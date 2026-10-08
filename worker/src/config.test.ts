import { describe, expect, it, vi } from 'vitest';
import { findPerson, parseConfig, timingSafeEqual } from './config';

const VIEW = 'v'.repeat(32);
const TOK_A = 'a'.repeat(32);
const TOK_B = 'b'.repeat(32);
const people = (over: unknown[] = []) =>
  JSON.stringify(
    over.length
      ? over
      : [
          { id: 'a', name: 'Alice', pushToken: TOK_A },
          { id: 'b', name: 'Bob', pushToken: TOK_B },
        ],
  );

describe('parseConfig', () => {
  it('parses a valid environment', () => {
    const r = parseConfig({ VIEW_SECRET: VIEW, PEOPLE: people() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.viewSecret).toBe(VIEW);
    expect(r.config.people.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.config.people[0]).toEqual({ id: 'a', name: 'Alice', pushToken: TOK_A });
  });

  it.each([
    ['missing VIEW_SECRET', { PEOPLE: people() }],
    ['empty VIEW_SECRET', { VIEW_SECRET: '', PEOPLE: people() }],
    ['short VIEW_SECRET', { VIEW_SECRET: 'short', PEOPLE: people() }],
    ['VIEW_SECRET with a slash', { VIEW_SECRET: 'v'.repeat(20) + '/x', PEOPLE: people() }],
    ['push token with a quote', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a', name: 'x', pushToken: 'a'.repeat(20) + '"' }]) }],
    ['push token with a space', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a', name: 'x', pushToken: 'a'.repeat(20) + ' b' }]) }],
    ['missing PEOPLE', { VIEW_SECRET: VIEW }],
    ['PEOPLE not JSON', { VIEW_SECRET: VIEW, PEOPLE: 'nope' }],
    ['PEOPLE not an array', { VIEW_SECRET: VIEW, PEOPLE: '{"id":"a"}' }],
    ['PEOPLE empty', { VIEW_SECRET: VIEW, PEOPLE: '[]' }],
    ['6 people', { VIEW_SECRET: VIEW, PEOPLE: people(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id, pushToken: id.repeat(32) }))) }],
    ['bad id (uppercase)', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'A', name: 'x', pushToken: TOK_A }]) }],
    ['bad id (too long)', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a'.repeat(17), name: 'x', pushToken: TOK_A }]) }],
    ['duplicate ids', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a', name: 'x', pushToken: TOK_A }, { id: 'a', name: 'y', pushToken: TOK_B }]) }],
    ['missing name', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a', pushToken: TOK_A }]) }],
    ['short token', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a', name: 'x', pushToken: 'short' }]) }],
    ['duplicate tokens', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a', name: 'x', pushToken: TOK_A }, { id: 'b', name: 'y', pushToken: TOK_A }]) }],
    ['token equal to view secret', { VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a', name: 'x', pushToken: VIEW }]) }],
  ])('rejects: %s', (_label, env) => {
    expect(parseConfig(env as { VIEW_SECRET?: string; PEOPLE?: string }).ok).toBe(false);
  });

  it('the rejection reason never contains a secret value', () => {
    const r = parseConfig({ VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'A', name: 'x', pushToken: TOK_A }]) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).not.toContain(TOK_A);
    expect(r.reason).not.toContain(VIEW);
  });

  it('drops unknown keys from people', () => {
    const r = parseConfig({ VIEW_SECRET: VIEW, PEOPLE: people([{ id: 'a', name: 'x', pushToken: TOK_A, extra: 1 }]) });
    expect(r.ok && Object.keys(r.config.people[0]!).sort()).toEqual(['id', 'name', 'pushToken']);
  });
});

describe('timingSafeEqual', () => {
  it('true for equal strings, false otherwise', async () => {
    expect(await timingSafeEqual('abc', 'abc')).toBe(true);
    expect(await timingSafeEqual('abc', 'abd')).toBe(false);
    expect(await timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(await timingSafeEqual('', '')).toBe(true);
    expect(await timingSafeEqual('', 'a')).toBe(false);
    expect(await timingSafeEqual('é', 'é')).toBe(true);
    expect(await timingSafeEqual('é', 'e')).toBe(false);
  });

  it('compares SHA-256 digests (crypto.subtle.digest) rather than the strings directly', async () => {
    const spy = vi.spyOn(crypto.subtle, 'digest');
    try {
      await timingSafeEqual('secret-one', 'secret-two');
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.every((c) => c[0] === 'SHA-256')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('findPerson', () => {
  const cfg = () => {
    const r = parseConfig({ VIEW_SECRET: VIEW, PEOPLE: people() });
    if (!r.ok) throw new Error('bad test config');
    return r.config;
  };
  it('returns the matching person', async () => {
    expect((await findPerson(cfg(), TOK_B))?.id).toBe('b');
    expect((await findPerson(cfg(), TOK_A))?.id).toBe('a');
  });
  it('returns null for unknown tokens, the view secret and empty strings', async () => {
    expect(await findPerson(cfg(), 'x'.repeat(32))).toBeNull();
    expect(await findPerson(cfg(), VIEW)).toBeNull();
    expect(await findPerson(cfg(), '')).toBeNull();
  });
  it('checks every person (no early exit): digests computed for all tokens', async () => {
    const spy = vi.spyOn(crypto.subtle, 'digest');
    try {
      await findPerson(cfg(), TOK_A); // matches the first person
      // 1 digest for the candidate per comparison + 1 per stored token, for both people = 4
      expect(spy).toHaveBeenCalledTimes(4);
    } finally {
      spy.mockRestore();
    }
  });
});
