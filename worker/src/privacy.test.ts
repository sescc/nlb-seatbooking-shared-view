// Static checks of the "never contacts NLB / nothing deployment-specific in git" laws.
import { describe, expect, it } from 'vitest';
import boardSrc from './board.ts?raw';
import configSrc from './config.ts?raw';
import indexSrc from './index.ts?raw';
import pagesSrc from './pages.ts?raw';
import routerSrc from './router.ts?raw';
import gitignore from '../../.gitignore?raw';
import devVarsExample from '../../.dev.vars.example?raw';
import wrangler from '../../wrangler.toml?raw';

const sources = { 'board.ts': boardSrc, 'config.ts': configSrc, 'index.ts': indexSrc, 'pages.ts': pagesSrc, 'router.ts': routerSrc };

// Strip comments so prose in a comment cannot trigger or mask a check.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('no outbound network code anywhere in worker/src', () => {
  for (const [name, src] of Object.entries(sources)) {
    it(`${name} makes no outbound requests`, () => {
      const c = code(src);
      expect(c, 'fetch() call').not.toMatch(/(?<![.\w])fetch\s*\(/);
      expect(c, 'globalThis.fetch').not.toMatch(/globalThis\.fetch|self\.fetch/);
      expect(c).not.toMatch(/XMLHttpRequest|WebSocket|EventSource|sendBeacon|cloudflare:sockets|\bconnect\s*\(/);
      expect(c).not.toMatch(/new Request\(/);
    });
  }

  it('the only service stub call is the Board Durable Object (RPC), never fetch', () => {
    expect(code(routerSrc)).toMatch(/env\.BOARD\.get\(env\.BOARD\.idFromName\('board'\)\)\.put\(/);
    expect(code(routerSrc)).toMatch(/env\.BOARD\.get\(env\.BOARD\.idFromName\('board'\)\)\.board\(/);
  });

  it('NLB\'s host appears only in the userscript @match header, never in server logic', () => {
    for (const [name, src] of Object.entries(sources)) {
      const hits = code(src).split('\n').filter((l) => l.includes('nlb.gov.sg'));
      if (name === 'pages.ts') {
        expect(hits.every((l) => l.includes('@match'))).toBe(true);
      } else {
        expect(hits, name).toEqual([]);
      }
    }
  });

  it('the Worker stores no NLB credentials, cookies or tokens (no cookie handling at all)', () => {
    for (const [name, src] of Object.entries(sources)) {
      expect(code(src), name).not.toMatch(/set-cookie|getSetCookie|headers\.get\(['"]cookie['"]\)|authorization/i);
    }
  });
});

describe('nothing deployment-specific is committed', () => {
  it('wrangler.toml has no vars, secrets, account id, routes or custom domains', () => {
    const toml = wrangler.replace(/^\s*#.*$/gm, '');
    expect(toml).not.toMatch(/^\s*\[vars\]/m);
    expect(toml).not.toMatch(/^\s*\[env\./m);
    expect(toml).not.toMatch(/account_id/);
    expect(toml).not.toMatch(/^\s*routes?\s*=/m);
    expect(toml).not.toMatch(/^\s*\[\[routes\]\]/m);
    expect(toml).not.toMatch(/zone_(id|name)|pattern\s*=|custom_domain/);
    expect(toml).not.toMatch(/VIEW_SECRET|PEOPLE|pushToken/);
  });

  it('binds only the BOARD Durable Object, with a SQLite migration', () => {
    expect(wrangler).toMatch(/name = "BOARD"/);
    expect(wrangler).toMatch(/class_name = "Board"/);
    expect(wrangler).toMatch(/new_sqlite_classes = \["Board"\]/);
    expect(wrangler).not.toMatch(/\[\[(kv_namespaces|d1_databases|r2_buckets|services)\]\]/);
    expect(wrangler).not.toMatch(/\[assets\]/);
  });

  it('.dev.vars and generated files are git-ignored; the example holds placeholders only', () => {
    expect(gitignore).toMatch(/^\.dev\.vars$/m);
    expect(gitignore).toMatch(/^worker\/src\/generated\/$/m);
    expect(gitignore).toMatch(/^node_modules$/m);
    expect(devVarsExample).toContain('replace-with');
    expect(devVarsExample).not.toMatch(/workers\.dev/);
  });
});
