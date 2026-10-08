// SGT (UTC+8, no DST) helpers. Pure: no clock reads, no Intl, no time zone database.
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

// Epoch milliseconds -> "YYYY-MM-DDTHH:MM:SS+08:00".
export function msToSgtIso(ms: number): string {
  return new Date(ms + SGT_OFFSET_MS).toISOString().slice(0, 19) + '+08:00';
}

// SGT calendar date "YYYY-MM-DD" of an instant.
export function sgtDate(iso: string): string {
  return msToSgtIso(Date.parse(iso)).slice(0, 10);
}

// SGT wall-clock time "HH:MM" of an instant.
export function sgtHHMM(iso: string): string {
  return msToSgtIso(Date.parse(iso)).slice(11, 16);
}

// Add (or subtract) minutes; result is always in the +08:00 representation.
export function addMinutes(iso: string, minutes: number): string {
  return msToSgtIso(Date.parse(iso) + minutes * 60_000);
}
