# board — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that realises it.
> Keep in sync WITH the code (§6.3). Planned targets are written as plain text (not backticked)
> until built, so the drift check only verifies real refs. Note: drift-check resolves against
> `git ls-files` — new files must be at least staged (`git add -N`) to resolve.

## Morphisms / objects → code
| Morphism / object | Realising code | State |
| --- | --- | --- |
| Worker entry (default export `fetch`, exports `Board`) | `worker/src/index.ts` (default export delegating to `worker/src/router.ts:handle`; re-exports `worker/src/board.ts:Board`) | built |
| router (`Path → Handler`) | `worker/src/router.ts:handle` | built |
| guard (natural transformation over all routes) | `worker/src/router.ts:applyGuard` | built |
| bare 404 (shared by every miss) | `worker/src/router.ts:notFound` | built |
| ingest ⊸ (`Person × PushPayload → Snapshot`) | `worker/src/router.ts:handlePush` + `worker/src/board.ts:Board` (`put`) | built |
| raw-body 64 KB cap | `worker/src/router.ts:readBodyCapped` | built |
| personOf? (token → Person) | `worker/src/config.ts:findPerson` | built |
| constant-time compare | `worker/src/config.ts:timingSafeEqual` | built |
| Person / VIEW_SECRET from secrets (URL-safe, ≥ 16 chars) | `worker/src/config.ts:parseConfig` | built |
| Bindings (BOARD, VIEW_SECRET, PEOPLE) | `worker/src/env.d.ts:Cloudflare` | built |
| Snapshot store, owner, rate limit | `worker/src/board.ts:Board` | built |
| boardView (deduced on read) | `worker/src/board.ts:Board` (`board`) | built |
| buildPushClient (`/setup`) | `worker/src/pages.ts:bookmarkletUrl`, `worker/src/pages.ts:userscriptFile`, `worker/src/pages.ts:setupHtml` | built |
| viewer page (shell from the viewer component) | `worker/src/pages.ts:viewerHtml` | built |
| browser bundles → Worker strings | `scripts/build.mjs` (writes `worker/src/generated/assets.ts`, git-ignored) | built |
| init-secrets script | `scripts/init-secrets.mjs:main` (`generateSecret`, `buildSecrets`, `putSecret`) | built |
| wrangler config (DO binding, SQLite migration, no vars) | `wrangler.toml` | built |

