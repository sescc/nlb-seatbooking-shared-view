// Pure: (Board, now, ViewPrefs) -> HTML string for the page body. Holds no state, reads no clock, and uses only the
// SGT string helpers from shared/ (never getHours/toLocale*), so the output cannot depend on the device
// time zone. Every data string is HTML-escaped. No style="" attributes: positions are CSS classes (layout.ts).
// Where a block sits (lane, track) is decided by placement.ts; this file only turns that into markup.
import { mergeBlocks } from '../shared/src/blocks';
import { holdsSeat } from '../shared/src/booking';
import { computeOverlaps } from '../shared/src/overlap';
import { computeStaleness } from '../shared/src/staleness';
import { addMinutes, sgtDate, sgtHHMM } from '../shared/src/time';
import type { Block, Board, Overlap, Person, Status } from '../shared/src/types';
import { esc } from './html';
import { GRID_START_MIN, rowClass, rowSpanClass, slotRange, SLOT_MIN, SLOTS, spanClass, startClass } from './layout';
import { layoutRows, placeBlocks, type Placement, type RowLayout } from './placement';

const DASH = '–';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_LABEL: Record<Status, string> = {
  booked: 'Booked',
  checked_in: 'Checked in',
  cancelled: 'Cancelled',
  partial_cancelled: 'Partly cancelled',
  no_show: 'No-show (auto-cancelled)',
};
// Text copied from NLB's formatBookingStatus; booked / checked_in deliberately get none.
const NLB_NOTE: Partial<Record<Status, string>> = {
  cancelled: 'Cancelled',
  partial_cancelled: 'Partially cancelled',
  no_show: 'This booking has been cancelled as you did not check-in, 1 hour has been deducted from your daily quota.',
};

type Flag = 'redundant' | 'duplicate';
interface Annotated {
  block: Block;
  unverified: boolean;
  flags: Set<Flag>;
}

const stClass = (s: Status) => 'st-' + s.replace(/_/g, '-');
const personClass = (i: number) => 'p-' + (i % 5);

function dateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

/** Minutes of `iso` since 00:00 SGT on `date` (may be < 0 or > 1440 for blocks crossing midnight). */
const minutesOnDay = (iso: string, date: string) => (Date.parse(iso) - Date.parse(date + 'T00:00:00+08:00')) / 60_000;

const range = (b: Block) => `${sgtHHMM(b.start)}${DASH}${sgtHHMM(b.end)}`;
const intersects = (b: Block, ov: Overlap) =>
  Date.parse(b.start) < Date.parse(ov.end) && Date.parse(ov.start) < Date.parse(b.end);

/** Viewer-only display choices (not part of the Board). `reveal` is a per-calendar-date override of showCancelled. */
export interface ViewPrefs {
  showCancelled: boolean;
  reveal: Record<string, boolean>;
  legendOpen: boolean; // the "Key" legend under the subtitle
}

export function render(
  board: Board,
  nowIso: string,
  prefs: ViewPrefs = { showCancelled: false, reveal: {}, legendOpen: false },
): string {
  const today = sgtDate(nowIso);
  const tomorrow = sgtDate(addMinutes(nowIso, 24 * 60));
  const staleness = computeStaleness(board, nowIso);
  const overlaps = computeOverlaps(board);

  // Merged blocks per person, cancelled ones included (shown struck through; computeOverlaps already skips cancelled and no-show ones).
  const annotated: Annotated[] = [];
  board.people.forEach((p, i) => {
    const unverifiedRefs = new Set(staleness[i]?.unverifiedRefs ?? []);
    for (const block of mergeBlocks(p.id, board.snapshots[p.id]?.bookings ?? [])) {
      annotated.push({ block, unverified: block.refs.some((r) => unverifiedRefs.has(r)), flags: new Set() });
    }
  });

  const mark = (who: { personId: string; unit: string; kind: Block['kind'] }, ov: Overlap, flag: Flag) => {
    for (const a of annotated) {
      const b = a.block;
      if (b.personId === who.personId && b.unit === who.unit && b.kind === who.kind && holdsSeat(b.status) && intersects(b, ov)) {
        a.flags.add(flag);
      }
    }
  };
  for (const ov of overlaps) {
    if (ov.kind === 'seat_in_partner_room' && ov.redundantSeat) {
      mark({ ...ov.redundantSeat, kind: 'seat' }, ov, 'redundant');
    } else if (ov.kind === 'duplicate_rooms') {
      mark(ov.a, ov, 'duplicate');
      mark(ov.b, ov, 'duplicate');
    }
  }

  const days = [
    { key: 'today', title: 'Today', date: today },
    { key: 'tomorrow', title: 'Tomorrow', date: tomorrow },
  ];
  return (
    `<header class="top"><h1>Shared bookings</h1>` +
    `<p class="sub">All times are Singapore time (SGT) · now ${esc(sgtHHMM(nowIso))}</p>` +
    keyHtml(prefs.legendOpen) +
    `</header>` +
    days.map((d) => renderDay(board, nowIso, staleness, annotated, overlaps, prefs, d.key, d.title, d.date)).join('')
  );
}

