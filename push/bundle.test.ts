// Runs the REAL bundled push clients, exactly as the Worker serves them (templated with an origin
// and token), against fake browser globals. Proves the esbuild bundle + /setup wrapping work end to end.
import { describe, expect, it } from 'vitest';
import { NLB_ROW_KEYS } from '../shared/src/booking';
import { ingestRows } from '../shared/src/payload';
import { FAKE_PROFILE, VISIT_BOOKING, accountInfoResponse, nlbRoomRow, nlbSeatRow } from '../shared/src/fixtures';
import { bookmarkletUrl, userscriptFile } from '../worker/src/pages';
import { FakeDocument } from './testing';

const ORIGIN = 'https://worker.example.test';
const TOKEN = 'push-token-aaaaaaaaaaaaaaaaaaaa';
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('served bookmarklet, executed', () => {
  const code = decodeURIComponent(bookmarkletUrl(ORIGIN, TOKEN).slice('javascript:'.length));
  const runWith = async (fetchStub: (url: string) => Promise<unknown>) => {
    const doc = new FakeDocument();
    const alerts: string[] = [];
    new Function('document', 'fetch', 'alert', code)(doc, fetchStub, (m: string) => alerts.push(m));
    await flush();
    return { doc, alerts };
  };

  it('logged in: submits the trimmed rows to this deployment with this token', async () => {
    const calls: string[] = [];
    const { doc, alerts } = await runWith(async (url) => {
      calls.push(url);
      return { json: async () => accountInfoResponse([nlbSeatRow(), nlbRoomRow()], [VISIT_BOOKING]) };
    });
    expect(calls).toEqual(['/seatbooking/api/accounts/GetAccountInfo']);
    expect(alerts).toEqual([]);
    expect(doc.submissions).toHaveLength(1);
    const s = doc.submissions[0]!;
    expect(s.action).toBe(`${ORIGIN}/push/${TOKEN}`);
    expect(s.method.toUpperCase()).toBe('POST');
    expect(s.target).toBe('_blank');
    expect(s.attrs['accept-charset']).toBe('utf-8');
    const raw = s.fields.rows!;
    const rows = JSON.parse(raw) as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    for (const row of rows) for (const k of Object.keys(row)) expect(NLB_ROW_KEYS as readonly string[]).toContain(k);
    expect(ingestRows(rows).ok).toBe(true);
    for (const v of Object.values(FAKE_PROFILE)) expect(raw).not.toContain(v);
    expect(raw).not.toContain(String(VISIT_BOOKING.bookingRefId));
  });

  it('logged out: alerts "Log in to NLB first" and sends nothing', async () => {
    const { doc, alerts } = await runWith(async () => ({ json: async () => ({}) }));
    expect(doc.submissions).toEqual([]);
    expect(alerts).toEqual(['Log in to NLB first']);
  });

  it('does not define any global (no pollution of the NLB page)', async () => {
    const before = Object.getOwnPropertyNames(globalThis).sort();
    await runWith(async () => ({ json: async () => accountInfoResponse([]) }));
    expect(Object.getOwnPropertyNames(globalThis).sort()).toEqual(before);
  });
});
describe('served userscript, executed', () => {
  const file = userscriptFile({ origin: ORIGIN, viewSecret: 'v'.repeat(24), person: { id: 'a', name: 'A', pushToken: TOKEN } });
  const code = file.slice(file.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length);

  it('waits for the store, pushes once on load after 3 s, and toasts "pushed ✓"', () => {
    const timers: { fn: () => void; at: number }[] = [];
    let now = 0;
    const doc = new FakeDocument();
    const sent: { url: string; data: string; headers: Record<string, string>; onload: (r: { status: number }) => void }[] = [];
    const state = { accountInfo: { ...FAKE_PROFILE, bookings: [nlbSeatRow()], visitBookings: [VISIT_BOOKING] } };
    let storeVisible = false;
    const unsafeWindow = {
      document: {
        querySelector: (sel: string) =>
          sel === '#app' && storeVisible ? { __vue__: { $store: { state, subscribe: () => () => {} } } } : null,
      },
    };
    const advance = (ms: number) => {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        now = next.at;
        next.fn();
      }
      now = end;
    };

    new Function('document', 'unsafeWindow', 'GM_xmlhttpRequest', 'setTimeout', 'clearTimeout', code)(
      doc,
      unsafeWindow,
      (d: (typeof sent)[number]) => void sent.push(d),
      (fn: () => void, ms: number) => {
        const t = { fn, at: now + ms };
        timers.push(t);
        return t;
      },
      (t: { fn: () => void }) => {
        const i = timers.indexOf(t as never);
        if (i >= 0) timers.splice(i, 1);
      },
    );

    advance(2_000);
    expect(sent).toHaveLength(0); // store not there yet
    storeVisible = true;
    advance(1_000); // store found
    expect(sent).toHaveLength(0); // debounce still running
    advance(3_000);
    expect(sent).toHaveLength(1);

    const req = sent[0]!;
    expect(req.url).toBe(`${ORIGIN}/push/${TOKEN}`);
    expect(req.headers['Content-Type']).toBe('application/json');
    const rows = JSON.parse(req.data) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    for (const k of Object.keys(rows[0]!)) expect(NLB_ROW_KEYS as readonly string[]).toContain(k);
    expect(ingestRows(rows).ok).toBe(true);
    for (const v of Object.values(FAKE_PROFILE)) expect(req.data).not.toContain(v);
    expect(req.data).not.toContain(String(VISIT_BOOKING.bookingRefId));

    req.onload({ status: 204 });
    expect(doc.visibleText()).toContain('pushed ✓');
  });
});
