// Deployment configuration, parsed from Worker secrets only (VIEW_SECRET, PEOPLE).
// Nothing deployment-specific lives in the repository (spec: per-deployment secrets).
import type { PersonConfig } from '../../shared/src/types';

// Bindings are declared once, in env.d.ts (Cloudflare.Env).
export type Env = Cloudflare.Env;

export interface Config {
  viewSecret: string;
  people: PersonConfig[];
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; reason: string };

const ID = /^[a-z0-9]{1,16}$/;
const MIN_SECRET_LENGTH = 16;
// Secrets travel in URL paths and are embedded unescaped in the bookmarklet, so they must be URL-safe (base64url).
const URL_SAFE = /^[A-Za-z0-9_-]+$/;
const MAX_PEOPLE = 5;

// Never put a secret value in a reason: it may be logged.
export function parseConfig(env: { VIEW_SECRET?: string; PEOPLE?: string }): ConfigResult {
  const view = env.VIEW_SECRET;
  if (typeof view !== 'string' || view.length < MIN_SECRET_LENGTH || !URL_SAFE.test(view)) {
    return { ok: false, reason: 'VIEW_SECRET missing, too short or not URL-safe' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(env.PEOPLE ?? '');
  } catch {
    return { ok: false, reason: 'PEOPLE is not valid JSON' };
  }
  if (!Array.isArray(raw)) return { ok: false, reason: 'PEOPLE must be an array' };
  if (raw.length < 1 || raw.length > MAX_PEOPLE) return { ok: false, reason: `PEOPLE must have 1 to ${MAX_PEOPLE} entries` };

  const people: PersonConfig[] = [];
  const ids = new Set<string>();
  const tokens = new Set<string>([view]);
  for (const [i, p] of raw.entries()) {
    const o = typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : {};
    const { id, name, pushToken } = o;
    if (typeof id !== 'string' || !ID.test(id)) return { ok: false, reason: `PEOPLE[${i}].id must match [a-z0-9]{1,16}` };
    if (typeof name !== 'string' || name === '') return { ok: false, reason: `PEOPLE[${i}].name must be a non-empty string` };
    if (typeof pushToken !== 'string' || pushToken.length < MIN_SECRET_LENGTH || !URL_SAFE.test(pushToken)) {
      return { ok: false, reason: `PEOPLE[${i}].pushToken missing, too short or not URL-safe` };
    }
    if (ids.has(id)) return { ok: false, reason: `PEOPLE[${i}].id is a duplicate` };
    if (tokens.has(pushToken)) return { ok: false, reason: `PEOPLE[${i}].pushToken duplicates another secret` };
    ids.add(id);
    tokens.add(pushToken);
    people.push({ id, name, pushToken });
  }
  return { ok: true, config: { viewSecret: view, people } };
}

const encoder = new TextEncoder();

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
}

// Constant-time string compare: SHA-256 both sides (equal length, no length leak), then a
// byte loop that always visits every byte.
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= (da[i] ?? 0) ^ (db[i] ?? 0);
  return diff === 0;
}

// personOf?: constant-time token match against every configured person (no early exit).
export async function findPerson(config: Config, token: string): Promise<PersonConfig | null> {
  let found: PersonConfig | null = null;
  for (const p of config.people) {
    if (await timingSafeEqual(token, p.pushToken)) found = p;
  }
  return found;
}
