## Context
All behaviour was decided by the user in grilling rounds Q1–Q22 (2026-10-09), with prototypes for:
- the no-show colour and past-shading;
- the wash behind vs in front of blocks (the in-front alpha computed live for AA);
- the checked-in mark and spanning rooms;
- the centre rows shared by rooms and seats.

Decisions D62–D72 are in `CLAUDE.md`.

## Model delta (viewer only)
- **Consolidation check (§3).** No new domain object.
  - The viewer gains a deduced layout morphism `placeBlocks : Person* × Block* → Placement*`, where `Placement = { block, lane : PersonIndex | span | rooms, track : ℕ }`. It is Total, pure and deterministic, in `web/placement.ts`.
  - It replaces the per-lane greedy packing and the ghost copies, so a room is one object drawn once (§3: one object, not N copies).
- **Two people (centre layout).**
  - Tracks count outward from the centre line.
  - Rooms that overlap no other room span track 0 of both people when both are free; otherwise they sit in their booker's lane.
  - Placement order: active rooms → active seats → cancelled, then start, end, person, unit.
  - A block takes the innermost track with no half-open clash.
- **N ≠ 2.** A top "Rooms" band spans all lanes; seats are packed per lane.
- **`nowMark : Now → (slot, minute)?`** (Partial: defined only 08:00–22:00 SGT, Today only). It is deduced inside the pure `render`. Positions are expressed as CSS classes (`.s-HHMM` plus `.mo-N`, `.mw-N`) because the CSP forbids `style=`.
- **`ViewPrefs` gains `legendOpen : Bool`** (stored per browser).
  - `toggleLegend ⊸` is Partial, like `toggleCancelled`.
  - `render` reads it for the `<details open>` attribute.
- **First-load auto-scroll** is a DOM effect in `web/app.ts`, outside `render`.
- **Tokens:**
  - `nsbg`/`nsfg` become neutral grey;
  - new `p0fade…p4fade`;
  - a wash colour plus `WASH_ALPHA` per theme, the darkest alpha keeping every in-block text pair at AA (pinned by a test);
  - `GHOST_OPACITY` is removed.

## Coherence laws kept (§4.5)
- **Law 1:** `render(board, now, prefs)` stays pure. Placement and the now-mark are deduced from its inputs.
- **Deduce, don't store:** layout, the now-line and the wash are recomputed every paint. Only `legendOpen` and `showCancelled` are stored, per browser.
- **No new Loc or Trm.** Overlaps, badges and statuses are unchanged in meaning.
