# Design: add-shared-view

The intent model lives in `docs/architecture-map.md` and `docs/{domain,push-client,board,viewer}/ARCHITECTURE.md`.
This file fixes only the build-level contracts the parallel implementers need.

## Model delta (FRAMEWORK §2)
New objects: `Booking`, `Block` (deduced), `PushPayload`, `Snapshot`, `Person`, `Board`, `Overlap` (deduced), `Staleness` (deduced).
- **§3 Consolidation:** seat and room are one `Booking` with `kind`. `Block` is a deduced display view over `Booking*`, not a stored object.
- **Coherence laws to keep (§4.5):**
  - Law 1: the viewer only reads `Board` from T3.
  - Law 4: no component except push-client touches NLB.
  - Law 6: `validatePayload` is placed at L1 and L2.

## Facts from spike S1 (real NLB data, 2026-10-08)
- `GET /seatbooking/api/accounts/GetAccountInfo` returns 200 to a same-origin bookmarklet fetch. A bookmarklet runs under NLB's CSP in desktop Chrome 154.
  - Response shape: `{settings, accountInfo, action, branchId}`.
  - `accountInfo` keys: `name, userId, accountType, accountId, email, dailyBookingQuotas, advancedBookingQuotas, visitBookingMonthlyCountsForNonNlbUser, bookings, visitBookings, allowAdvanceBooking`.
- The Vuex store is reachable at `document.querySelector('#app').__vue__.$store.state.accountInfo.bookings`.
- Booking keys:
  - `bookingId (number), bookingRefId ("NLB####S#####" for BOTH seats and rooms), bookingTimeslotInMinutes, branchId, facilityId, lastAction (string)`;
  - `actions (string[])`, e.g. `["Book"]`, `["Book","ManualFullCancel"]`, `["Book","AutoCheckIn"]`;
  - `seat` (e.g. "S145", "R3"), `area` (e.g. "Long Study Space", "Discussion Room"), `areaInformation (object|null)`, `areaIgnoreHolidays, floor ("4"), branchName`;
  - `startTime`/`endTime` as **offset-less local SGT** ISO strings, e.g. `"2026-10-08T11:00:00"`;
  - `areaImageUrls, mapUrls, infoJson`: rooms have a JSON string `{"NumberOfPeople":"2","Purpose":"..."}`, seats have an unparseable/empty value;
  - `canCancelStatus, canCheckInStatus, canExtendStatus`.
- **Each hour is a separate row**, so a 4-hour hold is 4 rows.
- Cancelled bookings are still returned. There is no `pax` field.

## Repo layout & tooling
```
package.json            scripts: build, test, dev, deploy, init-secrets, typecheck
tsconfig.json           strict, ES2022, moduleResolution bundler
vitest.config.ts        projects: "unit" (node env: shared/, web/, push/) and "worker" (@cloudflare/vitest-pool-workers: worker/)
wrangler.toml           name = "nlb-shared-view", main = "worker/src/index.ts", compatibility_date, DO binding BOARD → class Board, migrations new_sqlite_classes=["Board"]. NO vars, NO secrets.
.gitignore              node_modules, .wrangler, .dev.vars, worker/src/generated/
.dev.vars.example       VIEW_SECRET=…, PEOPLE=[{"id":"a","name":"Alice","pushToken":"…"},…]
shared/src/types.ts     all types below
shared/src/booking.ts   extract(), mapStatus(), detectKind(), toSgtIso()
shared/src/payload.ts   validatePayload()
shared/src/blocks.ts    mergeBlocks()
shared/src/overlap.ts   computeOverlaps()
shared/src/staleness.ts computeStaleness()
shared/src/time.ts      SGT helpers: sgtDate(iso), sgtHHMM(iso), addMinutes
web/app.ts              viewer entry (poll + render); web/render.ts pure render(board, nowIso): string
push/bookmarklet.ts     bookmarklet entry (reads globals __NLBSV_ORIGIN__, __NLBSV_TOKEN__ injected at /setup time)
push/userscript.ts      userscript body (same injected globals)
scripts/build.mjs       esbuild: bundles web/app.ts, push/bookmarklet.ts, push/userscript.ts as minified IIFE strings → worker/src/generated/assets.ts (export const VIEWER_JS, BOOKMARKLET_JS, USERSCRIPT_JS)
scripts/init-secrets.mjs  generates secrets and runs `wrangler secret put` (prompts for 2+ names)
worker/src/index.ts     router + guard
worker/src/board.ts     Board Durable Object
worker/src/pages.ts     viewerHtml(), setupHtml(), userscriptFile()
worker/src/config.ts    parse PEOPLE / VIEW_SECRET from env; constant-time compare
```
The viewer is **served by the Worker** as HTML with the JS inlined behind a CSP nonce. There are **no Workers static assets**, so no public asset path reveals the deployment.

