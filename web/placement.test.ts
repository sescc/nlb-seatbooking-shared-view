import { describe, expect, it } from 'vitest';
import type { Block, Person } from '../shared/src/types';
import { layoutRows, placeBlocks, type Placement } from './placement';

const A: Person = { id: 'a', name: 'Alice' };
const B: Person = { id: 'b', name: 'Bob' };
const C: Person = { id: 'c', name: 'Carol' };
const D = '2026-10-08';

function blk(o: {
  who: string;
  unit: string;
  from: string; // HH:MM
  to: string;
  kind?: Block['kind'];
  status?: Block['status'];
}): Block {
  return {
    personId: o.who,
    refs: [`${o.who}-${o.unit}-${o.from}`],
    kind: o.kind ?? (o.unit.startsWith('R') ? 'room' : 'seat'),
    library: 'L',
    area: 'Ar',
    floor: '1',
    unit: o.unit,
    start: `${D}T${o.from}:00+08:00`,
    end: `${D}T${o.to}:00+08:00`,
    status: o.status ?? 'booked',
  };
}

/** lane/track of the placement of the block with this unit. */
function at(ps: Placement[], unit: string, who?: string): { lane: Placement['lane']; track: number } {
  const p = ps.filter((x) => x.block.unit === unit && (who === undefined || x.block.personId === who));
  expect(p, `placements of ${unit}`).toHaveLength(1);
  return { lane: p[0]!.lane, track: p[0]!.track };
}

