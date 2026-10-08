import { env } from 'cloudflare:workers';
import { SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trimRow } from '../../shared/src/booking';
import { FAKE_PROFILE, VISIT_BOOKING, accountInfoResponse, nlbRoomRow, nlbSeatRow } from '../../shared/src/fixtures';
import type { Board } from '../../shared/src/types';
import { handle } from './router';

const ORIGIN = 'https://worker.example.test';
const VIEW = env.VIEW_SECRET;
const PEOPLE = JSON.parse(env.PEOPLE) as { id: string; name: string; pushToken: string }[];
const [A, B] = PEOPLE as [(typeof PEOPLE)[number], (typeof PEOPLE)[number]];

// A strictly increasing fake clock, so successive pushes never trip the 2 s rate limit by accident.
let clock = Date.parse('2026-10-08T10:00:00+08:00');
const tick = () => (clock += 10_000);
const sgt = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 19) + '+08:00';

const call = (path: string, init?: RequestInit, nowMs = tick()) => handle(new Request(ORIGIN + path, init), env, nowMs);
// A push body is a JSON array of trimmed raw NLB rows (no version, no device clock).
const booking = ({ ref = 'NLB0001S00001', ...rest }: Record<string, unknown> = {}) => trimRow(nlbSeatRow({ bookingRefId: ref, ...rest }));
const payloadFor = (rows: Record<string, unknown>[] = [booking()], _ignored?: number) => rows;
const postJson = (token: string, body: unknown, nowMs = tick()) =>
  call(`/push/${token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, nowMs);
const postForm = (token: string, body: unknown, nowMs = tick()) =>
  call(
    `/push/${token}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ rows: JSON.stringify(body) }).toString(),
    },
    nowMs,
  );
const readBoard = async (): Promise<Board> => (await call(`/api/${VIEW}/board`)).json();

const GUARD = {
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};
const expectGuard = (res: Response, label = '') => {
  for (const [k, v] of Object.entries(GUARD)) expect(res.headers.get(k), `${label} ${k}`).toBe(v);
};
const headerEntries = (res: Response) => [...res.headers.entries()].filter(([k]) => k !== 'date').sort();

afterEach(() => vi.restoreAllMocks());