## Types (shared/src/types.ts), exact
```ts
export type Kind = 'seat' | 'room';
export type Status = 'booked' | 'checked_in' | 'cancelled' | 'partial_cancelled';
export interface Booking {
  ref: string; kind: Kind; library: string; area: string; floor: string;
  unit: string;            // NLB `seat` field: "S201" or "R3"
  start: string; end: string; // ISO with +08:00, e.g. "2026-10-08T11:00:00+08:00"
  pax?: number;            // rooms only, from infoJson.NumberOfPeople
  status: Status; actions: string[];
}
// Wire format (D41): JSON array of trimmed raw NLB rows, keys limited to NLB_ROW_KEYS
// = bookingRefId, bookingId, seat, area, floor, branchName, startTime, endTime, actions, infoJson.
// Form POST: field `rows`; userscript: the array as the JSON body. No device pushedAt (D42).
export type NlbRow = Partial<Record<(typeof NLB_ROW_KEYS)[number], unknown>>;
export interface Person { id: string; name: string }                // public view of a person
export interface PersonConfig extends Person { pushToken: string }  // secret
export interface Snapshot { personId: string; receivedAt: string; bookings: Booking[] }
export interface Board { serverNow: string; people: Person[]; snapshots: Record<string, Snapshot | null> }
export interface Block { personId: string; refs: string[]; kind: Kind; library: string; area: string; floor: string; unit: string; start: string; end: string; pax?: number; status: Status }
export interface Overlap { kind: 'both_booked' | 'seat_in_partner_room' | 'duplicate_rooms'; start: string; end: string;
  a: { personId: string; unit: string; kind: Kind }; b: { personId: string; unit: string; kind: Kind };
  redundantSeat?: { personId: string; unit: string } }
export interface Staleness { personId: string; receivedAt: string | null; ageMin: number | null; unverifiedRefs: string[] }
```

## Domain rules (exact)
- `toSgtIso(s)`: if `s` already ends with `Z` or `±HH:MM`, convert it to the +08:00 representation. Otherwise append `+08:00`. Output is always `YYYY-MM-DDTHH:MM:SS+08:00`.
- `detectKind(nb)`: `room` iff `infoJson` parses (string or object) to an object with a non-null `NumberOfPeople`; else `seat`. `pax = parseInt(NumberOfPeople, 10)` when finite.
- `mapStatus(actions)`, in precedence order:
  1. any action matching `/FullCancel$/` → `cancelled`;
  2. else `/PartialCancel$/` → `partial_cancelled`;
  3. else `/CheckIn$/` → `checked_in`;
  4. else `booked`.
- `extract(input)`:
  - It accepts the full GetAccountInfo response, an `accountInfo` object, or a bookings array.
  - It reads ONLY `bookings[]` and never touches visitBookings or profile keys.
  - It drops rows missing `startTime`, `endTime` or `seat`. `ref = String(bookingRefId ?? bookingId)`.
- **Ingest pipeline (L2, D41):** body → must be an array of at most 200 rows → each row is trimmed to `NLB_ROW_KEYS` (defence in depth) → `extract` → validate the `Booking[]`.
  - Validation type-checks every field and requires `start < end` with the +08:00 ISO format.
  - It returns `{ok:true, bookings}` or `{ok:false, reason}`.
  - The 64 KB size cap is checked by the Worker on the raw body before parsing.
  - The superseded device-`pushedAt` 5-minute-skew rule is gone (D42).
  - `infoJson.Purpose` may arrive on the wire but is never stored, because `extract` keeps only `pax`.
- `mergeBlocks(personId, bookings)`: sort by start. Merge row r into the current block when it has the same `library, area, unit, kind, status` and `r.start === block.end`. `refs` accumulates; `pax` is the max.
- `computeOverlaps(board)`:
  - Build blocks per person, excluding `cancelled`. For each pair of persons, check each block pair.
  - If `max(start) < min(end)`, emit `both_booked` with the intersection.
  - If one block is a room and the other a seat, emit instead `seat_in_partner_room` with `redundantSeat` = the seat's person/unit.
  - If both blocks are rooms, emit instead `duplicate_rooms`. This is the core duplication the tool exists to prevent (D38). The viewer marks both rooms "duplicate room".
  - Exactly one Overlap is emitted per block pair.
  - Times compare as instants. Use `Date.parse`, which handles the +08:00 offset.
