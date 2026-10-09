# 2026-10-09 — redesign-timeline

> Follows `2026-10-09-cancelled-toggle.md`. This log supersedes its live-state and open-item tables.

## 0. Continuation brief
**Current state.** The viewer timeline is redesigned:
- Two people share a centre line: A's lane grows up, B's grows down.
- Rooms are drawn once in the booker's colour, spanning both inner rows (no hatched copies). Blocks move outward only on a time clash.
- Today has a now-line with an HH:MM chip, and a past wash in front of blocks at the darkest AA-safe alpha (0.26 light, 0.34 dark).
- No-show is grey with a dotted border, partly cancelled is a faded person colour, and checked in has a ✓.
- A collapsible key sits under the subtitle.

643 tests are green, the typecheck is clean and the build passes. OpenSpec `redesign-timeline` is archived. **Not deployed and not committed.** The cancelled toggle (previous log) was deployed by the user.

**Next step.** The user commits, runs `npm run deploy`, reloads open viewer tabs, and looks at the page in light, in dark and on Android.

**Resume check.**
```
npm test
npx wrangler deployments list
openspec list --json
```

## 1. Work completed
- The user asked whether a now-line would be resource-intensive (no: it reuses the 30 s redraw) and for a no-show colour that doesn't clash. Grilling ran Q1–Q22 with four inline prototypes:
  1. no-show colours and past shading;
  2. the wash behind vs in front, with the AA-max alpha computed live;
  3. checked-in ✓ vs border, plus spanning rooms;
  4. the centre rows shared by rooms and seats (re-prototyped after the user's correction).
- At the plan stage the user added rooms spanning both lanes instead of hatched copies, then corrected the first prototype: seats must share the centre rows with rooms.
- A fresh Sonnet agent was used (the warm one's context was nearly full). Review sent it back twice:
  - a cancelled room must not un-span an active room (D74), plus a joined-line glitch;
  - the user's choice to darken the limiting texts (D73), which lifted the wash from 0.09/0.21 to 0.26/0.34.

## 2. Decisions
D62–D75 are in `CLAUDE.md`; D54 is superseded by D65.

| Discarded | Why |
| --- | --- |
| Faded person colour for no-show (Claude's Q8 recommendation) | the user chose neutral grey |
| "· no-show" label suffix | the user relies on the style (Q9 b) |
| Wash behind blocks (Claude's recommendation) | the user chose in front, with AA as the limit |
| Strict colours with a 9%/21% wash | too faint; the limiting texts were darkened instead (D73) |
| Rooms band separate from the seat rows (first prototype) | the user wanted seats in the same centre rows |
| Earlier-placed room spans in a duplicate pair | the user chose "neither spans" |

## 3. Checks
| Check | Result |
| --- | --- |
| `npm test` / `npm run typecheck` / `npm run build` | 24 files, 643 passed (was 520) / clean / viewer 16,625 B |
| `openspec validate redesign-timeline --strict` | valid |
| Drift check in a throwaway tracked copy | 0 dead / 166 refs |
| Local Worker, throwaway secrets, port 8790, about 17:51 SGT | the placements, chip, wash classes, key and ✓ described in the review all verified through DOM reads |
| Screenshots | light at 800 px; dark at 800 px with the key open; dark at mobile width (first-load scroll centred the now-line; no sideways page scroll) |

## 4. Live handoff state
| Type | Handle | State | Inspect | Cleanup |
| --- | --- | --- | --- | --- |
| deployment | Worker `nlb-shared-view` | has the cancelled toggle, not this redesign | `npx wrangler deployments list` | `npm run deploy`, then reload tabs |
| process | local wrangler dev on 8790 | stopped | — | none |
| config | `.claude/launch.json` | the temporary entry was removed | — | — |
| artifact | scratchpad: `test.vars`, `cancel-check.mjs`, `redesign-check.mjs`, `wrangler-state`, `driftcopy/` | throwaway, outside the repo | — | none needed |
| artifact | `graphify-out/` | updated, 16 communities | — | — |
| git | `main` | uncommitted | `git status --short` | the user commits |

## 5. In-flight changes (from OpenSpec)
None. Archived today: `refine-cancel-statuses`, `add-cancelled-toggle`, `redesign-timeline`.

## 6. Open items
| Priority | Item | Next action | Done when |
| --- | --- | --- | --- |
| P1 | Commit and deploy the redesign | the user commits, runs `npm run deploy`, reloads tabs | the live page shows the centre layout and the now-line |
| P2 | Real-device look (Android, light and dark) | open the live page | the user is satisfied or requests tweaks |
| P3 | Spanning room label clipped when scrolled on a phone | consider a sticky label inside the block, if it bothers the user | — |
| P2 | Action code on the later hours of a multi-hour no-show | carried over | as recorded |
| P2 | Userscript untested on real NLB | carried over | as recorded |

## 7. Architecture / model changes
- Viewer:
  - new pure `placeBlocks`/`layoutRows` (`web/placement.ts`), replacing the per-lane packing and ghost copies;
  - `nowMark` (Partial, Today 08:00–22:00) inside `render`;
  - `ViewPrefs.legendOpen` and `toggleLegend ⊸`;
  - `scrollToNow ⊸` (`web/scroll.ts:centreNow`, first paint only);
  - tokens: grey `nsbg`/`nsfg`, `pNfade`, `cxfg`, `dupfg`, `wash`, `WASH_ALPHA`; `GHOST_OPACITY` removed.
- No new Loc or Trm. Checklist: `docs/viewer/reviews/review-redesign-timeline.md`.

## 8. Docs reconciled
- `docs/viewer/ARCHITECTURE.md`, `IMPLEMENTATION.md`, `STATUS.md`, plus the review.
- `CLAUDE.md` (D62–D75, D54 superseded, edge cases).
- `openspec/specs/shared-view/spec.md` (via archive).

## 10. Files changed
- Code: `web/placement.ts` (new), `web/scroll.ts` (new), `web/render.ts`, `web/styles.ts`, `web/cancelled.ts`, `web/app.ts`.
- Tests: `web/placement.test.ts` (new), `web/scroll.test.ts` (new), `web/render.test.ts`, `web/styles.test.ts`, `web/cancelled.test.ts`, `web/shell.test.ts`.
- Docs and OpenSpec: as in §8, plus `openspec/changes/archive/2026-10-09-redesign-timeline/` and this log.
