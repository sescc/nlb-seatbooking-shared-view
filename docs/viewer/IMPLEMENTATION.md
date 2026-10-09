# viewer — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that realises it.
> Keep in sync WITH the code (§6.3). Planned targets are written as plain text (not backticked)
> until built, so the drift check only verifies real refs. Note: drift-check resolves against
> `git ls-files` — new files must be at least staged (`git add -N`) to resolve.

## Morphisms / objects → code
| Morphism / object | Realising code | State |
| --- | --- | --- |
| `render` | `web/render.ts:render` | built |
| `daySplit` | `web/render.ts:renderDay` (buckets merged blocks by the SGT date of `start`; Today/Tomorrow come from `sgtDate(nowIso)`) | built |
| `computeOverlaps` (placed here) | `shared/src/overlap.ts:computeOverlaps`, called from `web/render.ts:render` | built |
| `computeStaleness` (placed here) | `shared/src/staleness.ts:computeStaleness`, called from `web/render.ts:render` | built |
| block merging for display | `shared/src/blocks.ts:mergeBlocks`, called from `web/render.ts:render` | built |
| `poll ⊸` | `web/poller.ts:createPoller`, wired to real `document`/`fetch`/timers in `web/app.ts` | built |
| view secret / board URL | `web/session.ts:secretFromPath`, `web/session.ts:boardUrl` | built |
| `now` input (Law 1) | `web/session.ts:estimateNow` (server clock + local elapsed time) | built |
| `?pushed=` toast | `web/session.ts:createPushedToast` | built |
| page shell (noindex meta, nonced style + script) | `web/shell.ts:viewerHtml` | built |
| CSS incl. generated positional classes | `web/styles.ts:viewerCss`, geometry in `web/layout.ts:slotRange` | built |
| HTML escaping | `web/html.ts:esc` | built |
| `setTheme ⊸` | `web/theme.ts:setTheme` (apply + persist), `web/theme.ts:wireThemeControl` (click handling, wired in `web/app.ts`) | built |
| theme control markup | `web/theme.ts:themeControlHtml`, placed in `web/shell.ts:viewerHtml` outside the re-rendered `#app` | built |
| theme before first paint | `web/theme.ts:themeInitScript` (nonced inline script in `<head>`), `web/theme.ts:initialTheme` | built |
| colour tokens, one source for both themes | `web/styles.ts:LIGHT_TOKENS`, `web/styles.ts:DARK_TOKENS` | built |
| browser entry | `web/app.ts` | built |

## Composition rules → where enforced
| Rule (ARCHITECTURE §6) | Enforced at | Tested at |
| --- | --- | --- |
| 1. rendered state is a function of (last `Board`, `now`) only | `web/render.ts:render` is pure and reads no clock; `web/app.ts` keeps only the last `Board` and calls `render(board, estimateNow(...))`; SGT strings via `shared/src/time.ts` only | `web/render.test.ts` "is pure", "Device in another time zone", "SGT calendar days of nowIso"; `web/session.test.ts` "estimateNow" |
| 2a. no third-party requests | `web/shell.ts:viewerHtml` (no `src`, `href`, `url()` or `@import`; CSS inline) | `web/shell.test.ts` "loads nothing external and has no inline styles or handlers" |
| 2b. `<meta name="robots" content="noindex">` present | `web/shell.ts:viewerHtml` | `web/shell.test.ts` "full HTML5 document with noindex" |
| 2c. nonce-only CSP: no `style=` or inline handlers | `web/render.ts` (positions are classes from `web/layout.ts`), `web/shell.ts:safeInlineJs` | `web/render.test.ts` "never emits inline style attributes or event handlers"; `web/shell.test.ts` "cannot be broken out of by the bundled js", "defines every positional class that render() can emit" |
| 2d. all data HTML-escaped | `web/html.ts:esc` used by every interpolation in `web/render.ts` | `web/render.test.ts` "escapes every data string", "escapes person ids used in attributes" |
| 3. `?pushed=<id>` shows "Pushed ✓" toast, then `history.replaceState` | `web/session.ts:createPushedToast`, wired in `web/app.ts` | `web/session.test.ts` "createPushedToast", "pushed query parameter" |
| R4.2 poll every 5 s only while visible; immediate on visible; no overlap | `web/poller.ts:createPoller` | `web/poller.test.ts` (visible polling, hidden stops, refetch on visible, never overlapping, failure keeps polling) |
| 4. theme choice never enters `render`; stored per browser only; works when storage throws | `web/theme.ts` (all storage access in try/catch), `web/styles.ts` (CSS `data-theme` paths), `web/shell.ts` | `web/theme.test.ts`; `web/styles.test.ts` "theming" and "text contrast"; `web/shell.test.ts` "applies the stored theme before first paint", "has the Auto / Light / Dark control" |
| R2.1 Today/Tomorrow stacked, "No bookings" | `web/render.ts:renderDay` | `web/render.test.ts` "Today and Tomorrow on one page" |
| R2.2 consecutive hourly rows are one block | `web/render.ts:render` via `shared/src/blocks.ts:mergeBlocks` | `web/render.test.ts` "Consecutive hourly slots shown as one block" |
| R2.3 room shown in both lanes with booker + pax | `web/render.ts:renderDay` (a ghost copy of each room in every other lane), `web/render.ts:blockLabel` | `web/render.test.ts` "Rooms are shared" |
| R3.2 cancelled: hollow outline, struck through, no overlap badges (D53) | `web/render.ts` (`st-cancelled`; overlaps and `mark` use `holdsSeat`) + `web/styles.ts` (`.blk.st-cancelled`) | `web/render.test.ts` "Cancelled bookings"; `web/styles.test.ts` "viewer CSS: cancelled and no-show blocks" |
| no-show: red tint, "No-show (auto-cancelled)", no overlap badges (D52, D54) | `web/render.ts` (`STATUS_LABEL`, `st-no-show`, `mark` via `holdsSeat`) + `web/styles.ts` (`.blk.st-no-show`, tokens `nsbg`/`nsfg`) | `web/render.test.ts` "No-show bookings"; `web/styles.test.ts` "viewer CSS: cancelled and no-show blocks", "text contrast" |
| `nlbNote` (Status → 𝕊?): Notes column = NLB's text for the cancel kinds, then badges (D55) | `web/render.ts` (`NLB_NOTE`, used in `listHtml`) | `web/render.test.ts` "NLB notes in the detail list" |
| R3.3 overlap bands and badges | `web/render.ts:render` (`mark`), `web/render.ts:renderDay` (bands) | `web/render.test.ts` "Overlap badges" |
| R4.3 freshness label and unverified badge | `web/render.ts:laneHeader`, `web/render.ts:badges` via `computeStaleness` | `web/render.test.ts` "Freshness indicators" |
| viewport 360 px usable, page never scrolls sideways | `web/styles.ts` (`.tl-scroll`/`.list-scroll` scroll inside their own box; the list stacks under 640 px) | `web/shell.test.ts` "is responsive"; checked by eye in the browser pane at about 420 px |

