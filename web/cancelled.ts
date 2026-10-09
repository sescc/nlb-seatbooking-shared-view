// "Show cancelled" preference: a per-browser setting kept in localStorage under "showCancelled" ('1' / '0'),
// default hidden. Mirrors theme.ts: environment-specific parts (storage, document) are injected so this is
// unit-testable with fakes, and every storage access is wrapped, so a blocked store just means "hidden".
// The per-day reveal overrides live only in the ViewPrefs object (memory); a reload drops them.
// The same file holds the other per-browser view pref, the open/closed state of the page's "Key" legend (key "legendOpen").
import type { ViewPrefs } from './render';
import type { ThemeStorage } from './theme';

export const SHOW_CANCELLED_KEY = 'showCancelled';
export const SHOW_CANCELLED_ID = 'show-cancelled';

type MaybeStorage = ThemeStorage | null | undefined;

// `undefined` = use the page's localStorage (which may be absent or throw); `null` = no storage at all.
function pick(storage: MaybeStorage): ThemeStorage | null {
  if (storage !== undefined) return storage;
  try {
    return (globalThis as { localStorage?: ThemeStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadShowCancelled(storage?: MaybeStorage): boolean {
  try {
    return pick(storage)?.getItem(SHOW_CANCELLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveShowCancelled(v: boolean, storage?: MaybeStorage): void {
  try {
    pick(storage)?.setItem(SHOW_CANCELLED_KEY, v ? '1' : '0');
  } catch {
    /* storage unavailable: the choice just won't survive a reload */
  }
}

/** The checkbox, as static markup (wired by `wireCancelledControl`). */
export function cancelledControlHtml(): string {
  return `<label class="cb"><input type="checkbox" id="${SHOW_CANCELLED_ID}"> Show cancelled</label>`;
}

interface CheckboxLike {
  checked: boolean;
  addEventListener(type: 'change', fn: () => void): void;
}
interface ContainerLike {
  addEventListener(type: 'click', fn: (e: { target: unknown }) => void): void;
}
interface CountButton {
  dataset: Record<string, string | undefined>;
}

/**
 * The checkbox sets the default for both days, saves it and clears every per-day reveal. A click on a day's
 * count button (delegated on #app, which is re-rendered via innerHTML) reveals or hides that date only.
 */
export function wireCancelledControl(
  doc: { getElementById(id: string): unknown },
  prefs: ViewPrefs,
  rerender: () => void,
  storage?: MaybeStorage,
): void {
  const box = doc.getElementById(SHOW_CANCELLED_ID) as CheckboxLike | null;
  const app = doc.getElementById('app') as ContainerLike | null;
  if (box) {
    box.checked = prefs.showCancelled;
    box.addEventListener('change', () => {
      prefs.showCancelled = box.checked;
      saveShowCancelled(prefs.showCancelled, storage);
      prefs.reveal = {};
      rerender();
    });
  }
  app?.addEventListener('click', (e) => {
    const target = e.target as { closest?: (sel: string) => CountButton | null } | null;
    const btn = target?.closest?.('button.cnt') ?? null;
    const date = btn?.dataset.date;
    if (!btn || !date) return;
    prefs.reveal[date] = btn.dataset.reveal === '1';
    rerender();
  });
}

export const LEGEND_OPEN_KEY = 'legendOpen';

export function loadLegendOpen(storage?: MaybeStorage): boolean {
  try {
    return pick(storage)?.getItem(LEGEND_OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveLegendOpen(v: boolean, storage?: MaybeStorage): void {
  try {
    pick(storage)?.setItem(LEGEND_OPEN_KEY, v ? '1' : '0');
  } catch {
    /* storage unavailable: the choice just won't survive a reload */
  }
}

interface ToggleContainer {
  addEventListener(type: 'toggle', fn: (e: { target: unknown }) => void, capture: boolean): void;
}
interface DetailsLike {
  open: boolean;
}

/**
 * The legend is a <details class="key"> inside #app, which is re-rendered via innerHTML; the next render reads
 * prefs.legendOpen, so this only records the choice (no repaint). `toggle` does not bubble: listen in the capture phase.
 */
export function wireLegendControl(doc: { getElementById(id: string): unknown }, prefs: ViewPrefs, storage?: MaybeStorage): void {
  const app = doc.getElementById('app') as ToggleContainer | null;
  app?.addEventListener(
    'toggle',
    (e) => {
      const target = e.target as { closest?: (sel: string) => DetailsLike | null } | null;
      const details = target?.closest?.('details.key') ?? null;
      if (!details) return;
      prefs.legendOpen = details.open;
      saveLegendOpen(details.open, storage);
    },
    true,
  );
}
