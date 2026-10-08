// Builds spike/s1-bookmarklet.txt from spike/s1-probe.js (plain Node, no deps).
// Naive minifier: see the constraints at the top of s1-probe.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 's1-probe.js'), 'utf8');

const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('//'))
  .join(' ');

new vm.Script(code); // syntax check of the minified code; throws on error (does not execute)

// Percent-encode what is unsafe in a pasted URL: %, #, and non-ASCII. Plain spaces stay (shorter).
const body = code.replace(/[%#]|[^\x20-\x7e]/g, (c) => encodeURIComponent(c));
const url = 'javascript:' + body;

writeFileSync(join(dir, 's1-bookmarklet.txt'), url, 'utf8');
console.log('wrote s1-bookmarklet.txt, ' + Buffer.byteLength(url) + ' bytes');
