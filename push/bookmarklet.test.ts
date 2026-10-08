import { describe, expect, it, vi } from 'vitest';
import { NLB_ROW_KEYS } from '../shared/src/booking';
import {
  FAKE_PROFILE,
  VISIT_BOOKING,
  accountInfoResponse,
  nlbRoomRow,
  nlbSeatRow,
} from '../shared/src/fixtures';
import { ingestRows } from '../shared/src/payload';
import { LOGIN_MESSAGE, runBookmarklet } from './bookmarklet';
import { ACCOUNT_API, pushUrl, showMessage } from './common';
import { FakeDocument } from './testing';

const ORIGIN = 'https://worker.example.test';
const TOKEN = 'tok-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

type FetchFn = typeof fetch;
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setup(opts: { fetch?: (url: string, init?: RequestInit) => Promise<Response> } = {}) {
  const doc = new FakeDocument();
  const fetchFn = vi.fn(opts.fetch ?? (async () => jsonResponse(accountInfoResponse([nlbSeatRow()]))));
  const alertFn = vi.fn<(m: string) => void>();
  const run = () =>
    runBookmarklet(ORIGIN, TOKEN, doc.asDocument(), fetchFn as unknown as FetchFn, alertFn);
  return { doc, fetchFn, alertFn, run };
}

describe('pushUrl', () => {
  it('joins origin and token, ignoring a trailing slash on the origin', () => {
    expect(pushUrl(ORIGIN, TOKEN)).toBe(`${ORIGIN}/push/${TOKEN}`);
    expect(pushUrl(`${ORIGIN}/`, TOKEN)).toBe(`${ORIGIN}/push/${TOKEN}`);
  });
});

