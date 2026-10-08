// Deduced: where two different people both hold a non-cancelled block at the same time.
// Half-open intervals, so touching blocks do not overlap. Instants compared with Date.parse.
// One Overlap per block pair: seat+seat -> both_booked, seat+room -> seat_in_partner_room,
// room+room -> duplicate_rooms.
import { mergeBlocks } from './blocks';
import type { Block, Board, Overlap } from './types';

const ref = (b: Block) => ({ personId: b.personId, unit: b.unit, kind: b.kind });

export function computeOverlaps(board: Board): Overlap[] {
  const perPerson = board.people.map((p) => {
    const snap = board.snapshots[p.id];
    const live = (snap?.bookings ?? []).filter((b) => b.status !== 'cancelled');
    return mergeBlocks(p.id, live);
  });

  const out: Overlap[] = [];
  for (let i = 0; i < perPerson.length; i++) {
    for (let j = i + 1; j < perPerson.length; j++) {
      for (const a of perPerson[i] ?? []) {
        for (const b of perPerson[j] ?? []) {
          const start = Date.parse(a.start) >= Date.parse(b.start) ? a.start : b.start;
          const end = Date.parse(a.end) <= Date.parse(b.end) ? a.end : b.end;
          if (!(Date.parse(start) < Date.parse(end))) continue;

          const overlap: Overlap = { kind: 'both_booked', start, end, a: ref(a), b: ref(b) };
          if (a.kind === 'room' && b.kind === 'room') {
            overlap.kind = 'duplicate_rooms'; // the core duplication this tool exists to prevent (D38)
          } else if (a.kind !== b.kind) {
            const seat = a.kind === 'seat' ? a : b;
            overlap.kind = 'seat_in_partner_room';
            overlap.redundantSeat = { personId: seat.personId, unit: seat.unit };
          }
          out.push(overlap);
        }
      }
    }
  }
  return out.sort((x, y) => Date.parse(x.start) - Date.parse(y.start) || Date.parse(x.end) - Date.parse(y.end));
}
