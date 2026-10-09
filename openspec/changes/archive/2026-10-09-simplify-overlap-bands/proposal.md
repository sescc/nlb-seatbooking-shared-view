## Why
The yellow overlap band was drawn whenever both people held any booking at the same time, including two ordinary seats. That wrapped slots the user does not consider overlaps. The key also listed items the user finds self-explanatory.

## What Changes
- There is no yellow band at all. Seat + seat is not flagged. A seat inside the partner's room is shown only by its "possibly redundant" badge.
- The red band for duplicate rooms stays, at full timeline height.
- The key drops "Room", "Overlap (yellow band)", "Now (line)" and "Past (shaded)".

## Capabilities
### Modified Capabilities
- `shared-view`: overlap badges, partially cancelled bookings, key.

## Impact
- `web/render.ts` (band loop, `keyHtml`) and `web/styles.ts` (yellow band styles removed).
- The domain's `computeOverlaps` is unchanged, because the badges depend on it.
