# Review — add-shared-view (domain)

> §4.5 checklist run after building, 2026-10-09. A pure component (§7.1 degenerate case), so it has no Loc or Trm of its own.

- [x] **Consolidation (§3).** Seat and room are one `Booking` with `kind`. `Block` is a deduced view, not a stored twin.
- [x] **Deduce, don't store.** `mergeBlocks`, `computeOverlaps` and `computeStaleness` are pure and never persisted.
- [x] **Composition rules → tests.** Every rule in ARCHITECTURE.md §6 maps to a test in IMPLEMENTATION.md, for example:
  - the half-open overlap test;
  - the start+15 staleness boundary test;
  - the leak test showing profile values never appear in `extract` output.
- [x] **Explicit time input.** `now` is always passed in; no hidden clock reads.
- **Real-data alignment (spike S1):**
  - offset-less times are read as SGT;
  - `kind` comes from `infoJson.NumberOfPeople`;
  - status is mapped by action-suffix pattern.
- Open: the action code NLB uses for a no-show auto-cancel hasn't been seen yet. The suffix pattern should classify it; confirm once observed.
