import { describe, expect, it } from 'vitest';
import { NLB_ROW_KEYS, detectKind, extract, holdsSeat, mapStatus, toSgtIso, trimRow } from './booking';
import {
  FAKE_PROFILE,
  VISIT_BOOKING,
  accountInfoOnly,
  accountInfoResponse,
  hourlyRows,
  nlbRoomRow,
  nlbSeatRow,
} from './fixtures';

describe('NLB_ROW_KEYS / trimRow (the only keys that may leave the NLB page)', () => {
  it('is exactly the whitelist, defined once', () => {
    expect([...NLB_ROW_KEYS].sort()).toEqual(
      ['actions', 'area', 'bookingId', 'bookingRefId', 'branchName', 'endTime', 'floor', 'infoJson', 'seat', 'startTime'].sort(),
    );
  });

  it('keeps whitelisted keys and drops every other key (urls, flags, quotas, profile)', () => {
    const row = { ...nlbRoomRow(), ...FAKE_PROFILE, extra: 'x' };
    const out = trimRow(row);
    expect(Object.keys(out).sort()).toEqual([...NLB_ROW_KEYS].sort());
    for (const dropped of ['areaImageUrls', 'mapUrls', 'lastAction', 'canCancelStatus', 'facilityId', 'branchId', 'name', 'email', 'userId', 'accountId', 'extra']) {
      expect(out).not.toHaveProperty(dropped);
    }
    expect(JSON.stringify(out)).not.toContain(FAKE_PROFILE.email);
  });

  it('keeps only the keys that are present (no undefined placeholders)', () => {
    const out = trimRow({ seat: 'S1', startTime: 'a', endTime: 'b' });
    expect(out).toEqual({ seat: 'S1', startTime: 'a', endTime: 'b' });
  });

  it('returns {} for non-objects and does not mutate its input', () => {
    expect(trimRow(null)).toEqual({});
    expect(trimRow('x')).toEqual({});
    expect(trimRow(7)).toEqual({});
    const row = nlbSeatRow();
    const copy = JSON.parse(JSON.stringify(row));
    trimRow(row);
    expect(row).toEqual(copy);
  });

  it('a trimmed row extracts to the same Booking as the full row', () => {
    const rows = [nlbSeatRow(), nlbRoomRow(), ...hourlyRows(2, 9)];
    expect(extract(rows.map(trimRow))).toEqual(extract(rows));
  });

  it('Purpose inside infoJson survives trimming (it is on the wire) but never reaches a Booking', () => {
    const trimmed = trimRow(nlbRoomRow());
    expect(String(trimmed.infoJson)).toContain('Purpose');
    expect(JSON.stringify(extract([trimmed]))).not.toContain('Study group');
    expect(JSON.stringify(extract([trimmed]))).not.toContain('Purpose');
  });
});

describe('toSgtIso', () => {
  it('appends +08:00 to an offset-less local SGT string', () => {
    expect(toSgtIso('2026-10-08T11:00:00')).toBe('2026-10-08T11:00:00+08:00');
  });
  it('fills missing seconds and drops fractional seconds of offset-less input', () => {
    expect(toSgtIso('2026-10-08T11:00')).toBe('2026-10-08T11:00:00+08:00');
    expect(toSgtIso('2026-10-08T11:00:00.000')).toBe('2026-10-08T11:00:00+08:00');
  });
  it('converts a Z instant to +08:00', () => {
    expect(toSgtIso('2026-10-08T03:00:00Z')).toBe('2026-10-08T11:00:00+08:00');
    expect(toSgtIso('2026-10-08T03:00:00.123Z')).toBe('2026-10-08T11:00:00+08:00');
  });
  it('converts a non-SGT offset to +08:00', () => {
    expect(toSgtIso('2026-10-08T05:00:00-05:00')).toBe('2026-10-08T18:00:00+08:00');
    expect(toSgtIso('2026-10-08T15:00:00-05:00')).toBe('2026-10-09T04:00:00+08:00');
    expect(toSgtIso('2026-10-08T11:00:00+00:00')).toBe('2026-10-08T19:00:00+08:00');
  });
  it('leaves an SGT instant unchanged', () => {
    expect(toSgtIso('2026-10-08T11:00:00+08:00')).toBe('2026-10-08T11:00:00+08:00');
  });
  it('crosses a day boundary when converting from UTC', () => {
    expect(toSgtIso('2026-10-08T20:00:00Z')).toBe('2026-10-09T04:00:00+08:00');
  });
  it('throws on garbage and impossible dates', () => {
    expect(() => toSgtIso('garbage')).toThrow();
    expect(() => toSgtIso('')).toThrow();
    expect(() => toSgtIso('2026-13-40T11:00:00')).toThrow();
    expect(() => toSgtIso('2026-02-30T11:00:00')).toThrow();
    expect(() => toSgtIso('2026-10-08')).toThrow();
  });
});