describe('routes', () => {
  it('GET /v/<view> serves the viewer page', async () => {
    const res = await call(`/v/${VIEW}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('<script');
  });

  it('GET /api/<view>/board returns the Board as no-store JSON without tokens', async () => {
    const res = await call(`/api/${VIEW}/board`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toContain('application/json');
    const text = await res.text();
    const board = JSON.parse(text) as Board;
    expect(board.people).toEqual(PEOPLE.map(({ id, name }) => ({ id, name })));
    expect(Object.keys(board.snapshots).sort()).toEqual(PEOPLE.map((p) => p.id).sort());
    expect(board.serverNow).toMatch(/\+08:00$/);
    for (const p of PEOPLE) expect(text).not.toContain(p.pushToken);
    expect(text).not.toContain(VIEW);
  });

  it('GET /robots.txt disallows everything', async () => {
    const res = await call('/robots.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('User-agent: *\nDisallow: /');
  });

  it('GET /setup/<view> lists every person with their own token and this origin', async () => {
    const res = await call(`/setup/${VIEW}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    for (const p of PEOPLE) {
      expect(body).toContain(p.name);
      expect(body).toContain(p.pushToken);
      expect(body).toContain(`${ORIGIN}/setup/${VIEW}/${p.id}.user.js`);
    }
    expect(body).toContain(ORIGIN);
  });

  it('GET /setup/<view>/<id>.user.js serves the userscript as text/javascript', async () => {
    const res = await call(`/setup/${VIEW}/${B.id}.user.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/javascript');
    const body = await res.text();
    expect(body).toContain('// ==UserScript==');
    expect(body).toContain(B.pushToken);
    expect(body).not.toContain(A.pushToken);
    expect(body).toContain('// @connect      worker.example.test');
    expect(body).toContain(`// @updateURL    ${ORIGIN}/setup/${VIEW}/${B.id}.user.js`);
    expect(body).toContain(`// @downloadURL  ${ORIGIN}/setup/${VIEW}/${B.id}.user.js`);
  });

  it('is wired as the Worker default export (SELF)', async () => {
    const robots = await SELF.fetch(`${ORIGIN}/robots.txt`);
    expect(robots.status).toBe(200);
    expectGuard(robots);
    const missing = await SELF.fetch(`${ORIGIN}/`);
    expect(missing.status).toBe(404);
    expectGuard(missing);
  });
});

describe('bare, byte-identical 404s', () => {
  const requests: [string, string, RequestInit?][] = [
    ['root', '/'],
    ['unknown path', '/anything'],
    ['wrong view secret (viewer)', '/v/not-the-secret'],
    ['empty view segment', '/v/'],
    ['extra segment after view', `/v/${VIEW}/extra`],
    ['trailing slash', `/v/${VIEW}/`],
    ['wrong view secret (api)', '/api/not-the-secret/board'],
    ['right secret, wrong api path', `/api/${VIEW}/other`],
    ['wrong view secret (setup)', '/setup/not-the-secret'],
    ['wrong view secret (userscript)', '/setup/not-the-secret/a.user.js'],
    ['unknown person userscript', `/setup/${VIEW}/zz.user.js`],
    ['userscript path with extra segment', `/setup/${VIEW}/a.user.js/x`],
    ['wrong push token', '/push/not-a-token', { method: 'POST', body: '{}' }],
    ['VIEW SECRET used as a push token', `/push/${VIEW}`, { method: 'POST', body: '{}' }],
    ['push token on GET', `/push/${A.pushToken}`],
    ['push with DELETE', `/push/${A.pushToken}`, { method: 'DELETE' }],
    ['POST to the viewer', `/v/${VIEW}`, { method: 'POST', body: '{}' }],
    ['POST to robots.txt', '/robots.txt', { method: 'POST', body: '{}' }],
    ['viewer HEAD', `/v/${VIEW}`, { method: 'HEAD' }],
    ['source map style path', '/assets/app.js.map'],
    ['git-ish path', '/.git/config'],
  ];

  it('are identical in status, headers (except date) and body for every kind of miss', async () => {
    const results = await Promise.all(
      requests.map(async ([label, path, init]) => {
        const res = await call(path, init);
        return { label, status: res.status, headers: headerEntries(res), body: await res.text() };
      }),
    );
    const first = results[0]!;
    expect(first.status).toBe(404);
    expect(first.body).toBe('');
    for (const r of results) {
      expect(r.status, r.label).toBe(404);
      expect(r.body, r.label).toBe('');
      expect(r.headers, r.label).toEqual(first.headers);
    }
  });

  it('a wrong token is a 404 even when the body is garbage (no token oracle)', async () => {
    const res = await call('/push/not-a-token', { method: 'POST', body: 'x'.repeat(100_000) });
    expect(res.status).toBe(404);
  });

  it('a misconfigured Worker (bad PEOPLE) answers every route with the same bare 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = { ...env, PEOPLE: 'not json' } as typeof env;
    for (const path of ['/', `/v/${VIEW}`, `/api/${VIEW}/board`, `/setup/${VIEW}`, '/robots.txt']) {
      const res = await handle(new Request(ORIGIN + path), bad, clock);
      expect(res.status, path).toBe(404);
      expect(await res.text()).toBe('');
      expectGuard(res, path);
    }
  });

  it('unexpected errors become an empty 500, still guarded, with no secret in the body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { ...env, BOARD: undefined } as unknown as typeof env;
    const res = await handle(new Request(`${ORIGIN}/api/${VIEW}/board`), broken, clock);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('');
    expectGuard(res);
  });
});

