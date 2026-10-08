import { describe, expect, it } from 'vitest';
import { parseConfig } from '../worker/src/config.ts';
import { buildSecrets, devVarsText, generateSecret, putSecret, setupUrl, validateNames } from './init-secrets.mjs';

describe('generateSecret', () => {
  it('is 256 bits of base64url and different every time', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe('validateNames', () => {
  it('accepts 2 to 5 distinct names, trimmed', () => {
    expect(validateNames([' Alice ', 'Bob'])).toEqual(['Alice', 'Bob']);
    expect(validateNames(['a', 'b', 'c', 'd', 'e'])).toHaveLength(5);
  });
  it.each([
    ['one name', ['A']],
    ['six names', ['a', 'b', 'c', 'd', 'e', 'f']],
    ['empty name', ['A', '  ']],
    ['too long', ['A', 'x'.repeat(33)]],
    ['control character', ['A', 'B\nC']],
    ['hash (breaks .dev.vars)', ['A', 'B#C']],
    ['duplicate (case-insensitive)', ['Alice', 'alice']],
  ])('rejects %s', (_l, names) => {
    expect(() => validateNames(names)).toThrow();
  });
});

describe('buildSecrets', () => {
  it('makes a view secret, distinct per-person tokens and neutral ids', () => {
    const s = buildSecrets(['Alice', 'Bob']);
    expect(s.people.map((p) => p.id)).toEqual(['a', 'b']);
    expect(s.people.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    const secrets = [s.viewSecret, ...s.people.map((p) => p.pushToken)];
    expect(new Set(secrets).size).toBe(3);
    for (const x of secrets) expect(x.length).toBeGreaterThanOrEqual(43);
  });

  it('produces exactly what the Worker accepts (round-trip through parseConfig)', () => {
    const s = buildSecrets(['Alice', 'Bob', 'Carol']);
    const parsed = parseConfig({ VIEW_SECRET: s.viewSecret, PEOPLE: s.peopleJson });
    expect(parsed.ok).toBe(true);
  });

  it('ids never contain the names (they appear in URLs)', () => {
    const s = buildSecrets(['Alice', 'Bob']);
    for (const p of s.people) expect(p.id).not.toMatch(/alice|bob/i);
  });
});

describe('devVarsText', () => {
  it('writes VIEW_SECRET and a single-line PEOPLE JSON', () => {
    const s = buildSecrets(['Alice', 'Bob']);
    const text = devVarsText(s);
    const lines = text.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(`VIEW_SECRET=${s.viewSecret}`);
    expect(JSON.parse(lines[1].slice('PEOPLE='.length))).toEqual(s.people);
  });
});

describe('setupUrl', () => {
  it('prints the full URL when the worker URL is known, else a placeholder', () => {
    expect(setupUrl('https://w.example.workers.dev/', 'VIEW')).toBe('https://w.example.workers.dev/setup/VIEW');
    expect(setupUrl(undefined, 'VIEW')).toBe('<your workers.dev URL>/setup/VIEW');
  });
});

describe('putSecret', () => {
  it('pipes the value on stdin, with a fixed command line that never contains it', () => {
    const calls = [];
    const fake = (cmd, opts) => {
      calls.push({ cmd, opts });
      return { status: 0 };
    };
    putSecret('VIEW_SECRET', 'super-secret-value', fake);
    putSecret('PEOPLE', '[{"pushToken":"tok"}]', fake);
    expect(calls.map((c) => c.cmd)).toEqual(['npx wrangler secret put VIEW_SECRET', 'npx wrangler secret put PEOPLE']);
    for (const c of calls) {
      expect(c.opts.shell).toBe(true); // npx resolves on Windows
      expect(c.opts.stdio[0]).toBe('pipe');
    }
    expect(calls[0].opts.input).toBe('super-secret-value');
    expect(JSON.stringify(calls.map((c) => c.cmd))).not.toContain('super-secret-value');
    expect(JSON.stringify(calls.map((c) => c.cmd))).not.toContain('tok');
  });

  it('throws without echoing the secret when wrangler fails', () => {
    expect(() => putSecret('PEOPLE', 'the-secret', () => ({ status: 1 }))).toThrow(/failed/);
    try {
      putSecret('PEOPLE', 'the-secret', () => ({ status: 1 }));
    } catch (e) {
      expect(String(e.message)).not.toContain('the-secret');
    }
  });

  it('propagates a spawn error', () => {
    expect(() => putSecret('X', 'v', () => ({ error: new Error('spawn boom') }))).toThrow('spawn boom');
  });
});
