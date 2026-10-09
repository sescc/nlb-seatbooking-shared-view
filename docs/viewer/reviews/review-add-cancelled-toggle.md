# Review: add-cancelled-toggle (§4.5 checklist)

> Viewer only. Change: `openspec/changes/add-cancelled-toggle/` (archived after this review).

- [x] **Law 1, explicit inputs.** `render(board, now, prefs)` is pure and reads no storage. `web/app.ts` owns the single `ViewPrefs` instance (D61).
- [x] **Deduce, don't store.** Visibility and the per-day count are deduced on every render. Only the user's checkbox choice is stored, per browser.
- [x] **Partiality.** `toggleCancelled` wraps every storage access. A throwing or absent store means hidden, with no crash (`web/cancelled.test.ts`).
- [x] **Both branches tested.**
  - hidden or shown; per-day reveal true or false overriding either default;
  - N = 0 (no button) or N > 0;
  - "No bookings" vs "No active bookings";
  - track repacking.
- [x] **CSP.** No inline handlers or styles. The control is static markup in the shell, wired by the nonced bundle (`web/shell.test.ts`).
- [x] **Contrast.** `.cnt` uses `--muted` on `--card` (AA-tested). The checkbox label uses `--fg`. Both have focus rings.
- [x] **No new Loc or Trm.** No server, wire or domain change.

## Checks
- `npm test`: 22 files, 520 passed. `npm run typecheck`: clean. `npm run build`: viewer 12,871 B.
- Local Worker with throwaway secrets (D45), at 1280 px, with the page forced visible because the pane was hidden:
  - **Default:** Today reads "1 cancelled hidden" (a 2-hour hold counts 1), shows "No active bookings", and still draws 14 hour headers and 2 lanes. Tomorrow reads "2 cancelled hidden". No cancelled blocks or rows are shown, and both no-shows are visible.
  - **Reveal Tomorrow:** its 2 blocks and 2 rows appear and Today stays hidden. This held after a wait of more than 5 s, so it survives the poll redraw.
  - **Hide:** re-hides the day.
  - **Checkbox ticked:** both days show "Hide N"; storage holds `'1'`.
  - **Per-day hide of Today, then reload:** the per-day choice is dropped, the checkbox stays ticked, and both days are shown.
  - The page does not scroll sideways (1265 ≤ 1280).
- No screenshots: they time out while the pane is hidden. No mobile check.

## Observations
- The checkbox sits inside the existing `#theme` bar, which is also the theme click container. That's harmless, because the theme handler only reacts to `button[data-theme-choice]`.