describe('placeBlocks: two people (centre layout)', () => {
  const two = [A, B];

  it('an empty input places nothing', () => {
    expect(placeBlocks(two, [])).toEqual([]);
    expect(placeBlocks([], [])).toEqual([]);
  });

  it('no rooms and no clashes: every block on track 0 of its owner, one row each', () => {
    const ps = placeBlocks(two, [blk({ who: 'a', unit: 'S1', from: '10:00', to: '11:00' }), blk({ who: 'b', unit: 'S2', from: '10:00', to: '11:00' })]);
    expect(at(ps, 'S1')).toEqual({ lane: 0, track: 0 });
    expect(at(ps, 'S2')).toEqual({ lane: 1, track: 0 });
    const rl = layoutRows(2, ps);
    expect(rl.laneTracks).toEqual([1, 1]);
    expect(rl.bandTracks).toBe(0);
    expect(rl.total).toBe(2);
  });

  it('a person with no blocks at all still has one row', () => {
    const rl = layoutRows(2, placeBlocks(two, []));
    expect(rl.laneTracks).toEqual([1, 1]);
    expect(rl.laneRow).toEqual([2, 3]);
  });

  it("blocks of the same person that do not clash share track 0", () => {
    const ps = placeBlocks(two, [blk({ who: 'a', unit: 'S1', from: '10:00', to: '11:00' }), blk({ who: 'a', unit: 'S2', from: '11:00', to: '12:00' })]);
    expect(at(ps, 'S1').track).toBe(0);
    expect(at(ps, 'S2').track).toBe(0);
  });

  it('a clashing block of the same person moves outward to track 1', () => {
    const ps = placeBlocks(two, [blk({ who: 'a', unit: 'S1', from: '10:00', to: '12:00' }), blk({ who: 'a', unit: 'S2', from: '11:00', to: '13:00' })]);
    expect(at(ps, 'S1')).toEqual({ lane: 0, track: 0 });
    expect(at(ps, 'S2')).toEqual({ lane: 0, track: 1 });
  });

  it('a third overlapping block goes to track 2, and a later free gap reuses the innermost free track', () => {
    const ps = placeBlocks(two, [
      blk({ who: 'b', unit: 'S1', from: '10:00', to: '12:00' }),
      blk({ who: 'b', unit: 'S2', from: '10:00', to: '11:00' }),
      blk({ who: 'b', unit: 'S3', from: '10:30', to: '11:30' }),
      blk({ who: 'b', unit: 'S4', from: '12:00', to: '13:00' }),
    ]);
    // sorted by start then end: S2 (10-11), S1 (10-12), S3 (10:30-11:30), S4
    expect(at(ps, 'S2').track).toBe(0);
    expect(at(ps, 'S1').track).toBe(1);
    expect(at(ps, 'S3').track).toBe(2);
    expect(at(ps, 'S4').track).toBe(0);
  });

  it('touching intervals are not a clash (half-open), but a half-hour of overlap is', () => {
    const touch = placeBlocks(two, [blk({ who: 'a', unit: 'S1', from: '10:00', to: '11:00' }), blk({ who: 'a', unit: 'S2', from: '11:00', to: '12:00' })]);
    expect(at(touch, 'S2').track).toBe(0);
    const over = placeBlocks(two, [blk({ who: 'a', unit: 'S1', from: '10:00', to: '11:30' }), blk({ who: 'a', unit: 'S2', from: '11:00', to: '12:00' })]);
    expect(at(over, 'S2').track).toBe(1);
  });

  it('sub-half-hour blocks sharing a grid cell clash even though their minutes do not', () => {
    const ps = placeBlocks(two, [blk({ who: 'a', unit: 'S1', from: '10:00', to: '10:15' }), blk({ who: 'a', unit: 'S2', from: '10:15', to: '10:30' })]);
    expect(at(ps, 'S2').track).toBe(1);
  });

  describe('rooms', () => {
    it('a room is placed once, spanning both lanes on track 0', () => {
      const ps = placeBlocks(two, [blk({ who: 'a', unit: 'R3', from: '12:00', to: '13:00' })]);
      expect(ps).toHaveLength(1);
      expect(ps[0]).toMatchObject({ lane: 'span', track: 0 });
      const rl = layoutRows(2, ps);
      expect(rl.laneTracks).toEqual([1, 1]);
      // straddles the centre: A's track-0 row (row 2) and B's (row 3)
      expect(rl.rowOf(ps[0]!)).toEqual({ row: 2, span: 2 });
    });

    it("a partner's seat inside the room goes to the partner's track 1; the owner's own seat to the owner's track 1", () => {
      const room = blk({ who: 'a', unit: 'R3', from: '12:00', to: '14:00' });
      const partner = placeBlocks(two, [room, blk({ who: 'b', unit: 'S9', from: '13:00', to: '14:00' })]);
      expect(at(partner, 'R3').lane).toBe('span');
      expect(at(partner, 'S9')).toEqual({ lane: 1, track: 1 });
      expect(layoutRows(2, partner).laneTracks).toEqual([1, 2]);

      const own = placeBlocks(two, [room, blk({ who: 'a', unit: 'S9', from: '13:00', to: '14:00' })]);
      expect(at(own, 'S9')).toEqual({ lane: 0, track: 1 });
      expect(layoutRows(2, own).laneTracks).toEqual([2, 1]);
    });

    it('a seat before/after the room (touching) stays on track 0', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'a', unit: 'R3', from: '12:00', to: '13:00' }),
        blk({ who: 'b', unit: 'S1', from: '11:00', to: '12:00' }),
        blk({ who: 'b', unit: 'S2', from: '13:00', to: '14:00' }),
      ]);
      expect(at(ps, 'S1').track).toBe(0);
      expect(at(ps, 'S2').track).toBe(0);
    });

    it('a seat placed before the room in time order still gives way to it (rooms are placed first)', () => {
      const ps = placeBlocks(two, [blk({ who: 'b', unit: 'S1', from: '11:00', to: '13:00' }), blk({ who: 'a', unit: 'R3', from: '12:00', to: '14:00' })]);
      expect(at(ps, 'R3').lane).toBe('span');
      expect(at(ps, 'S1')).toEqual({ lane: 1, track: 1 });
    });

    it('two identical overlapping rooms: neither spans; each in its booker\'s track 0', () => {
      const ps = placeBlocks(two, [blk({ who: 'a', unit: 'R3', from: '12:00', to: '13:00' }), blk({ who: 'b', unit: 'R5', from: '12:00', to: '13:00' })]);
      expect(at(ps, 'R3')).toEqual({ lane: 0, track: 0 });
      expect(at(ps, 'R5')).toEqual({ lane: 1, track: 0 });
    });

    it('two partially overlapping rooms: neither spans', () => {
      const ps = placeBlocks(two, [blk({ who: 'a', unit: 'R3', from: '12:00', to: '14:00' }), blk({ who: 'b', unit: 'R5', from: '13:00', to: '15:00' })]);
      expect(at(ps, 'R3')).toEqual({ lane: 0, track: 0 });
      expect(at(ps, 'R5')).toEqual({ lane: 1, track: 0 });
    });

    it("overlapping rooms of the SAME person stack in that person's lane", () => {
      const ps = placeBlocks(two, [blk({ who: 'a', unit: 'R3', from: '12:00', to: '14:00' }), blk({ who: 'a', unit: 'R4', from: '13:00', to: '15:00' })]);
      expect(at(ps, 'R3')).toEqual({ lane: 0, track: 0 });
      expect(at(ps, 'R4')).toEqual({ lane: 0, track: 1 });
    });

    it('rooms touching each other (10-11, 11-12) both span', () => {
      const ps = placeBlocks(two, [blk({ who: 'a', unit: 'R3', from: '10:00', to: '11:00' }), blk({ who: 'b', unit: 'R5', from: '11:00', to: '12:00' })]);
      expect(at(ps, 'R3').lane).toBe('span');
      expect(at(ps, 'R5').lane).toBe('span');
      expect(layoutRows(2, ps).laneTracks).toEqual([1, 1]);
    });

    it('a room overlapping nothing spans even when another pair of rooms elsewhere does not', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'a', unit: 'R3', from: '10:00', to: '11:00' }),
        blk({ who: 'b', unit: 'R5', from: '10:00', to: '11:00' }),
        blk({ who: 'a', unit: 'R7', from: '15:00', to: '16:00' }),
      ]);
      expect(at(ps, 'R3').lane).toBe(0);
      expect(at(ps, 'R5').lane).toBe(1);
      expect(at(ps, 'R7').lane).toBe('span');
    });

    it('a seat on the other track-0 spot does not block a different-time room from spanning', () => {
      const ps = placeBlocks(two, [blk({ who: 'b', unit: 'S1', from: '10:00', to: '11:00' }), blk({ who: 'a', unit: 'R3', from: '11:00', to: '12:00' })]);
      expect(at(ps, 'R3').lane).toBe('span');
      expect(at(ps, 'S1').track).toBe(0);
    });
  });

  describe('cancelled blocks', () => {
    it('a cancelled seat clashing with an active one goes outward, whichever starts first', () => {
      for (const [cancelledFrom, activeFrom] of [['09:00', '10:00'], ['10:00', '10:00'], ['11:00', '10:00']]) {
        const ps = placeBlocks(two, [
          blk({ who: 'a', unit: 'XC', from: cancelledFrom!, to: '12:00', status: 'cancelled' }),
          blk({ who: 'a', unit: 'S1', from: activeFrom!, to: '12:00' }),
        ]);
        expect(at(ps, 'S1'), `cancelled from ${cancelledFrom}`).toEqual({ lane: 0, track: 0 });
        expect(at(ps, 'XC'), `cancelled from ${cancelledFrom}`).toEqual({ lane: 0, track: 1 });
      }
    });

    it('a cancelled seat that clashes with nothing takes track 0', () => {
      const ps = placeBlocks(two, [blk({ who: 'b', unit: 'XC', from: '09:00', to: '10:00', status: 'cancelled' }), blk({ who: 'b', unit: 'S1', from: '10:00', to: '11:00' })]);
      expect(at(ps, 'XC').track).toBe(0);
    });

    it('a cancelled room never stops an active room spanning; it goes outward in its booker\'s lane', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'b', unit: 'R9', from: '12:00', to: '13:00', status: 'cancelled' }),
        blk({ who: 'a', unit: 'R3', from: '12:00', to: '13:00' }),
      ]);
      expect(at(ps, 'R3').lane).toBe('span');
      expect(at(ps, 'R9')).toEqual({ lane: 1, track: 1 });
    });

    it('a cancelled room overlapping an active room of the same person goes outward in that lane', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'a', unit: 'R9', from: '12:00', to: '13:00', status: 'cancelled' }),
        blk({ who: 'a', unit: 'R3', from: '12:30', to: '14:00' }),
      ]);
      expect(at(ps, 'R3').lane).toBe('span');
      expect(at(ps, 'R9')).toEqual({ lane: 0, track: 1 });
    });

    it('a cancelled room overlapping a non-spanning active room (a duplicate pair) goes outward', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'a', unit: 'R3', from: '12:00', to: '13:00' }),
        blk({ who: 'b', unit: 'R5', from: '12:00', to: '13:00' }),
        blk({ who: 'a', unit: 'R9', from: '12:00', to: '13:00', status: 'cancelled' }),
      ]);
      expect(at(ps, 'R3')).toEqual({ lane: 0, track: 0 });
      expect(at(ps, 'R5')).toEqual({ lane: 1, track: 0 });
      expect(at(ps, 'R9')).toEqual({ lane: 0, track: 1 });
    });

    it('a cancelled room that overlaps no other room does not stop active rooms elsewhere from spanning', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'a', unit: 'R3', from: '10:00', to: '11:00' }),
        blk({ who: 'b', unit: 'R9', from: '15:00', to: '16:00', status: 'cancelled' }),
      ]);
      expect(at(ps, 'R3').lane).toBe('span');
      expect(at(ps, 'R9').lane).toBe('span');
    });

    it('a cancelled room clashing with a SEAT in the partner\'s track 0 sits in its own lane', () => {
      const ps = placeBlocks(two, [blk({ who: 'b', unit: 'S1', from: '12:00', to: '13:00' }), blk({ who: 'a', unit: 'R9', from: '12:00', to: '13:00', status: 'cancelled' })]);
      expect(at(ps, 'S1')).toEqual({ lane: 1, track: 0 });
      expect(at(ps, 'R9')).toEqual({ lane: 0, track: 0 });
    });

    it('a lone cancelled room spans like any room', () => {
      const ps = placeBlocks(two, [blk({ who: 'a', unit: 'R9', from: '12:00', to: '13:00', status: 'cancelled' })]);
      expect(ps[0]!.lane).toBe('span');
    });

    it('two overlapping cancelled rooms with no active rooms: the first spans, the second goes outward', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'b', unit: 'R9', from: '12:30', to: '13:30', status: 'cancelled' }),
        blk({ who: 'a', unit: 'R8', from: '12:00', to: '13:00', status: 'cancelled' }),
      ]);
      expect(at(ps, 'R8').lane).toBe('span');
      expect(at(ps, 'R9')).toEqual({ lane: 1, track: 1 });
    });

    it('no-show and partly cancelled blocks count as active (placed with the active seats)', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'a', unit: 'XC', from: '10:00', to: '11:00', status: 'cancelled' }),
        blk({ who: 'a', unit: 'S1', from: '10:00', to: '11:00', status: 'no_show' }),
        blk({ who: 'a', unit: 'S2', from: '10:00', to: '11:00', status: 'partial_cancelled' }),
      ]);
      expect(at(ps, 'S1').track).toBe(0);
      expect(at(ps, 'S2').track).toBe(1);
      expect(at(ps, 'XC').track).toBe(2);
    });
  });

  describe('order and determinism', () => {
    const set = [
      blk({ who: 'a', unit: 'R3', from: '12:00', to: '14:00' }),
      blk({ who: 'a', unit: 'S1', from: '13:00', to: '15:00' }),
      blk({ who: 'b', unit: 'S2', from: '13:00', to: '15:00' }),
      blk({ who: 'b', unit: 'S3', from: '13:30', to: '14:30' }),
      blk({ who: 'b', unit: 'XC', from: '12:30', to: '13:30', status: 'cancelled' }),
      blk({ who: 'a', unit: 'R9', from: '09:00', to: '10:00', status: 'cancelled' }),
    ];
    const shape = (ps: Placement[]) => ps.map((p) => `${p.block.unit}:${String(p.lane)}:${p.track}`);

    it('places active rooms, then active seats, then cancelled rooms, then cancelled seats', () => {
      const units = placeBlocks(two, set).map((p) => p.block.unit);
      expect(units).toEqual(['R3', 'S1', 'S2', 'S3', 'R9', 'XC']);
    });

    it('does not depend on the input order', () => {
      const base = shape(placeBlocks(two, set));
      for (const perm of [[...set].reverse(), [set[3]!, set[0]!, set[5]!, set[1]!, set[4]!, set[2]!]]) {
        expect(shape(placeBlocks(two, perm))).toEqual(base);
      }
    });

    it('breaks ties by end, then person, then unit', () => {
      const ps = placeBlocks(two, [
        blk({ who: 'b', unit: 'S5', from: '10:00', to: '11:00' }),
        blk({ who: 'a', unit: 'S9', from: '10:00', to: '11:00' }),
        blk({ who: 'a', unit: 'S2', from: '10:00', to: '11:00' }),
        blk({ who: 'a', unit: 'S7', from: '10:00', to: '10:30' }),
      ]);
      expect(ps.map((p) => p.block.unit)).toEqual(['S7', 'S2', 'S9', 'S5']);
    });

    it('is pure: does not mutate or reorder its input', () => {
      const input = [...set];
      placeBlocks(two, input);
      expect(input).toEqual(set);
    });

    it('returns the very Block objects it was given', () => {
      const ps = placeBlocks(two, set);
      for (const p of ps) expect(set).toContain(p.block);
    });
  });

  it('drops blocks of people that are not on the board', () => {
    const ps = placeBlocks(two, [blk({ who: 'zz', unit: 'S1', from: '10:00', to: '11:00' }), blk({ who: 'zz', unit: 'R1', from: '10:00', to: '11:00' })]);
    expect(ps).toEqual([]);
  });
});

