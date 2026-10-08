// The single Board Durable Object (L3): the only stored state in the system is one Snapshot per person.
// Overlaps, staleness and the Board itself are never persisted (they are deduced on read / in the viewer).
import { DurableObject } from 'cloudflare:workers';
import { msToSgtIso } from '../../shared/src/time';
import type { Board as BoardView, Booking, Person, PushPayload, Snapshot } from '../../shared/src/types';

const MIN_PUSH_INTERVAL_MS = 2_000;

interface Row extends Record<string, SqlStorageValue> {
  person_id: string;
  received_at: string;
  json: string;
}

export class Board extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS snapshot(person_id TEXT PRIMARY KEY, received_at TEXT, json TEXT)',
    );
  }

  // ingest: replace that person's snapshot (C1). Rejects if they pushed less than 2 s ago.
  // Runs synchronously inside the DO, so check + write are atomic.
  put(personId: string, payload: PushPayload, receivedAt: string): 'ok' | 'rate_limited' {
    const sql = this.ctx.storage.sql;
    const last = sql.exec<Row>('SELECT received_at FROM snapshot WHERE person_id = ?', personId).toArray()[0];
    if (last && Date.parse(receivedAt) - Date.parse(last.received_at) < MIN_PUSH_INTERVAL_MS) return 'rate_limited';
    sql.exec(
      'INSERT OR REPLACE INTO snapshot(person_id, received_at, json) VALUES (?, ?, ?)',
      personId,
      receivedAt,
      JSON.stringify(payload.bookings),
    );
    return 'ok';
  }

  // boardView: built on every read. People with no snapshot get null (an empty lane).
  // Only id and name are exposed, never a push token.
  board(people: Person[]): BoardView {
    const rows = this.ctx.storage.sql.exec<Row>('SELECT * FROM snapshot').toArray();
    const byPerson = new Map(rows.map((r) => [r.person_id, r]));
    const snapshots: Record<string, Snapshot | null> = {};
    for (const p of people) {
      const r = byPerson.get(p.id);
      snapshots[p.id] = r
        ? {
            personId: p.id,
            receivedAt: r.received_at,
            bookings: JSON.parse(r.json) as Booking[],
          }
        : null;
    }
    return {
      serverNow: msToSgtIso(Date.now()),
      people: people.map((p) => ({ id: p.id, name: p.name })),
      snapshots,
    };
  }
}
