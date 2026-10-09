# Review: redesign-timeline (§4.5 checklist)

> Viewer only. Change: `openspec/changes/redesign-timeline/` (archived after this review).

- [x] **Law 1, explicit inputs.** `render(board, now, prefs)` is pure. `placeBlocks`/`layoutRows` and the now-mark are deduced from those inputs. `centreNow` (a DOM effect) runs in `app.ts`, on the first paint only.
- [x] **One object, one block (§3).** A room is one block, never per-lane copies. `.ghost` and `GHOST_OPACITY` are deleted.
- [x] **Deduce, don't store.** Layout, the now-line and the wash are recomputed every paint. Only `legendOpen` and `showCancelled` are stored, per browser, with try/catch.
- [x] **Partiality, both branches.**
  - The now-mark is checked at 07:59, 08:00, 08:29/08:30, 14:15, 21:59, 22:00 and 22:01, and is absent on Tomorrow.
  - Placement covers: spanning or not; own vs partner clashes; overlapping, partially overlapping and touching rooms; cancelled rooms (D74); N = 1, 3 and 5; empty input.
- [x] **Contrast (D50, D63, D73).** `WASH_ALPHA` (0.26 light, 0.34 dark) is tested to be the darkest hundredth keeping every in-block text pair ≥ 4.5:1. The limit is `nsfg` on `nsbg` in both themes. The new `cxfg`/`dupfg` are scoped to cancelled-block text and duplicate badge text only (tested).
- [x] **CSP.** Positions are classes only (`.mo-N`, `.mw-N`); there is no `style=` (tested).
- [x] **No new Loc or Trm.**

## Checks
- `npm test`: 24 files, 643 passed (was 520). `npm run typecheck`: clean. `npm run build`: viewer 16,625 B.
- Local Worker, throwaway secrets (D45), now about 17:51 SGT:
  - **Today:** R3 spans (r-2, h-2). B's S111 inside it moved to B's outer row (r-4). ✓ on S201 only. The chip reads 17:51. The wash is `s-0800 d-19` plus `s-1730 mw-21`.
  - **Tomorrow:** touching rooms R7 and R8 both span. A's own seat S204 during A's room R6 moves outward. Duplicate R4/R5 sit in their own inner rows. No now-line.
  - No `.ghost` anywhere. The key is closed by default, and an opened key is stored and survives a reload.
- Screenshots: light at 800 px; dark at 800 px with the key open; dark at mobile width.
  - On mobile, the first load scrolled Today to the now-line (scrollLeft 677, line at 161 of 321 px), with no sideways page scroll.

## Observations
- When a spanning room is scrolled partly out of view on a phone, only the tail of its label shows ("2 pax"). It's minor; the list shows the full room.
- In the dark theme the wash is subtler than in light (black over a dark card), as expected.
