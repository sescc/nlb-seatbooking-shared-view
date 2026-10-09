## Why
NLB's own front end (`formatBookingStatus(actions)` in its public bundle) distinguishes three cancel kinds:
- `ManualFullCancel`, shown as "Cancelled";
- `ManualPartialCancel`, shown as "Partially cancelled". This is a cancel made after the booking began.
- `AutoPartialCancel`, the **no-show auto-cancel**: "This booking has been cancelled as you did not check-in, 1 hour has been deducted from your daily quota."

The view folds both partial kinds into one status. As a result, a no-show still raises overlap badges such as "possibly redundant", and the Notes column stays empty. Cancelled blocks are also not faded enough to fade into the background.

## What Changes
- A new status, **no-show**, for `AutoPartialCancel`. It is excluded from overlaps, like a full cancel. A manual partial cancel still counts for overlaps (user decision).
- Cancelled blocks are drawn as a hollow outline: no fill, a dashed muted border, muted struck-through text. The text keeps WCAG AA contrast.
- No-show blocks get a faded red tint that is less vibrant than booked or checked-in blocks. They are not struck through.
- The Notes column shows NLB's own text for the three cancel kinds, followed by our badges. Booked and checked-in rows show only badges.

## Capabilities
### Modified Capabilities
- `shared-view`: cancelled styling; new no-show and partial-cancel requirements; the Notes column.

## Impact
- `shared/src`: `types.ts` (`Status`), `booking.ts` (`mapStatus`, new `holdsSeat`), `overlap.ts`, `payload.ts`.
- `web/`: `render.ts` (labels, notes, overlap marking), `styles.ts` (tokens `nsbg`/`nsfg`, cancelled outline, `CANCELLED_OPACITY` removed).
- No wire-format change. `actions` is already whitelisted (D41).
- Snapshots stored before the deploy keep the old status until that person's next push (D21 replace-on-push).
