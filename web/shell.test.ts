import { describe, expect, it } from 'vitest';
import { booking } from '../shared/src/fixtures';
import type { Board } from '../shared/src/types';
import { render } from './render';
import { viewerHtml } from './shell';
import { themeControlHtml, themeInitScript } from './theme';

const html = viewerHtml({ nonce: 'N0NCE', js: '(function(){var x=1})();' });

describe('viewerHtml', () => {
  it('is a full HTML5 document with noindex, viewport and title', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1[^"]*">/);
    expect(html).toContain('<title>Shared bookings</title>');
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('has one nonced <style>, a nonced head script, and the bundled nonced script at the end of body', () => {
    expect(html.match(/<style\b/g)).toHaveLength(1);
    expect(html.match(/<script\b/g)).toHaveLength(2);
    expect(html).toContain('<style nonce="N0NCE">');
    expect(html).toContain('<script nonce="N0NCE">(function(){var x=1})();</script>');
    const afterScript = html.slice(html.lastIndexOf('</script>') + '</script>'.length);
    expect(afterScript.trim()).toBe('</body></html>');
    // every script carries the nonce
    for (const m of html.matchAll(/<script\b([^>]*)>/g)) expect(m[1]).toBe(' nonce="N0NCE"');
  });

  it('applies the stored theme before first paint: a nonced script in <head>, before the body', () => {
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    expect(head).toContain(`<script nonce="N0NCE">${themeInitScript()}</script>`);
    expect(html.indexOf(themeInitScript())).toBeLessThan(html.indexOf('<body>'));
  });

  it('has the Auto / Light / Dark control, Auto pressed, outside the re-rendered #app', () => {
    const body = html.slice(html.indexOf('<body>'));
    expect(body).toContain(themeControlHtml('auto'));
    expect(body.indexOf('id="theme"')).toBeGreaterThan(-1);
    expect(body.indexOf('data-theme-choice="auto"')).toBeLessThan(body.indexOf('id="app"'));
    expect(body.match(/<button\b/g)).toHaveLength(3);
  });

  it('loads nothing external and has no inline styles or handlers', () => {
    expect(html).not.toMatch(/\ssrc\s*=/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/url\((?!["']?data:)/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('provides the mount points app.ts relies on', () => {
    expect(html).toContain('id="app"');
    expect(html).toContain('id="toast"');
    expect(html).toContain('id="conn"');
    expect(html).toContain("Can't reach server");
  });

  it('escapes the nonce attribute value', () => {
    const h = viewerHtml({ nonce: 'a"><b', js: '' });
    expect(h).toContain('nonce="a&quot;&gt;&lt;b"');
    expect(h).not.toContain('nonce="a">');
  });

  it('cannot be broken out of by the bundled js', () => {
    const h = viewerHtml({ nonce: 'n', js: 'var s="</script><img src=x onerror=1>"; var c="<!--";' });
    expect(h.match(/<\/script/gi)).toHaveLength(2); // the head script and the bundled script
    expect(h).not.toContain('<!--');
    expect(h).toContain('<\\/script>');
  });

  it('is responsive: narrow-screen rules exist and the page itself does not scroll sideways', () => {
    expect(html).toMatch(/@media\s*\(max-width:\s*\d+px\)/);
    expect(html).toMatch(/overflow-x:\s*auto/);
    expect(html).toMatch(/prefers-color-scheme:\s*dark/);
  });

  it('defines every positional class that render() can emit', () => {
    const css = html.slice(html.indexOf('<style'), html.indexOf('</style>'));
    for (let m = 8 * 60; m < 22 * 60; m += 30) {
      const hhmm = String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0');
      expect(css).toContain(`.s-${hhmm}{`);
    }
    for (let n = 1; n <= 28; n++) expect(css).toContain(`.d-${n}{`);
    for (let n = 1; n <= 40; n++) {
      expect(css).toContain(`.r-${n}{`);
      expect(css).toContain(`.h-${n}{`);
    }

    // and every s-/d-/r-/h- class in a rendered page is covered
    const board: Board = {
      serverNow: '2026-10-08T14:15:00+08:00',
      people: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      snapshots: {
        a: { personId: 'a', receivedAt: '2026-10-08T14:10:00+08:00',
          bookings: [
            booking({ ref: '1', kind: 'room', unit: 'R3', pax: 2, start: '2026-10-08T12:00:00+08:00', end: '2026-10-08T14:30:00+08:00' }),
            booking({ ref: '2', unit: 'S1', start: '2026-10-08T07:00:00+08:00', end: '2026-10-08T23:00:00+08:00' }),
          ] },
        b: { personId: 'b', receivedAt: '2026-10-08T14:10:00+08:00',
          bookings: [booking({ ref: '3', unit: 'S2', start: '2026-10-08T13:30:00+08:00', end: '2026-10-08T21:30:00+08:00' })] },
      },
    };
    const body = render(board, board.serverNow);
    const used = new Set<string>();
    for (const m of body.matchAll(/class="([^"]*)"/g)) for (const c of m[1]!.split(/\s+/)) used.add(c);
    const positional = [...used].filter((c) => /^[sdrh]-\d+$/.test(c));
    expect(positional.length).toBeGreaterThan(5);
    for (const c of positional) expect(css).toContain(`.${c}{`);
  });
});
