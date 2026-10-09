import { describe, expect, it } from 'vitest';
import { extract, trimRow } from './booking';
import { FAKE_PROFILE, VISIT_BOOKING, accountInfoResponse, booking, hourlyRows, nlbRoomRow, nlbSeatRow } from './fixtures';
import { ingestRows, validatePayload } from './payload';

function reasonOf(r: ReturnType<typeof validatePayload>): string {
  if (r.ok) throw new Error('expected rejection');
  return r.reason;
}

describe('validatePayload (extracted Booking[])', () => {
  it('accepts a valid list, returning it as { bookings }', () => {
    expect(validatePayload([booking()])).toEqual({ ok: true, payload: { bookings: [booking()] } });
  });
  it('accepts an empty list (an empty push clears the lane)', () => {
    expect(validatePayload([])).toEqual({ ok: true, payload: { bookings: [] } });
  });
  it.each(['booked', 'checked_in', 'cancelled', 'partial_cancelled', 'no_show'] as const)('accepts status %s', (status) => {
    expect(validatePayload([booking({ status })]).ok).toBe(true);
  });
  it('rejects an unknown status such as no-show (hyphen) or NO_SHOW', () => {
    for (const status of ['no-show', 'NO_SHOW', 'noshow']) {
      expect(reasonOf(validatePayload([{ ...booking(), status }]))).toContain('bookings[0].status');
    }
  });
  it('accepts a room with pax', () => {
    expect(validatePayload([booking({ kind: 'room', unit: 'R3', pax: 2 })]).ok).toBe(true);
  });
  it('accepts exactly 200 bookings and rejects 201', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => booking({ ref: `R${i}` }));
    expect(validatePayload(many(200)).ok).toBe(true);
    expect(reasonOf(validatePayload(many(201)))).toMatch(/200/);
  });

  it.each([null, undefined, 'str', 42, {}, { bookings: [] }])('rejects a non-array: %j', (v) => {
    expect(reasonOf(validatePayload(v))).toMatch(/array/);
  });
  it('rejects an element that is not an object', () => {
    expect(reasonOf(validatePayload([null]))).toMatch(/bookings\[0\]/);
    expect(reasonOf(validatePayload(['x']))).toMatch(/bookings\[0\]/);
  });

  it.each([
    ['ref', 5],
    ['ref', ''],
    ['kind', 'desk'],
    ['kind', 1],
    ['library', 1],
    ['area', null],
    ['floor', 4],
    ['unit', undefined],
    ['status', 'done'],
    ['status', undefined],
    ['actions', 'Book'],
    ['actions', [1]],
    ['actions', undefined],
    ['pax', '2'],
    ['pax', -1],
    ['pax', 1.5],
    ['pax', Number.NaN],
  ])('rejects bad booking field %s = %j', (field, value) => {
    expect(reasonOf(validatePayload([{ ...booking(), [field]: value }]))).toContain(`bookings[0].${field}`);
  });

  it('rejects start >= end', () => {
    const equal = booking({ start: '2026-10-08T11:00:00+08:00', end: '2026-10-08T11:00:00+08:00' });
    const backwards = booking({ start: '2026-10-08T12:00:00+08:00', end: '2026-10-08T11:00:00+08:00' });
    expect(reasonOf(validatePayload([equal]))).toMatch(/start/);
    expect(reasonOf(validatePayload([backwards]))).toMatch(/start/);
  });

  it('rejects start/end without the +08:00 offset (offset-less, Z, other offset, fractional, garbage)', () => {
    for (const bad of [
      '2026-10-08T11:00:00',
      '2026-10-08T03:00:00Z',
      '2026-10-08T11:00:00+09:00',
      '2026-10-08T11:00:00+0800',
      '2026-10-08 11:00:00+08:00',
      '2026-10-08T11:00:00.000+08:00',
      'nonsense',
    ]) {
      expect(reasonOf(validatePayload([booking({ start: bad })]))).toContain('bookings[0].start');
      expect(reasonOf(validatePayload([booking({ end: bad })]))).toContain('bookings[0].end');
    }
  });
  it('rejects impossible calendar dates', () => {
    expect(reasonOf(validatePayload([booking({ start: '2026-02-30T11:00:00+08:00' })]))).toContain('start');
  });

  it('strips unknown keys and does not mutate its input', () => {
    const dirty = [{ ...booking(), accountId: 'TESTACCT-0001', infoJson: '{"Purpose":"x"}', email: FAKE_PROFILE.email }];
    const copy = JSON.parse(JSON.stringify(dirty));
    const r = validatePayload(dirty);
    expect(r.ok && r.payload).toEqual({ bookings: [booking()] });
    expect(dirty).toEqual(copy);
  });
});

