import { describe, expect, it } from 'vitest';
import { centreNow } from './scroll';

function scroller(o: { scrollWidth: number; clientWidth: number; scrollLeft?: number; now?: number | null }) {
  const s = {
    scrollWidth: o.scrollWidth,
    clientWidth: o.clientWidth,
    scrollLeft: o.scrollLeft ?? 0,
    selectors: [] as string[],
    querySelector(sel: string) {
      s.selectors.push(sel);
      return o.now === undefined || o.now === null ? null : { offsetLeft: o.now };
    },
  };
  return s;
}

describe('centreNow', () => {
  it('scrolls so the now-line is in the middle of the visible area', () => {
    const s = scroller({ scrollWidth: 1200, clientWidth: 400, now: 700 });
    expect(centreNow(s)).toBe(true);
    expect(s.scrollLeft).toBe(500);
    expect(s.selectors).toEqual(['.now']);
  });

  it('never scrolls to a negative position (now-line near the left edge)', () => {
    const s = scroller({ scrollWidth: 1200, clientWidth: 400, now: 100, scrollLeft: 0 });
    expect(centreNow(s)).toBe(true);
    expect(s.scrollLeft).toBe(0);
  });

  it('does nothing when the timeline is not horizontally scrollable', () => {
    for (const [sw, cw] of [[400, 400], [300, 400]] as const) {
      const s = scroller({ scrollWidth: sw, clientWidth: cw, now: 200, scrollLeft: 7 });
      expect(centreNow(s)).toBe(false);
      expect(s.scrollLeft).toBe(7);
    }
  });

  it('does nothing without a now-line (outside 08:00-22:00 or on another day)', () => {
    const s = scroller({ scrollWidth: 1200, clientWidth: 400, now: null, scrollLeft: 9 });
    expect(centreNow(s)).toBe(false);
    expect(s.scrollLeft).toBe(9);
  });

  it('does nothing without a scroller', () => {
    expect(centreNow(null)).toBe(false);
  });
});
