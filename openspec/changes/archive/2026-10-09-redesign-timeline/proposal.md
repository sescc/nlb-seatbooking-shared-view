## Why
The user asked for a time indicator, and for a no-show colour that doesn't clash with person 2's orange lane. Grilling and four inline prototypes (2026-10-09) grew this into a timeline redesign:
- rooms drawn once across the centre line instead of hatched copies in each lane;
- seats hugging the centre line;
- a distinct look for every status;
- a key that explains the visual codes.

## What Changes
- **Now-line** on Today: a neutral line with an HH:MM chip, moved by the existing 30 s redraw, shown only 08:00–22:00. On first load only, a phone-width timeline scrolls to "now".
- **Past wash**: Today's elapsed time is shaded in front of blocks, as dark as possible while all block text stays WCAG AA.
- **Centre layout for two people**:
  - Each person's inner row touches the centre line (A grows up, B grows down).
  - A room is drawn once in its booker's colour, spanning both inner rows, unless another room overlaps it; then each sits in its own booker's inner row.
  - Blocks move outward only on a time clash. Active blocks claim inner rows before cancelled ones.
  - With three or more people, rooms go in a "Rooms" band at the top.
- **Status looks**:
  - checked in gets a "✓" label prefix;
  - partly cancelled gets a faded person-colour fill;
  - no-show becomes neutral grey with a dotted border (no longer red).
- **Key**: a collapsible legend under the subtitle, closed by default, remembered per browser, drawn with the page's own styles.

## Capabilities
### Modified Capabilities
- `shared-view`: rooms layout, no-show and partial-cancel looks; new current-time, checked-in mark and key requirements.

## Impact
- `web/`: new `placement.ts`; `render.ts`, `styles.ts`, the prefs module, `app.ts`.
- The hatched room copies (`.ghost`, `GHOST_OPACITY`) are removed.
- No server, wire or domain change.
