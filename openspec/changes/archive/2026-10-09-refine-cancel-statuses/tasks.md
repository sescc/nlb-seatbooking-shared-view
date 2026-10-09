## 1. Domain
- [x] 1.1 `Status` gains `no_show` (`shared/src/types.ts`); `STATUSES` in `shared/src/payload.ts`
- [x] 1.2 `mapStatus` precedence per design; tests for every NLB code, precedence pairs and unseen codes
- [x] 1.3 `holdsSeat` predicate; `computeOverlaps` uses it; overlap tests for no_show on either side
- [x] 1.4 Staleness and blocks tests: no_show never unverified; no merge with booked

## 2. Viewer
- [x] 2.1 `STATUS_LABEL.no_show`; badge marking uses `holdsSeat`
- [x] 2.2 Notes column: NLB text for the cancel kinds, followed by badges; render tests
- [x] 2.3 Styles: hollow cancelled outline; no-show red tint tokens; `CANCELLED_OPACITY` removed; contrast tests
- [x] 2.4 Browser check with throwaway secrets: Light and Dark at 1280 px. Mobile was not captured because the pane was hidden; the change adds no layout rules.

## 3. Reconcile
- [x] 3.1 `docs/domain/ARCHITECTURE.md` and `IMPLEMENTATION.md` (status functor, `holdsSeat`)
- [x] 3.2 `docs/viewer/ARCHITECTURE.md`, `IMPLEMENTATION.md`, `STATUS.md`; `docs/STATUS.md`
- [x] 3.3 `CLAUDE.md`: D51–D55, D48 resolved, D31 updated, edge cases
- [x] 3.4 Review checklist `docs/viewer/reviews/review-refine-cancel-statuses.md`
- [x] 3.5 Drift check passes (0 dead / 147 refs); archive
