// Server-side ingest pipeline for an untrusted push (placed at L2, coherence law 6):
//   JSON array of trimmed NLB rows  --trimRow-->  --extract-->  Booking[]  --validatePayload-->  PushPayload
// Pure: no clock, no I/O. The 64 KB size cap is the Worker's job, on the raw body before parsing.
// There is no device clock in a push: the server stamps `receivedAt` itself.
import { extract, toSgtIso, trimRow } from './booking';
import type { Booking, Kind, PushPayload, Status } from './types';

export type ValidationResult = { ok: true; payload: PushPayload } | { ok: false; reason: string };

export const MAX_ROWS = 200;
const KINDS: readonly string[] = ['seat', 'room'] satisfies Kind[];
const STATUSES: readonly string[] = ['booked', 'checked_in', 'cancelled', 'partial_cancelled', 'no_show'] satisfies Status[];
const SGT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/;

const fail = (reason: string): ValidationResult => ({ ok: false, reason });

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Canonical SGT instant ("YYYY-MM-DDTHH:MM:SS+08:00", a real date), else null.
function sgtInstant(v: unknown): string | null {
  if (typeof v !== 'string' || !SGT_ISO.test(v)) return null;
  try {
    return toSgtIso(v) === v ? v : null;
  } catch {
    return null;
  }
}

function parseBooking(raw: unknown, i: number): { ok: true; booking: Booking } | { ok: false; reason: string } {
  const at = `bookings[${i}]`;
  const bad = (reason: string) => ({ ok: false as const, reason: `${at}${reason}` });
  if (!isObject(raw)) return bad(' must be an object');

  const { ref, kind, library, area, floor, unit, status, actions, pax } = raw;
  if (typeof ref !== 'string' || ref === '') return bad('.ref must be a non-empty string');
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return bad('.kind must be "seat" or "room"');
  if (typeof library !== 'string') return bad('.library must be a string');
  if (typeof area !== 'string') return bad('.area must be a string');
  if (typeof floor !== 'string') return bad('.floor must be a string');
  if (typeof unit !== 'string') return bad('.unit must be a string');
  const start = sgtInstant(raw.start);
  if (start === null) return bad('.start must be an ISO time ending +08:00');
  const end = sgtInstant(raw.end);
  if (end === null) return bad('.end must be an ISO time ending +08:00');
  if (!(Date.parse(start) < Date.parse(end))) return bad(': start must be before end');
  if (typeof status !== 'string' || !STATUSES.includes(status)) return bad('.status is not a known status');
  if (!Array.isArray(actions) || !actions.every((a) => typeof a === 'string')) {
    return bad('.actions must be an array of strings');
  }
  if (pax !== undefined && (typeof pax !== 'number' || !Number.isInteger(pax) || pax < 0)) {
    return bad('.pax must be a non-negative integer');
  }

  const booking: Booking = {
    ref, kind: kind as Kind, library, area, floor, unit, start, end,
    status: status as Status, actions: [...(actions as string[])],
  };
  if (pax !== undefined) booking.pax = pax as number;
  return { ok: true, booking };
}

// Validates already-extracted bookings and rebuilds them from known fields only,
// so unknown keys are never carried through to storage.
export function validatePayload(bookings: unknown): ValidationResult {
  if (!Array.isArray(bookings)) return fail('bookings must be an array');
  if (bookings.length > MAX_ROWS) return fail(`bookings has more than ${MAX_ROWS} entries`);
  const out: Booking[] = [];
  for (let i = 0; i < bookings.length; i++) {
    const r = parseBooking(bookings[i], i);
    if (!r.ok) return fail(r.reason);
    out.push(r.booking);
  }
  return { ok: true, payload: { bookings: out } };
}

// The whole pipeline for a parsed push body. Rows `extract` cannot use are ignored;
// a body that is not an array, or has more than 200 rows, is rejected.
export function ingestRows(json: unknown): ValidationResult {
  if (!Array.isArray(json)) return fail('rows must be an array');
  if (json.length > MAX_ROWS) return fail(`rows has more than ${MAX_ROWS} entries`);
  return validatePayload(extract(json.map(trimRow)));
}
