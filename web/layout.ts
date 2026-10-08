// Timeline geometry shared by render.ts (which emits the classes) and styles.ts (which defines them).
//
// A CSP-nonced stylesheet cannot be combined with style="" attributes, so every position is a class:
//   .s-HHMM  grid-column-start for a half-hour slot (.s-0800 ... .s-2130)
//   .d-N     grid-column-end: span N half-hour slots (.d-1 ... .d-28)
//   .r-N     grid-row-start (.r-1 is the hour header row)
//   .h-N     grid-row-end: span N rows
// Column 1 of the grid is the lane label; slot i (0 = 08:00) is column line 2 + i.

export const GRID_START_MIN = 8 * 60;
export const GRID_END_MIN = 22 * 60;
export const SLOT_MIN = 30;
export const SLOTS = (GRID_END_MIN - GRID_START_MIN) / SLOT_MIN; // 28
export const MAX_ROWS = 40;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "HHMM" of a slot index (0 -> "0800"). */
export function slotHHMM(slot: number): string {
  const m = GRID_START_MIN + slot * SLOT_MIN;
  return pad2(Math.floor(m / 60)) + pad2(m % 60);
}

export const startClass = (slot: number) => `s-${slotHHMM(slot)}`;
export const spanClass = (slots: number) => `d-${slots}`;
export const rowClass = (row: number) => `r-${Math.min(row, MAX_ROWS)}`;
export const rowSpanClass = (rows: number) => `h-${Math.min(rows, MAX_ROWS)}`;

/**
 * Slot range [first, end) covered by minutes-since-midnight [startMin, endMin), floored/ceiled to
 * half-hours and clamped to the grid. Returns null when nothing falls inside 08:00-22:00.
 */
export function slotRange(startMin: number, endMin: number): { first: number; end: number } | null {
  const first = Math.max(0, Math.floor((startMin - GRID_START_MIN) / SLOT_MIN));
  const end = Math.min(SLOTS, Math.ceil((endMin - GRID_START_MIN) / SLOT_MIN));
  return end > first ? { first, end } : null;
}
