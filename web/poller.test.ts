import { describe, expect, it } from 'vitest';
import { createPoller } from './poller';

// Fakes: a document with controllable visibility, a manual timer queue, and fetches we resolve by hand.
function makeEnv() {
  const doc = {
    visibilityState: 'visible' as 'visible' | 'hidden',
    listeners: [] as Array<() => void>,
    addEventListener(type: string, fn: () => void) {
      if (type === 'visibilitychange') this.listeners.push(fn);
    },
    removeEventListener(type: string, fn: () => void) {
      if (type === 'visibilitychange') this.listeners = this.listeners.filter((l) => l !== fn);
    },
    setVisibility(v: 'visible' | 'hidden') {
      this.visibilityState = v;
      for (const l of [...this.listeners]) l();
    },
  };

  let nextId = 1;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  const setTimeoutFake = (fn: () => void, ms: number) => {
    const id = nextId++;
    timers.set(id, { fn, ms });
    return id;
  };
  const clearTimeoutFake = (id: unknown) => {
    timers.delete(id as number);
  };

  const pending: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  const fetchBoard = () => {
    calls++;
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise<string>((resolve, reject) => {
      pending.push({
        resolve: (v) => {
          inFlight--;
          resolve(v);
        },
        reject: (e) => {
          inFlight--;
          reject(e);
        },
      });
    });
  };

  const boards: string[] = [];
  const errors: unknown[] = [];

  const poller = createPoller<string>({
    fetchBoard,
    doc,
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    onBoard: (b) => boards.push(b),
    onError: (e) => errors.push(e),
  });

  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const settle = async (v = 'board') => {
    pending.shift()!.resolve(v);
    await flush();
  };
  const fail = async () => {
    pending.shift()!.reject(new Error('down'));
    await flush();
  };
  const fireTimer = async () => {
    const [id, t] = [...timers.entries()][0]!;
    timers.delete(id);
    t.fn();
    await flush();
  };
  return {
    doc, timers, pending, boards, errors, poller, settle, fail, fireTimer, flush,
    stats: () => ({ calls, maxInFlight }),
  };
}

describe('createPoller', () => {
  it('polls while visible: fetches immediately, then every 5 s after each response', async () => {
    const e = makeEnv();
    e.poller.start();
    expect(e.stats().calls).toBe(1);
    await e.settle('b1');
    expect(e.boards).toEqual(['b1']);
    expect([...e.timers.values()].map((t) => t.ms)).toEqual([5000]);

    await e.fireTimer();
    expect(e.stats().calls).toBe(2);
    await e.settle('b2');
    expect(e.boards).toEqual(['b1', 'b2']);
    expect([...e.timers.values()].map((t) => t.ms)).toEqual([5000]);
  });

  it('does not fetch at start when hidden, and nothing is scheduled', async () => {
    const e = makeEnv();
    e.doc.visibilityState = 'hidden';
    e.poller.start();
    expect(e.stats().calls).toBe(0);
    expect(e.timers.size).toBe(0);
  });

  it('Hidden tab: stops polling when hidden (pending timer cleared, no requests)', async () => {
    const e = makeEnv();
    e.poller.start();
    await e.settle();
    expect(e.timers.size).toBe(1);

    e.doc.setVisibility('hidden');
    expect(e.timers.size).toBe(0);
    expect(e.stats().calls).toBe(1);
  });

  it('a timer that fires after the tab became hidden makes no request', async () => {
    const e = makeEnv();
    e.poller.start();
    await e.settle();
    const t = [...e.timers.values()][0]!;
    e.doc.visibilityState = 'hidden'; // no event delivered
    t.fn();
    await e.flush();
    expect(e.stats().calls).toBe(1);
  });

  it('a response arriving while hidden is delivered but does not reschedule', async () => {
    const e = makeEnv();
    e.poller.start();
    e.doc.setVisibility('hidden');
    await e.settle('late');
    expect(e.boards).toEqual(['late']);
    expect(e.timers.size).toBe(0);
    expect(e.stats().calls).toBe(1);
  });

  it('refetches immediately when the page becomes visible again', async () => {
    const e = makeEnv();
    e.poller.start();
    await e.settle();
    e.doc.setVisibility('hidden');
    expect(e.stats().calls).toBe(1);

    e.doc.setVisibility('visible');
    expect(e.stats().calls).toBe(2);
    await e.settle('fresh');
    expect(e.boards).toEqual(['board', 'fresh']);
    expect(e.timers.size).toBe(1); // polling resumed
  });

  it('visible after a long hidden period does not leave a stale timer behind', async () => {
    const e = makeEnv();
    e.poller.start();
    await e.settle();
    e.doc.setVisibility('hidden');
    e.doc.setVisibility('visible');
    await e.settle();
    expect(e.timers.size).toBe(1);
  });

  it('never runs overlapping requests', async () => {
    const e = makeEnv();
    e.poller.start();
    // hide and show while the first request is still in flight
    e.doc.setVisibility('hidden');
    e.doc.setVisibility('visible');
    e.doc.setVisibility('visible');
    expect(e.stats().calls).toBe(1);
    expect(e.stats().maxInFlight).toBe(1);

    await e.settle('one');
    // the "became visible" request is honoured right after the in-flight one completes
    expect(e.stats().calls).toBe(2);
    await e.settle('two');
    expect(e.stats().maxInFlight).toBe(1);
    expect(e.boards).toEqual(['one', 'two']);
  });

  it('a timer firing during an in-flight request does not start a second one', async () => {
    const e = makeEnv();
    e.poller.start();
    await e.settle();
    await e.fireTimer(); // request 2 in flight
    e.poller.refresh();
    expect(e.stats().calls).toBe(2);
    expect(e.stats().maxInFlight).toBe(1);
  });

  it('on failure: reports the error, keeps polling', async () => {
    const e = makeEnv();
    e.poller.start();
    await e.fail();
    expect(e.errors).toHaveLength(1);
    expect(e.boards).toEqual([]);
    expect([...e.timers.values()].map((t) => t.ms)).toEqual([5000]);

    await e.fireTimer();
    await e.settle('recovered');
    expect(e.boards).toEqual(['recovered']);
  });

  it('on failure while hidden: reports the error and does not reschedule', async () => {
    const e = makeEnv();
    e.poller.start();
    e.doc.setVisibility('hidden');
    await e.fail();
    expect(e.errors).toHaveLength(1);
    expect(e.timers.size).toBe(0);
  });

  it('stop() clears the timer, removes the listener, and ignores in-flight results', async () => {
    const e = makeEnv();
    e.poller.start();
    await e.settle();
    e.poller.stop();
    expect(e.timers.size).toBe(0);
    expect(e.doc.listeners).toHaveLength(0);

    const e2 = makeEnv();
    e2.poller.start();
    e2.poller.stop();
    await e2.settle('ignored');
    expect(e2.boards).toEqual([]);
    expect(e2.timers.size).toBe(0);
  });

  it('start() twice does not double the polling', async () => {
    const e = makeEnv();
    e.poller.start();
    e.poller.start();
    expect(e.stats().calls).toBe(1);
    expect(e.doc.listeners).toHaveLength(1);
  });

  it('a fetchBoard that throws synchronously is treated as a failure', async () => {
    const e = makeEnv();
    const errors: unknown[] = [];
    const p = createPoller<string>({
      fetchBoard: () => {
        throw new Error('sync');
      },
      doc: e.doc,
      setTimeout: () => 0,
      clearTimeout: () => {},
      onBoard: () => {},
      onError: (x) => errors.push(x),
    });
    p.start();
    await e.flush();
    expect(errors).toHaveLength(1);
  });
});