- `computeStaleness(board, nowIso)`: per person:
  - `receivedAt`, and `ageMin = floor((now - receivedAt)/60000)`; when there is no snapshot, `ageMin` is null.
  - `unverifiedRefs`: bookings with `status === 'booked'` where `now ≥ start+15min` and `receivedAt < start+15min`.

## Worker contracts
- **Env:** `BOARD` (DO namespace), `VIEW_SECRET` (string), `PEOPLE` (JSON `PersonConfig[]`, 1–5 entries, unique ids `[a-z0-9]{1,16}`).
- **Routes:**
  - `GET /v/:view` → viewer HTML.
  - `GET /api/:view/board` → `Board` JSON with `Cache-Control: no-store`.
  - `POST /push/:token`:
    - form (`application/x-www-form-urlencoded`, field `rows`) → **303** `Location: /v/<VIEW_SECRET>?pushed=<personId>`;
    - JSON → **204**;
    - bad payload → **400** with text `invalid payload: <reason>`;
    - under 2 s since that person's last accepted push → **429**.
  - `GET /setup/:view` → setup HTML.
  - `GET /setup/:view/:personId.user.js` → userscript (`text/javascript`).
  - `GET /robots.txt` → `User-agent: *\nDisallow: /`.
  - Everything else, and any wrong secret or token → **404**, empty body, identical bytes.
- **Guard:** it is applied to every response.
  - It sets `X-Robots-Tag: noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`.
  - HTML responses also get `Content-Security-Policy: default-src 'none'; script-src 'nonce-<n>'; style-src 'nonce-<n>'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
- **Secrets:** all secret comparisons are constant time (compare SHA-256 digests or use a timing-safe loop).
- **Board DO** (`idFromName("board")`): SQLite table `snapshot(person_id TEXT PRIMARY KEY, received_at TEXT, json TEXT)`.
  - RPC methods: `put(personId, payload, receivedAt)`, which returns `'ok' | 'rate_limited'`; and `board(people)`, which returns `Board`.
- **No `fetch()` to any external host anywhere in worker/.**

## Push clients
**Bookmarklet:** this is the minimal version (D41/D43), because Android Chrome hard-truncates long bookmark URLs.
- **Size budget:** at most 1,000 bytes as served, origin and token included.
- **Steps:**
  1. Fetch GetAccountInfo.
  2. If `accountInfo.bookings` is missing, or anything fails, `alert('Log in to NLB first')`.
  3. Otherwise trim each row to `NLB_ROW_KEYS` and submit a hidden `<form method=POST action=ORIGIN+'/push/'+TOKEN target=_blank accept-charset=utf-8>` with field `rows`.
- No Vuex fallback, no overlay, and no `extract` on the page.

/setup wraps the bundled IIFE as `javascript:` + `encodeURIComponent`-safe text, with the origin and token injected as string literals.

**Userscript:**
- Header: `@match https://www.nlb.gov.sg/seatbooking/*`, `@grant GM_xmlhttpRequest`, `@connect <worker host>`, `@run-at document-idle`.
- It waits for `unsafeWindow` `#app.__vue__.$store`.
- It subscribes to store mutations. Whenever `state.accountInfo.bookings` changes, it debounces 3 s, then sends the trimmed rows (same `NLB_ROW_KEYS`) as JSON via `GM_xmlhttpRequest`.
- It also pushes once on load when logged in.
- It shows a small transient "pushed ✓" toast, styled with CSSOM.

## Viewer
`render(board, nowIso): string` is pure and HTML-escapes all data.
- **Sections:** Today and Tomorrow are SGT calendar days of `nowIso`.
- **Timeline:** an hour grid from 08:00 to 22:00, with one lane per person.
  - Room blocks render spanning all lanes, labelled `"<unit> · booked by <name> · <pax> pax"`.
  - Cancelled blocks are struck through.
  - Overlap ranges are highlighted, and redundant seats get a "possibly redundant" badge.
  - A block shows an "unverified" badge if any of its refs is unverified.
- **List:** follows each day's timeline.
- **Lane headers:** `pushed HH:MM (X min ago)` or `never pushed`.
- **Updates:**
  - `app.ts` polls `/api/<view>/board` every 5 s while `document.visibilityState === 'visible'`, and fetches immediately on `visibilitychange` to visible.
  - It re-renders every 30 s for the staleness tick.
  - It handles `?pushed=` as a toast, then calls `history.replaceState`.
- **Layout:** desktop-first, and responsive down to 360 px.
