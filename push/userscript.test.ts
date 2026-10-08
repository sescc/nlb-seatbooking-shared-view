import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NLB_ROW_KEYS } from '../shared/src/booking';
import { FAKE_PROFILE, VISIT_BOOKING, nlbRoomRow, nlbSeatRow } from '../shared/src/fixtures';
import { ingestRows } from '../shared/src/payload';
import { DEBOUNCE_MS, startUserscript, type Store, type UserscriptDeps } from './userscript';

const ORIGIN = 'https://worker.example.test';
const TOKEN = 'tok-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

type Handler = (mutation: unknown, state: Store['state']) => void;

class FakeStore implements Store {
  handlers: Handler[] = [];
  constructor(public state: Store['state']) {}
  subscribe(fn: Handler): () => void {
    this.handlers.push(fn);
    return () => {};
  }
  // Simulates a Vuex mutation that sets a new state.
  commit(next: Store['state']): void {
    this.state = next;
    for (const h of this.handlers) h({ type: 'whatever' }, this.state);
  }
}

const loggedIn = (bookings: unknown[] = [nlbSeatRow()]) => ({
  accountInfo: { ...FAKE_PROFILE, bookings, visitBookings: [VISIT_BOOKING] },
});

interface Sent {
  method: string;
  url: string;
  headers: Record<string, string>;
  data: string;
  respond(status: number): void;
  fail(): void;
}

