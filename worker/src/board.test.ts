import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { booking } from '../../shared/src/fixtures';
import type { PushPayload } from '../../shared/src/types';

const people = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];
const T0 = Date.parse('2026-10-08T10:00:00+08:00');
const at = (ms: number) => new Date(ms).toISOString();
const payload = (bookings = [booking()]): PushPayload => ({ bookings });

// A fresh Board instance per test, so tests never share state.
const freshBoard = () => env.BOARD.get(env.BOARD.idFromName(`test-${crypto.randomUUID()}`));

describe('Board Durable Object', () => {
  it('a person who never pushed has a null snapshot', async () => {
    const b = await freshBoard().board(people);
    expect(b.snapshots).toEqual({ a: null, b: null });
    expect(b.people).toEqual(people);
  });

  it('put stores a snapshot stamped with the server receivedAt', async () => {
    const stub = freshBoard();
    expect(await stub.put('a', payload(), at(T0))).toBe('ok');
    const b = await stub.board(people);
    expect(b.snapshots.a).toEqual({
      personId: 'a',
      receivedAt: at(T0),
      bookings: [booking()],
    });
    expect(b.snapshots.b).toBeNull();
  });

  it('a later push replaces the earlier one entirely', async () => {
    const stub = freshBoard();
    await stub.put('a', payload([booking({ ref: 'A' }), booking({ ref: 'B' })]), at(T0));
    await stub.put('a', payload([booking({ ref: 'A' })]), at(T0 + 10_000));
    const snap = (await stub.board(people)).snapshots.a;
    expect(snap?.bookings.map((x) => x.ref)).toEqual(['A']);
    expect(snap?.receivedAt).toBe(at(T0 + 10_000));
  });

  it('an empty push clears the bookings but keeps the snapshot', async () => {
    const stub = freshBoard();
    await stub.put('a', payload([booking()]), at(T0));
    await stub.put('a', payload([]), at(T0 + 10_000));
    const snap = (await stub.board(people)).snapshots.a;
    expect(snap?.bookings).toEqual([]);
    expect(snap?.receivedAt).toBe(at(T0 + 10_000));
  });

  it('rate limit: a second push under 2 s later is rejected and changes nothing', async () => {
    const stub = freshBoard();
    await stub.put('a', payload([booking({ ref: 'FIRST' })]), at(T0));
    expect(await stub.put('a', payload([booking({ ref: 'SECOND' })]), at(T0 + 1_999))).toBe('rate_limited');
    const snap = (await stub.board(people)).snapshots.a;
    expect(snap?.bookings.map((x) => x.ref)).toEqual(['FIRST']);
    expect(snap?.receivedAt).toBe(at(T0));
  });

  it('rate limit: exactly 2 s later is accepted', async () => {
    const stub = freshBoard();
    await stub.put('a', payload(), at(T0));
    expect(await stub.put('a', payload(), at(T0 + 2_000))).toBe('ok');
  });

  it('a rejected push does not extend the rate-limit window', async () => {
    const stub = freshBoard();
    await stub.put('a', payload(), at(T0));
    expect(await stub.put('a', payload(), at(T0 + 1_500))).toBe('rate_limited');
    expect(await stub.put('a', payload(), at(T0 + 2_000))).toBe('ok');
  });

  it('rate limit is per person', async () => {
    const stub = freshBoard();
    await stub.put('a', payload(), at(T0));
    expect(await stub.put('b', payload(), at(T0 + 100))).toBe('ok');
  });

  it('board only lists the given people and exposes no tokens', async () => {
    const stub = freshBoard();
    await stub.put('a', payload(), at(T0));
    await stub.put('b', payload(), at(T0));
    const b = await stub.board([{ id: 'a', name: 'Alice', pushToken: 'SECRET-TOKEN-VALUE' } as never]);
    expect(Object.keys(b.snapshots)).toEqual(['a']);
    expect(JSON.stringify(b)).not.toContain('SECRET-TOKEN-VALUE');
    expect(b.people).toEqual([{ id: 'a', name: 'Alice' }]);
  });

  it('persists only the snapshot table: boards, overlaps and staleness are never stored', async () => {
    const stub = freshBoard();
    await stub.put('a', payload(), at(T0));
    await stub.board(people);
    const tables = await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'")
        .toArray()
        .map((r) => r.name),
    );
    expect(tables).toEqual(['snapshot']);
  });

  it('the snapshot table stores no device clock (columns: person_id, received_at, json)', async () => {
    const stub = freshBoard();
    await stub.put('a', payload(), at(T0));
    const columns = await runInDurableObject(stub, (_i, state) =>
      state.storage.sql.exec<{ name: string }>('PRAGMA table_info(snapshot)').toArray().map((r) => r.name),
    );
    expect(columns).toEqual(['person_id', 'received_at', 'json']);
  });

  it('serverNow is an SGT (+08:00) timestamp', async () => {
    const b = await freshBoard().board(people);
    expect(b.serverNow).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
  });
});
