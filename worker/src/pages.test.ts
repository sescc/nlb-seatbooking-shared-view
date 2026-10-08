import { describe, expect, it } from 'vitest';
import { BOOKMARKLET_JS, USERSCRIPT_JS } from './generated/assets';
import { bookmarkletUrl, esc, setupHtml, userscriptFile, viewerHtml } from './pages';

const ORIGIN = 'https://worker.example.test';
const VIEW = 'view-secret-0000000000000000';
const TOKEN = 'push-token-aaaaaaaaaaaaaaaaaaaa';
const PERSON = { id: 'a', name: 'Test Alice', pushToken: TOKEN };

describe('bookmarkletUrl', () => {
  const url = bookmarkletUrl(ORIGIN, TOKEN);
  const decoded = decodeURIComponent(url.slice('javascript:'.length));

  it('is a single-line javascript: URL', () => {
    expect(url.startsWith('javascript:')).toBe(true);
    expect(url).not.toMatch(/[\r\n]/);
    expect(url).toMatch(/^[\x20-\x7e]+$/); // pure printable ASCII
  });

  it('is at most 1,000 bytes with a realistic 60-char https origin and a 43-char token (Android Chrome truncates long bookmark URLs)', () => {
    const origin = ('https://nlb-shared-view.' + 'my-long-account-name-for-this-test'.padEnd(60, 'x')).slice(0, 60);
    const token = 'T'.repeat(43);
    expect(origin).toHaveLength(60);
    const bytes = new TextEncoder().encode(bookmarkletUrl(origin, token)).length;
    console.log(`bookmarklet size with 60-char origin + 43-char token: ${bytes} bytes`);
    expect(bytes).toBeLessThanOrEqual(1000);
  });
  it('percent-encodes % and # so the browser decodes the original code', () => {
    expect(url).not.toMatch(/%(?![0-9A-F]{2})/);
    expect(url).not.toContain('#');
    expect(decoded).toContain(BOOKMARKLET_JS);
  });

  it('binds this deployment origin and the person token as string literals', () => {
    expect(decoded).toContain(JSON.stringify(ORIGIN));
    expect(decoded).toContain(JSON.stringify(TOKEN));
    expect(decoded.startsWith('(function(__NLBSV_ORIGIN__,__NLBSV_TOKEN__){')).toBe(true);
  });

  it('carries the row whitelist and nothing else: no profile keys, no extract, no style attributes', () => {
    for (const k of ['bookingRefId', 'bookingId', 'seat', 'area', 'floor', 'branchName', 'startTime', 'endTime', 'actions', 'infoJson']) {
      expect(BOOKMARKLET_JS).toContain(`"${k}"`);
    }
    for (const forbidden of ['name', 'email', 'userId', 'accountId', 'visitBookings', 'Purpose']) {
      expect(BOOKMARKLET_JS).not.toContain(`"${forbidden}"`);
    }
    expect(BOOKMARKLET_JS).not.toContain('innerHTML');
    expect(BOOKMARKLET_JS).not.toMatch(/setAttribute\(["']style["']/);
  });
  it('only talks to NLB same-origin and to the bound origin (no hard-coded hosts)', () => {
    expect(BOOKMARKLET_JS).not.toMatch(/https?:\/\//);
    expect(BOOKMARKLET_JS).not.toContain('sendBeacon');
  });

  it('different tokens give different bookmarklets', () => {
    expect(bookmarkletUrl(ORIGIN, 'other-token-bbbbbbbbbbbbbbbbbbbb')).not.toBe(url);
  });
});

describe('userscriptFile', () => {
  const file = userscriptFile({ origin: ORIGIN, viewSecret: VIEW, person: PERSON });

  it('has a Violentmonkey/Tampermonkey header', () => {
    expect(file.startsWith('// ==UserScript==\n')).toBe(true);
    expect(file).toContain('// ==/UserScript==');
    expect(file).toContain('// @match        https://www.nlb.gov.sg/seatbooking/*');
    expect(file).toContain('// @grant        GM_xmlhttpRequest');
    expect(file).toContain('// @run-at       document-idle');
  });

  it('@connect is the request host (no port, no scheme)', () => {
    expect(file).toContain('// @connect      worker.example.test');
    const local = userscriptFile({ origin: 'http://localhost:8787', viewSecret: VIEW, person: PERSON });
    expect(local).toContain('// @connect      localhost\n');
  });

  it('has @updateURL and @downloadURL pointing at its own /setup URL', () => {
    const own = `${ORIGIN}/setup/${VIEW}/a.user.js`;
    expect(file).toContain(`// @updateURL    ${own}`);
    expect(file).toContain(`// @downloadURL  ${own}`);
  });

  it('binds the origin and this person\'s token as JSON string literals', () => {
    expect(file).toContain(`})(${JSON.stringify(ORIGIN)},${JSON.stringify(TOKEN)});`);
    expect(file).toContain(USERSCRIPT_JS);
  });

  it('a person name with newlines cannot break out of the header', () => {
    const evil = userscriptFile({
      origin: ORIGIN,
      viewSecret: VIEW,
      person: { ...PERSON, name: 'x\n// @grant GM_evil' },
    });
    expect(evil).not.toContain('\n// @grant GM_evil');
  });
});

describe('setupHtml', () => {
  const people = [PERSON, { id: 'b', name: 'Test <b>Bob</b>', pushToken: 'push-token-bbbbbbbbbbbbbbbbbbbb' }];
  const html = setupHtml({ origin: ORIGIN, viewSecret: VIEW, people, nonce: 'n0nce' });

  it('contains each person\'s token (in their bookmarklet) and the userscript links', () => {
    for (const p of people) {
      expect(html).toContain(p.pushToken);
      expect(html).toContain(`${ORIGIN}/setup/${VIEW}/${p.id}.user.js`);
    }
  });

  it('offers the bookmarklet both as a draggable link and as copyable text', () => {
    expect(html).toMatch(/<a class="bm" href="javascript:/);
    expect(html).toMatch(/<textarea id="bm-a" readonly[^>]*>javascript:/);
  });

  it('escapes names and uses the nonce for its inline style and script', () => {
    expect(html).not.toContain('<b>Bob</b>');
    expect(html).toContain('Test &lt;b&gt;Bob&lt;/b&gt;');
    expect(html).toContain('<style nonce="n0nce">');
    expect(html).toContain('<script nonce="n0nce">');
    expect(html).not.toMatch(/\sstyle=/);
  });

  it('is marked noindex and loads nothing external', () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow, noarchive">');
    expect(html).not.toMatch(/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/);
  });
});

describe('viewerHtml', () => {
  it('delegates to the viewer shell with the nonce and the bundled viewer JS', () => {
    const html = viewerHtml('abc123');
    expect(html).toContain('nonce="abc123"');
    expect(html).toContain('noindex');
  });
});

describe('esc', () => {
  it('escapes HTML metacharacters', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});
