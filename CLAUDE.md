# NLB Seat Booking shared view

Two people push their own NLB (nlb.gov.sg/seatbooking) seat/room bookings from the logged-in
NLB page to a Cloudflare Worker + Durable Object; a secret-URL page shows both people's
Today/Tomorrow bookings so they don't duplicate rooms or seats.

- **Hard constraints:**
  - The server never contacts NLB and never stores NLB credentials or tokens.
  - Read-only.
  - Safe to publish on public GitHub: no secrets, URLs or names in git.
  - $0/month.
- **Docs:**
  - Intent: `docs/architecture-map.md`, `docs/<component>/ARCHITECTURE.md`.
  - Code map: `IMPLEMENTATION.md`.
  - In-flight work: `openspec/changes/`.
  - Handoffs: `docs/sessions/`.
- **Approved plan:** `C:\Users\FMW\.claude\plans\q1-a-q2-awareness-gentle-wand.md`.
- **Workflow:** supercharge loop (start / work / end), and drift check before archiving. The user does all git commits.

## Decision log

| # | Decision | Who | Why | Status |
|---|---|---|---|---|
| D1 | Exactly 2 people; `people[]` model allows 3–5 | user | it's for the user and one partner | active |
| D2 | Purpose: awareness of each other's booking times + room bookings | user | a room serves both; avoid duplicate room/seat bookings | active |
| D3 | Read-only; never book, cancel or check in | user | lower risk to real bookings and accounts | active |
| D4 | Custom web page, desktop-primary, mobile-friendly | user | used mostly on desktop (revised from mobile-first at plan review) | active |
| D5 | Near-real-time | user | — | **superseded** by D17 |
| D6 | Fully automatic ingestion | user | bookmarklet seemed unusable on mobile | **superseded** by D14 (no stored credentials) |
| D7 | Free-tier cloud, $0/month | user | — | active |
| D8 | Access via a secret unguessable URL, no login | user | simplest | active, refined by D20 |
| D9 | Live-mode toggle, default off, auto-off after 1 min page hidden, 15 min cap, shared toggle | user | protect NLB from load | **superseded** by D17 (server no longer calls NLB) |
| D10 | Layout: Today + Tomorrow stacked on one page (no tabs), two-lane timeline + detail list | user | tabs dropped at plan review | active |
| D11 | No history; latest snapshot only | user | least personal data | active |
| D12 | Overlap hints as display-only badges | user | spot redundant seat vs partner's room | active |
| D13 | Seats + rooms/zones only; visit passes excluded | user | only these matter for duplication | active |
| D14 | **No stored NLB passwords or tokens** | user | NLB ToS §6: user is responsible for password confidentiality / all account activity | active |
| D15 | Stack: Cloudflare Worker + one Durable Object, TypeScript, vitest | user (Claude recommended) | free; DO gives a single consistent store | active |
| D16 | Ingestion: one-tap push from the NLB page; bookmarklet (Chrome desktop/Android) + optional userscript (auto-push) | user | only option that is exact and credential-free; both on Android+desktop | active |
| D17 | Always live: the viewer polls our Worker every 5 s while visible | user | server never calls NLB, so polling costs NLB nothing | active |
| D18 | Staleness: per-person "pushed X min ago" + per-booking **unverified** badge once start+15 min passes without a newer push | user | pushes go stale; auto-cancel happens at start+15 | active |
| D19 | The push sends booking fields only; profile data is stripped on the NLB page | user | privacy | active |
| D20 | Public-repo safe: all secrets/names are Worker secrets, generated per deployment by `init-secrets`; push clients templated at `/setup` runtime; noindex + no-referrer + bare 404s | user (requirement) / Claude (mechanism) | user may publish the code; each deployer gets their own URL | active |
| D21 | A push replaces that person's snapshot (no merge) | Claude | NLB returns the full current set; replace makes cancellations disappear correctly | active |
| D22 | Separate per-person push tokens, distinct from the view secret | Claude | a leaked view link must not allow writes | active |
| D23 | Cancelled bookings struck through, excluded from overlaps | Claude | still informative, never a false overlap | active; display refined by D53 and D56 (hidden by default) |
| D24 | Render all times in SGT | Claude | NLB is SGT-only | active |
| D25 | Email ingestion not used | Claude (from user facts) | only one person uses Gmail; push gives exact status | active |
| D26 | Server stamps `receivedAt`; staleness uses it, not the device's `pushedAt`; reject `pushedAt` > 5 min in the future | Claude | device clock skew | active |
| D27 | Transport from the NLB page: form POST target=_blank (bookmarklet), `GM_xmlhttpRequest` (userscript) | Claude (from CSP research) | NLB CSP `connect-src` blocks cross-origin fetch/sendBeacon; no `form-action` directive | active |
| D28 | OpenSpec specs hold the external surface only (supercharge option B) | Claude | the push/board API and viewer behaviour have scenario-shaped contracts | active |
| D29 | Seat vs room: `room` ⟺ `infoJson.NumberOfPeople` present; `pax` from it | Claude (from spike S1) | `bookingRefId` is `NLB…S…` for both kinds | active |
| D30 | NLB times are offset-less local SGT; `extract` appends `+08:00` | Claude (from spike S1) | observed `"2026-10-08T11:00:00"` | active |
| D31 | Status is mapped by action-suffix pattern (`FullCancel`/`PartialCancel`/`CheckIn`), precedence cancel > partial > check-in > booked | Claude | unseen codes (e.g. no-show auto-cancel) still classify | active, refined by D51 (precedence cancelled > partial_cancelled > no_show > checked_in > booked) |
| D32 | Consecutive hourly rows are merged into display `Block`s (same person/unit/status, contiguous); storage keeps raw rows; overlaps are computed on blocks | Claude (from spike S1) | NLB returns one row per hour | active |
| D33 | One `PEOPLE` secret holds `{id, name, pushToken}[]` (replaces per-person `PUSH_TOKEN_<id>`) | Claude | one source of truth for Person | active |
| D34 | The viewer is served by the Worker with inlined, nonce'd JS/CSS; no Workers static assets | Claude | no public asset path reveals a deployment (identical bare 404s) | active |
| D35 | Push rate limit: reject a push < 2 s after that person's last accepted one (429); userscript debounces 3 s | Claude | replaces "1 per 5 s" from the plan, which would drop legitimate rapid pushes | active |
| D36 | Userscript triggers on Vuex store mutations of `accountInfo.bookings` (catches login/book/cancel/check-in) | Claude | the store is reachable at `#app.__vue__.$store` (spike S1) | active |
| D38 | Room+room overlap between the two people → `duplicate_rooms` flag on both rooms (exactly one Overlap per block pair) | Claude (at review) | that is the core duplication the tool exists to prevent; the plan only flagged seat-in-partner-room | active |
| D39 | Compatibility date stays ≤ 2026-08-22 | Claude (agent A finding) | the old pool's workerd refused newer dates | **superseded** by D40 |
| D40 | Use `@cloudflare/vitest-plugin` (renamed successor of the deprecated `vitest-pool-workers`); compatibility_date 2026-10-01 | Claude | removes the deprecation warning; the newer workerd accepts the date | active |
| D41 | Wire format = JSON array of raw NLB rows trimmed on the page to the whitelist `NLB_ROW_KEYS`; `extract` moves from the page (L1) to the Worker (L2); one format for bookmarklet and userscript | Claude (after user found Android truncation) | Android Chrome hard-truncates long bookmark URLs; the privacy boundary (no profile keys leave the page) is unchanged | active; supersedes the L1 placement of extract |
| D42 | Drop the device `pushedAt` and the 5-min skew rule; only server `receivedAt` exists | Claude | it was never used for anything; removes a redundant stored value (§5) | active; supersedes D26's skew rejection |
| D43 | Bookmarklet ≤ 1,000 bytes as served; `alert()` for "Log in to NLB first"; no Vuex fallback | Claude | size budget for Android | active |
| D37 | Bookmarklet verified working on desktop Chrome 154 under NLB's CSP (spike S1), and the 911-byte bookmarklet verified on Android Chrome against the deployed Worker (2026-10-09) | user tests | — | closed |
| D44 | Deployed to the user's own Cloudflare account; the user ran `wrangler login`, `init-secrets` and `deploy` | user | outward-facing step owned by the user | active |
| D46 | Timeline room labels are compact (`R3 · TestA · 2 pax`); "booked by" wording is kept in the title and list | Claude | fits a 1-hour block | active |
| D47 | Repo name suggestion `seatmates`; keep the Worker name `nlb-shared-view` unless the user asks (renaming changes the URL and needs re-setup) | Claude (recommendation) | name without NLB branding; avoids redeploy churn | superseded by D48 |
| D48 | Repo name: user proposed `nlb-seatbooking-sharedview`; Claude recommends kebab-case per word, best `nlb-shared-view` (matches the Worker name, no redeploy) | user / Claude (recommendation) | consistent hyphenation; repo = Worker = URL | **resolved 2026-10-09**: the user chose `nlb-seatbooking-shared-view`; the Worker stays `nlb-shared-view` |
| D49 | Theme switcher Auto · Light · Dark (default Auto = OS); stored per browser in `localStorage["theme"]` (try/catch); nonce'd `<head>` script applies it before first paint; one token set per theme | user (request) / Claude (design) | user's OS is dark; wanted a light option | active |
| D50 | Light/dark tokens must meet WCAG AA (4.5:1) for text; enforced by a contrast unit test. Light `--dup` #991b1b, dark `--dup` #fecaca, ghost opacity .8, cancelled opacity .7 | Claude (agent C finding) | the first contrast run failed several light-theme cases | active; the "cancelled opacity .7" part is superseded by D53 |
| D51 | `AutoPartialCancel` is the no-show auto-cancel and gets its own status `no_show`; `ManualPartialCancel` stays `partial_cancelled`; precedence copies NLB's `formatBookingStatus` | Claude (from NLB's public JS bundle) / user (asked whether a manual variant exists) | NLB itself shows different text for each; the no-show text was seen on the user's real booking | active |
| D52 | Overlaps and badges exclude `cancelled` and `no_show` (one predicate `holdsSeat`); `partial_cancelled` still counts | user | a no-show no longer holds the seat, so a badge would be false | active |
| D53 | Cancelled blocks look like a hollow outline: filled with `--card` (opaque, so the block blends into the day card), dashed muted border, muted struck-through text; `CANCELLED_OPACITY` removed | user (chose "hollow outline") / Claude (card fill instead of transparent, at review) | fainter than 0.7 opacity while text stays AA; a transparent fill let overlap bands drop dark text to ~3.8:1 (refines D50) | active |
| D54 | No-show blocks use a faded red tint (tokens `nsbg`/`nsfg`), not struck through | user (chose from options) | less vibrant than booked/checked-in; echoes NLB's red cancel icon; the hour still counted against quota | active |
| D55 | Notes column = NLB's exact text for cancelled / partly cancelled / no-show, then badges; booked and checked-in rows get badges only | user | NLB has no notes field; its text is derived from `actions`; the check-in reminder on every booked row would be noise | active |
| D56 | Cancelled (`ManualFullCancel`) bookings are hidden by default, in the timeline (incl. ghost room copies) and the list; no-show and partly cancelled are never hidden | user (grilling Q1, Q2) | less clutter; no-show and partial cancels still carry information (quota, overlaps) | active; refines D23 |
| D57 | "Show cancelled" checkbox beside the theme switch, per browser in `localStorage["showCancelled"]`, default off | user (Q3, Q5) | like the theme (D49); a shared toggle would need viewer writes | active |
| D58 | Hiding closes up the timeline (tracks repack); the hour header and lanes are always drawn; an all-cancelled day shows "No active bookings" | user (Q6, Q7, plan review) | decluttering without losing the empty grid | active |
| D59 | Per-day count in the day heading: "· N cancelled hidden" reveals that day only, "· Hide N cancelled" re-hides it; N = merged blocks, never per lane copy | user (Q4, Q8–Q11; Q9 chosen from a prototype) | see what's hidden without a global switch; symmetric per-day control | active |
| D60 | A per-day reveal is keyed by calendar date and kept in memory (survives 5 s redraws and midnight, not reloads); changing the checkbox resets all per-day reveals | user (Q12, Q13) | the checkbox is the "make everything consistent" action | active |
| D61 | `render(board, now, prefs)` takes `ViewPrefs` explicitly (unlike the CSS-only theme), so it stays pure while repacking | Claude | Law 1: every render input explicit | active |
| D45 | Local end-to-end checks use throwaway test secrets via `wrangler dev --env-file <scratch file>`, never the real `.dev.vars` | Claude | keeps real secrets out of transcripts and tool calls | active |