describe('ingestRows (raw trimmed NLB rows -> validated payload)', () => {
  const rows = () => [nlbSeatRow(), nlbRoomRow()].map(trimRow);

  it('extracts rows into bookings (same result as extract)', () => {
    const r = ingestRows(rows());
    expect(r.ok && r.payload.bookings).toEqual(extract([nlbSeatRow(), nlbRoomRow()]));
    expect(r.ok && r.payload.bookings.map((b) => b.kind)).toEqual(['seat', 'room']);
  });

  it('an empty array is a valid push that clears the lane', () => {
    expect(ingestRows([])).toEqual({ ok: true, payload: { bookings: [] } });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'rows'],
    ['an object', { bookings: [] }],
    ['the old { v, pushedAt, bookings } shape', { v: 1, pushedAt: '2026-10-08T10:00:00+08:00', bookings: [] }],
  ])('rejects a body that is not an array: %s', (_label, v) => {
    const r = ingestRows(v);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/array/);
  });

  it('accepts exactly 200 rows and rejects 201', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => trimRow(nlbSeatRow({ bookingRefId: `NLB${i}`, seat: `S${i}` })));
    expect(ingestRows(many(200)).ok).toBe(true);
    const r = ingestRows(many(201));
    expect(!r.ok && r.reason).toMatch(/200/);
  });

  it('ignores rows extract drops (missing fields, bad times, non-objects) without failing the push', () => {
    const r = ingestRows([
      null,
      'x',
      7,
      { seat: 'S1' },
      trimRow(nlbSeatRow({ bookingRefId: 'BAD', startTime: 'garbage' })),
      trimRow(nlbSeatRow({ bookingRefId: 'KEEP' })),
    ]);
    expect(r.ok && r.payload.bookings.map((b) => b.ref)).toEqual(['KEEP']);
  });

  it('ignores non-whitelisted keys on a row (defence in depth: profile, urls, flags)', () => {
    const dirty = { ...nlbRoomRow(), ...FAKE_PROFILE, areaImageUrls: ['https://x.invalid/a.png'], canCancelStatus: 'Yes' };
    const r = ingestRows([dirty]);
    expect(r.ok).toBe(true);
    const json = JSON.stringify(r);
    for (const v of Object.values(FAKE_PROFILE)) expect(json).not.toContain(v);
    expect(json).not.toContain('x.invalid');
    expect(json).not.toContain('canCancelStatus');
  });

  it('a whole GetAccountInfo response or accountInfo object smuggled in as a row yields nothing', () => {
    const r = ingestRows([accountInfoResponse([nlbSeatRow()], [VISIT_BOOKING])]);
    expect(r).toEqual({ ok: true, payload: { bookings: [] } });
  });

  it('Purpose inside infoJson is accepted on the wire but never stored', () => {
    const r = ingestRows([trimRow(nlbRoomRow())]);
    expect(r.ok).toBe(true);
    const json = JSON.stringify(r);
    expect(json).not.toContain('Study group');
    expect(json).not.toContain('Purpose');
    expect(json).not.toContain('infoJson');
    expect(r.ok && r.payload.bookings[0]).toMatchObject({ kind: 'room', pax: 2 });
  });

  it('hourly rows stay one booking per row', () => {
    const r = ingestRows(hourlyRows(4, 11).map(trimRow));
    expect(r.ok && r.payload.bookings).toHaveLength(4);
  });

  it('does not mutate its input', () => {
    const input = rows();
    const copy = JSON.parse(JSON.stringify(input));
    ingestRows(input);
    expect(input).toEqual(copy);
  });
});
