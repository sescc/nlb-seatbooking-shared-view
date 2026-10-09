export type Kind = 'seat' | 'room';
export type Status = 'booked' | 'checked_in' | 'cancelled' | 'partial_cancelled' | 'no_show';
export interface Booking {
  ref: string; kind: Kind; library: string; area: string; floor: string;
  unit: string;            // NLB `seat` field: "S201" or "R3"
  start: string; end: string; // ISO with +08:00, e.g. "2026-10-08T11:00:00+08:00"
  pax?: number;            // rooms only, from infoJson.NumberOfPeople
  status: Status; actions: string[];
}
export interface PushPayload { bookings: Booking[] }  // what the server stores per push; no device clock (receivedAt is server time)
export interface Person { id: string; name: string }                // public view of a person
export interface PersonConfig extends Person { pushToken: string }  // secret
export interface Snapshot { personId: string; receivedAt: string; bookings: Booking[] }
export interface Board { serverNow: string; people: Person[]; snapshots: Record<string, Snapshot | null> }
export interface Block { personId: string; refs: string[]; kind: Kind; library: string; area: string; floor: string; unit: string; start: string; end: string; pax?: number; status: Status }
export interface Overlap { kind: 'both_booked' | 'seat_in_partner_room' | 'duplicate_rooms'; start: string; end: string;
  a: { personId: string; unit: string; kind: Kind }; b: { personId: string; unit: string; kind: Kind };
  redundantSeat?: { personId: string; unit: string } }
export interface Staleness { personId: string; receivedAt: string | null; ageMin: number | null; unverifiedRefs: string[] }
