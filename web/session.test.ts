import { describe, expect, it } from 'vitest';
import { boardUrl, createPushedToast, estimateNow, parsePushedParam, secretFromPath, urlWithoutPushed } from './session';
import type { Board } from '../shared/src/types';

describe('secretFromPath', () => {
  it('reads the view secret from /v/<secret>', () => {
    expect(secretFromPath('/v/abc123')).toBe('abc123');
    expect(secretFromPath('/v/abc123/')).toBe('abc123');
  });
  it('returns null for anything else', () => {
    expect(secretFromPath('/')).toBeNull();
    expect(secretFromPath('/v/')).toBeNull();
    expect(secretFromPath('/x/abc')).toBeNull();
  });
  it('builds the board URL from it', () => {
    expect(boardUrl('abc123')).toBe('/api/abc123/board');
  });
});

describe('estimateNow', () => {
  it('uses the server clock plus local elapsed time, ignoring device clock skew', () => {
    const serverNow = '2026-10-08T14:00:00+08:00';
    // the device clock is hours off, but only elapsed time since the fetch matters
    const fetchedAtLocal = 5_000_000_000;
    expect(estimateNow(serverNow, fetchedAtLocal, fetchedAtLocal + 90_000)).toBe('2026-10-08T14:01:30+08:00');
  });
  it('never goes backwards if the local clock does', () => {
    expect(estimateNow('2026-10-08T14:00:00+08:00', 1000, 500)).toBe('2026-10-08T14:00:00+08:00');
  });
});

describe('pushed query parameter', () => {
  it('parses ?pushed=<id>', () => {
    expect(parsePushedParam('?pushed=a')).toBe('a');
    expect(parsePushedParam('?x=1&pushed=bob')).toBe('bob');
    expect(parsePushedParam('')).toBeNull();
    expect(parsePushedParam('?other=1')).toBeNull();
    expect(parsePushedParam('?pushed=')).toBeNull();
  });
  it('removes only the pushed parameter from the URL', () => {
    expect(urlWithoutPushed('/v/s', '?pushed=a', '')).toBe('/v/s');
    expect(urlWithoutPushed('/v/s', '?x=1&pushed=a', '#top')).toBe('/v/s?x=1#top');
  });
});

describe('createPushedToast', () => {
  const board: Board = {
    serverNow: '2026-10-08T14:00:00+08:00',
    people: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }],
    snapshots: { a: null, b: null },
  };

  function env(search: string) {
    const shown: string[] = [];
    let hidden = 0;
    const replaced: string[] = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const toast = createPushedToast({
      search,
      pathname: '/v/s',
      hash: '',
      show: (t) => shown.push(t),
      hide: () => hidden++,
      replaceUrl: (u) => replaced.push(u),
      setTimeout: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length;
      },
    });
    return { toast, shown, replaced, timers, hiddenCount: () => hidden };
  }

  it('shows "Pushed ✓ <name>" for 4 s, then drops the query with replaceState', () => {
    const e = env('?pushed=b');
    e.toast.onBoard(board);
    expect(e.shown).toEqual(['Pushed ✓ Bob']);
    expect(e.timers).toHaveLength(1);
    expect(e.timers[0]!.ms).toBe(4000);
    expect(e.replaced).toEqual([]);
    e.timers[0]!.fn();
    expect(e.hiddenCount()).toBe(1);
    expect(e.replaced).toEqual(['/v/s']);
  });

  it('shows only once, however many boards arrive', () => {
    const e = env('?pushed=a');
    e.toast.onBoard(board);
    e.toast.onBoard(board);
    expect(e.shown).toHaveLength(1);
  });

  it('does nothing without a pushed param', () => {
    const e = env('');
    e.toast.onBoard(board);
    expect(e.shown).toEqual([]);
    expect(e.timers).toEqual([]);
  });

  it('an unknown person id shows a plain "Pushed ✓"', () => {
    const e = env('?pushed=zzz');
    e.toast.onBoard(board);
    expect(e.shown).toEqual(['Pushed ✓']);
  });
});
