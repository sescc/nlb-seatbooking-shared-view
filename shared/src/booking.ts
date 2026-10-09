// Normalises NLB's raw booking rows into `Booking`. Pure; reads ONLY `bookings[]` (never
// visitBookings or profile keys), so no profile field can reach a push payload.
import { msToSgtIso } from './time';
import type { Booking, Kind, Status } from './types';

const HAS_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;
const OFFSET_LESS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;
const WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

// Any ISO string -> "YYYY-MM-DDTHH:MM:SS+08:00". Offset-less input is taken to be local SGT.
// Throws RangeError when the input is not a real date-time.
export function toSgtIso(s: string): string {
  if (HAS_OFFSET.test(s)) {
    const ms = WITH_OFFSET.test(s) ? Date.parse(s) : NaN;
    if (Number.isNaN(ms)) throw new RangeError(`invalid date-time: ${s}`);
    return msToSgtIso(ms);
  }
  const m = OFFSET_LESS.exec(s);
  if (!m) throw new RangeError(`invalid date-time: ${s}`);
  const out = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}+08:00`;
  // Round-trip rejects impossible values such as month 13 or 30 February.
  const ms = Date.parse(out);
  if (Number.isNaN(ms) || msToSgtIso(ms) !== out) throw new RangeError(`invalid date-time: ${s}`);
  return out;
}

// The ONLY keys of an NLB booking row that may leave the NLB page (and that the server will read).
// Defined once: the push clients import it (esbuild inlines it) and the server applies the same list.
export const NLB_ROW_KEYS = [
  'bookingRefId', 'bookingId', 'seat', 'area', 'floor', 'branchName', 'startTime', 'endTime', 'actions', 'infoJson',
] as const;

// Keep only the whitelisted keys that are present. Profile and every other key are dropped.
export function trimRow(row: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof row === 'object' && row !== null) {
    for (const k of NLB_ROW_KEYS) if (k in row) out[k] = (row as Record<string, unknown>)[k];
  }
  return out;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

// `room` iff infoJson (string or object) is an object with a non-null NumberOfPeople.
// Spike S1: bookingRefId is "NLB…S…" for both kinds, so the ref cannot discriminate.
export function detectKind(nb: { infoJson?: unknown }): { kind: Kind; pax?: number } {
  let info: unknown = nb.infoJson;
  if (typeof info === 'string') {
    try {
      info = JSON.parse(info);
    } catch {
      return { kind: 'seat' };
    }
  }
  const obj = asRecord(info);
  const people = obj?.NumberOfPeople;
  if (people === undefined || people === null) return { kind: 'seat' };
  const pax = parseInt(String(people), 10);
  return Number.isFinite(pax) && pax >= 0 ? { kind: 'room', pax } : { kind: 'room' };
}

// Precedence: cancel > manual partial cancel > no-show > check-in > booked. Suffix patterns so unseen codes still classify.
// NLB's own UI reads an Auto…PartialCancel as the no-show auto-cancel (1 h deducted from quota); a manual one is a
// partial cancel after the booking began.
export function mapStatus(actions: string[]): Status {
  if (actions.some((a) => /FullCancel$/.test(a))) return 'cancelled';
  if (actions.some((a) => /PartialCancel$/.test(a) && !a.startsWith('Auto'))) return 'partial_cancelled';
  if (actions.some((a) => /^Auto\w*PartialCancel$/.test(a))) return 'no_show';
  if (actions.some((a) => /CheckIn$/.test(a))) return 'checked_in';
  return 'booked';
}

// The single rule for "this booking still occupies its seat/room" (overlaps, redundancy flags).
export const holdsSeat = (s: Status): boolean => s !== 'cancelled' && s !== 'no_show';

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

function normaliseRow(raw: unknown): Booking | null {
  const nb = asRecord(raw);
  if (!nb) return null;
  if (nb.startTime == null || nb.endTime == null || nb.seat == null) return null;
  const refSource = nb.bookingRefId ?? nb.bookingId;
  if (refSource == null || String(refSource) === '') return null;

  let start: string;
  let end: string;
  try {
    start = toSgtIso(String(nb.startTime));
    end = toSgtIso(String(nb.endTime));
  } catch {
    return null;
  }
  if (!(Date.parse(start) < Date.parse(end))) return null;

  const actions = Array.isArray(nb.actions) ? nb.actions.filter((a): a is string => typeof a === 'string') : [];
  const { kind, pax } = detectKind(nb);
  const booking: Booking = {
    ref: String(refSource),
    kind,
    library: str(nb.branchName),
    area: str(nb.area),
    floor: str(nb.floor),
    unit: String(nb.seat),
    start,
    end,
    status: mapStatus(actions),
    actions,
  };
  if (kind === 'room' && pax !== undefined) booking.pax = pax;
  return booking;
}

// Accepts the full GetAccountInfo response, an accountInfo object, or a bookings array.
export function extract(input: unknown): Booking[] {
  let rows: unknown = input;
  if (!Array.isArray(rows)) {
    const top = asRecord(rows);
    if (!top) return [];
    const accountInfo = asRecord(top.accountInfo);
    rows = (accountInfo ?? top).bookings;
  }
  if (!Array.isArray(rows)) return [];
  const out: Booking[] = [];
  for (const row of rows) {
    const b = normaliseRow(row);
    if (b) out.push(b);
  }
  return out;
}
