## Context
The user settled the behaviour in a grilling session on 2026-10-09 (decisions D56–D60 in `CLAUDE.md`). A throwaway prototype was used to choose how the count line behaves once a day is revealed.

## Model delta (viewer only)
- **Consolidation check (§3).**
  - New object `ViewPrefs = { showCancelled : Bool, reveal : Date ⇀ Bool }`, held at L4 only and never sent anywhere.
  - `showCancelled` persists per browser (`localStorage["showCancelled"]`); `reveal` lives in memory.
  - It is not part of `Board`, and it is a different object from `ThemeChoice`: the theme is CSS-only (rule 4), while visibility changes the layout (track repacking), so it must be an input to `render`.
- **`render ⊸ : Board × Now × ViewPrefs → DOM`** (Total, pure). Rule 1 becomes: the rendered state is a function of (last `Board`, `now`, `ViewPrefs`).
- **`visible(day) = reveal[day.date] ?? showCancelled`.** Hidden blocks = `cancelled` blocks of a day where `visible` is false. They are removed before ghosts and track packing.
- **`hiddenCount(day)`** = the number of that day's merged `cancelled` blocks (Deduced, never per lane copy).
- **`toggleCancelled ⊸ : Event → ViewPrefs`** (Partial: storage may throw, in which case the choice lasts only for the page view). It is modelled on `setTheme ⊸`.
  - checkbox change → `showCancelled := checked`, `reveal := ∅`, persist;
  - count click → `reveal[date] := (data-reveal = 1)`.

## Coherence laws kept (§4.5)
- **Law 1:** every input to `render` is explicit (`Board`, `now`, `ViewPrefs`), and `render` stays pure.
- **Deduce, don't store:** the count and the visibility are deduced on every render. Only the user's checkbox choice is stored.
- **No new Loc or Trm.** Overlaps are unchanged (cancelled was already excluded, D52).
