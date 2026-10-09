# Review: refine-cancel-statuses (§4.5 checklist)

> Covers domain and viewer. Change: `openspec/changes/refine-cancel-statuses/` (archived after this review).

- [x] **Law 1, no hidden inputs.** `render(board, now)` stays pure. `NLB_NOTE` is a constant lookup on `Status`, so no clock and no storage is read.
- [x] **Law 4, only push-client touches NLB.** NLB's bundle was read once at design time to learn the codes and texts. There is no runtime dependency on it.
- [x] **Law 6, one schema in several places.** `Status` (`shared/src/types.ts`) and `STATUSES` (`shared/src/payload.ts`) list the same five values; the `satisfies Status[]` check enforces it.
- [x] **One source of truth.** `holdsSeat` is the only rule for "still occupies its unit". `computeOverlaps` and the viewer's `mark` both call it, so badges and bands can't disagree.
- [x] **Deduce, don't store.** `no_show` is deduced from stored raw `actions` at ingest, exactly like the other statuses. Nothing new is stored, and the wire format is unchanged (D41).
- [x] **Partiality covered both ways.** `nlbNote` is defined for the three cancel kinds and undefined for booked and checked_in; both branches are tested. `mapStatus` is tested for every NLB code, every precedence pair and unseen codes.
- [x] **Contrast (D50).** AA 4.5:1 in both themes is tested for: `nsfg` on `nsbg`, including at ghost opacity and over an overlap band; `--muted` on `--card` for cancelled blocks; the note text.
  - Cancelled blocks are card-filled (opaque), so a band behind them can't lower contrast.
- [x] **No new Loc or Trm.**

## Checks
- `npm test`: 21 files, 472 passed. `npm run typecheck`: clean.
- Local Worker with throwaway secrets (D45). Raw NLB rows were pushed for two people; the stored statuses came back `cancelled`, `checked_in`, `booked`, `no_show` and `partial_cancelled` as expected.
- Browser pane at 1280 px, Light and Dark:
  - cancelled blocks are hollow and struck through;
  - no-show blocks are red-tinted and not struck through;
  - a no-show seat inside the partner's room has no badge and no band;
  - a partly cancelled seat there has "possibly redundant";
  - Notes shows NLB's text;
  - the page does not scroll sideways.
- The mobile screenshot was not taken: the pane was hidden, and the poller correctly does not load while hidden. The change adds no layout rules.

## Observations
- In Light, person B's lane colour (pale orange) and the no-show tint (pale red) are fairly close. They differ in hue and left-border colour, but not strongly. Worth a look on the real page.
- `partial_cancelled` blocks still look like booked blocks in the timeline; only the label and Notes differ. This was unchanged by design.
- The hours after the first of a multi-hour no-show have an unobserved action code (open).
