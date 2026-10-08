// Test fixtures built from the real NLB GetAccountInfo shape (spike S1, 2026-10-08).
// All personal values are fake.
import type { Booking } from './types';

export const FAKE_PROFILE = {
  name: 'Test Name',
  email: 'test.name@example.invalid',
  userId: 'TESTUSER-0001',
  accountId: 'TESTACCT-0001',
} as const;

export type NlbRow = Record<string, unknown>;

const SEAT_DEFAULTS: NlbRow = {
  bookingId: 900001,
  bookingRefId: 'NLB0001S00001',
  bookingTimeslotInMinutes: 60,
  branchId: 'TEST',
  facilityId: 111,
  lastAction: 'Book',
  actions: ['Book'],
  seat: 'S145',
  area: 'Long Study Space',
  areaInformation: null,
  areaIgnoreHolidays: false,
  floor: '4',
  branchName: 'Test Library',
  startTime: '2026-10-08T11:00:00',
  endTime: '2026-10-08T12:00:00',
  areaImageUrls: [],
  mapUrls: [],
  infoJson: 'not-json',
  canCancelStatus: 'Yes',
  canCheckInStatus: 'No',
  canExtendStatus: 'No',
};

const ROOM_DEFAULTS: NlbRow = {
  ...SEAT_DEFAULTS,
  bookingId: 900101,
  bookingRefId: 'NLB0001S00101',
  seat: 'R3',
  area: 'Discussion Room',
  infoJson: '{"NumberOfPeople":"2","Purpose":"Study group"}',
};

export function nlbSeatRow(overrides: NlbRow = {}): NlbRow {
  return { ...SEAT_DEFAULTS, ...overrides };
}

export function nlbRoomRow(overrides: NlbRow = {}): NlbRow {
  return { ...ROOM_DEFAULTS, ...overrides };
}

// `n` consecutive hourly rows for one unit, starting at `startHour` on `date` (offset-less local SGT).
export function hourlyRows(
  n: number,
  startHour: number,
  opts: { date?: string; seat?: string; baseId?: number; actions?: string[] } = {},
): NlbRow[] {
  const date = opts.date ?? '2026-10-08';
  const baseId = opts.baseId ?? 910000;
  const pad = (h: number) => String(h).padStart(2, '0');
  return Array.from({ length: n }, (_, i) =>
    nlbSeatRow({
      bookingId: baseId + i,
      bookingRefId: `NLB0002S${String(baseId + i).padStart(5, '0')}`,
      seat: opts.seat ?? 'S201',
      actions: opts.actions ?? ['Book'],
      startTime: `${date}T${pad(startHour + i)}:00:00`,
      endTime: `${date}T${pad(startHour + i + 1)}:00:00`,
    }),
  );
}

export const VISIT_BOOKING: NlbRow = {
  bookingId: 777,
  bookingRefId: 'NLB0009V00001',
  branchName: 'Visit Library',
  startTime: '2026-10-08T09:00:00',
  endTime: '2026-10-08T18:00:00',
};

// The full GetAccountInfo response: {settings, accountInfo, action, branchId}.
export function accountInfoResponse(bookings: NlbRow[], visitBookings: NlbRow[] = []): Record<string, unknown> {
  return {
    settings: { someSetting: true },
    accountInfo: {
      ...FAKE_PROFILE,
      accountType: 'Member',
      dailyBookingQuotas: { total: 4, used: 1 },
      advancedBookingQuotas: { total: 2, used: 0 },
      visitBookingMonthlyCountsForNonNlbUser: 0,
      bookings,
      visitBookings,
      allowAdvanceBooking: true,
    },
    action: 'GetAccountInfo',
    branchId: 'TEST',
  };
}

// Only the accountInfo object of the response.
export function accountInfoOnly(bookings: NlbRow[], visitBookings: NlbRow[] = []): Record<string, unknown> {
  return accountInfoResponse(bookings, visitBookings).accountInfo as Record<string, unknown>;
}

// --- Normalised Booking builder, for tests of payload/blocks/overlap/staleness ---

export function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    ref: 'NLB0001S00001',
    kind: 'seat',
    library: 'Test Library',
    area: 'Long Study Space',
    floor: '4',
    unit: 'S145',
    start: '2026-10-08T11:00:00+08:00',
    end: '2026-10-08T12:00:00+08:00',
    status: 'booked',
    actions: ['Book'],
    ...overrides,
  };
}
