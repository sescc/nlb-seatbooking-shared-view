// Deduced: how old each person's snapshot is, and which `booked` rows can no longer be trusted.
// NLB auto-cancels an un-checked-in booking at start + 15 min, so a snapshot received before
// that deadline cannot say whether the booking survived.
import type { Board, Staleness } from './types';

const CHECK_IN_GRACE_MS = 15 * 60_000;

export function computeStaleness(board: Board, nowIso: string): Staleness[] {
  const now = Date.parse(nowIso);
  return board.people.map((p): Staleness => {
    const snap = board.snapshots[p.id];
    if (!snap) return { personId: p.id, receivedAt: null, ageMin: null, unverifiedRefs: [] };

    const received = Date.parse(snap.receivedAt);
    const unverifiedRefs = snap.bookings
      .filter((b) => {
        if (b.status !== 'booked') return false;
        const deadline = Date.parse(b.start) + CHECK_IN_GRACE_MS;
        return now >= deadline && received < deadline;
      })
      .map((b) => b.ref);
    return {
      personId: p.id,
      receivedAt: snap.receivedAt,
      ageMin: Math.max(0, Math.floor((now - received) / 60_000)),
      unverifiedRefs,
    };
  });
}