describe('guard headers on every response', () => {
  it('are set on success, error, redirect, no-content, rate-limit and 404 responses', async () => {
    const now = tick();
    const responses: [string, Response][] = [
      ['viewer', await call(`/v/${VIEW}`)],
      ['board', await call(`/api/${VIEW}/board`)],
      ['setup', await call(`/setup/${VIEW}`)],
      ['userscript', await call(`/setup/${VIEW}/a.user.js`)],
      ['robots', await call('/robots.txt')],
      ['404', await call('/nope')],
      ['303 form push', await postForm(A.pushToken, payloadFor())],
      ['204 json push', await postJson(B.pushToken, payloadFor())],
      ['429', await postJson(B.pushToken, payloadFor(), clock)], // same instant as the push above
      ['400 bad json', await call(`/push/${A.pushToken}`, { method: 'POST', body: '{nope' })],
      ['400 bad schema', await postJson(A.pushToken, { v: 2 })],
    ];
    expect(now).toBeLessThan(clock);
    const expected: Record<string, number> = {
      viewer: 200, board: 200, setup: 200, userscript: 200, robots: 200, '404': 404,
      '303 form push': 303, '204 json push': 204, '429': 429, '400 bad json': 400, '400 bad schema': 400,
    };
    for (const [label, res] of responses) {
      expect(res.status, label).toBe(expected[label]);
      expectGuard(res, label);
      expect(res.headers.get('cache-control'), label).toBe('no-store');
    }
  });

  it('HTML responses carry the CSP with a per-request nonce that matches the page', async () => {
    const nonces = new Set<string>();
    for (const path of [`/v/${VIEW}`, `/setup/${VIEW}`]) {
      const res = await call(path);
      const csp = res.headers.get('content-security-policy')!;
      const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
      expect(nonce, path).toBeTruthy();
      expect(nonce!.length).toBeGreaterThanOrEqual(16);
      expect(csp).toBe(
        `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; ` +
          `img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      );
      const body = await res.text();
      expect(body).toContain(`nonce="${nonce}"`);
      nonces.add(nonce!);
    }
    const again = await call(`/v/${VIEW}`);
    nonces.add(/nonce-([^']+)/.exec(again.headers.get('content-security-policy')!)![1]!);
    expect(nonces.size).toBe(3);
  });

  it('pages load no third-party resources and are marked noindex', async () => {
    for (const path of [`/v/${VIEW}`, `/setup/${VIEW}`]) {
      const body = await (await call(path)).text();
      expect(body).toMatch(/<meta name="robots" content="noindex/);
      const external = [...body.matchAll(/\b(?:src|href|action)=["'](https?:)?\/\/([^/"']+)/g)]
        .map((m) => m[2])
        .filter((host) => host !== 'worker.example.test');
      expect(external, path).toEqual([]);
      expect(body).not.toMatch(/<link[^>]+rel=["']stylesheet/);
    }
  });
});

describe('POST /push/<token>', () => {
  it('form push -> 303 to the viewer with ?pushed=<id>, and the snapshot is stored', async () => {
    const res = await postForm(A.pushToken, payloadFor([booking({ ref: 'FORM-1' })]));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/v/${VIEW}?pushed=${A.id}`);
    expect((await readBoard()).snapshots[A.id]?.bookings.map((b) => b.ref)).toEqual(['FORM-1']);
  });

  it('JSON push -> 204 with an empty body', async () => {
    const res = await postJson(B.pushToken, payloadFor([booking({ ref: 'JSON-1' })]));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect((await readBoard()).snapshots[B.id]?.bookings.map((b) => b.ref)).toEqual(['JSON-1']);
  });

  it('the server stamps receivedAt from its own clock; no device clock exists in the stored snapshot', async () => {
    const now = tick();
    await postJson(A.pushToken, payloadFor(), now);
    const snap = (await readBoard()).snapshots[A.id]!;
    expect(snap.receivedAt).toBe(sgt(now));
    expect(Object.keys(snap).sort()).toEqual(['bookings', 'personId', 'receivedAt']);
  });

  it('attributes the push to the token owner only', async () => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'ONLY-A' })]));
    await postJson(B.pushToken, payloadFor([booking({ ref: 'ONLY-B' })]));
    const board = await readBoard();
    expect(board.snapshots[A.id]?.bookings.map((b) => b.ref)).toEqual(['ONLY-A']);
    expect(board.snapshots[B.id]?.bookings.map((b) => b.ref)).toEqual(['ONLY-B']);
  });

  it('a later push replaces the earlier bookings (cancellation disappears)', async () => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'KEEP' }), booking({ ref: 'CANCELLED-LATER' })]));
    await postJson(A.pushToken, payloadFor([booking({ ref: 'KEEP' })]));
    expect((await readBoard()).snapshots[A.id]?.bookings.map((b) => b.ref)).toEqual(['KEEP']);
  });

  it('an empty push clears that person only', async () => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'A1' })]));
    await postJson(B.pushToken, payloadFor([booking({ ref: 'B1' })]));
    expect((await postJson(A.pushToken, payloadFor([]))).status).toBe(204);
    const board = await readBoard();
    expect(board.snapshots[A.id]?.bookings).toEqual([]);
    expect(board.snapshots[B.id]?.bookings.map((b) => b.ref)).toEqual(['B1']);
  });

  it('a person who never pushed has a null snapshot (empty lane)', async () => {
    expect((await readBoard()).snapshots[PEOPLE[2]!.id]).toBeNull();
  });

  it('stores bookings only: profile fields and any other keys on a pushed row are ignored', async () => {
    // A hostile or buggy client sends the WHOLE untrimmed rows plus profile keys.
    const dirty = [
      { ...nlbSeatRow({ bookingRefId: 'DIRTY' }), ...FAKE_PROFILE, areaImageUrls: ['https://x.invalid/a.png'] },
      accountInfoResponse([nlbSeatRow()], [VISIT_BOOKING]),
    ];
    expect((await postJson(A.pushToken, dirty)).status).toBe(204);
    const board = await readBoard();
    expect(board.snapshots[A.id]?.bookings.map((b) => b.ref)).toEqual(['DIRTY']);
    const text = JSON.stringify(board);
    for (const v of Object.values(FAKE_PROFILE)) expect(text).not.toContain(v);
    expect(text).not.toContain('x.invalid');
    expect(text).not.toContain('visitBookings');
    expect(text).not.toContain(String(VISIT_BOOKING.bookingRefId));
    expect(text).not.toContain('infoJson');
  });

  it('Purpose inside infoJson is accepted on the wire but never stored or served', async () => {
    const roomRow = trimRow(nlbRoomRow({ bookingRefId: 'ROOM-1' }));
    expect(String(roomRow.infoJson)).toContain('Study group'); // it IS in the request
    expect((await postJson(A.pushToken, [roomRow])).status).toBe(204);
    const text = JSON.stringify(await readBoard());
    expect(text).toContain('ROOM-1');
    expect(text).not.toContain('Study group');
    expect(text).not.toContain('Purpose');
    expect(text).toContain('"pax":2');
  });

  it('rows the extractor cannot use are ignored; the usable ones are stored', async () => {
    const body = [null, 'x', { seat: 'S1' }, booking({ ref: 'BADTIME', startTime: 'garbage' }), booking({ ref: 'GOOD' })];
    expect((await postJson(A.pushToken, body)).status).toBe(204);
    expect((await readBoard()).snapshots[A.id]?.bookings.map((b) => b.ref)).toEqual(['GOOD']);
  });

  it('offset-less NLB times are taken as SGT', async () => {
    await postJson(A.pushToken, [booking({ ref: 'T', startTime: '2026-10-08T11:00:00', endTime: '2026-10-08T12:00:00' })]);
    const b = (await readBoard()).snapshots[A.id]!.bookings[0]!;
    expect([b.start, b.end]).toEqual(['2026-10-08T11:00:00+08:00', '2026-10-08T12:00:00+08:00']);
  });
});

