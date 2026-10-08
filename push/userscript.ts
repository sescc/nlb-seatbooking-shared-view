// Userscript realisation of the push client (T1': GM_xmlhttpRequest). Violentmonkey / Tampermonkey.
// It watches NLB's Vuex store and pushes after the bookings change (debounced), plus once on load.
// The Worker's /setup templating wraps this bundle in a function binding __NLBSV_ORIGIN__ / __NLBSV_TOKEN__.
import { trimRow } from '../shared/src/booking';
import { hasBookings, pushUrl, showMessage } from './common';

export const DEBOUNCE_MS = 3000;
const POLL_MS = 500;
const POLL_ATTEMPTS = 120; // about a minute

export interface Store {
  state: { accountInfo?: { bookings?: unknown } | null } & Record<string, unknown>;
  subscribe(fn: (mutation: unknown, state: Store['state']) => void): unknown;
}

export interface UserscriptDeps {
  origin: string;
  token: string;
  getStore: () => Store | undefined;
  xhr: (details: GmRequestDetails) => unknown;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  toast: (text: string) => void;
}

export function startUserscript(deps: UserscriptDeps): void {
  let store: Store | undefined;
  let lastBookings: unknown;
  let timer: unknown;

  const push = (): void => {
    const info = store?.state.accountInfo;
    if (!hasBookings(info)) return; // logged out: never push (it would clear the lane)
    deps.xhr({
      method: 'POST',
      url: pushUrl(deps.origin, deps.token),
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(info.bookings.map(trimRow)), // trimmed raw rows; the server runs extract
      timeout: 15_000,
      onload: (r) => {
        if (r.status === 204) deps.toast('pushed ✓');
        else if (r.status !== 429) deps.toast(`push failed (${r.status})`);
      },
      onerror: () => deps.toast('push failed'),
      ontimeout: () => deps.toast('push failed'),
    });
  };

  const schedule = (): void => {
    if (timer !== undefined) deps.clearTimeout(timer);
    timer = deps.setTimeout(() => {
      timer = undefined;
      push();
    }, DEBOUNCE_MS);
  };

  const attach = (s: Store): void => {
    store = s;
    lastBookings = s.state.accountInfo?.bookings;
    if (hasBookings(s.state.accountInfo)) schedule(); // once on load when logged in
    s.subscribe((_mutation, state) => {
      const current = state.accountInfo?.bookings;
      if (current === lastBookings) return;
      lastBookings = current;
      if (Array.isArray(current)) schedule();
    });
  };

  let attempts = 0;
  const waitForStore = (): void => {
    const s = deps.getStore();
    if (s) return attach(s);
    if (++attempts < POLL_ATTEMPTS) deps.setTimeout(waitForStore, POLL_MS);
  };
  waitForStore();
}

// Auto-run only inside the generated userscript, where the Worker has bound the two names.
if (typeof __NLBSV_ORIGIN__ !== 'undefined' && typeof GM_xmlhttpRequest !== 'undefined') {
  startUserscript({
    origin: __NLBSV_ORIGIN__,
    token: __NLBSV_TOKEN__,
    getStore: () => {
      const app = unsafeWindow.document.querySelector('#app') as { __vue__?: { $store?: Store } } | null;
      return app?.__vue__?.$store;
    },
    xhr: (details) => GM_xmlhttpRequest(details),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    toast: (text) => showMessage(document, text, { corner: true, ms: 2500 }),
  });
}