## Composition rules → where enforced
| Rule (ARCHITECTURE §6) | Enforced at | Tested at |
| --- | --- | --- |
| 1. at most one Snapshot per Person; a later push replaces it (later `receivedAt` wins) | `worker/src/board.ts:Board` (`snapshot.person_id` PRIMARY KEY, `INSERT OR REPLACE`) | `worker/src/board.test.ts`: "a later push replaces the earlier one entirely", "an empty push clears the bookings but keeps the snapshot"; `worker/src/router.test.ts`: "a later push replaces the earlier bookings (cancellation disappears)", "an empty push clears that person only" |
| 1a. server stamps `receivedAt` (D26); a push carries no device clock (no `v`, no `pushedAt`; the 5-minute skew rule is gone) | `worker/src/router.ts:handlePush` (`msToSgtIso(nowMs)`), `worker/src/board.ts:Board` (no `pushed_at` column) | `worker/src/router.test.ts`: "the server stamps receivedAt from its own clock; no device clock exists in the stored snapshot", "a push needs no device clock: a bare array of rows is the whole body"; `worker/src/board.test.ts`: "the snapshot table stores no device clock (columns: person_id, received_at, json)" |
| 1b. ≤ 1 push per person per 2 s | `worker/src/board.ts:Board` (`put` → `'rate_limited'`) → 429 in `worker/src/router.ts:handlePush` | `worker/src/board.test.ts`: "rate limit: a second push under 2 s later is rejected and changes nothing", "rate limit: exactly 2 s later is accepted", "rate limit is per person"; `worker/src/router.test.ts`: "second push by the same person within 2 s -> 429; after 2 s it is accepted" |
| 1c. payload ≤ 64 KB, checked on the raw body before parsing | `worker/src/router.ts:readBodyCapped` | `worker/src/router.test.ts`: "body over 64 KB -> 400 and the previous snapshot remains (JSON and form)", "a body just under 64 KB is accepted", "the cap applies to the real body, not just a Content-Length header" |
| 1d. malformed body → 400 (not JSON, no `rows` field, not an array, > 200 rows), snapshot unchanged; rows `extract` cannot use are ignored | `worker/src/router.ts:handlePush` (`invalid`) via `shared/src/payload.ts:ingestRows` | `worker/src/router.test.ts`: "malformed JSON -> 400 …", "form push without a rows field -> 400", "a body that is not an array (%s) -> 400", "more than 200 rows -> 400, exactly 200 -> accepted", "rows the extractor cannot use are ignored; the usable ones are stored" |
| 1e. a push stores booking fields only: the server re-applies the row whitelist, runs `extract` (`infoJson`/Purpose is reduced to `pax`) and rebuilds the payload | `shared/src/payload.ts:ingestRows` (`trimRow` → `extract` → `validatePayload`) used by `worker/src/router.ts:handlePush` | `worker/src/router.test.ts`: "stores bookings only: profile fields and any other keys on a pushed row are ignored", "Purpose inside infoJson is accepted on the wire but never stored or served", "offset-less NLB times are taken as SGT" |
| 2. Board / Overlap / Staleness never persisted | `worker/src/board.ts:Board` (only the `snapshot` table exists; `board` builds the view per call) | `worker/src/board.test.ts`: "persists only the snapshot table: boards, overlaps and staleness are never stored" |
| 3. no outbound `fetch` anywhere in the Worker | `worker/src/router.ts:handle` and all of `worker/src/*.ts` (no network code) | `worker/src/router.test.ts`: "makes zero outbound fetch calls across a push, a board read, the viewer and the setup pages" (spy on `globalThis.fetch`, with a positive control); `worker/src/privacy.test.ts`: "<file> makes no outbound requests", "NLB's host appears only in the userscript @match header …", "the Worker stores no NLB credentials, cookies or tokens …" |
| 4. secrets compare in constant time | `worker/src/config.ts:timingSafeEqual` (SHA-256 digests via `crypto.subtle`, then a full byte loop), `worker/src/config.ts:findPerson` (no early exit) | `worker/src/config.test.ts`: "compares SHA-256 digests (crypto.subtle.digest) rather than the strings directly", "checks every person (no early exit) …", "true for equal strings, false otherwise" |
| 4a. error bodies reveal nothing; wrong secret / unknown path / `/` / wrong token / view secret as token are byte-identical 404s | `worker/src/router.ts:notFound` (one shared response), token check before body parse in `worker/src/router.ts:handlePush` | `worker/src/router.test.ts`: "are identical in status, headers (except date) and body for every kind of miss", "a wrong token is a 404 even when the body is garbage (no token oracle)", "a misconfigured Worker (bad PEOPLE) answers every route with the same bare 404", "using the view secret as a push token is a bare 404 and changes nothing" |
| 4b. guard headers on every response (noindex, no-referrer, nosniff, no-store; CSP + nonce on HTML) | `worker/src/router.ts:applyGuard` | `worker/src/router.test.ts`: "are set on success, error, redirect, no-content, rate-limit and 404 responses", "HTML responses carry the CSP with a per-request nonce that matches the page", "pages load no third-party resources and are marked noindex"; "is wired as the Worker default export (SELF)" |
| 4c. unexpected errors reveal nothing | `worker/src/router.ts:handle` (empty 500, still guarded) | `worker/src/router.test.ts`: "unexpected errors become an empty 500, still guarded, with no secret in the body" |
| 5. Person / secrets only from Worker secrets; nothing deployment-specific in git | `worker/src/config.ts:parseConfig`, `wrangler.toml` (no `[vars]`, account id, routes), `.gitignore`, `scripts/init-secrets.mjs:buildSecrets` | `worker/src/config.test.ts`: "rejects: %s", "the rejection reason never contains a secret value"; `worker/src/privacy.test.ts`: "wrangler.toml has no vars, secrets, account id, routes or custom domains", "binds only the BOARD Durable Object, with a SQLite migration", ".dev.vars and generated files are git-ignored …"; `scripts/init-secrets.test.mjs`: "produces exactly what the Worker accepts (round-trip through parseConfig)", "pipes the value on stdin, with a fixed command line that never contains it" |
| 6. view link is read-only | `worker/src/router.ts:handlePush` (`findPerson` only knows push tokens) | `worker/src/router.test.ts`: "using the view secret as a push token is a bare 404 and changes nothing", "a push token cannot read the board or the setup page" |
| 7. `/setup` pre-fills this deployment's origin and each person's token | `worker/src/pages.ts:setupHtml`, `worker/src/pages.ts:userscriptFile` | `worker/src/router.test.ts`: "GET /setup/<view> lists every person with their own token and this origin", "GET /setup/<view>/<id>.user.js serves the userscript as text/javascript"; `worker/src/pages.test.ts`: "contains each person's token (in their bookmarklet) and the userscript links", "@connect is the request host (no port, no scheme)", "has @updateURL and @downloadURL pointing at its own /setup URL" |

## Notes / divergences
- Routing and the guard live in `worker/src/router.ts` (`handle(request, env, nowMs)`), not in `index.ts`.
  `index.ts` is a thin entry that passes `Date.now()`. This keeps the clock injectable for the 2 s rate-limit and
  5-minute skew tests, and keeps non-handler exports out of the Worker entry module.
- `pages.ts` (design.md layout) holds `/setup` templating; there is no `worker/src/setup.ts`.
- The Worker adds `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` to every response, in addition to
  the two headers required by the spec.
- An oversize body is rejected with 400 `invalid payload: body larger than 64 KB` (design.md lists no 413).
- Both pushes and board reads use one Board instance, `idFromName('board')`.
- A misconfigured Worker (invalid `VIEW_SECRET` / `PEOPLE`) answers every route with the bare 404 and logs only the
  reason (never a value). Secrets must be at least 16 characters.
- `board()` reports `serverNow` and stores `receivedAt` as SGT (`+08:00`) strings.
- **Wire format change (D41–D43):** the push body is a JSON array of trimmed raw NLB rows (form field `rows`, or the JSON body itself). The Worker runs `ingestRows` (whitelist → `extract` → `validatePayload`): `extract` is placed at L2. `PushPayload` is `{ bookings }`; `Snapshot` and the DO table have no `pushedAt`/`pushed_at`.
- Secrets (`VIEW_SECRET`, push tokens) must now match `[A-Za-z0-9_-]{16,}`: they sit in URL paths and are embedded unescaped in the bookmarklet (`scripts/init-secrets.mjs` already produces base64url).
- Order of operations in the README: `init-secrets` runs before the first `deploy`. Verified in the installed
  wrangler source: `secret put` on a not-yet-deployed Worker offers to create it and, with piped stdin (non-interactive),
  defaults to yes. Not exercised against a real Cloudflare account.
- Compatibility date `2026-10-01` is the newest the bundled workerd accepted when tested.
