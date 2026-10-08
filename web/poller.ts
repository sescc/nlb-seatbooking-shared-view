// Visibility-aware polling, with every environment dependency injected so it is unit-testable with fakes.
//   - polls every `intervalMs` (5 s) only while the document is visible;
//   - fetches immediately when the document becomes visible;
//   - never runs two requests at once (a setTimeout chain scheduled after each settle, not setInterval).

export interface PollerDoc {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface PollerDeps<B> {
  fetchBoard: () => Promise<B>;
  doc: PollerDoc;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  onBoard: (board: B) => void;
  onError: (err: unknown) => void;
  intervalMs?: number;
}

export interface Poller {
  start(): void;
  stop(): void;
  /** Fetch now if visible and no request is running (otherwise one is queued for when it settles). */
  refresh(): void;
}

export const POLL_INTERVAL_MS = 5000;

export function createPoller<B>(deps: PollerDeps<B>): Poller {
  const interval = deps.intervalMs ?? POLL_INTERVAL_MS;
  let started = false;
  let inFlight = false;
  let queued = false; // a refresh was requested while a request was running
  let timer: unknown = null;

  const visible = () => deps.doc.visibilityState === 'visible';
  const clearTimer = () => {
    if (timer !== null) deps.clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    clearTimer();
    if (started && visible()) {
      timer = deps.setTimeout(() => {
        timer = null;
        void tick();
      }, interval);
    }
  };

  async function tick(): Promise<void> {
    if (!started || !visible()) return;
    if (inFlight) {
      queued = true;
      return;
    }
    clearTimer();
    inFlight = true;
    try {
      const board = await deps.fetchBoard();
      if (started) deps.onBoard(board);
    } catch (err) {
      if (started) deps.onError(err);
    } finally {
      inFlight = false;
    }
    if (!started) return;
    if (queued) {
      queued = false;
      if (visible()) {
        void tick();
        return;
      }
    }
    schedule();
  }

  const onVisibility = () => {
    if (!started) return;
    if (visible()) void tick();
    else {
      clearTimer();
      queued = false;
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      deps.doc.addEventListener('visibilitychange', onVisibility);
      if (visible()) void tick();
    },
    stop() {
      started = false;
      queued = false;
      clearTimer();
      deps.doc.removeEventListener('visibilitychange', onVisibility);
    },
    refresh() {
      void tick();
    },
  };
}