## Notes / divergences
- **Room copies per lane.** "Room spans lanes" is realised as a copy of the room block in every lane (the booker's is the real one; the others carry class `ghost`), not as one element spanning the rows. A room never covers a partner's seat that way, since per-lane track packing stacks them. Badges (unverified, duplicate room) sit on the booker's block only.
- **`now` is not the device clock.** `web/session.ts:estimateNow` uses `board.serverNow` plus local elapsed time since the fetch, so a wrong device clock cannot skew staleness or the Today/Tomorrow split.
- **Positioning scheme.** `.s-HHMM` (28 half-hour starts, `.s-0800`…`.s-2130`) sets `grid-column-start`; `.d-N` (1…28) sets `grid-column-end: span N`; `.r-N`/`.h-N` (1…40) set the grid row and row span. All are generated by `web/styles.ts:viewerCss`. Blocks are floored/ceiled to the half hour and clamped to 08:00–22:00; blocks wholly outside only appear in the list, with a note.
- **Nothing in a timeline block is clipped.** No `nowrap`/`ellipsis`/`overflow:hidden` on `.blk`, `.blk .lbl` or `.badge`; badges wrap by word ("possibly / redundant"). Grid rows are `minmax(2.6rem, auto)`, so a taller block grows its row and never overlaps the next. Each half-hour column is at least 38px (76px per hour; `COL_MIN_PX` in `web/styles.ts`), so `.tl` has `min-width: calc(label + 28 x 38px)` and scrolls inside `.tl-scroll` when the container is narrower. `main` is 1320px wide so the timeline fits unscrolled at a 1280px viewport. Tested in `web/styles.test.ts`.
- **Compact room labels in the timeline.** `web/render.ts:blockLabel(people, b, compact)`: blocks show `R3 · TestA · 2 pax`; the `title` attribute keeps `R3 · booked by TestA · 2 pax`, and the list shows who, "Room R3 · 2 pax".
- **Theme.** `<html data-theme>` is `light`, `dark`, or absent (Auto). The dark tokens are emitted twice from the same `DARK_TOKENS` string: under `@media (prefers-color-scheme:dark){:root:not([data-theme=light])}` and under `:root[data-theme=dark]`; `color-scheme` follows. The choice lives in `localStorage` key `theme` (per browser, never shared). A tiny nonced `<head>` script applies it before first paint. The control sits in the shell, outside `#app`, so a repaint never resets focus. `worker/src/pages.ts` needed no change: it passes a single nonce, which `viewerHtml` reuses for the style and both scripts.
- **Light-theme contrast** (checked in `web/styles.test.ts`, WCAG AA 4.5:1 for text, both themes): light `--dup` `#b91c1c` → `#991b1b` (duplicate-room badge on a lane colour was 4.05:1); dark `--dup` `#fca5a5` → `#fecaca` (4.43:1 on the orange lane colour); room copies (`.ghost`) opacity .6 → .8 and cancelled blocks .55 → .7 (light text was 3.4–4.0:1). The ghost hatch stripes are slightly stronger (.22 → .3) to stay distinguishable at the higher opacity.
- **Cancelled and no-show blocks (D53, D54).** `CANCELLED_OPACITY` is gone.
  - A cancelled block is filled with `--card`, which makes it opaque. It looks hollow but hides any overlap band behind it, so its muted text is always measured on the card colour. It has a dashed muted border and a struck-through label.
  - Its partner-room copy keeps `opacity:1` (`.blk.ghost.st-cancelled`). Muted text at the ghost opacity failed AA in light (3.35:1).
  - A no-show block is `--nsbg`/`--nsfg` (light `#f7e6e6`/`#7a2e2e`, dark `#3b2326`/`#e8c6c6`) and is not struck through.
  - Both rules come after the lane-colour, room and ghost rules, so they win by source order; a test pins that order. As a result a ghost copy of a cancelled or no-show room has no hatch, and only its label names the booker.
- **`pushed HH:MM` uses the server `receivedAt`** (D26), not the device `pushedAt`.
- **Overlap band label** ("Overlap HH:MM–HH:MM") is visually hidden (screen readers only) to keep the timeline uncluttered.
- Shell contract with `worker/src/pages.ts`: `viewerHtml({ nonce, js })`. The Worker owns the CSP header and the nonce.
