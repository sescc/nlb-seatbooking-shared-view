// Pure layout morphism: (people, blocks) -> where each block sits. No HTML, no clock, deterministic.
//   Exactly two people ("centre" layout): A's lane grows UP from the centre line, B's DOWN; track 0 is each person's
//     inner row. A room is drawn once, `lane: 'span'`, straddling the centre (track 0 of both), unless it overlaps
//     another room or either inner row is taken; then it sits in its booker's lane like a seat.
//   Any other count: lanes stack top-down (tracks grow downward); every room goes in one shared band above them
//     (`lane: 'rooms'`), overlapping rooms stacking within it.
// A block moves outward only when it clashes with something already in the track (half-open: touching is fine).
// Clashes use half-hour cells, because that is what the timeline can draw. Order: active rooms, active seats,
// cancelled rooms, cancelled seats; inside a group by start, end, person, unit.
import type { Block, Person } from '../shared/src/types';

export type LaneRef = number | 'span' | 'rooms';
export interface Placement {
  block: Block;
  lane: LaneRef; // person index, 'span' (centre layout room) or 'rooms' (band)
  track: number; // 0 = innermost
}

interface Cells {
  s: number;
  e: number;
}
type Tracks = Cells[][];

const HALF_MS = 30 * 60_000; // SGT is a whole number of half-hours from UTC, so absolute cells line up with the grid
const cells = (b: Block): Cells => {
  const s = Math.floor(Date.parse(b.start) / HALF_MS);
  return { s, e: Math.max(s + 1, Math.ceil(Date.parse(b.end) / HALF_MS)) };
};
const clash = (x: Cells, y: Cells) => x.s < y.e && y.s < x.e;
const free = (t: Cells[] | undefined, x: Cells) => !t || t.every((y) => !clash(x, y));
function innermost(ts: Tracks, x: Cells): number {
  let i = 0;
  while (!free(ts[i], x)) i++;
  return i;
}
function put(ts: Tracks, i: number, x: Cells): void {
  (ts[i] ??= []).push(x);
}

export function placeBlocks(people: Person[], blocks: Block[]): Placement[] {
  const owner = new Map(people.map((p, i) => [p.id, i]));
  const mine = blocks.filter((b) => owner.has(b.personId));
  const cancelled = (b: Block) => b.status === 'cancelled';
  const group = (b: Block) => (cancelled(b) ? 2 : 0) + (b.kind === 'room' ? 0 : 1);
  const order = [...mine].sort(
    (x, y) =>
      group(x) - group(y) ||
      Date.parse(x.start) - Date.parse(y.start) ||
      Date.parse(x.end) - Date.parse(y.end) ||
      owner.get(x.personId)! - owner.get(y.personId)! ||
      x.unit.localeCompare(y.unit) ||
      x.refs.join(',').localeCompare(y.refs.join(',')),
  );

  const out: Placement[] = [];
  if (people.length === 2) {
    // active rooms that overlap another active room never span; a cancelled room never stops an active one
    // spanning, and is placed last by the normal rule (spans only if both inner rows are free)
    const clashing = new Set<Block>();
    const rooms = order.filter((b) => b.kind === 'room' && !cancelled(b));
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (clash(cells(rooms[i]!), cells(rooms[j]!))) {
          clashing.add(rooms[i]!);
          clashing.add(rooms[j]!);
        }
      }
    }
    const lanes: Tracks[] = [[], []];
    for (const b of order) {
      const x = cells(b);
      if (b.kind === 'room' && !clashing.has(b) && free(lanes[0]![0], x) && free(lanes[1]![0], x)) {
        put(lanes[0]!, 0, x);
        put(lanes[1]!, 0, x);
        out.push({ block: b, lane: 'span', track: 0 });
        continue;
      }
      const lane = owner.get(b.personId)!;
      const track = innermost(lanes[lane]!, x);
      put(lanes[lane]!, track, x);
      out.push({ block: b, lane, track });
    }
    return out;
  }

  const band: Tracks = [];
  const lanes: Tracks[] = people.map(() => []);
  for (const b of order) {
    const x = cells(b);
    if (b.kind === 'room') {
      const track = innermost(band, x);
      put(band, track, x);
      out.push({ block: b, lane: 'rooms', track });
      continue;
    }
    const lane = owner.get(b.personId)!;
    const track = innermost(lanes[lane]!, x);
    put(lanes[lane]!, track, x);
    out.push({ block: b, lane, track });
  }
  return out;
}

export interface RowLayout {
  bandRow: number; // first grid row of the rooms band (only meaningful when bandTracks > 0)
  bandTracks: number; // 0 when there is no band
  laneRow: number[]; // first grid row of each person's lane
  laneTracks: number[]; // rows in each person's lane (>= 1)
  total: number; // rows below the hour header (row 1)
  rowOf(p: Placement): { row: number; span: number };
}

/** Grid rows (row 1 is the hour header) for the placements of `nPeople` people. */
export function layoutRows(nPeople: number, placements: Placement[]): RowLayout {
  const centre = nPeople === 2;
  const need = (pick: (p: Placement) => boolean) =>
    placements.filter(pick).reduce((n, p) => Math.max(n, p.track + 1), 0);
  const bandTracks = need((p) => p.lane === 'rooms');
  const laneTracks = Array.from({ length: nPeople }, (_, i) => Math.max(1, need((p) => p.lane === i)));
  const bandRow = 2;
  const laneRow: number[] = [];
  let next = bandRow + bandTracks;
  for (const n of laneTracks) {
    laneRow.push(next);
    next += n;
  }
  return {
    bandRow,
    bandTracks,
    laneRow,
    laneTracks,
    total: next - 2,
    rowOf(p) {
      if (p.lane === 'span') return { row: laneRow[0]! + laneTracks[0]! - 1, span: 2 };
      if (p.lane === 'rooms') return { row: bandRow + p.track, span: 1 };
      // centre layout: the first person's tracks count upward from the centre line
      const row = centre && p.lane === 0 ? laneRow[0]! + laneTracks[0]! - 1 - p.track : laneRow[p.lane]! + p.track;
      return { row, span: 1 };
    },
  };
}
