// Router + guard. Every response leaves through applyGuard(); every unknown path, wrong secret,
// wrong token or wrong method leaves through the one shared notFound().
import { ingestRows } from '../../shared/src/payload';
import { msToSgtIso } from '../../shared/src/time';
import { findPerson, parseConfig, timingSafeEqual, type Config, type Env } from './config';
import { setupHtml, userscriptFile, viewerHtml } from './pages';

export const MAX_BODY_BYTES = 64 * 1024;
const FORM = 'application/x-www-form-urlencoded';

function notFound(): Response {
  return new Response(null, { status: 404 });
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function html(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// guard: a natural transformation over all routes.
function applyGuard(res: Response, nonce: string): Response {
  const headers = new Headers(res.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  if ((headers.get('content-type') ?? '').startsWith('text/html')) {
    headers.set(
      'Content-Security-Policy',
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; ` +
        `img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    );
  }
  return new Response(res.body, { status: res.status, headers });
}

// Reads at most `max` bytes of the raw body (before any parsing). Returns null when it is larger.
async function readBodyCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

const invalid = (reason: string): Response => text(400, `invalid payload: ${reason}`);

async function handlePush(request: Request, env: Env, config: Config, token: string, nowMs: number): Promise<Response> {
  const person = await findPerson(config, token);
  if (!person) return notFound(); // before touching the body: no oracle for tokens

  const body = await readBodyCapped(request, MAX_BODY_BYTES);
  if (body === null) return invalid('body larger than 64 KB');

  const isForm = (request.headers.get('content-type') ?? '').toLowerCase().startsWith(FORM);
  // The body is a JSON array of trimmed NLB rows: the form field `rows`, or the JSON body itself.
  let json: unknown;
  try {
    const raw = isForm ? new URLSearchParams(body).get('rows') : body;
    if (raw === null) return invalid('missing rows field');
    json = JSON.parse(raw);
  } catch {
    return invalid('not valid JSON');
  }

  const now = msToSgtIso(nowMs); // the only time that counts: no device clock is ever read
  const checked = ingestRows(json); // trim to the whitelist, extract, validate
  if (!checked.ok) return invalid(checked.reason);

  const result = await env.BOARD.get(env.BOARD.idFromName('board')).put(person.id, checked.payload, now);
  if (result === 'rate_limited') return text(429, 'too many requests');

  return isForm
    ? new Response(null, { status: 303, headers: { Location: `/v/${config.viewSecret}?pushed=${person.id}` } })
    : new Response(null, { status: 204 });
}

async function route(request: Request, env: Env, nowMs: number, nonce: string): Promise<Response> {
  const parsed = parseConfig(env);
  if (!parsed.ok) {
    console.error(`misconfigured: ${parsed.reason}`); // reason never contains a secret value
    return notFound();
  }
  const config = parsed.config;
  const url = new URL(request.url);
  const seg = url.pathname.split('/').slice(1);
  const isGet = request.method === 'GET';
  const viewOk = async (s: string | undefined) => s !== undefined && (await timingSafeEqual(s, config.viewSecret));

  switch (seg[0]) {
    case 'robots.txt':
      return isGet && seg.length === 1 ? text(200, 'User-agent: *\nDisallow: /') : notFound();

    case 'v':
      return isGet && seg.length === 2 && (await viewOk(seg[1])) ? html(viewerHtml(nonce)) : notFound();

    case 'api': {
      if (!(isGet && seg.length === 3 && seg[2] === 'board' && (await viewOk(seg[1])))) return notFound();
      const board = await env.BOARD.get(env.BOARD.idFromName('board')).board(config.people.map(({ id, name }) => ({ id, name })));
      return new Response(JSON.stringify(board), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }

    case 'push':
      return request.method === 'POST' && seg.length === 2 ? handlePush(request, env, config, seg[1] ?? '', nowMs) : notFound();

    case 'setup': {
      if (!isGet || !(await viewOk(seg[1]))) return notFound();
      const origin = url.origin;
      if (seg.length === 2) {
        return html(setupHtml({ origin, viewSecret: config.viewSecret, people: config.people, nonce }));
      }
      const m = seg.length === 3 ? /^([a-z0-9]{1,16})\.user\.js$/.exec(seg[2] ?? '') : null;
      const person = m ? config.people.find((p) => p.id === m[1]) : undefined;
      if (!person) return notFound();
      return new Response(userscriptFile({ origin, viewSecret: config.viewSecret, person }), {
        headers: { 'content-type': 'text/javascript; charset=utf-8' },
      });
    }

    default:
      return notFound();
  }
}

export async function handle(request: Request, env: Env, nowMs: number): Promise<Response> {
  const nonce = newNonce();
  let res: Response;
  try {
    res = await route(request, env, nowMs, nonce);
  } catch (e) {
    console.error('unhandled error', e instanceof Error ? e.name : 'unknown');
    res = new Response(null, { status: 500 });
  }
  return applyGuard(res, nonce);
}
