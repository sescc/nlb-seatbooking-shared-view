// HTML pages and push-client files, templated at request time with THIS deployment's origin and
// each person's push token. The repository holds templates only (no origin, no token, no name).
import { viewerHtml as renderViewer } from '../../web/shell';
import type { PersonConfig } from '../../shared/src/types';
import { BOOKMARKLET_JS, USERSCRIPT_JS, VIEWER_JS } from './generated/assets';

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// The viewer page: nonce'd inline CSS + JS, no third-party loads (markup comes from web/shell.ts).
export function viewerHtml(nonce: string): string {
  return renderViewer({ nonce, js: VIEWER_JS });
}

// Wrap a bundle so the free names __NLBSV_ORIGIN__ / __NLBSV_TOKEN__ resolve to string literals.
// As function parameters they stay local: nothing leaks onto NLB's window.
function bind(bundle: string, origin: string, token: string): string {
  return `(function(__NLBSV_ORIGIN__,__NLBSV_TOKEN__){${bundle}})(${JSON.stringify(origin)},${JSON.stringify(token)});`;
}

// A single-line javascript: URL. Only %, # and non-ASCII need percent-encoding; plain spaces stay (shorter).
export function bookmarkletUrl(origin: string, token: string): string {
  const code = bind(BOOKMARKLET_JS, origin, token);
  return 'javascript:' + code.replace(/[%#]|[^\x20-\x7e]/g, (c) => encodeURIComponent(c));
}

export function userscriptUrl(origin: string, viewSecret: string, personId: string): string {
  return `${origin}/setup/${viewSecret}/${personId}.user.js`;
}

function headerText(s: string): string {
  return s.replace(/[\r\n]+/g, ' ');
}

export function userscriptFile(opts: { origin: string; viewSecret: string; person: PersonConfig }): string {
  const { origin, viewSecret, person } = opts;
  const url = userscriptUrl(origin, viewSecret, person.id);
  const header = [
    '// ==UserScript==',
    `// @name         NLB shared view push (${headerText(person.name)})`,
    '// @namespace    nlb-shared-view',
    '// @version      1.0.0',
    '// @description  Pushes your own NLB seat and room bookings to your shared view. Not affiliated with NLB.',
    '// @match        https://www.nlb.gov.sg/seatbooking/*',
    '// @grant        GM_xmlhttpRequest',
    '// @grant        unsafeWindow',
    `// @connect      ${new URL(origin).hostname}`,
    '// @run-at       document-idle',
    '// @noframes',
    `// @updateURL    ${url}`,
    `// @downloadURL  ${url}`,
    '// ==/UserScript==',
  ].join('\n');
  return `${header}\n\n${bind(USERSCRIPT_JS, origin, person.pushToken)}\n`;
}

const SETUP_CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#5b6470;--card:#f4f6f8;--line:#d5dae0;--accent:#0b5fd4}
@media (prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#e8eaed;--muted:#9aa3ad;--card:#1d2226;--line:#333b42;--accent:#6aa5ff}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0}
h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:0}
a{color:var(--accent)}
a.bm{display:inline-block;padding:8px 12px;border:1px dashed var(--accent);border-radius:8px;text-decoration:none;cursor:grab}
textarea{width:100%;box-sizing:border-box;height:6em;font:12px/1.3 ui-monospace,monospace;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px}
button{font:inherit;padding:6px 12px;margin:6px 0}
.muted{color:var(--muted);font-size:.9rem}
`;

const SETUP_JS =
  "document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('button[data-copy]');" +
  "if(!b){return;}var t=document.getElementById(b.getAttribute('data-copy'));if(!t){return;}t.select();" +
  "try{navigator.clipboard.writeText(t.value);}catch(x){document.execCommand('copy');}b.textContent='Copied';});";

export function setupHtml(opts: { origin: string; viewSecret: string; people: PersonConfig[]; nonce: string }): string {
  const { origin, viewSecret, people, nonce } = opts;
  const sections = people
    .map((p) => {
      const bm = bookmarkletUrl(origin, p.pushToken);
      return (
        `<section><h2>${esc(p.name)}</h2>` +
        `<p><a class="bm" href="${esc(bm)}">Push my NLB bookings</a></p>` +
        `<p class="muted">Desktop: drag the button above to your bookmarks bar.<br />
        Mobile: copy the text below, create a bookmark, and paste it as the address (type <code>javascript:</code> yourself if the browser strips it).</p>` +
        `<textarea id="bm-${esc(p.id)}" readonly rows="4">${esc(bm)}</textarea>` +
        `<button type="button" data-copy="bm-${esc(p.id)}">Copy bookmarklet</button>` +
        `<p><a href="${esc(userscriptUrl(origin, viewSecret, p.id))}">Install the userscript</a> ` +
        `<span class="muted">(Violentmonkey or Tampermonkey; pushes automatically)</span></p></section>`
      );
    })
    .join('');
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="robots" content="noindex, nofollow, noarchive">' +
    '<meta name="referrer" content="no-referrer">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Setup</title>' +
    `<style nonce="${esc(nonce)}">${SETUP_CSS}</style></head><body><main>` +
    '<h1>Set up your push</h1>' +
    '<p class="muted">Each push client is pre-filled with this deployment\'s address and your private push token. Do not share these links or take screenshots of this page.</p>' +
    sections +
    `</main><script nonce="${esc(nonce)}">${SETUP_JS}</script></body></html>`
  );
}
