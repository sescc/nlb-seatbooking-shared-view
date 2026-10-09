## Context
Source of truth for the action codes: NLB's public bundle `/seatbooking/js/app.80bca149.js`, read on 2026-10-09. Its function `formatBookingStatus(actions, pax)` checks the codes in this precedence:

| Precedence | Code(s) | NLB text |
| --- | --- | --- |
| 1 | `ManualFullCancel` | "Cancelled" |
| 2 | `ManualPartialCancel` | "Partially cancelled" |
| 3 | `AutoPartialCancel` | "This booking has been cancelled as you did not check-in, 1 hour has been deducted from your daily quota." |
| 4 | `BookAndCheckIn`, `AutoCheckIn`, `ManualCheckIn`, `OverBookAndCheckIn` | "Checked in" |
| 5 | anything else | "Check-in no later than 14 minutes from your booking start time." (not used by us) |

NLB has no notes field: spike S1's full key list has none. The text is a function of `actions` alone.

## Model delta (domain)
- **Consolidation check (§3).** No new object. `Status` is a discrete category, and it gains one object: `no_show`.
  - Before: `{booked, checked_in, cancelled, partial_cancelled}`.
  - After: `{booked, checked_in, cancelled, partial_cancelled, no_show}`.
- **Status functor `actions[] → Status`** (Total, still by suffix pattern, so unseen codes classify). Precedence cancelled > partial_cancelled > no_show > checked_in > booked, matching NLB:
  - `/FullCancel$/` → cancelled;
  - else a `/PartialCancel$/` code not starting with `Auto` → partial_cancelled;
  - else `/^Auto\w*PartialCancel$/` → no_show;
  - else `/CheckIn$/` → checked_in;
  - else booked.
- **New morphism `holdsSeat : Status → Bool`** (Total). It is false for `cancelled` and `no_show`. It is the one source of truth for "this booking still occupies its unit". Both `computeOverlaps` and the viewer's badge marking use it (§5: one source of truth for shared structure).
- **`unverified?`** is unchanged: it is booked-only, so a no-show is never unverified.
- **`mergeBlocks`** is unchanged: merging already requires an equal status, so a no-show hour never merges with a booked hour.

## Model delta (viewer)
- **`nlbNote : Status → 𝕊?`** (Partial). Defined for `cancelled`, `partial_cancelled` and `no_show`, with NLB's exact strings. It is undefined for `booked` and `checked_in`, per the user's decision. It is a pure lookup inside `render`, so `render` stays pure (rule 4).
- **Styles.** Cancelled becomes a hollow outline and `CANCELLED_OPACITY` is removed. Text is `--muted` on `--card`, which is AA.
- **No-show** gets the theme tokens `nsbg` and `nsfg`, AA-checked in both themes and under `GHOST_OPACITY`.

## Coherence laws kept (§4.5)
- **Law 1** (no hidden inputs): `render` still reads only Board × now.
- **Law 4**: no component except push-client touches NLB. The bundle was read once, at design time, by a human-directed check. It is not a runtime dependency.
- **Law 6**: `validatePayload`'s `STATUSES` list and `Status` stay one set.
- **No new Loc or Trm.**

## Decisions
- D51–D55 in `CLAUDE.md`.

## Open question
- Which action code NLB puts on the hours **after the first** of a multi-hour no-show. NLB's help text says those hours are "returned to your daily booking quota". Confirm on real data.
