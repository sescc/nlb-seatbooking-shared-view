// Generates this deployment's secrets and installs them into YOUR Cloudflare account:
//   VIEW_SECRET  the unguessable path of the shared page
//   PEOPLE       JSON [{id, name, pushToken}] - display names and per-person push tokens
// Nothing generated here is ever written to the repository: .dev.vars (for `npm run dev`) is git-ignored.
//
// Usage:  npm run init-secrets                         (prompts for 2-5 names)
//         npm run init-secrets -- Alice Bob            (names as arguments)
//         npm run init-secrets -- Alice Bob --url=https://nlb-shared-view.you.workers.dev
//   --url=<url>    print the full setup URL (otherwise a placeholder is shown)
//   --local-only   only write .dev.vars; do not call wrangler
//   --force        overwrite an existing .dev.vars
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 5;

// 32 random bytes = 256 bits, base64url (43 characters).
export function generateSecret() {
  return randomBytes(32).toString('base64url');
}

// 2-5 distinct display names. They live only in the Worker secret, so any text is fine except what
// would break the .dev.vars line (control characters, '#').
export function validateNames(raw) {
  const names = raw.map((n) => String(n).trim());
  if (names.length < MIN_PEOPLE || names.length > MAX_PEOPLE) {
    throw new Error(`Need ${MIN_PEOPLE} to ${MAX_PEOPLE} names, got ${names.length}.`);
  }
  const seen = new Set();
  for (const n of names) {
    if (n.length < 1 || n.length > 32) throw new Error('Each name must be 1 to 32 characters.');
    if (/[\u0000-\u001f\u007f#]/.test(n)) throw new Error(`Name "${n}" contains a control character or '#'.`);
    if (seen.has(n.toLowerCase())) throw new Error(`Duplicate name "${n}".`);
    seen.add(n.toLowerCase());
  }
  return names;
}

// ids are neutral letters (a, b, c, ...) because they appear in URLs; the names do not.
export function buildSecrets(rawNames, gen = generateSecret) {
  const names = validateNames(rawNames);
  const people = names.map((name, i) => ({ id: String.fromCharCode(97 + i), name, pushToken: gen() }));
  return { viewSecret: gen(), people, peopleJson: JSON.stringify(people) };
}

export function devVarsText({ viewSecret, peopleJson }) {
  return `VIEW_SECRET=${viewSecret}\nPEOPLE=${peopleJson}\n`;
}

export function setupUrl(workerUrl, viewSecret) {
  const base = (workerUrl || '<your workers.dev URL>').replace(/\/+$/, '');
  return `${base}/setup/${viewSecret}`;
}

// The secret travels on stdin only: never on the command line (shell history, process list) and never logged.
// shell:true so `npx` resolves on Windows; the command string is fixed text.
export function putSecret(name, value, run = spawnSync) {
  const result = run(`npx wrangler secret put ${name}`, {
    input: value,
    shell: true,
    cwd: root,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`wrangler secret put ${name} failed (exit ${result.status}).`);
}

async function askNames() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const names = [];
  try {
    console.log(`Enter ${MIN_PEOPLE} to ${MAX_PEOPLE} display names, one per line. Finish with an empty line.`);
    while (names.length < MAX_PEOPLE) {
      const line = (await rl.question(`Name ${names.length + 1}: `)).trim();
      if (line === '') {
        if (names.length >= MIN_PEOPLE) break;
        console.log(`Need at least ${MIN_PEOPLE} names.`);
        continue;
      }
      names.push(line);
    }
  } finally {
    rl.close();
  }
  return names;
}

export async function main(argv) {
  const flags = argv.filter((a) => a.startsWith('--'));
  const positional = argv.filter((a) => !a.startsWith('--'));
  const url = flags.find((f) => f.startsWith('--url='))?.slice('--url='.length);
  const localOnly = flags.includes('--local-only');
  const force = flags.includes('--force');

  const names = positional.length > 0 ? positional : await askNames();
  const { viewSecret, people, peopleJson } = buildSecrets(names);

  if (!localOnly) {
    console.log('Installing secrets into your Cloudflare account (you must be logged in: npx wrangler login)...');
    putSecret('VIEW_SECRET', viewSecret);
    putSecret('PEOPLE', peopleJson);
  }

  const devVars = join(root, '.dev.vars');
  if (existsSync(devVars) && !force) {
    console.log('.dev.vars already exists; left unchanged (use --force to overwrite).');
  } else {
    writeFileSync(devVars, devVarsText({ viewSecret, peopleJson }), { encoding: 'utf8', mode: 0o600 });
    console.log('Wrote .dev.vars for local development (git-ignored).');
  }

  console.log(`\nGenerated a view secret and ${people.length} push tokens (${people.map((p) => p.id).join(', ')}).`);
  console.log('Next: npm run deploy, then open this private setup page:\n');
  console.log(`  ${setupUrl(url, viewSecret)}\n`);
  console.log('Anyone with that link can read the shared view. Do not share it or post screenshots of it.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
