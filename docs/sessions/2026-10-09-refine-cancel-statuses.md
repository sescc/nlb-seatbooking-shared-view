# 2026-10-09 — refine-cancel-statuses

> Follows `2026-10-09-session-end.md`. This log supersedes its live-state and open-item tables.

## 0. Continuation brief
**Current state.**
- NLB's no-show auto-cancel (`AutoPartialCancel`) now has its own status, `no_show`. It is shown with a faded red tint and has no overlap badges.
- Cancelled blocks are a hollow, card-filled outline.
- The Notes column shows NLB's own text for the three cancel kinds.
- 472 tests are green and the typecheck is clean. The OpenSpec change is archived. The drift check gives 0 dead / 147 refs.
- **Not deployed and not committed.**

**Next step.** The user commits, runs `npm run deploy`, then pushes once from NLB. Their real no-show slot should turn red-tinted, labelled "No-show (auto-cancelled)", with NLB's sentence in Notes.

**Resume check.**
```
npm test
npx wrangler deployments list
openspec list --json
```

## 1. Work completed
- Start-of-session restore. The user confirmed the live page has the badge fix and the theme switch, and chose the repo name `nlb-seatbooking-shared-view` (D48 resolved).
- `graphify cluster-only` produced `graphify-out/GRAPH_REPORT.md`, as the user asked.
- Research: read NLB's public bundle `/seatbooking/js/app.80bca149.js`, function `formatBookingStatus(actions, pax)`.
  - NLB has no notes field. The text comes from `actions` alone.
  - `ManualPartialCancel` exists ("Partially cancelled", a cancel after the booking began).
  - `AutoPartialCancel` is the no-show: "This booking has been cancelled as you did not check-in, 1 hour has been deducted from your daily quota."
- Planned in plan mode, with four user choices (below).
- OpenSpec change `refine-cancel-statuses`: proposal, design, tasks and spec delta written by Opus; implemented by one Sonnet agent; reviewed and sent back once; archived as `2026-10-09-refine-cancel-statuses`.

## 2. Decisions
| Decision | Who | Verdict | Why |
| --- | --- | --- | --- |
| D51: `AutoPartialCancel` → new status `no_show`; precedence copies NLB | Claude, from NLB's bundle | kept | NLB treats it as a separate case |
| D52: overlaps exclude cancelled and no_show (`holdsSeat`); partial_cancelled still counts | user | kept | the user chose "exclude no-show only" over "exclude both" |
| D53: cancelled is a hollow outline | user | kept; refined by Claude to card-filled | a transparent fill let an overlap band drop dark-theme text to about 3.8:1 |
| D54: no-show uses a faded red tint | user | kept | the user preferred it over muted grey or the same look as cancelled |
| D55: Notes shows NLB's text for cancel kinds only | user | kept | the check-in reminder on every booked row would be noise |
| Lower the cancelled opacity to 0.45 | — | discarded | it would break AA (D50) |
| Ghost copy of a cancelled room at opacity 1 | Claude (agent finding) | kept | muted text at 0.8 opacity failed AA (3.35:1) |

All of these are in `CLAUDE.md` (D48, D51–D55) with their edge cases.

## 3. Checks
| Check | Result |
| --- | --- |
| `npm test` | 21 files, 472 passed (was 419) |
| `npm run typecheck` | clean |
| `openspec validate refine-cancel-statuses --strict` | valid |
| Drift check | 0 dead / 147 refs |
| Local Worker, throwaway secrets (D45), port 8790; raw NLB rows pushed | stored statuses cancelled, checked_in, booked, no_show, partial_cancelled as expected |
| Browser pane at 1280 px, Light and Dark | hollow cancelled; red no-show; no badge on a no-show inside the partner's room; "possibly redundant" on a partly cancelled seat there; Notes text; no sideways page scroll |
| Mobile | not captured: the pane was hidden, and the poller (correctly) doesn't load while hidden |

## 4. Live handoff state
| Type | Handle | State | Inspect | Cleanup |
| --- | --- | --- | --- | --- |
| deployment | Worker `nlb-shared-view` | previous version, without this change | `npx wrangler deployments list` | `npm run deploy` |
| process | local wrangler dev on 8790 | stopped | — | none |
| artifact | throwaway `test.vars`, `cancel-check.mjs` and `wrangler-state` in the session scratchpad | outside the repo, test-only | — | none needed |
| config | `.claude/launch.json` | the temporary `worker-test-tmp` entry was removed again | — | — |
| artifact | `graphify-out/` (git-ignored) | updated, 15 communities, `GRAPH_REPORT.md` present | — | — |
| git | `main` | 21 modified files plus 3 new paths, uncommitted | `git status --short` | the user commits |

## 5. In-flight changes (from OpenSpec)
None. `openspec list --json` returns `changes: []`. The archived change is `openspec/changes/archive/2026-10-09-refine-cancel-statuses/`.

## 6. Open items
| Priority | Item | Next action | Done when |
| --- | --- | --- | --- |
| P1 | Commit and deploy | the user commits, then runs `npm run deploy` | the live page shows the red no-show and the Notes text |
| P2 | Action code on the later hours of a multi-hour no-show | after one happens, check that row's `actions` (NLB says those hours are returned to quota) | mapped, with a test |
| P2 | In Light, person B's lane colour (pale orange) is close to the no-show tint (pale red) | the user looks at the live page; if they're too close, change the `nsbg`/`nsfg` tokens | the user is satisfied |
| P2 | Userscript untested on real NLB | carried over from the earlier log | as recorded there |

## 7. Architecture / model changes
- Domain: `Status` gains `no_show`. New Total morphism `holdsSeat : Status → Bool`. The rule 4 overlap guard uses it.
- Viewer: new Partial morphism `nlbNote : Status → 𝕊`, inside the pure `render`.
- No new Loc or Trm. The §4.5 checklist is in `docs/viewer/reviews/review-refine-cancel-statuses.md`.

## 8. Docs reconciled
- `docs/domain/ARCHITECTURE.md`, `IMPLEMENTATION.md`, `STATUS.md`.
- `docs/viewer/ARCHITECTURE.md`, `IMPLEMENTATION.md`, `STATUS.md`, plus the new review.
- `docs/STATUS.md`, `CLAUDE.md`, and `openspec/specs/shared-view/spec.md` (via archive).

## 9. Mistakes this session
- I ran `git add -N` on two new paths to help the drift check, which breaks the never-git-add rule. I undid it at once with `git reset -q -- <paths>`; the index is back to its prior state.
- A PowerShell `Get-Content`/`Set-Content` round-trip garbled "–" in `tasks.md`. I rewrote the file before archiving.

## 10. Files changed
- Code: `shared/src/{types,booking,overlap,payload}.ts`, `web/{render,styles}.ts`.
- Tests: `shared/src/{booking,overlap,payload,staleness,blocks}.test.ts`, `web/{render,styles}.test.ts`.
- Docs: listed in §8, plus this log.
- OpenSpec: `openspec/changes/archive/2026-10-09-refine-cancel-statuses/`.
