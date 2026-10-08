import { describe, expect, it } from 'vitest';
import { booking } from './fixtures';
import { computeStaleness } from './staleness';
import type { Board, Booking, Snapshot } from './types';

const t = (hhmm: string, ss = '00') => `2026-10-08T${hhmm}:${ss}+08:00`;

function boardOf(personBookings: Booking[], receivedAt: string | null, serverNow = t('14:15')): Board {
  const snapshot: Snapshot | null =
    receivedAt === null ? null : { personId: 'a', receivedAt, bookings: personBookings };
  return { serverNow, people: [{ id: 'a', name: 'Alice' }], snapshots: { a: snapshot } };
}

const b14 = (over: Partial<Booking> = {}) =>
  booking({ ref: 'X', start: t('14:00'), end: t('15:00'), status: 'booked', ...over });

describe('computeStaleness', () => {
  it('never pushed -> nulls and no unverified refs', () => {
    const [s] = computeStaleness(boardOf([], null), t('14:15'));
    expect(s).toEqual({ personId: 'a', receivedAt: null, ageMin: null, unverifiedRefs: [] });
  });

  it('missing snapshot key behaves like never pushed', () => {
    const board = boardOf([], null);
    delete board.snapshots.a;
    expect(computeStaleness(board, t('14:15'))[0]).toMatchObject({ receivedAt: null, ageMin: null });
  });

  it('ageMin is the floor of whole minutes since receivedAt', () => {
    const [s] = computeStaleness(boardOf([], t('13:50')), t('14:00', '59'));
    expect(s).toMatchObject({ receivedAt: t('13:50'), ageMin: 10 });
    expect(computeStaleness(boardOf([], t('13:50')), t('14:00'))[0]?.ageMin).toBe(10);
    expect(computeStaleness(boardOf([], t('13:50')), t('13:50', '30'))[0]?.ageMin).toBe(0);
  });

  it('ageMin never goes negative when receivedAt is marginally ahead of now', () => {
    expect(computeStaleness(boardOf([], t('14:00', '10')), t('14:00'))[0]?.ageMin).toBe(0);
  });

  it('one entry per person, in board.people order', () => {
    const board: Board = {
      serverNow: t('14:15'),
      people: [
        { id: 'b', name: 'Bob' },
        { id: 'a', name: 'Alice' },
      ],
      snapshots: { a: null, b: null },
    };
    expect(computeStaleness(board, t('14:15')).map((s) => s.personId)).toEqual(['b', 'a']);
  });

  describe('unverified (check-in deadline = start + 15 min)', () => {
    it('before the deadline -> not unverified', () => {
      const [s] = computeStaleness(boardOf([b14()], t('13:50')), t('14:14', '59'));
      expect(s?.unverifiedRefs).toEqual([]);
    });

    it('exactly start+15 with no newer push -> unverified', () => {
      const [s] = computeStaleness(boardOf([b14()], t('13:50')), t('14:15'));
      expect(s?.unverifiedRefs).toEqual(['X']);
    });

    it('after the deadline with a stale push -> unverified', () => {
      const [s] = computeStaleness(boardOf([b14()], t('13:50')), t('14:30'));
      expect(s?.unverifiedRefs).toEqual(['X']);
    });

    it('push received after the deadline -> verified', () => {
      const [s] = computeStaleness(boardOf([b14()], t('14:20')), t('14:30'));
      expect(s?.unverifiedRefs).toEqual([]);
    });

    it('push received exactly at the deadline counts as after it -> verified', () => {
      const [s] = computeStaleness(boardOf([b14()], t('14:15')), t('14:30'));
      expect(s?.unverifiedRefs).toEqual([]);
    });

    it('push received one second before the deadline -> unverified', () => {
      const [s] = computeStaleness(boardOf([b14()], t('14:14', '59')), t('14:15'));
      expect(s?.unverifiedRefs).toEqual(['X']);
    });

    it.each(['checked_in', 'cancelled', 'partial_cancelled'] as const)('%s is never unverified', (status) => {
      const [s] = computeStaleness(boardOf([b14({ status })], t('13:50')), t('14:30'));
      expect(s?.unverifiedRefs).toEqual([]);
    });

    it('only the booked rows that qualify are listed', () => {
      const rows = [
        b14({ ref: 'late-start', start: t('16:00'), end: t('17:00') }),
        b14({ ref: 'stale' }),
        b14({ ref: 'checked', status: 'checked_in' }),
      ];
      const [s] = computeStaleness(boardOf(rows, t('13:50')), t('14:30'));
      expect(s?.unverifiedRefs).toEqual(['stale']);
    });

    it('compares instants across offsets', () => {
      const utcStart = b14({ start: '2026-10-08T06:00:00Z', end: '2026-10-08T07:00:00Z' }); // 14:00 SGT
      const [s] = computeStaleness(boardOf([utcStart], t('13:50')), '2026-10-08T06:15:00Z');
      expect(s?.unverifiedRefs).toEqual(['X']);
    });
  });
});
