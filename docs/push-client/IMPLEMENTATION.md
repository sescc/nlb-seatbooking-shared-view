# push-client — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that realises it.
> Keep in sync WITH the code (§6.3). Planned targets are written as plain text (not backticked)
> until built, so the drift check only verifies real refs. Note: drift-check resolves against
> `git ls-files` — new files must be at least staged (`git add -N`) to resolve.

## Morphisms / objects → code
| Morphism / object | Realising code | State |
| --- | --- | --- |
| getAccountInfo ⊸ (same-origin GET; bookmarklet has no Vuex fallback) | `push/bookmarklet.ts:runBookmarklet` | built |
| trim (`NlbBooking* → whitelisted rows`; replaces `wrap`, there is no `v` / `pushedAt`) | `shared/src/booking.ts:trimRow` (key list `shared/src/booking.ts:NLB_ROW_KEYS`, inlined into both clients by `scripts/build.mjs`) | built |
| extract | not at L1 any more: placed at L2, see `shared/src/payload.ts:ingestRows` | n/a |
| T1 form POST (bookmarklet; field `rows`) | `push/bookmarklet.ts:runBookmarklet` | built |
| bookmarklet esbuild entry (binds the Worker-injected origin + token) | `push/bookmarklet.entry.ts` | built |
| "Log in to NLB first" (`alert`) | `push/bookmarklet.ts:LOGIN_MESSAGE` | built |
| T1' GM_xmlhttpRequest (userscript; JSON array of rows) | `push/userscript.ts:startUserscript` | built |
| toasts (CSSOM only; userscript) | `push/common.ts:showMessage` | built |
| push URL | `push/common.ts:pushUrl` | built |
| logged-in check (userscript never pushes a partial account) | `push/common.ts:hasBookings` | built |
| origin + token templating (T4, `/setup`) | `worker/src/pages.ts:bookmarkletUrl`, `worker/src/pages.ts:userscriptFile` (bundles from `scripts/build.mjs`) | built |
| fake DOM for tests (rejects what NLB's CSP forbids) | `push/testing.ts:FakeDocument` | built |
| spike S1 probe (throwaway) | `spike/s1-probe.js` | built |

## Composition rules → where enforced
| Rule (ARCHITECTURE §6) | Enforced at | Tested at |
| --- | --- | --- |
| 1. no cross-origin `fetch` / `sendBeacon` from NLB's page | `push/bookmarklet.ts:runBookmarklet` (the only network call is a same-origin relative GET; the rows leave by form POST), `push/userscript.ts:startUserscript` (GM_xmlhttpRequest) | `push/bookmarklet.test.ts`: "reads GetAccountInfo same-origin (relative URL, session credentials), once, read-only", "submits a POST form to the push URL in a new tab, with utf-8 charset and one field named rows"; `worker/src/pages.test.ts`: "only talks to NLB same-origin and to the bound origin (no hard-coded hosts)"; `push/bundle.test.ts`: "logged in: submits the trimmed rows to this deployment with this token" |
| 2. no NLB write endpoint is called (read-only) | `push/common.ts:ACCOUNT_API` is the only NLB URL, and it is GET | `push/bookmarklet.test.ts`: "reads GetAccountInfo same-origin …"; `push/bundle.test.ts`: "logged in: submits …" (the only fetched URL is GetAccountInfo) |
| 3. origin and push token are templated in at /setup time; the repository holds templates only | `worker/src/pages.ts:bookmarkletUrl`, `worker/src/pages.ts:userscriptFile`, `worker/src/pages.ts:setupHtml` | `worker/src/pages.test.ts`: "binds this deployment origin and the person token as string literals", "binds the origin and this person's token as JSON string literals", "is a single-line javascript: URL"; `worker/src/privacy.test.ts`: ".dev.vars and generated files are git-ignored …" |
| 4. userscript toasts use the CSSOM only (NLB's CSP blocks style attributes and `<style>`); the bookmarklet has no UI (an `alert`) | `push/common.ts:showMessage` | `push/bookmarklet.test.ts`: "showMessage (userscript toast; CSSOM-only styling) > is styled via element.style only …", "removes itself after the timeout and on click"; `worker/src/pages.test.ts`: "carries the row whitelist and nothing else: no profile keys, no extract, no style attributes" |
| 5. only the whitelisted row keys leave the page; no profile data; visit bookings excluded | `shared/src/booking.ts:trimRow` / `NLB_ROW_KEYS` used by `push/bookmarklet.ts:runBookmarklet` and `push/userscript.ts:startUserscript`; the server re-applies it (`shared/src/payload.ts:ingestRows`) | `push/bookmarklet.test.ts`: "the rows field is a bare JSON array (no version, no device clock) of whitelisted keys only", "profile data and visit bookings never appear in the request"; `push/userscript.test.ts`: "sends bookings only: no profile data, no visit bookings", "POSTs a JSON array of trimmed rows …"; `push/bundle.test.ts` (both served bundles, executed); `shared/src/booking.test.ts`: "NLB_ROW_KEYS / trimRow …" |
| 5a. what a client sends is what the server accepts | `shared/src/payload.ts:ingestRows` | `push/bookmarklet.test.ts`: "what it sends is exactly what the server accepts (round-trip through ingestRows)"; `push/userscript.test.ts` and `push/bundle.test.ts` (`ingestRows(rows).ok`) |
| 6. nothing is sent when logged out; a partial account never clears a lane | `push/bookmarklet.ts:runBookmarklet` (a missing `accountInfo`/`bookings` throws into the `catch` → `alert`), `push/common.ts:hasBookings` + `push/userscript.ts:startUserscript` | `push/bookmarklet.test.ts`: "bookmarklet: logged out or broken" (alert once, no submission; no bookings array → no push); `push/userscript.test.ts`: "does not push when not logged in (no bookings array)", "does not push when bookings disappear (logout) …" |
| 7. userscript pushes on load and (debounced 3 s) when `state.accountInfo.bookings` changes | `push/userscript.ts:startUserscript` | `push/userscript.test.ts`: "pushes once on load when logged in, after the debounce", "pushes again when state.accountInfo.bookings changes", "debounces a burst of changes into one push carrying the latest state", "ignores mutations that do not replace the bookings", "polls until the Vuex store appears, then proceeds", "gives up after about a minute instead of polling forever" |
| 8. the served bookmarklet fits in 1,000 bytes (Android Chrome truncates long bookmark URLs) | `push/bookmarklet.ts` (minimal), `scripts/build.mjs` (minified IIFE), `worker/src/pages.ts:bookmarkletUrl` (only `%`, `#`, non-ASCII are escaped) | `worker/src/pages.test.ts`: "is at most 1,000 bytes with a realistic 60-char https origin and a 43-char token …" |
| 9. the served clients run end to end | `scripts/build.mjs` (esbuild IIFE bundles), `worker/src/pages.ts` | `push/bundle.test.ts`: "served bookmarklet, executed", "served userscript, executed", "does not define any global (no pollution of the NLB page)" |

## Notes / divergences
- **Wire format change (D41–D43):** both clients send trimmed raw NLB rows (`NLB_ROW_KEYS`): a form field `rows` (bookmarklet) or the JSON array
  itself (userscript). No `v`, no `pushedAt`, no `extract` on the page; `extract` runs on the server.
- `push/userscript.ts` replaces the planned `push/nlb-push.user.js`; the userscript is generated by the Worker (header + bundle),
  not stored as a file in the repository.
- The bookmarklet logic is `push/bookmarklet.ts` (importable by tests); the esbuild entry `push/bookmarklet.entry.ts` calls it with the
  Worker-bound names, so the bundle carries no auto-run guard. `push/userscript.ts` keeps the guard (its size does not matter).
- The bookmarklet has no Vuex fallback, no CSSOM overlay and no `extract`; any failure to get `accountInfo.bookings` (HTTP error, network
  error, non-JSON, `accountInfo: null`, no bookings array) ends in `alert('Log in to NLB first')`.
- The bookmarklet binds the origin and token as unescaped string literals, so the Worker only accepts URL-safe secrets
  (`worker/src/config.ts:parseConfig`).
- The userscript header also grants `unsafeWindow` (needed to reach `#app.__vue__.$store`), and adds `@noframes`,
  `@updateURL` and `@downloadURL`. `@version` is fixed at 1.0.0, so managers will not see an update until it is bumped.
- Failure toasts ("push failed (status)") are shown in addition to the specified "pushed ✓"; a 429 is silent.
- Served bookmarklet size: 911 bytes as the final single-line `javascript:` URL with a 60-char https origin and a 43-char token
  (743 B of minified code).
- Open (spike S1): whether Chrome on Android can run a bookmarklet under NLB's CSP; the userscript is the fallback realisation.
