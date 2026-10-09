import { describe, expect, it } from 'vitest';
import { mergeBlocks } from './blocks';
import { booking, hourlyRows } from './fixtures';
import { extract } from './booking';

const h = (hour: number) => `2026-10-08T${String(hour).padStart(2, '0')}:00:00+08:00`;
const row = (hour: number, over = {}) =>
  booking({ ref: `r${hour}${JSON.stringify(over).length}`, unit: 'S201', start: h(hour), end: h(hour + 1), ...over });

describe('mergeBlocks', () => {
  it('merges 4 hourly rows into one block with all refs', () => {
    const rows = extract(hourlyRows(4, 11));
    const blocks = mergeBlocks('a', rows);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      personId: 'a',
      unit: 'S201',
      kind: 'seat',
      start: h(11),
      end: h(15),
      status: 'booked',
    });
    expect(blocks[0]?.refs).toEqual(rows.map((r) => r.ref));
  });

  it('merges regardless of input order (sorts by start)', () => {
    const blocks = mergeBlocks('a', [row(13), row(11), row(12)]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ start: h(11), end: h(14) });
  });

  it('a gap breaks the block', () => {
    const blocks = mergeBlocks('a', [row(11), row(12), row(14)]);
    expect(blocks.map((b) => [b.start, b.end])).toEqual([
      [h(11), h(13)],
      [h(14), h(15)],
    ]);
  });

  it('a no_show hour adjacent to a booked hour on the same unit does not merge', () => {
    for (const rows of [[row(11, { status: 'no_show' }), row(12)], [row(11), row(12, { status: 'no_show' })]]) {
      const blocks = mergeBlocks('a', rows);
      expect(blocks.map((b) => [b.status, b.start, b.end])).toHaveLength(2);
    }
  });

  it('adjacent no_show hours on the same unit still merge into one no_show block', () => {
    const blocks = mergeBlocks('a', [row(11, { status: 'no_show' }), row(12, { status: 'no_show' })]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ status: 'no_show', start: h(11), end: h(13) });
  });

  it('a status change breaks the block', () => {
    const blocks = mergeBlocks('a', [row(11), row(12, { status: 'checked_in' }), row(13, { status: 'checked_in' })]);
    expect(blocks.map((b) => [b.start, b.end, b.status])).toEqual([
      [h(11), h(12), 'booked'],
      [h(12), h(14), 'checked_in'],
    ]);
  });

  it('a different unit breaks the block', () => {
    const blocks = mergeBlocks('a', [row(11), row(12, { unit: 'S202' })]);
    expect(blocks.map((b) => b.unit)).toEqual(['S201', 'S202']);
  });

  it('a different area, library or kind breaks the block', () => {
    expect(mergeBlocks('a', [row(11), row(12, { area: 'Other' })])).toHaveLength(2);
    expect(mergeBlocks('a', [row(11), row(12, { library: 'Other' })])).toHaveLength(2);
    expect(mergeBlocks('a', [row(11), row(12, { kind: 'room' })])).toHaveLength(2);
  });

  it('pax is the max across merged rows; absent when no row has pax', () => {
    const rooms = mergeBlocks('a', [
      row(11, { kind: 'room', unit: 'R3', pax: 2 }),
      row(12, { kind: 'room', unit: 'R3', pax: 4 }),
      row(13, { kind: 'room', unit: 'R3' }),
    ]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.pax).toBe(4);
    const seat = mergeBlocks('a', [row(11), row(12)]);
    expect(seat[0]).not.toHaveProperty('pax');
  });

  it('a seat and a room held in the same hours form two blocks, not interleaved fragments', () => {
    const blocks = mergeBlocks('a', [
      row(11),
      row(11, { kind: 'room', unit: 'R3', area: 'Discussion Room', pax: 2 }),
      row(12),
      row(12, { kind: 'room', unit: 'R3', area: 'Discussion Room', pax: 2 }),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => [b.unit, b.start, b.end]).sort()).toEqual([
      ['R3', h(11), h(13)],
      ['S201', h(11), h(13)],
    ]);
  });

  it('compares touching times as instants, not strings', () => {
    const blocks = mergeBlocks('a', [
      row(11),
      booking({ unit: 'S201', ref: 'z', start: '2026-10-08T04:00:00Z' as string, end: h(13) }),
    ]);
    expect(blocks).toHaveLength(1);
  });

  it('carries library/area/floor from the first row and does not mutate input', () => {
    const input = [row(12), row(11)];
    const snapshot = JSON.parse(JSON.stringify(input));
    const blocks = mergeBlocks('a', input);
    expect(blocks[0]).toMatchObject({ library: 'Test Library', area: 'Long Study Space', floor: '4' });
    expect(input).toEqual(snapshot);
  });

  it('empty input -> no blocks', () => {
    expect(mergeBlocks('a', [])).toEqual([]);
  });
});
