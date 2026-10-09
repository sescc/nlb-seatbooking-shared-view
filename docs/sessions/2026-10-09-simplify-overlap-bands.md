# 2026-10-09 — simplify-overlap-bands

> Follows `2026-10-09-redesign-timeline.md`. This log supersedes its live-state and open-item tables.

## 0. Continuation brief
**Current state.**
- The yellow overlap band is gone. Seat + seat at the same time is not flagged, and a seat inside the partner's room shows only its "possibly redundant" badge.
- The red full-height band stays for duplicate rooms.
- The key no longer lists room, yellow band, now-line or past wash.
- 644 tests are green, the typecheck is clean and the build passes. OpenSpec `simplify-overlap-bands` is archived.
- **Not deployed and not committed.** The timeline redesign (previous log) is also still uncommitted, unless the user did both together.

**Next step.** The user commits, runs `npm run deploy`, and reloads open viewer tabs.

**Resume check.**
```
npm test
npx wrangler deployments list
```

## 1. Work completed
- The user asked about the yellow band's logic. Explanation given:
  - a full-height band was drawn for every pair of seat-holding blocks of different people that share time, for both seat + seat and seat + partner's room;
  - it was rounded to half-hours.
- The user decided: no yellow band at all; the full-height red band stays for duplicate rooms; the key is trimmed.
- The warm Sonnet agent from the redesign implemented it. Review passed first time. I verified it locally with throwaway secrets and took a light screenshot.

## 2. Decisions
D76 (no yellow band) and D77 (key trimmed) are in `CLAUDE.md`; D12 and D72 are marked as refined.

| Discarded | Why |
| --- | --- |
| Yellow band for the seat-in-partner's-room case only (Claude's recommendation) | the user preferred no yellow band at all; the badge suffices |
| Bands covering only the involved rows (Claude's recommendation) | the user kept full height for the red band |

## 3. Checks
| Check | Result |
| --- | --- |
| `npm test` / `npm run typecheck` / `npm run build` | 24 files, 644 passed / clean / viewer 16,325 B |
| `openspec validate --strict` | valid (after keeping the "Touching bookings" scenario) |
| Drift check, throwaway tracked copy | 0 dead / 166 refs |
| Local Worker, port 8790 | Today: no `.ovl`, S111 keeps "possibly redundant". Tomorrow: one `ovl ovl-room s-1600 d-2 r-2 h-3`, R4/R5 badged. The key has the 9 expected items |
| `WASH_ALPHA` | unchanged at 0.26 / 0.34 (the limit is still `nsfg` on `nsbg`) |

## 4. Live handoff state
| Type | Handle | State | Inspect | Cleanup |
| --- | --- | --- | --- | --- |
| deployment | Worker `nlb-shared-view` | without the redesign or this change | `npx wrangler deployments list` | `npm run deploy`, reload tabs |
| process | local wrangler dev on 8790 | stopped | — | none |
| config | `.claude/launch.json` | the temporary entry was removed | — | — |
| git | `main` | uncommitted | `git status --short` | the user commits |

## 5. In-flight changes
None. Archived: `2026-10-09-simplify-overlap-bands`.

## 6. Open items
| Priority | Item | Next action |
| --- | --- | --- |
| P1 | Commit and deploy the redesign and this change | the user commits, runs `npm run deploy`, reloads tabs |
| P2 | Real-device look | from the previous log |
| P3 | Spanning room label clipped when scrolled on a phone | from the previous log |
| P2 | Later-hours no-show action code; userscript on real NLB | carried over |

## 7. Architecture / model changes
None to the model. The viewer's band rendering is now filtered to `duplicate_rooms` (`web/render.ts:renderDay`). The domain's `computeOverlaps` is unchanged.

## 8. Docs reconciled
- `docs/viewer/ARCHITECTURE.md`, `IMPLEMENTATION.md`, `STATUS.md`.
- `CLAUDE.md` (D76, D77, D12 and D72 notes, edge cases).
- `openspec/specs/shared-view/spec.md` (via archive).

## 10. Files changed
- `web/render.ts`, `web/styles.ts`, `web/render.test.ts`, `web/styles.test.ts`.
- Docs as in §8, plus `openspec/changes/archive/2026-10-09-simplify-overlap-bands/` and this log.