describe('detectKind', () => {
  it('room when infoJson string has NumberOfPeople, with pax parsed', () => {
    expect(detectKind({ infoJson: '{"NumberOfPeople":"2","Purpose":"x"}' })).toEqual({ kind: 'room', pax: 2 });
  });
  it('room when infoJson is already an object', () => {
    expect(detectKind({ infoJson: { NumberOfPeople: 4 } })).toEqual({ kind: 'room', pax: 4 });
  });
  it('seat when infoJson is unparseable, empty, null or missing', () => {
    expect(detectKind({ infoJson: 'not-json' })).toEqual({ kind: 'seat' });
    expect(detectKind({ infoJson: '' })).toEqual({ kind: 'seat' });
    expect(detectKind({ infoJson: null })).toEqual({ kind: 'seat' });
    expect(detectKind({})).toEqual({ kind: 'seat' });
  });
  it('seat when infoJson parses to a non-object or lacks NumberOfPeople', () => {
    expect(detectKind({ infoJson: '[1,2]' })).toEqual({ kind: 'seat' });
    expect(detectKind({ infoJson: '"text"' })).toEqual({ kind: 'seat' });
    expect(detectKind({ infoJson: '{"Purpose":"x"}' })).toEqual({ kind: 'seat' });
    expect(detectKind({ infoJson: '{"NumberOfPeople":null}' })).toEqual({ kind: 'seat' });
  });
  it('room without pax when NumberOfPeople is not a finite number', () => {
    expect(detectKind({ infoJson: '{"NumberOfPeople":""}' })).toEqual({ kind: 'room' });
    expect(detectKind({ infoJson: '{"NumberOfPeople":"many"}' })).toEqual({ kind: 'room' });
  });
});

describe('mapStatus', () => {
  it('booked for plain Book and for unknown codes', () => {
    expect(mapStatus(['Book'])).toBe('booked');
    expect(mapStatus(['Book', 'SomethingNew'])).toBe('booked');
    expect(mapStatus([])).toBe('booked');
  });
  it('cancelled when any FullCancel action is present, whatever else is there', () => {
    expect(mapStatus(['Book', 'ManualFullCancel'])).toBe('cancelled');
  });
  it('checked_in for check-in codes', () => {
    expect(mapStatus(['Book', 'AutoCheckIn'])).toBe('checked_in');
    expect(mapStatus(['BookAndCheckIn'])).toBe('checked_in');
    expect(mapStatus(['OverBookAndCheckIn'])).toBe('checked_in');
    expect(mapStatus(['Book', 'ManualCheckIn'])).toBe('checked_in');
  });
  it('partial_cancelled for a manual partial cancel', () => {
    expect(mapStatus(['Book', 'ManualPartialCancel'])).toBe('partial_cancelled');
  });
  it('no_show for the auto partial cancel (NLB: did not check in, 1 h deducted from quota)', () => {
    expect(mapStatus(['Book', 'AutoPartialCancel'])).toBe('no_show');
  });
  it('classifies unseen codes by suffix', () => {
    expect(mapStatus(['Book', 'AutoFullCancel'])).toBe('cancelled');
    expect(mapStatus(['Book', 'AutoFooPartialCancel'])).toBe('no_show');
    expect(mapStatus(['Book', 'FooPartialCancel'])).toBe('partial_cancelled');
    expect(mapStatus(['Book', 'ManualFooFullCancel'])).toBe('cancelled');
    expect(mapStatus(['Book', 'ManualFooCheckIn'])).toBe('checked_in');
  });
  it.each([
    [['ManualFullCancel'], 'cancelled'],
    [['ManualPartialCancel'], 'partial_cancelled'],
    [['AutoPartialCancel'], 'no_show'],
    [['BookAndCheckIn'], 'checked_in'],
    [['AutoCheckIn'], 'checked_in'],
    [['ManualCheckIn'], 'checked_in'],
    [['OverBookAndCheckIn'], 'checked_in'],
    [['Book'], 'booked'],
    [[], 'booked'],
  ] as const)('every NLB code alone: %j -> %s', (actions, status) => {
    expect(mapStatus([...actions])).toBe(status);
  });
  it('precedence: cancelled > partial_cancelled > no_show > checked_in > booked', () => {
    expect(mapStatus(['AutoCheckIn', 'ManualPartialCancel', 'ManualFullCancel'])).toBe('cancelled');
    expect(mapStatus(['AutoCheckIn', 'ManualPartialCancel'])).toBe('partial_cancelled');
    expect(mapStatus(['AutoCheckIn', 'Book'])).toBe('checked_in');
    expect(mapStatus(['ManualPartialCancel', 'AutoPartialCancel'])).toBe('partial_cancelled');
    expect(mapStatus(['AutoPartialCancel', 'ManualPartialCancel'])).toBe('partial_cancelled');
    expect(mapStatus(['ManualFullCancel', 'AutoPartialCancel'])).toBe('cancelled');
    expect(mapStatus(['AutoPartialCancel', 'AutoCheckIn'])).toBe('no_show');
    expect(mapStatus(['AutoCheckIn', 'AutoPartialCancel'])).toBe('no_show');
  });
});