## Edge cases

| Edge case | Handling | Test |
|---|---|---|
| Empty push | clears that person's lane | planned: ingest test |
| Push while logged out of NLB | client shows "log in first"; nothing sent | planned (manual) |
| Touching intervals (10–11 vs 11–12) | not an overlap (half-open) | planned: overlap test |
| Seat overlapping partner's room | `seat_in_partner_room` badge | planned: overlap test |
| Cancelled booking | struck through, no overlap | planned: overlap test |
| Partial cancel (`ManualPartialCancel`) | "Partly cancelled" label, NLB note "Partially cancelled"; still overlaps (D52) | shared/src/overlap.test.ts, web/render.test.ts |
| Check-in deadline exactly start+15 | counts as passed → unverified if no later push | planned: staleness boundary test |
| Checked-in booking | never unverified | planned: staleness test |
| Device in another time zone | renders SGT | planned: render test |
| Two devices push | later `receivedAt` wins | planned: ingest test |
| `pushedAt` in the future (skew) | ~~> 5 min ahead rejected~~ moot: no device time is sent (D42) | — |
| Long bookmarklet truncated by Android Chrome | bookmarklet ≤ 1,000 bytes (D43); 911 B verified on a real device | worker/src/pages.test.ts size test + user test |
| Room purpose text on the wire | never stored (extract keeps only pax) | worker router test; also checked in the local e2e run |
| Hidden tab | polling stops | web/poller.test.ts (the browser pane can't hide tabs) |
| Badge text in a 1-hour block | ~~clipped~~ fixed: badges wrap by word; rows grow with their content; min 38 px per half-hour column; the timeline scrolls inside its container when narrower | web/styles.test.ts + visual check at 1280 px and mobile |
| No-show auto-cancel action code | ~~assumed; unobserved~~ resolved: `AutoPartialCancel` (NLB bundle + user's real booking) → `no_show` (D51) | shared/src/booking.test.ts |
| Hours after the first of a multi-hour no-show | NLB says they are "returned to your daily booking quota"; their action code is unknown | open: confirm on real data |
| Snapshot stored before the no_show deploy | keeps `partial_cancelled` until that person's next push (D21 replace heals it) | — |
| ManualPartialCancel + AutoPartialCancel on one row | `partial_cancelled` (NLB precedence) | shared/src/booking.test.ts |
| No-show seat inside partner's room | no overlap, no "possibly redundant" (D52) | shared/src/overlap.test.ts, web/render.test.ts |
| No-show hour next to a booked hour, same unit | not merged (different status) | shared/src/blocks.test.ts |
| Partner-room copy (ghost) of a cancelled room | kept at opacity 1 (`.blk.ghost.st-cancelled`); muted text at 0.8 failed AA (3.35:1) | web/styles.test.ts |
| Cancelled block under another pair's overlap band | card-filled (opaque), so the band can't lower its text contrast | web/styles.test.ts |
| Day with only cancelled bookings (hidden) | lanes and hour header drawn; "No active bookings"; heading count | web/render.test.ts |
| Day with no bookings at all | lanes drawn; "No bookings"; no count | web/render.test.ts |
| Cancelled 3-hour hold / cancelled room in two lanes | counts as 1 | web/render.test.ts |
| Cancelled block sharing a track with a booked one | hidden → the lane repacks to 1 track | web/render.test.ts |
| localStorage throws (private mode etc.) | cancelled stay hidden; no crash | web/cancelled.test.ts |
| Per-day reveal at midnight | keyed by date: a revealed Tomorrow stays revealed as Today | web/render.test.ts |
| Reload | checkbox remembered; per-day reveals dropped | browser check |
| Outside-08:00–22:00 note | defensive only (unreachable with NLB hours); counts visible blocks | web/render.test.ts |
| Viewer tab opened before the no_show deploy | old inlined JS can't label `no_show` ("undefined", no style) until reloaded | — (reload after deploy) |
| Payload > 64 KB / bad schema / bad token / > 1 push per 5 s | rejected (404 for bad token) | planned: ingest tests |
| Wrong/old view secret, unknown path, `/` | bare 404 | planned: route tests |
| Leaked view URL | read-only; can't push (D22) | planned: route test |
| Search-engine discovery | never linked; noindex headers + meta, robots.txt Disallow, no-referrer, no third-party loads | planned: route tests |
| Unknown NLB action code | maps to `booked`, raw code kept for display | planned: normalise test |
| Visit/day-pass bookings | excluded | planned: normalise test |
| Bookmarklet blocked by NLB's CSP | fall back to userscript-first (desktop: not blocked, per S1) | spike S1 (manual) |
| Both people book rooms at the same time | `duplicate_rooms` badge on both | planned: overlap test (agent A) |
| Malformed single NLB row | dropped by `extract` so the rest of the push still validates | shared/src/booking.test.ts |
| Push received exactly at start+15 | counts as after deadline → verified | shared/src/staleness.test.ts |
| Multi-hour hold returned as hourly rows | merged into one display block | planned: blocks test |
| Room vs seat with identical ref format | discriminate on infoJson.NumberOfPeople | planned: booking test |
| Offset-less NLB times | treated as SGT (+08:00) | planned: booking test |
| Cancelled bookings still returned by NLB | struck through; excluded from overlaps | planned: overlap/render tests |
| Day with no bookings | "No bookings" | planned: render test |
