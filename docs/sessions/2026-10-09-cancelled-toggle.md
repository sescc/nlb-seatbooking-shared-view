# 2026-10-09 — cancelled-toggle

> Follows `2026-10-09-refine-cancel-statuses.md`. This log supersedes its live-state and open-item tables.

## 0. Continuation brief
**Current state.**
- Cancelled bookings are hidden by default.
- A "Show cancelled" checkbox sits beside the theme switch, remembered per browser.
- Each day heading has a count: "· N cancelled hidden" reveals that day, "· Hide N cancelled" re-hides it.
- A day with only cancelled bookings shows "No active bookings"; the timeline is always drawn.
- 520 tests are green and the typecheck is clean. OpenSpec `add-cancelled-toggle` is archived.
- **Not deployed and not committed.** The previous change (`refine-cancel-statuses`) was deployed by the user and confirmed working.

**Next step.** The user commits, runs `npm run deploy`, and **reloads open viewer tabs** (the inlined JS changed). Then glance at the checkbox on Android.

**Resume check.**
```
npm test
npx wrangler deployments list
openspec list --json
```

## 1. Work completed
- The user deployed `refine-cancel-statuses` and found it good.
- The user proposed the toggle and asked to be grilled. Three rounds (Q1–Q13) settled every branch, and a throwaway inline prototype settled Q9.
- At plan review the user corrected two points:
  - keep the blank timeline even with no bookings (the prototype had wrongly dropped it);
  - the "outside 08:00–22:00" note: Claude explained it is a defensive fallback that is unreachable with NLB's hours, so it is left unchanged.
- OpenSpec change `add-cancelled-toggle`: written by Opus, implemented by the warm Sonnet agent (reused from the previous change), reviewed (two text glitches sent back: a stray carriage return in a doc comment, two statements on one line), verified and archived.

## 2. Decisions
D56–D61 are in `CLAUDE.md` (who and why), and D23 is marked as refined. Summary:

| Q | Verdict |
| --- | --- |
| Q1 | hide only `cancelled` (not no-show or partial) |
| Q2 | hide in both timeline and list |
| Q3 | per-browser `localStorage`, default hidden |
| Q4/Q11 | a count in the day heading, which is also the reveal link |
| Q5 | a checkbox beside the theme switch |
| Q6 | close up the tracks; the timeline is always drawn |
| Q7 | "No active bookings" |
| Q8 | the count reveals that day only (not the global switch) |
| Q9 | "Hide N cancelled" while revealed (chosen via the prototype) |
| Q10 | count blocks, not hourly rows |
| Q12 | reveals keyed by date, in memory |
| Q13 | changing the checkbox resets the reveals |

| Discarded | Why |
| --- | --- |
| Count click flips the global setting (Claude's Q8 recommendation) | the user preferred a per-day reveal |
| Count line disappears once revealed (Q9 a) | with per-day reveal there'd be no way to re-hide that day |
| Shared toggle | would need viewer writes to the server |

## 3. Checks
| Check | Result |
| --- | --- |
| `npm test` / `npm run typecheck` | 22 files, 520 passed (was 472) / clean |
| `openspec validate add-cancelled-toggle --strict` | valid |
| Drift check, working repo | 5 dead, all `web/cancelled.ts` (untracked until committed) |
| Drift check, throwaway tracked copy in the scratchpad | 0 dead / 155 refs |
| Local Worker with throwaway secrets, port 8790, 1280 px, page forced visible (pane hidden) | default hides; Today shows "No active bookings · 1 cancelled hidden" with lanes and header; reveal survives a 5 s redraw; Hide works; checkbox shows all and stores `'1'`; after reload the checkbox is kept and per-day choices are dropped |
| Screenshots / mobile | not possible: screenshots time out while the pane is hidden |

## 4. Live handoff state
| Type | Handle | State | Inspect | Cleanup |
| --- | --- | --- | --- | --- |
| deployment | Worker `nlb-shared-view` | has `refine-cancel-statuses`, not the toggle | `npx wrangler deployments list` | `npm run deploy`, then reload tabs |
| process | local wrangler dev on 8790 | stopped | — | none |
| config | `.claude/launch.json` | the temporary entry was removed again | — | — |
| artifact | scratchpad `test.vars`, `cancel-check.mjs`, `wrangler-state`, `driftcopy/` | throwaway, outside the repo | — | none needed |
| artifact | `graphify-out/` | updated, 16 communities | — | — |
| git | `main` | uncommitted changes from both changes this session | `git status --short` | the user commits |

## 5. In-flight changes (from OpenSpec)
None (`changes: []`). Archived: `2026-10-09-refine-cancel-statuses`, `2026-10-09-add-cancelled-toggle`.

## 6. Open items
| Priority | Item | Next action | Done when |
| --- | --- | --- | --- |
| P1 | Commit and deploy the toggle | the user commits, runs `npm run deploy`, reloads open tabs | the live page hides cancelled by default |
| P2 | Look at the checkbox and count on a phone | open the live page on Android | it looks fine, or a styling fix is requested |
| P2 | Light theme: B's pale orange is close to the no-show pale red | from the previous log; the user saw the page and said "looks good" | closed unless raised again |
| P2 | Action code on the later hours of a multi-hour no-show | carried over | as recorded |
| P2 | Userscript untested on real NLB | carried over | as recorded |

## 7. Architecture / model changes
- Viewer:
  - new Dat `ViewPrefs` (L4 only);
  - new Partial Trn `toggleCancelled ⊸`;
  - `render ⊸ : Board × Now × ViewPrefs → DOM`;
  - rule 1 now includes `ViewPrefs` (D61).
- No new Loc or Trm. The checklist is in `docs/viewer/reviews/review-add-cancelled-toggle.md`.

## 8. Docs reconciled
- `docs/viewer/ARCHITECTURE.md`, `IMPLEMENTATION.md`, `STATUS.md`, plus the new review.
- `CLAUDE.md` (D56–D61, D23 note, edge cases).
- `openspec/specs/shared-view/spec.md` (via archive).

## 10. Files changed
- Code: `web/render.ts`, `web/cancelled.ts` (new), `web/shell.ts`, `web/app.ts`, `web/styles.ts`.
- Tests: `web/render.test.ts`, `web/cancelled.test.ts` (new), `web/shell.test.ts`, `web/styles.test.ts`.
- Docs and OpenSpec: as in §8, plus `openspec/changes/archive/2026-10-09-add-cancelled-toggle/` and this log.
