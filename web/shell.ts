// The viewer page shell, served by the Worker (worker/src/pages.ts wraps this).
// One nonced <style>, a tiny nonced theme script in <head> (applies the stored theme before first paint),
// the nonced bundled <script> at the end of <body>, and nothing external: no fonts, CDNs, images.
// The served CSP is: default-src 'none'; script-src 'nonce-X'; style-src 'nonce-X'; connect-src 'self';
// img-src 'self' data:  -> so no style="" attributes and no inline event handlers anywhere.
import { esc } from './html';
import { viewerCss } from './styles';
import { themeControlHtml, themeInitScript } from './theme';

/** Neutralise sequences that could end or confuse the inline script element. */
function safeInlineJs(js: string): string {
  return js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

export function viewerHtml(opts: { nonce: string; js: string }): string {
  const nonce = esc(opts.nonce);
  return (
    '<!doctype html>\n' +
    '<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="robots" content="noindex, nofollow">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Shared bookings</title>' +
    `<style nonce="${nonce}">${viewerCss()}</style>` +
    `<script nonce="${nonce}">${themeInitScript()}</script>` +
    '</head><body>' +
    `<main><div class="themebar" id="theme">${themeControlHtml('auto')}</div>` +
    '<div id="app"><p class="loading">Loading…</p></div></main>' +
    `<p id="conn" hidden>Can't reach server</p>` +
    '<div id="toast" role="status" aria-live="polite" hidden></div>' +
    `<script nonce="${nonce}">${safeInlineJs(opts.js)}</script>` +
    '</body></html>'
  );
}