function setup(opts: { store?: () => Store | undefined } = {}) {
  const sent: Sent[] = [];
  const toasts: string[] = [];
  let store: Store | undefined;
  const getStore = vi.fn(opts.store ?? (() => store));
  const deps: UserscriptDeps = {
    origin: ORIGIN,
    token: TOKEN,
    getStore,
    xhr: (d) =>
      void sent.push({
        method: d.method,
        url: d.url,
        headers: d.headers,
        data: d.data,
        respond: (status) => d.onload({ status }),
        fail: () => d.onerror(),
      }),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    toast: (t) => void toasts.push(t),
  };
  return {
    sent,
    toasts,
    getStore,
    setStore: (s: Store) => (store = s),
    start: () => startUserscript(deps),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('userscript: initial push', () => {
  it('pushes once on load when logged in, after the debounce', () => {
    const t = setup();
    t.setStore(new FakeStore(loggedIn()));
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(t.sent).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(t.sent).toHaveLength(1);
  });

  it('does not push when not logged in (no bookings array)', () => {
    const t = setup();
    t.setStore(new FakeStore({ accountInfo: null }));
    t.start();
    vi.advanceTimersByTime(60_000);
    expect(t.sent).toHaveLength(0);
  });

  it('DEBOUNCE_MS is 3 s', () => {
    expect(DEBOUNCE_MS).toBe(3000);
  });
});

describe('userscript: request', () => {
  it('POSTs a JSON array of trimmed rows to the push URL via GM_xmlhttpRequest details', () => {
    const t = setup();
    t.setStore(new FakeStore(loggedIn([nlbSeatRow(), nlbRoomRow()])));
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    const r = t.sent[0]!;
    expect(r.method).toBe('POST');
    expect(r.url).toBe(`${ORIGIN}/push/${TOKEN}`);
    expect(r.headers['Content-Type']).toBe('application/json');
    const rows = JSON.parse(r.data);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
    expect(r.data).not.toContain('pushedAt');
    for (const row of rows) for (const k of Object.keys(row)) expect(NLB_ROW_KEYS as readonly string[]).toContain(k);
    expect(ingestRows(rows).ok).toBe(true);
  });

  it('sends bookings only: no profile data, no visit bookings', () => {
    const t = setup();
    t.setStore(new FakeStore(loggedIn()));
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    const data = t.sent[0]!.data;
    for (const v of Object.values(FAKE_PROFILE)) expect(data).not.toContain(v);
    expect(data).not.toContain(String(VISIT_BOOKING.bookingRefId));
  });

  it('shows "pushed ✓" on 204', () => {
    const t = setup();
    t.setStore(new FakeStore(loggedIn()));
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    t.sent[0]!.respond(204);
    expect(t.toasts).toEqual(['pushed ✓']);
  });

  it('shows a failure toast on an error status or a network error, and stays silent on 429', () => {
    const t = setup();
    const store = new FakeStore(loggedIn());
    t.setStore(store);
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    t.sent[0]!.respond(500);
    expect(t.toasts).toEqual(['push failed (500)']);

    store.commit(loggedIn([nlbSeatRow({ bookingRefId: 'N2' })]));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    t.sent[1]!.fail();
    expect(t.toasts[1]).toBe('push failed');

    store.commit(loggedIn([nlbSeatRow({ bookingRefId: 'N3' })]));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    t.sent[2]!.respond(429);
    expect(t.toasts).toHaveLength(2);
  });
});

describe('userscript: store subscription', () => {
  it('pushes again when state.accountInfo.bookings changes', () => {
    const t = setup();
    const store = new FakeStore(loggedIn([nlbSeatRow()]));
    t.setStore(store);
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(t.sent).toHaveLength(1);

    store.commit(loggedIn([nlbSeatRow(), nlbRoomRow()]));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(t.sent).toHaveLength(2);
    expect(JSON.parse(t.sent[1]!.data)).toHaveLength(2);
  });

  it('debounces a burst of changes into one push carrying the latest state', () => {
    const t = setup();
    const store = new FakeStore(loggedIn([]));
    t.setStore(store);
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    t.sent.length = 0;

    store.commit(loggedIn([nlbSeatRow({ bookingRefId: 'B1' })]));
    vi.advanceTimersByTime(1000);
    store.commit(loggedIn([nlbSeatRow({ bookingRefId: 'B2' })]));
    vi.advanceTimersByTime(1000);
    store.commit(loggedIn([nlbSeatRow({ bookingRefId: 'B3' })]));
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(t.sent).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(t.sent).toHaveLength(1);
    expect(JSON.parse(t.sent[0]!.data).map((b: { bookingRefId: string }) => b.bookingRefId)).toEqual(['B3']);
  });

  it('ignores mutations that do not replace the bookings', () => {
    const t = setup();
    const state = loggedIn();
    const store = new FakeStore(state);
    t.setStore(store);
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    t.sent.length = 0;

    store.commit({ ...state, somethingElse: 1 } as Store['state']); // same bookings reference
    vi.advanceTimersByTime(60_000);
    expect(t.sent).toHaveLength(0);
  });

  it('pushes when the user logs in after the page loaded', () => {
    const t = setup();
    const store = new FakeStore({ accountInfo: null });
    t.setStore(store);
    t.start();
    vi.advanceTimersByTime(10_000);
    expect(t.sent).toHaveLength(0);
    store.commit(loggedIn());
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(t.sent).toHaveLength(1);
  });

  it('does not push when bookings disappear (logout), so a logout never clears the lane', () => {
    const t = setup();
    const store = new FakeStore(loggedIn());
    t.setStore(store);
    t.start();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    t.sent.length = 0;
    store.commit({ accountInfo: null });
    vi.advanceTimersByTime(60_000);
    expect(t.sent).toHaveLength(0);
  });
});

describe('userscript: waiting for the store', () => {
  it('polls until the Vuex store appears, then proceeds', () => {
    const store = new FakeStore(loggedIn());
    let calls = 0;
    const t = setup({ store: () => (++calls > 3 ? store : undefined) });
    t.start();
    vi.advanceTimersByTime(10_000);
    expect(t.sent).toHaveLength(1);
    expect(t.getStore.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('gives up after about a minute instead of polling forever', () => {
    const t = setup({ store: () => undefined });
    t.start();
    vi.advanceTimersByTime(120_000);
    const callsAtGiveUp = t.getStore.mock.calls.length;
    vi.advanceTimersByTime(120_000);
    expect(t.getStore.mock.calls.length).toBe(callsAtGiveUp);
    expect(t.sent).toHaveLength(0);
  });
});
