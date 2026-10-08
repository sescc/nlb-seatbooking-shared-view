// NLB returns one row per hour; consecutive rows for the same unit form one display block (deduced, not stored).
import type { Block, Booking } from './types';

const sameUnit = (b: Block, r: Booking) =>
  b.library === r.library && b.area === r.area && b.unit === r.unit && b.kind === r.kind && b.status === r.status;

export function mergeBlocks(personId: string, bookings: Booking[]): Block[] {
  const sorted = [...bookings].sort(
    (x, y) => Date.parse(x.start) - Date.parse(y.start) || Date.parse(x.end) - Date.parse(y.end),
  );
  const blocks: Block[] = [];
  for (const r of sorted) {
    // Search all open blocks, not just the latest, so a seat and a room held in the same hours
    // (rows interleave after sorting) still each merge into their own block.
    const target = blocks.find((b) => sameUnit(b, r) && Date.parse(b.end) === Date.parse(r.start));
    if (target) {
      target.end = r.end;
      target.refs.push(r.ref);
      if (r.pax !== undefined) target.pax = Math.max(target.pax ?? 0, r.pax);
      continue;
    }
    const block: Block = {
      personId, refs: [r.ref], kind: r.kind, library: r.library, area: r.area, floor: r.floor,
      unit: r.unit, start: r.start, end: r.end, status: r.status,
    };
    if (r.pax !== undefined) block.pax = r.pax;
    blocks.push(block);
  }
  return blocks;
}
