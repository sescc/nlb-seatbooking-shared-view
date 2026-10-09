// Browser entry for the shared viewer (bundled to one IIFE by scripts/build.mjs and inlined behind a CSP nonce).
// Holds no state beyond the last Board: every paint is render(lastBoard, estimatedNow).
//   - polls /api/<secret>/board every 5 s while the tab is visible, immediately when it becomes visible;
//   - the 'Show cancelled' prefs (storage + per-day reveals) and the 'Key' legend state are view state only: render(board, now, prefs);
//   - after the first paint only, Today's timeline is scrolled so the now-line is centred (when it scrolls sideways);
//   - re-renders every 30 s from the last board so "X min ago" and "unverified" tick without a new push;
//   - on a fetch failure keeps the last render and quietly shows "Can't reach server";
//   - ?pushed=<personId> shows a "Pushed ✓ <name>" toast for 4 s, then removes the query.
import type { Board } from '../shared/src/types';
import { createPoller } from './poller';
import { loadLegendOpen, loadShowCancelled, wireCancelledControl, wireLegendControl } from './cancelled';
import { render, type ViewPrefs } from './render';
import { centreNow } from './scroll';
import { boardUrl, createPushedToast, estimateNow, secretFromPath } from './session';
import { wireThemeControl } from './theme';

const REPAINT_MS = 30_000;

function isBoard(x: unknown): x is Board {
  const b = x as Board | null;
  return !!b && typeof b.serverNow === 'string' && Array.isArray(b.people) && typeof b.snapshots === 'object' && b.snapshots !== null;
}

function main(): void {
  const appEl = document.getElementById('app')!;
  const connEl = document.getElementById('conn')!;
  const toastEl = document.getElementById('toast')!;

  // Theme control: per-browser preference, applied before first paint by the inline head script.
  const themeEl = document.getElementById('theme');
  if (themeEl) {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* blocked: the control still works for this page view */
    }
    wireThemeControl({
      container: themeEl,
      root: document.documentElement,
      storage,
      buttons: Array.from(themeEl.querySelectorAll<HTMLButtonElement>('button[data-theme-choice]')),
    });
  }

  // "Show cancelled": per-browser default (hidden) plus in-memory per-day reveals; both only change the paint.
  const prefs: ViewPrefs = { showCancelled: loadShowCancelled(), reveal: {}, legendOpen: loadLegendOpen() };

  const secret = secretFromPath(location.pathname);
  let board: Board | null = null;
  let fetchedAtLocal = 0;

  let lastHtml = '';
  let centred = false; // the now-line is brought into view after the first paint only, never on later ones
  const paint = () => {
    if (!board) return;
    const html = render(board, estimateNow(board.serverNow, fetchedAtLocal, Date.now()), prefs);
    if (html === lastHtml) return; // identical paint: keep scroll positions and selections
    lastHtml = html;
    const scrolls = Array.from(appEl.querySelectorAll('.tl-scroll, .list-scroll'), (el) => el.scrollLeft);
    appEl.innerHTML = html;
    appEl.querySelectorAll('.tl-scroll, .list-scroll').forEach((el, i) => {
      el.scrollLeft = scrolls[i] ?? 0;
    });
    if (!centred) {
      centred = true;
      centreNow(appEl.querySelector('[data-day="today"] .tl-scroll'));
    }
  };

  wireCancelledControl(document, prefs, () => {
    lastHtml = ''; // force a repaint even when the board is unchanged
    paint();
  });
  wireLegendControl(document, prefs); // records the open state only; the next paint reads it

  const toast = createPushedToast({
    search: location.search,
    pathname: location.pathname,
    hash: location.hash,
    show: (text) => {
      toastEl.textContent = text;
      toastEl.hidden = false;
    },
    hide: () => {
      toastEl.hidden = true;
    },
    replaceUrl: (url) => history.replaceState(null, '', url),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  });

  if (secret === null) {
    connEl.hidden = false;
    return;
  }

  const poller = createPoller<Board>({
    fetchBoard: async () => {
      const res = await fetch(boardUrl(secret), { cache: 'no-store', headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`board ${res.status}`);
      const json: unknown = await res.json();
      if (!isBoard(json)) throw new Error('bad board');
      return json;
    },
    doc: document,
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    onBoard: (b) => {
      board = b;
      fetchedAtLocal = Date.now();
      connEl.hidden = true;
      paint();
      toast.onBoard(b);
    },
    onError: () => {
      connEl.hidden = false; // keep the last render
    },
  });

  poller.start();
  window.setInterval(paint, REPAINT_MS);
}

if (typeof document !== 'undefined') main();
