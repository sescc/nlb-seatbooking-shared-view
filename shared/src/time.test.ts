import { describe, expect, it } from 'vitest';
import { addMinutes, msToSgtIso, sgtDate, sgtHHMM } from './time';

describe('sgtDate', () => {
  it('returns the SGT calendar date of an SGT instant', () => {
    expect(sgtDate('2026-10-08T23:30:00+08:00')).toBe('2026-10-08');
  });
  it('rolls a UTC late-evening instant over to the next SGT day', () => {
    expect(sgtDate('2026-10-08T16:30:00Z')).toBe('2026-10-09');
  });
  it('does not depend on the device time zone (UTC midnight is 08:00 SGT)', () => {
    expect(sgtDate('2026-10-08T00:00:00Z')).toBe('2026-10-08');
  });
});

describe('sgtHHMM', () => {
  it('formats the SGT wall-clock time', () => {
    expect(sgtHHMM('2026-10-08T14:05:00+08:00')).toBe('14:05');
  });
  it('converts from UTC', () => {
    expect(sgtHHMM('2026-10-08T06:00:00Z')).toBe('14:00');
  });
});

describe('addMinutes', () => {
  it('adds minutes and keeps the +08:00 representation', () => {
    expect(addMinutes('2026-10-08T14:00:00+08:00', 15)).toBe('2026-10-08T14:15:00+08:00');
  });
  it('crosses midnight', () => {
    expect(addMinutes('2026-10-08T23:50:00+08:00', 20)).toBe('2026-10-09T00:10:00+08:00');
  });
  it('subtracts with a negative amount', () => {
    expect(addMinutes('2026-10-08T00:05:00+08:00', -10)).toBe('2026-10-07T23:55:00+08:00');
  });
});

describe('msToSgtIso', () => {
  it('formats epoch milliseconds as SGT', () => {
    expect(msToSgtIso(Date.parse('2026-10-08T03:00:00Z'))).toBe('2026-10-08T11:00:00+08:00');
  });
});