describe('holdsSeat', () => {
  it.each([
    ['booked', true],
    ['checked_in', true],
    ['partial_cancelled', true],
    ['cancelled', false],
    ['no_show', false],
  ] as const)('%s -> %s', (status, holds) => {
    expect(holdsSeat(status)).toBe(holds);
  });
});

describe('extract', () => {
  it('maps an AutoPartialCancel row to no_show and keeps its actions', () => {
    const [b] = extract([nlbSeatRow({ actions: ['Book', 'AutoPartialCancel'] })]);
    expect(b?.status).toBe('no_show');
    expect(b?.actions).toEqual(['Book', 'AutoPartialCancel']);
  });

  it('normalises a seat row', () => {
    const out = extract([nlbSeatRow()]);
    expect(out).toEqual([
      {
        ref: 'NLB0001S00001',
        kind: 'seat',
        library: 'Test Library',
        area: 'Long Study Space',
        floor: '4',
        unit: 'S145',
        start: '2026-10-08T11:00:00+08:00',
        end: '2026-10-08T12:00:00+08:00',
        status: 'booked',
        actions: ['Book'],
      },
    ]);
    expect(out[0]).not.toHaveProperty('pax');
  });

  it('normalises a room row with pax', () => {
    const [room] = extract([nlbRoomRow()]);
    expect(room).toMatchObject({ kind: 'room', unit: 'R3', area: 'Discussion Room', pax: 2 });
  });

  it('accepts the full response, the accountInfo object, and a bare array identically', () => {
    const rows = [nlbSeatRow(), nlbRoomRow()];
    const a = extract(accountInfoResponse(rows));
    const b = extract(accountInfoOnly(rows));
    const c = extract(rows);
    expect(a).toHaveLength(2);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('returns [] for null, undefined, non-objects and missing bookings', () => {
    expect(extract(null)).toEqual([]);
    expect(extract(undefined)).toEqual([]);
    expect(extract('x')).toEqual([]);
    expect(extract({})).toEqual([]);
    expect(extract({ accountInfo: {} })).toEqual([]);
    expect(extract({ bookings: 'nope' })).toEqual([]);
  });

  it('marks cancelled and auto-check-in rows via actions', () => {
    const rows = [
      nlbSeatRow({ bookingRefId: 'C1', actions: ['Book', 'ManualFullCancel'] }),
      nlbSeatRow({ bookingRefId: 'C2', actions: ['Book', 'AutoCheckIn'], seat: 'S2' }),
    ];
    const out = extract(rows);
    expect(out.map((b) => b.status)).toEqual(['cancelled', 'checked_in']);
    expect(out[1]?.actions).toEqual(['Book', 'AutoCheckIn']);
  });

  it('keeps one Booking per hourly row', () => {
    const out = extract(hourlyRows(4, 11));
    expect(out).toHaveLength(4);
    expect(out.map((b) => b.start)).toEqual([
      '2026-10-08T11:00:00+08:00',
      '2026-10-08T12:00:00+08:00',
      '2026-10-08T13:00:00+08:00',
      '2026-10-08T14:00:00+08:00',
    ]);
    expect(new Set(out.map((b) => b.ref)).size).toBe(4);
  });

  it('treats offset-less startTime/endTime as SGT', () => {
    const [b] = extract([nlbSeatRow({ startTime: '2026-10-08T23:00:00', endTime: '2026-10-09T00:00:00' })]);
    expect(b?.start).toBe('2026-10-08T23:00:00+08:00');
    expect(b?.end).toBe('2026-10-09T00:00:00+08:00');
  });

  it('uses bookingId as the ref when bookingRefId is missing', () => {
    const [b] = extract([nlbSeatRow({ bookingRefId: undefined, bookingId: 424242 })]);
    expect(b?.ref).toBe('424242');
  });

  it('drops rows with an empty ref, and ignores a negative or non-numeric pax', () => {
    expect(extract([nlbSeatRow({ bookingRefId: '' })])).toEqual([]);
    const [neg] = extract([nlbRoomRow({ infoJson: '{"NumberOfPeople":"-3"}' })]);
    expect(neg?.kind).toBe('room');
    expect(neg).not.toHaveProperty('pax');
  });

  it('drops rows missing startTime, endTime, seat, or any ref', () => {
    const rows = [
      nlbSeatRow({ startTime: undefined }),
      nlbSeatRow({ endTime: undefined }),
      nlbSeatRow({ seat: undefined }),
      nlbSeatRow({ bookingRefId: undefined, bookingId: undefined }),
      nlbSeatRow({ bookingRefId: 'KEEP' }),
    ];
    expect(extract(rows).map((b) => b.ref)).toEqual(['KEEP']);
  });

  it('drops unparseable times and rows with start >= end', () => {
    const rows = [
      nlbSeatRow({ bookingRefId: 'BAD', startTime: 'garbage' }),
      nlbSeatRow({ bookingRefId: 'ZERO', startTime: '2026-10-08T11:00:00', endTime: '2026-10-08T11:00:00' }),
      nlbSeatRow({ bookingRefId: 'BACK', startTime: '2026-10-08T12:00:00', endTime: '2026-10-08T11:00:00' }),
      nlbSeatRow({ bookingRefId: 'KEEP' }),
    ];
    expect(extract(rows).map((b) => b.ref)).toEqual(['KEEP']);
  });

  it('skips non-object rows without throwing', () => {
    expect(extract([null, 1, 'x', nlbSeatRow()] as unknown[])).toHaveLength(1);
  });

  it('ignores visitBookings entirely', () => {
    const out = extract(accountInfoResponse([nlbSeatRow()], [VISIT_BOOKING]));
    expect(out).toHaveLength(1);
    expect(out.map((b) => b.ref)).not.toContain(VISIT_BOOKING.bookingRefId);
  });

  it('reads only bookings[]: never touches visitBookings or profile keys', () => {
    const touched: string[] = [];
    const guard = <T extends object>(target: T, allowed: string[]): T =>
      new Proxy(target, {
        get(t, prop, recv) {
          if (typeof prop === 'string') {
            touched.push(prop);
            if (!allowed.includes(prop)) throw new Error(`touched forbidden key ${prop}`);
          }
          return Reflect.get(t, prop, recv);
        },
      });
    const response = accountInfoResponse([nlbSeatRow()], [VISIT_BOOKING]);
    const guarded = guard(
      { ...response, accountInfo: guard(response.accountInfo as object, ['bookings']) },
      ['accountInfo'],
    );
    expect(() => extract(guarded)).not.toThrow();
    expect(touched).toContain('bookings');
  });

  it('never leaks profile values into the output', () => {
    const out = extract(accountInfoResponse([nlbSeatRow(), nlbRoomRow()], [VISIT_BOOKING]));
    const json = JSON.stringify(out);
    for (const value of Object.values(FAKE_PROFILE)) {
      expect(json).not.toContain(value);
    }
    expect(json).not.toContain('accountInfo');
    expect(json).not.toContain('email');
  });

  it('emits only Booking keys (no NLB raw fields)', () => {
    const [b] = extract([nlbRoomRow()]);
    expect(Object.keys(b ?? {}).sort()).toEqual(
      ['actions', 'area', 'end', 'floor', 'kind', 'library', 'pax', 'ref', 'start', 'status', 'unit'].sort(),
    );
  });
});