describe('bookmarklet: logged in', () => {
  it('reads GetAccountInfo same-origin (relative URL, session credentials), once, read-only', async () => {
    const { fetchFn, run } = setup();
    await run();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(ACCOUNT_API);
    expect(url.startsWith('/')).toBe(true);
    expect(init?.credentials).toBe('include');
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('submits a POST form to the push URL in a new tab, with utf-8 charset and one field named rows', async () => {
    const { doc, alertFn, run } = setup();
    await run();
    expect(alertFn).not.toHaveBeenCalled();
    expect(doc.submissions).toHaveLength(1);
    const s = doc.submissions[0]!;
    expect(s.action).toBe(`${ORIGIN}/push/${TOKEN}`);
    expect(s.method.toUpperCase()).toBe('POST');
    expect(s.target).toBe('_blank');
    expect(s.attrs['accept-charset']).toBe('utf-8');
    expect(Object.keys(s.fields)).toEqual(['rows']);
  });

  it('the rows field is a bare JSON array (no version, no device clock) of whitelisted keys only', async () => {
    const { doc, run } = setup({
      fetch: async () => jsonResponse(accountInfoResponse([nlbSeatRow(), nlbRoomRow()], [VISIT_BOOKING])),
    });
    await run();
    const raw = doc.submissions[0]!.fields.rows!;
    const rows = JSON.parse(raw) as Record<string, unknown>[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      for (const k of Object.keys(row)) expect(NLB_ROW_KEYS as readonly string[]).toContain(k);
    }
    expect(raw).not.toContain('pushedAt');
    expect(raw).not.toContain('"v"');
  });

  it('profile data and visit bookings never appear in the request', async () => {
    const { doc, run } = setup({
      fetch: async () => jsonResponse(accountInfoResponse([nlbSeatRow(), nlbRoomRow()], [VISIT_BOOKING])),
    });
    await run();
    const raw = JSON.stringify(doc.submissions);
    for (const v of Object.values(FAKE_PROFILE)) expect(raw).not.toContain(v);
    expect(raw).not.toContain(String(VISIT_BOOKING.bookingRefId));
    expect(raw).not.toContain('areaImageUrls');
    expect(raw).not.toContain('canCancelStatus');
  });

  it('what it sends is exactly what the server accepts (round-trip through ingestRows)', async () => {
    const { doc, run } = setup({ fetch: async () => jsonResponse(accountInfoResponse([nlbSeatRow(), nlbRoomRow()])) });
    await run();
    const r = ingestRows(JSON.parse(doc.submissions[0]!.fields.rows!));
    expect(r.ok && r.payload.bookings.map((b) => b.kind)).toEqual(['seat', 'room']);
  });

  it('removes the form from the page after submitting', async () => {
    const { doc, run } = setup();
    await run();
    expect(doc.body.children).toEqual([]);
  });

  it('an account with no bookings pushes an empty array (clears the lane)', async () => {
    const { doc, alertFn, run } = setup({ fetch: async () => jsonResponse(accountInfoResponse([])) });
    await run();
    expect(alertFn).not.toHaveBeenCalled();
    expect(JSON.parse(doc.submissions[0]!.fields.rows!)).toEqual([]);
  });
});

describe('bookmarklet: logged out or broken', () => {
  const expectLoginAlert = (t: ReturnType<typeof setup>) => {
    expect(t.doc.submissions).toEqual([]);
    expect(t.alertFn).toHaveBeenCalledTimes(1);
    expect(t.alertFn).toHaveBeenCalledWith(LOGIN_MESSAGE);
  };

  it('the message is exactly "Log in to NLB first"', () => {
    expect(LOGIN_MESSAGE).toBe('Log in to NLB first');
  });

  it.each([
    ['HTTP 401 with an empty JSON object', async () => jsonResponse({}, 401)],
    ['accountInfo: null', async () => jsonResponse({ settings: {}, accountInfo: null })],
    ['accountInfo without a bookings array', async () => jsonResponse({ accountInfo: { ...FAKE_PROFILE } })],
    ['bookings that is not an array', async () => jsonResponse({ accountInfo: { bookings: 'x' } })],
    ['a non-JSON response', async () => new Response('<html>login</html>', { status: 200 })],
    [
      'a network error',
      async (): Promise<Response> => {
        throw new TypeError('network');
      },
    ],
  ])('alerts and sends nothing on %s', async (_label, fetchImpl) => {
    const t = setup({ fetch: fetchImpl });
    await t.run();
    expectLoginAlert(t);
  });

  it('a partial account never pushes (it would clear the lane)', async () => {
    const t = setup({ fetch: async () => jsonResponse({ accountInfo: { bookings: undefined } }) });
    await t.run();
    expectLoginAlert(t);
  });
});

describe('showMessage (userscript toast; CSSOM-only styling)', () => {
  it('is styled via element.style only (the fake DOM throws on style attributes, <style>, innerHTML)', () => {
    const doc = new FakeDocument();
    showMessage(doc.asDocument(), 'hi');
    const el = doc.body.children[0]!;
    expect(el.style.position).toBe('fixed');
    expect(Object.keys(el.style).length).toBeGreaterThan(3);
    expect(doc.created).not.toContain('style');
  });

  it('removes itself after the timeout and on click', () => {
    vi.useFakeTimers();
    try {
      const doc = new FakeDocument();
      showMessage(doc.asDocument(), 'hello', { ms: 1000 });
      expect(doc.body.children).toHaveLength(1);
      vi.advanceTimersByTime(1000);
      expect(doc.body.children).toHaveLength(0);

      showMessage(doc.asDocument(), 'again');
      doc.body.children[0]!.onclick?.();
      expect(doc.body.children).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('replaces an earlier message instead of stacking', () => {
    const doc = new FakeDocument();
    showMessage(doc.asDocument(), 'one');
    showMessage(doc.asDocument(), 'two');
    expect(doc.body.children).toHaveLength(1);
    expect(doc.visibleText()).toContain('two');
    expect(doc.visibleText()).not.toContain('one');
  });
});
