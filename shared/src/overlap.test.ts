import { describe, expect, it } from 'vitest';
import { booking } from './fixtures';
import { computeOverlaps } from './overlap';
import type { Board, Booking, Snapshot } from './types';

const h = (hour: number) => `2026-10-08T${String(hour).padStart(2, '0')}:00:00+08:00`;
const seat = (unit: string, from: number, to: number, over: Partial<Booking> = {}) =>
  booking({ ref: `${unit}-${from}`, unit, start: h(from), end: h(to), ...over });
const room = (unit: string, from: number, to: number, over: Partial<Booking> = {}) =>
  booking({ ref: `${unit}-${from}`, kind: 'room', area: 'Discussion Room', unit, pax: 2, start: h(from), end: h(to), ...over });

function snap(personId: string, bookings: Booking[]): Snapshot {
  return { personId, receivedAt: h(9), bookings };
}

function board(a: Booking[] | null, b: Booking[] | null): Board {
  return {
    serverNow: h(10),
    people: [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ],
    snapshots: { a: a && snap('a', a), b: b && snap('b', b) },
  };
}

describe('computeOverlaps', () => {
  it('two overlapping seats -> both_booked with the intersection', () => {
    const out = computeOverlaps(board([seat('S1', 10, 12)], [seat('S2', 11, 13)]));
    expect(out).toEqual([
      {
        kind: 'both_booked',
        start: h(11),
        end: h(12),
        a: { personId: 'a', unit: 'S1', kind: 'seat' },
        b: { personId: 'b', unit: 'S2', kind: 'seat' },
      },
    ]);
  });

  it('touching intervals are not overlaps', () => {
    expect(computeOverlaps(board([seat('S1', 10, 11)], [seat('S2', 11, 12)]))).toEqual([]);
    expect(computeOverlaps(board([seat('S2', 11, 12)], [seat('S1', 10, 11)]))).toEqual([]);
  });

  it('disjoint intervals are not overlaps', () => {
    expect(computeOverlaps(board([seat('S1', 9, 10)], [seat('S2', 14, 15)]))).toEqual([]);
  });

  it("B's seat inside A's room -> seat_in_partner_room, redundant seat is B's", () => {
    const out = computeOverlaps(board([room('R3', 12, 14)], [seat('S9', 13, 14)]));
    expect(out).toEqual([
      {
        kind: 'seat_in_partner_room',
        start: h(13),
        end: h(14),
        a: { personId: 'a', unit: 'R3', kind: 'room' },
        b: { personId: 'b', unit: 'S9', kind: 'seat' },
        redundantSeat: { personId: 'b', unit: 'S9' },
      },
    ]);
  });

  it("A's seat inside B's room -> redundant seat is A's", () => {
    const out = computeOverlaps(board([seat('S1', 12, 13)], [room('R3', 12, 14)]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: 'seat_in_partner_room',
      start: h(12),
      end: h(13),
      redundantSeat: { personId: 'a', unit: 'S1' },
    });
  });

  it('seat_in_partner_room is emitted instead of both_booked, not in addition', () => {
    const out = computeOverlaps(board([room('R3', 12, 14)], [seat('S9', 12, 14)]));
    expect(out.map((o) => o.kind)).toEqual(['seat_in_partner_room']);
  });

  it('room vs room -> duplicate_rooms (one overlap, intersection, no redundantSeat)', () => {
    const out = computeOverlaps(board([room('R3', 12, 14)], [room('R4', 13, 15)]));
    expect(out).toEqual([
      {
        kind: 'duplicate_rooms',
        start: h(13),
        end: h(14),
        a: { personId: 'a', unit: 'R3', kind: 'room' },
        b: { personId: 'b', unit: 'R4', kind: 'room' },
      },
    ]);
    expect(out[0]).not.toHaveProperty('redundantSeat');
  });

  it('touching rooms are not duplicate_rooms', () => {
    expect(computeOverlaps(board([room('R3', 12, 13)], [room('R4', 13, 14)]))).toEqual([]);
  });

  it('a cancelled room does not produce duplicate_rooms', () => {
    expect(computeOverlaps(board([room('R3', 12, 14, { status: 'cancelled' })], [room('R4', 12, 14)]))).toEqual([]);
  });

  it('seat vs seat stays both_booked', () => {
    expect(computeOverlaps(board([seat('S1', 12, 14)], [seat('S2', 12, 14)])).map((o) => o.kind)).toEqual(['both_booked']);
  });

  it('cancelled bookings are excluded on either side', () => {
    expect(computeOverlaps(board([seat('S1', 10, 12, { status: 'cancelled' })], [seat('S2', 10, 12)]))).toEqual([]);
    expect(computeOverlaps(board([seat('S1', 10, 12)], [seat('S2', 10, 12, { status: 'cancelled' })]))).toEqual([]);
    expect(computeOverlaps(board([room('R3', 10, 12, { status: 'cancelled' })], [seat('S2', 10, 12)]))).toEqual([]);
  });

  it('no_show bookings are excluded on either side, for every kind pairing', () => {
    const ns = { status: 'no_show' } as const;
    expect(computeOverlaps(board([seat('S1', 10, 12, ns)], [seat('S2', 10, 12)]))).toEqual([]);
    expect(computeOverlaps(board([seat('S1', 10, 12)], [seat('S2', 10, 12, ns)]))).toEqual([]);
    expect(computeOverlaps(board([seat('S1', 10, 12, ns)], [room('R3', 10, 12)]))).toEqual([]);
    expect(computeOverlaps(board([room('R3', 10, 12)], [seat('S1', 10, 12, ns)]))).toEqual([]);
    expect(computeOverlaps(board([room('R3', 10, 12, ns)], [seat('S1', 10, 12)]))).toEqual([]);
    expect(computeOverlaps(board([seat('S1', 10, 12)], [room('R3', 10, 12, ns)]))).toEqual([]);
    expect(computeOverlaps(board([room('R3', 10, 12, ns)], [room('R4', 10, 12)]))).toEqual([]);
    expect(computeOverlaps(board([room('R3', 10, 12)], [room('R4', 10, 12, ns)]))).toEqual([]);
  });

  it('no_show vs cancelled, or no_show vs no_show, never overlaps', () => {
    expect(computeOverlaps(board([seat('S1', 10, 12, { status: 'no_show' })], [seat('S2', 10, 12, { status: 'cancelled' })]))).toEqual([]);
    expect(computeOverlaps(board([seat('S1', 10, 12, { status: 'no_show' })], [seat('S2', 10, 12, { status: 'no_show' })]))).toEqual([]);
  });

  it('a no_show hour inside a longer booking does not extend the overlap', () => {
    const out = computeOverlaps(board([seat('S1', 10, 11), seat('S1', 11, 12, { status: 'no_show' })], [seat('S2', 11, 12)]));
    expect(out).toEqual([]);
  });

  it('partial_cancelled and checked_in bookings still overlap', () => {
    expect(computeOverlaps(board([seat('S1', 10, 12, { status: 'partial_cancelled' })], [seat('S2', 11, 12)]))).toHaveLength(1);
    expect(computeOverlaps(board([seat('S1', 10, 12, { status: 'checked_in' })], [seat('S2', 11, 12)]))).toHaveLength(1);
  });

  it('the same person never overlaps themself', () => {
    const out = computeOverlaps(board([seat('S1', 10, 12), room('R3', 10, 12), seat('S2', 11, 13)], []));
    expect(out).toEqual([]);
  });

  it('null / missing snapshots produce no overlaps', () => {
    expect(computeOverlaps(board(null, [seat('S2', 10, 12)]))).toEqual([]);
    expect(computeOverlaps(board(null, null))).toEqual([]);
    const missing = board([seat('S1', 10, 12)], null);
    delete missing.snapshots.b;
    expect(computeOverlaps(missing)).toEqual([]);
  });

  it('merges hourly rows first: one 11-15 seat block vs one partner block gives one overlap', () => {
    const rows = [11, 12, 13, 14].map((hr) => seat('S1', hr, hr + 1, { ref: `S1-${hr}` }));
    const out = computeOverlaps(board(rows, [seat('S2', 12, 14)]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: h(12), end: h(14) });
  });

  it('compares instants, not strings (UTC-expressed times)', () => {
    const utc = booking({ ref: 'u', unit: 'S2', start: '2026-10-08T03:00:00Z', end: '2026-10-08T05:00:00Z' }); // 11-13 SGT
    const out = computeOverlaps(board([seat('S1', 12, 14)], [utc]));
    expect(out).toHaveLength(1);
    expect(Date.parse(out[0]!.start)).toBe(Date.parse(h(12)));
    expect(Date.parse(out[0]!.end)).toBe(Date.parse(h(13)));
  });

  it('ignores snapshots of people not on the board', () => {
    const b = board([seat('S1', 10, 12)], null);
    b.snapshots.c = snap('c', [seat('S3', 10, 12)]);
    expect(computeOverlaps(b)).toEqual([]);
  });

  it('results are ordered by start then end', () => {
    const out = computeOverlaps(board([seat('S1', 14, 16), seat('S5', 9, 11)], [seat('S2', 15, 16), seat('S6', 10, 11)]));
    expect(out.map((o) => o.start)).toEqual([h(10), h(15)]);
  });
});