// ---- legend: swatches reuse the real block / badge / band classes (person 0's colours) ----

const swatch = (cls: string, inner = '') => `<span class="blk p-0 ${cls} sw">${inner}</span>`;
const keyItem = (mark: string, text: string) => `<span class="ki">${mark}${text}</span>`;
const BADGE_UNVERIFIED = '<span class="badge b-unverified">unverified</span>';
const BADGE_REDUNDANT = '<span class="badge b-redundant">possibly redundant</span>';
const BADGE_DUPLICATE = '<span class="badge b-duplicate">duplicate room</span>';

function keyHtml(open: boolean): string {
  const items = [
    keyItem(swatch('st-booked'), 'Booked'),
    keyItem(swatch('st-checked-in', '✓'), 'Checked in'),
    keyItem(swatch('st-partial-cancelled'), 'Partly cancelled (faded)'),
    keyItem(swatch('st-no-show'), 'No-show (grey, dotted)'),
    keyItem(swatch('st-cancelled', '<span class="lbl">S1</span>'), 'Cancelled (hollow, struck through; hidden unless shown)'),
    keyItem('<span class="ovl ovl-room sw"></span>', 'Duplicate rooms (red band)'),
    keyItem(BADGE_UNVERIFIED, 'check-in deadline passed with no newer push'),
    keyItem(BADGE_REDUNDANT, "a seat inside the partner's room"),
    keyItem(BADGE_DUPLICATE, 'both booked a room at once'),
  ];
  return `<details class="key"${open ? ' open' : ''}><summary>Key</summary><div class="key-items">${items.join('')}</div></details>`;
}

/**
 * Today only: the past wash (full half-hour columns before now, plus a partial one in now's column) and, while
 * now is inside 08:00-22:00, the now-line and its HH:MM chip. After 22:00 the wash covers the whole grid; before
 * 08:00 there is nothing. `rows` = lane rows below the header; the elements span all of them.
 */
function nowHtml(nowIso: string, rows: number): string {
  const [hh, mm] = sgtHHMM(nowIso).split(':').map(Number) as [number, number];
  const m = hh * 60 + mm - GRID_START_MIN;
  if (m < 0) return '';
  const pos = `${rowClass(2)} ${rowSpanClass(rows)}`;
  if (m >= SLOTS * SLOT_MIN) return `<div class="wash ${startClass(0)} ${spanClass(SLOTS)} ${pos}"></div>`;
  const slot = Math.floor(m / SLOT_MIN);
  const mo = m % SLOT_MIN;
  return (
    (slot > 0 ? `<div class="wash ${startClass(0)} ${spanClass(slot)} ${pos}"></div>` : '') +
    (mo > 0 ? `<div class="wash ${startClass(slot)} mw-${mo} ${pos}"></div>` : '') +
    `<div class="now ${startClass(slot)} mo-${mo} ${pos}"></div>` +
    `<div class="now-chip ${startClass(slot)} mo-${mo} ${rowClass(1)}">${esc(sgtHHMM(nowIso))}</div>`
  );
}

