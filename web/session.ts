// Small pure helpers for the viewer's browser session. No globals: app.ts passes the real ones in.
import { msToSgtIso } from '../shared/src/time';
import type { Board } from '../shared/src/types';

/** The view secret from the page path `/v/<secret>`; null when the path has another shape. */
export function secretFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/v\/([^/]+)\/?$/);
  return m ? m[1]! : null;
}

export const boardUrl = (secret: string) => `/api/${secret}/board`;

/**
 * "Now" for rendering: the server's clock at fetch time plus local time elapsed since, so a wrong device
 * clock cannot make staleness or Today/Tomorrow wrong. Elapsed time never goes negative.
 */
export function estimateNow(serverNow: string, fetchedAtLocalMs: number, localNowMs: number): string {
  const elapsed = Math.max(0, localNowMs - fetchedAtLocalMs);
  return msToSgtIso(Date.parse(serverNow) + elapsed);
}

export function parsePushedParam(search: string): string | null {
  const v = new URLSearchParams(search).get('pushed');
  return v ? v : null;
}

export function urlWithoutPushed(pathname: string, search: string, hash: string): string {
  const params = new URLSearchParams(search);
  params.delete('pushed');
  const qs = params.toString();
  return pathname + (qs ? `?${qs}` : '') + hash;
}

export const TOAST_MS = 4000;

export interface PushedToastDeps {
  search: string;
  pathname: string;
  hash: string;
  show: (text: string) => void;
  hide: () => void;
  replaceUrl: (url: string) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
}

/**
 * `?pushed=<personId>` (the redirect after a bookmarklet push): once the first board is known, show
 * "Pushed ✓ <name>" for 4 s, then drop the query with history.replaceState. Shows at most once.
 */
export function createPushedToast(deps: PushedToastDeps): { onBoard(board: Board): void } {
  const id = parsePushedParam(deps.search);
  let done = id === null;
  return {
    onBoard(board) {
      if (done || id === null) return;
      done = true;
      const name = board.people.find((p) => p.id === id)?.name;
      deps.show(name ? `Pushed ✓ ${name}` : 'Pushed ✓');
      deps.setTimeout(() => {
        deps.hide();
        deps.replaceUrl(urlWithoutPushed(deps.pathname, deps.search, deps.hash));
      }, TOAST_MS);
    },
  };
}