describe('rejected pushes leave the stored snapshot unchanged', () => {
  const stored = async () => (await readBoard()).snapshots[A.id]?.bookings.map((b) => b.ref);

  it('malformed JSON -> 400 "invalid payload: ..."', async () => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'BASE' })]));
    const res = await call(`/push/${A.pushToken}`, { method: 'POST', body: '{nope' });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/^invalid payload: /);
    expect(await stored()).toEqual(['BASE']);
  });

  it('form push without a rows field -> 400', async () => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'BASE' })]));
    const res = await call(`/push/${A.pushToken}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'other=1',
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/^invalid payload: /);
    expect(await stored()).toEqual(['BASE']);
  });

  it.each([
    ['an object', { bookings: [] }],
    ['the old { v, pushedAt, bookings } shape', { v: 1, pushedAt: '2026-10-08T10:00:00+08:00', bookings: [booking()] }],
    ['a string', 'rows'],
    ['null', null],
  ])('a body that is not an array (%s) -> 400', async (_label, body) => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'BASE' })]));
    const res = await postJson(A.pushToken, body);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('invalid payload: rows must be an array');
    expect(await stored()).toEqual(['BASE']);
  });

  it('more than 200 rows -> 400, exactly 200 -> accepted', async () => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'BASE' })]));
    const many = (n: number) => Array.from({ length: n }, (_, i) => trimRow(nlbSeatRow({ bookingRefId: `R${i}`, seat: `S${i}`, infoJson: '' })));
    const tooMany = await postJson(A.pushToken, many(201));
    expect(tooMany.status).toBe(400);
    expect(await tooMany.text()).toMatch(/200/);
    expect(await stored()).toEqual(['BASE']);
    expect((await postJson(A.pushToken, many(200))).status).toBe(204);
    expect(await stored()).toHaveLength(200);
  });

  it('a push needs no device clock: a bare array of rows is the whole body', async () => {
    const rows = payloadFor([booking({ ref: 'NOCLOCK' })]);
    expect((await postJson(A.pushToken, rows)).status).toBe(204);
    expect(await stored()).toEqual(['NOCLOCK']);
  });

  it('body over 64 KB -> 400 and the previous snapshot remains (JSON and form)', async () => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'BASE' })]));
    const big = payloadFor([booking({ ref: 'X'.repeat(70_000) })]);
    const json = await postJson(A.pushToken, big);
    expect(json.status).toBe(400);
    expect(await json.text()).toMatch(/^invalid payload: /);
    const form = await postForm(A.pushToken, big);
    expect(form.status).toBe(400);
    expect(await stored()).toEqual(['BASE']);
  });

  it('a body just under 64 KB is accepted', async () => {
    const ref = 'X'.repeat(60_000);
    expect((await postJson(A.pushToken, payloadFor([booking({ ref })]))).status).toBe(204);
    expect(await stored()).toEqual([ref]);
  });

  it('the cap applies to the real body, not just a Content-Length header', async () => {
    const res = await call(`/push/${A.pushToken}`, { method: 'POST', body: new Blob(['x'.repeat(70_000)]) });
    expect(res.status).toBe(400);
  });

  it('second push by the same person within 2 s -> 429; after 2 s it is accepted', async () => {
    const now = tick();
    expect((await postJson(A.pushToken, payloadFor([booking({ ref: 'FIRST' })], now), now)).status).toBe(204);
    const limited = await postJson(A.pushToken, payloadFor([booking({ ref: 'SECOND' })], now), now + 1_999);
    expect(limited.status).toBe(429);
    expect(await stored()).toEqual(['FIRST']);
    const ok = await postJson(A.pushToken, payloadFor([booking({ ref: 'THIRD' })], now), now + 2_000);
    expect(ok.status).toBe(204);
    expect(await stored()).toEqual(['THIRD']);
  });

  it('the rate limit is per person', async () => {
    const now = tick();
    expect((await postJson(A.pushToken, payloadFor([], now), now)).status).toBe(204);
    expect((await postJson(B.pushToken, payloadFor([], now), now)).status).toBe(204);
  });
});

describe('the view secret cannot write', () => {
  it('using the view secret as a push token is a bare 404 and changes nothing', async () => {
    await postJson(A.pushToken, payloadFor([booking({ ref: 'BASE' })]));
    const res = await postJson(VIEW, payloadFor([booking({ ref: 'EVIL' })]));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
    expect((await readBoard()).snapshots[A.id]?.bookings.map((b) => b.ref)).toEqual(['BASE']);
  });

  it('a push token cannot read the board or the setup page', async () => {
    expect((await call(`/api/${A.pushToken}/board`)).status).toBe(404);
    expect((await call(`/v/${A.pushToken}`)).status).toBe(404);
    expect((await call(`/setup/${A.pushToken}`)).status).toBe(404);
  });
});

describe('the Worker never contacts any external host', () => {
  it('makes zero outbound fetch calls across a push, a board read, the viewer and the setup pages', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await postForm(A.pushToken, payloadFor());
    await postJson(B.pushToken, payloadFor());
    await call(`/api/${VIEW}/board`);
    await call(`/v/${VIEW}`);
    await call(`/setup/${VIEW}`);
    await call(`/setup/${VIEW}/a.user.js`);
    await call('/nope');
    expect(spy).not.toHaveBeenCalled();

    // Positive control: the spy does observe a call made from this isolate.
    spy.mockImplementation(async () => new Response('stub'));
    await fetch('https://control.invalid/');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