function renderDay(
  board: Board,
  nowIso: string,
  staleness: ReturnType<typeof computeStaleness>,
  all: Annotated[],
  allOverlaps: Overlap[],
  prefs: ViewPrefs,
  key: string,
  title: string,
  date: string,
): string {
  const dayBlocks = all
    .filter((a) => sgtDate(a.block.start) === date)
    .sort((x, y) => Date.parse(x.block.start) - Date.parse(y.block.start) || Date.parse(x.block.end) - Date.parse(y.block.end));

  // Hidden cancelled blocks are dropped here, before placement, so the lanes repack.
  const cancelledN = dayBlocks.filter((a) => a.block.status === 'cancelled').length;
  const showCancelled = prefs.reveal[date] ?? prefs.showCancelled;
  const visible = showCancelled ? dayBlocks : dayBlocks.filter((a) => a.block.status !== 'cancelled');

  // ---- timeline items: the blocks that fall inside the 08:00-22:00 grid, placed by placement.ts ----
  const laneOf = new Map(board.people.map((p, i) => [p.id, i]));
  const byBlock = new Map<Block, Annotated>();
  const slots = new Map<Block, { first: number; end: number }>();
  let outside = 0;
  for (const a of visible) {
    if (!laneOf.has(a.block.personId)) continue;
    const r = slotRange(minutesOnDay(a.block.start, date), minutesOnDay(a.block.end, date));
    if (!r) {
      outside++;
      continue;
    }
    byBlock.set(a.block, a);
    slots.set(a.block, r);
  }
  const placements = placeBlocks(board.people, [...byBlock.keys()]);
  const rl = layoutRows(board.people.length, placements);

  // ---- timeline markup ----
  let tl = '';
  for (let h = 0; h < SLOTS / 2; h++) {
    const hh = String(8 + h).padStart(2, '0');
    tl += `<div class="hd ${startClass(h * 2)} ${spanClass(2)} ${rowClass(1)}">${hh}:00</div>`;
  }
  if (rl.bandTracks > 0) {
    const rc = `${rowClass(rl.bandRow)} ${rowSpanClass(rl.bandTracks)}`;
    tl += `<div class="lane-bg band ${rc}"></div><div class="lane-hd band ${rc}"><span class="who">Rooms</span></div>`;
  }
  const centre = board.people.length === 2;
  board.people.forEach((p, lane) => {
    const rc = `${rowClass(rl.laneRow[lane]!)} ${rowSpanClass(rl.laneTracks[lane]!)}`;
    const line = centre && lane === 1 ? ' centre' : ''; // the divider between the two lanes
    tl += `<div class="lane-bg ${personClass(lane)}${line} ${rc}"></div>`;
    tl += `<div class="lane-hd ${personClass(lane)}${line} ${rc}">${laneHeader(p, staleness[lane])}</div>`;
  });

  // Only duplicate rooms get a band (full timeline height); seat overlaps are shown by the "possibly redundant" badge.
  const seen = new Set<string>();
  for (const ov of allOverlaps) {
    if (ov.kind !== 'duplicate_rooms' || sgtDate(ov.start) !== date) continue;
    const r = slotRange(minutesOnDay(ov.start, date), minutesOnDay(ov.end, date));
    if (!r) continue;
    const k = `${r.first}|${r.end}`;
    if (seen.has(k)) continue;
    seen.add(k);
    tl +=
      `<div class="ovl ovl-room ${startClass(r.first)} ${spanClass(r.end - r.first)} ${rowClass(2)} ${rowSpanClass(rl.total)}"` +
      ` data-start="${esc(ov.start)}" data-end="${esc(ov.end)}">` +
      `<span class="ovl-lbl">Overlap ${sgtHHMM(ov.start)}${DASH}${sgtHHMM(ov.end)}</span></div>`;
  }
  for (const p of placements) tl += blockHtml(board.people, byBlock.get(p.block)!, slots.get(p.block)!, p, rl);
  if (key === 'today') tl += nowHtml(nowIso, rl.total);

  const note =
    outside > 0
      ? `<p class="note">${outside} booking${outside === 1 ? '' : 's'} outside 08:00${DASH}22:00 ${outside === 1 ? 'is' : 'are'} listed below only.</p>`
      : '';

  const body =
    visible.length > 0
      ? listHtml(board.people, visible)
      : `<p class="empty">${dayBlocks.length === 0 ? 'No bookings' : 'No active bookings'}</p>`;
  const cnt =
    cancelledN === 0
      ? ''
      : `<button type="button" class="cnt" data-date="${esc(date)}" data-reveal="${showCancelled ? 0 : 1}">` +
        (showCancelled ? `· Hide ${cancelledN} cancelled` : `· ${cancelledN} cancelled hidden`) +
        '</button>';

  return (
    `<section class="day" data-day="${key}" data-date="${esc(date)}">` +
    `<h2>${title} <span class="date">${esc(dateLabel(date))}</span>${cnt ? ' ' + cnt : ''}</h2>` +
    `<div class="tl-scroll"><div class="tl">${tl}</div></div>` +
    note +
    body +
    `</section>`
  );
}