describe('layoutRows: rows for two people', () => {
  const two = [A, B];

  it('A tracks count upward from the centre line, B downward; the span room straddles A track 0 and B track 0', () => {
    const ps = placeBlocks(two, [
      blk({ who: 'a', unit: 'R3', from: '12:00', to: '15:00' }),
      blk({ who: 'a', unit: 'S1', from: '12:00', to: '13:00' }),
      blk({ who: 'a', unit: 'S2', from: '12:00', to: '13:00' }),
      blk({ who: 'b', unit: 'S3', from: '12:00', to: '13:00' }),
    ]);
    const rl = layoutRows(2, ps);
    expect(rl.laneTracks).toEqual([3, 2]); // the room holds track 0 of both lanes, so every seat is pushed out
    expect(rl.laneRow).toEqual([2, 5]); // header is row 1; A rows 2-4, B rows 5-6
    expect(rl.total).toBe(5);
    const row = (u: string) => rl.rowOf(ps.find((p) => p.block.unit === u)!);
    expect(row('R3')).toEqual({ row: 4, span: 2 }); // A track 0 (row 4) and B track 0 (row 5)
    expect(row('S1')).toEqual({ row: 3, span: 1 });
    expect(row('S2')).toEqual({ row: 2, span: 1 });
    expect(row('S3')).toEqual({ row: 6, span: 1 });
  });

  it('A track 0 is the row next to the centre; higher A tracks are further up', () => {
    const ps = placeBlocks(two, [
      blk({ who: 'a', unit: 'S1', from: '12:00', to: '14:00' }),
      blk({ who: 'a', unit: 'S2', from: '12:00', to: '14:00' }),
      blk({ who: 'a', unit: 'S3', from: '12:00', to: '14:00' }),
      blk({ who: 'b', unit: 'S4', from: '12:00', to: '14:00' }),
      blk({ who: 'b', unit: 'S5', from: '12:00', to: '14:00' }),
    ]);
    const rl = layoutRows(2, ps);
    const row = (u: string) => rl.rowOf(ps.find((p) => p.block.unit === u)!).row;
    expect([row('S1'), row('S2'), row('S3')]).toEqual([4, 3, 2]); // track 0 nearest the centre, outermost on top
    expect([row('S4'), row('S5')]).toEqual([5, 6]); // B grows downward from the centre
  });

  it('the span room row is A track 0 (the row just above the centre) with row span 2', () => {
    const ps = placeBlocks(two, [blk({ who: 'b', unit: 'R3', from: '12:00', to: '13:00' }), blk({ who: 'a', unit: 'S1', from: '12:00', to: '13:00' })]);
    const rl = layoutRows(2, ps);
    expect(rl.laneTracks[0]).toBe(2);
    expect(rl.rowOf(ps.find((p) => p.block.unit === 'R3')!)).toEqual({ row: 3, span: 2 });
  });
});