function laneHeader(p: Person, s: ReturnType<typeof computeStaleness>[number] | undefined): string {
  const fresh =
    s && s.receivedAt !== null && s.ageMin !== null
      ? `<span class="fresh">pushed ${esc(sgtHHMM(s.receivedAt))} (${s.ageMin} min ago)</span>`
      : `<span class="fresh never">never pushed</span>`;
  return `<span class="who">${esc(p.name)}</span>${fresh}`;
}

function nameOf(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.name ?? id;
}

/** Full wording ("R3 · booked by Alice · 2 pax") for titles; compact ("R3 · Alice · 2 pax") inside timeline blocks. */
function blockLabel(people: Person[], b: Block, compact = false): string {
  if (b.kind === 'seat') return b.unit;
  const who = compact ? nameOf(people, b.personId) : `booked by ${nameOf(people, b.personId)}`;
  return `${b.unit} · ${who}` + (b.pax !== undefined ? ` · ${b.pax} pax` : '');
}

function badges(a: Annotated): string[] {
  const out: string[] = [];
  if (a.unverified) out.push(BADGE_UNVERIFIED);
  if (a.flags.has('redundant')) out.push(BADGE_REDUNDANT);
  if (a.flags.has('duplicate')) out.push(BADGE_DUPLICATE);
  return out;
}

function blockHtml(people: Person[], a: Annotated, slot: { first: number; end: number }, p: Placement, rl: RowLayout): string {
  const b = a.block;
  const label = blockLabel(people, b);
  const compact = (b.status === 'checked_in' ? '✓ ' : '') + blockLabel(people, b, true); // the list keeps "Checked in"
  const { row, span } = rl.rowOf(p);
  const cls = [
    'blk',
    b.kind === 'room' ? 'k-room' : 'k-seat',
    personClass(laneIndex(people, b.personId)),
    stClass(b.status),
    startClass(slot.first),
    spanClass(slot.end - slot.first),
    rowClass(row),
    rowSpanClass(span),
  ];
  const lane = typeof p.lane === 'number' ? (people[p.lane]?.id ?? '') : p.lane; // 'span' or 'rooms' for shared rows
  const title = `${label} · ${range(b)} · ${STATUS_LABEL[b.status]}`;
  return (
    `<div class="${cls.join(' ')}" data-person="${esc(b.personId)}" data-lane="${esc(lane)}"` +
    ` data-unit="${esc(b.unit)}" data-kind="${b.kind}" data-status="${b.status}" title="${esc(title)}">` +
    `<span class="lbl">${esc(compact)}</span>` +
    badges(a).join('') +
    `</div>`
  );
}

function laneIndex(people: Person[], id: string): number {
  return Math.max(0, people.findIndex((p) => p.id === id));
}

function listHtml(people: Person[], dayBlocks: Annotated[]): string {
  const head =
    '<thead><tr><th>Time</th><th>Who</th><th>Where</th><th>Seat / room</th><th>Status</th><th>Notes</th></tr></thead>';
  const rows = dayBlocks
    .map((a) => {
      const b = a.block;
      const where = [b.library, b.area, b.floor ? `Floor ${b.floor}` : ''].filter(Boolean).map(esc).join(' · ');
      const note = NLB_NOTE[b.status];
      const noteHtml = [...(note ? [`<span class="nlb-note">${esc(note)}</span>`] : []), ...badges(a)].join(' ');
      const what = b.kind === 'seat' ? `Seat ${esc(b.unit)}` : `Room ${esc(b.unit)}` + (b.pax !== undefined ? ` · ${b.pax} pax` : '');
      return (
        `<tr class="item ${stClass(b.status)} ${personClass(laneIndex(people, b.personId))}" data-person="${esc(b.personId)}">` +
        `<td class="c-time" data-label="Time">${range(b)}</td>` +
        `<td class="c-who" data-label="Who">${esc(nameOf(people, b.personId))}</td>` +
        `<td class="c-where" data-label="Where">${where}</td>` +
        `<td class="c-what" data-label="Seat / room">${what}</td>` +
        `<td class="c-status" data-label="Status">${STATUS_LABEL[b.status]}</td>` +
        `<td class="c-notes" data-label="Notes">${noteHtml}</td></tr>`
      );
    })
    .join('');
  return `<div class="list-scroll"><table class="list">${head}<tbody>${rows}</tbody></table></div>`;
}