describe('placeBlocks: other head counts (rooms band above stacked lanes)', () => {
  it('three people: rooms go to a shared band and stack when they overlap; seats are packed per lane', () => {
    const people = [A, B, C];
    const ps = placeBlocks(people, [
      blk({ who: 'a', unit: 'R3', from: '12:00', to: '14:00' }),
      blk({ who: 'b', unit: 'R5', from: '13:00', to: '15:00' }),
      blk({ who: 'c', unit: 'R7', from: '15:00', to: '16:00' }),
      blk({ who: 'a', unit: 'S1', from: '12:00', to: '13:00' }),
      blk({ who: 'a', unit: 'S2', from: '12:30', to: '13:30' }),
      blk({ who: 'c', unit: 'S3', from: '12:00', to: '13:00' }),
    ]);
    expect(at(ps, 'R3')).toEqual({ lane: 'rooms', track: 0 });
    expect(at(ps, 'R5')).toEqual({ lane: 'rooms', track: 1 });
    expect(at(ps, 'R7')).toEqual({ lane: 'rooms', track: 0 }); // touching R5 at 15:00: free again
    expect(at(ps, 'S1')).toEqual({ lane: 0, track: 0 });
    expect(at(ps, 'S2')).toEqual({ lane: 0, track: 1 });
    expect(at(ps, 'S3')).toEqual({ lane: 2, track: 0 });
    expect(ps.some((p) => p.lane === 'span')).toBe(false);

    const rl = layoutRows(3, ps);
    expect(rl.bandTracks).toBe(2);
    expect(rl.bandRow).toBe(2);
    expect(rl.laneTracks).toEqual([2, 1, 1]);
    expect(rl.laneRow).toEqual([4, 6, 7]); // header 1, band 2-3, then the lanes top-down
    expect(rl.total).toBe(6);
    const row = (u: string) => rl.rowOf(ps.find((p) => p.block.unit === u)!);
    expect(row('R3')).toEqual({ row: 2, span: 1 });
    expect(row('R5')).toEqual({ row: 3, span: 1 });
    expect(row('S1')).toEqual({ row: 4, span: 1 });
    expect(row('S2')).toEqual({ row: 5, span: 1 }); // tracks grow DOWNWARD in every lane here
    expect(row('S3')).toEqual({ row: 7, span: 1 });
  });

  it('with no rooms there is no band at all', () => {
    const ps = placeBlocks([A, B, C], [blk({ who: 'b', unit: 'S1', from: '10:00', to: '11:00' })]);
    const rl = layoutRows(3, ps);
    expect(rl.bandTracks).toBe(0);
    expect(rl.laneRow).toEqual([2, 3, 4]);
    expect(rl.total).toBe(3);
  });

  it('one person: a room goes to the band above the lane, not "span"', () => {
    const ps = placeBlocks([A], [blk({ who: 'a', unit: 'R3', from: '12:00', to: '13:00' }), blk({ who: 'a', unit: 'S1', from: '12:00', to: '13:00' })]);
    expect(at(ps, 'R3')).toEqual({ lane: 'rooms', track: 0 });
    expect(at(ps, 'S1')).toEqual({ lane: 0, track: 0 }); // the seat does not clash with the band
    const rl = layoutRows(1, ps);
    expect(rl.bandTracks).toBe(1);
    expect(rl.laneRow).toEqual([3]);
    expect(rl.total).toBe(2);
  });

  it('one person with no blocks: one empty lane row', () => {
    const rl = layoutRows(1, placeBlocks([A], []));
    expect(rl.laneTracks).toEqual([1]);
    expect(rl.total).toBe(1);
  });

  it('five people work too, cancelled rooms stack in the band after active ones', () => {
    const people = [A, B, C, { id: 'd', name: 'D' }, { id: 'e', name: 'E' }];
    const ps = placeBlocks(people, [
      blk({ who: 'e', unit: 'R1', from: '10:00', to: '11:00', status: 'cancelled' }),
      blk({ who: 'd', unit: 'R2', from: '10:00', to: '11:00' }),
      blk({ who: 'e', unit: 'S1', from: '10:00', to: '11:00' }),
    ]);
    expect(at(ps, 'R2')).toEqual({ lane: 'rooms', track: 0 });
    expect(at(ps, 'R1')).toEqual({ lane: 'rooms', track: 1 });
    expect(at(ps, 'S1')).toEqual({ lane: 4, track: 0 });
    expect(ps.map((p) => p.block.unit)).toEqual(['R2', 'S1', 'R1']);
  });

  it('an empty input places nothing', () => {
    expect(placeBlocks([A, B, C], [])).toEqual([]);
  });
});
