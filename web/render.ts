// Pure: Board x now -> HTML string for the page body. Holds no state, reads no clock, and uses only the
// SGT string helpers from shared/ (never getHours/toLocale*), so the output cannot depend on the device
// time zone. Every data string is HTML-escaped. No style="" attributes: positions are CSS classes (layout.ts).
import { mergeBlocks } from '../shared/src/blocks';
import { computeOverlaps } from '../shared/src/overlap';
import { computeStaleness } from '../shared/src/staleness';
import { addMinutes, sgtDate, sgtHHMM } from '../shared/src/time';
import type { Block, Board, Overlap, Person, Status } from '../shared/src/types';
import { esc } from './html';
import { rowClass, rowSpanClass, slotRange, spanClass, startClass, SLOTS } from './layout';

const DASH = '–';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_LABEL: Record<Status, string> = {
  booked: 'Booked',
  checked_in: 'Checked in',
  cancelled: 'Cancelled',
  partial_cancelled: 'Partly cancelled',
};

type Flag = 'redundant' | 'duplicate';
interface Annotated {
  block: Block;
  unverified: boolean;
  flags: Set<Flag>;
}
interface Item {
  a: Annotated;
  lane: number; // index into board.people
  ghost: boolean; // copy of a partner's room, shown in this lane
  first: number;
  end: number;
  track: number;
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

export function render(board: Board, nowIso: string): string {
  const today = sgtDate(nowIso);
  const tomorrow = sgtDate(addMinutes(nowIso, 24 * 60));
  const staleness = computeStaleness(board, nowIso);
  const overlaps = computeOverlaps(board);

  // Merged blocks per person, cancelled ones included (shown struck through; computeOverlaps already skips them).
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
      if (b.personId === who.personId && b.unit === who.unit && b.kind === who.kind && b.status !== 'cancelled' && intersects(b, ov)) {
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
    `<p class="sub">All times are Singapore time (SGT) · now ${esc(sgtHHMM(nowIso))}</p></header>` +
    days.map((d) => renderDay(board, staleness, annotated, overlaps, d.key, d.title, d.date)).join('')
  );
}

function renderDay(
  board: Board,
  staleness: ReturnType<typeof computeStaleness>,
  all: Annotated[],
  allOverlaps: Overlap[],
  key: string,
  title: string,
  date: string,
): string {
  const dayBlocks = all
    .filter((a) => sgtDate(a.block.start) === date)
    .sort((x, y) => Date.parse(x.block.start) - Date.parse(y.block.start) || Date.parse(x.block.end) - Date.parse(y.block.end));

  // ---- timeline items: own blocks per lane, plus a ghost copy of each room in every other lane ----
  const laneOf = new Map(board.people.map((p, i) => [p.id, i]));
  const items: Item[] = [];
  let outside = 0;
  for (const a of dayBlocks) {
    const owner = laneOf.get(a.block.personId);
    if (owner === undefined) continue;
    const r = slotRange(minutesOnDay(a.block.start, date), minutesOnDay(a.block.end, date));
    if (!r) {
      outside++;
      continue;
    }
    items.push({ a, lane: owner, ghost: false, first: r.first, end: r.end, track: 0 });
    if (a.block.kind === 'room') {
      board.people.forEach((_, lane) => {
        if (lane !== owner) items.push({ a, lane, ghost: true, first: r.first, end: r.end, track: 0 });
      });
    }
  }

  // greedy track packing inside each lane, so simultaneous blocks never sit in the same grid cell
  const laneTracks: number[] = board.people.map(() => 1);
  board.people.forEach((_, lane) => {
    const mine = items.filter((it) => it.lane === lane).sort((x, y) => x.first - y.first || Number(x.ghost) - Number(y.ghost));
    const trackEnd: number[] = [];
    for (const it of mine) {
      let t = trackEnd.findIndex((e) => e <= it.first);
      if (t === -1) t = trackEnd.length;
      trackEnd[t] = it.end;
      it.track = t;
    }
    laneTracks[lane] = Math.max(1, trackEnd.length);
  });
  const laneRow: number[] = [];
  let nextRow = 2;
  for (const n of laneTracks) {
    laneRow.push(nextRow);
    nextRow += n;
  }
  const totalRows = nextRow - 2;

  // ---- timeline markup ----
  let tl = '';
  for (let h = 0; h < SLOTS / 2; h++) {
    const hh = String(8 + h).padStart(2, '0');
    tl += `<div class="hd ${startClass(h * 2)} ${spanClass(2)} ${rowClass(1)}">${hh}:00</div>`;
  }
  board.people.forEach((p, lane) => {
    const rc = `${rowClass(laneRow[lane]!)} ${rowSpanClass(laneTracks[lane]!)}`;
    tl += `<div class="lane-bg ${personClass(lane)} ${rc}"></div>`;
    tl += `<div class="lane-hd ${personClass(lane)} ${rc}">${laneHeader(p, staleness[lane])}</div>`;
  });

  const seen = new Set<string>();
  for (const ov of allOverlaps) {
    if (sgtDate(ov.start) !== date) continue;
    const r = slotRange(minutesOnDay(ov.start, date), minutesOnDay(ov.end, date));
    if (!r) continue;
    const kind = ov.kind === 'seat_in_partner_room' ? 'ovl-seat' : ov.kind === 'duplicate_rooms' ? 'ovl-room' : 'ovl-both';
    const k = `${kind}|${r.first}|${r.end}`;
    if (seen.has(k)) continue;
    seen.add(k);
    tl +=
      `<div class="ovl ${kind} ${startClass(r.first)} ${spanClass(r.end - r.first)} ${rowClass(2)} ${rowSpanClass(totalRows)}"` +
      ` data-start="${esc(ov.start)}" data-end="${esc(ov.end)}">` +
      `<span class="ovl-lbl">Overlap ${sgtHHMM(ov.start)}${DASH}${sgtHHMM(ov.end)}</span></div>`;
  }

  for (const it of items) tl += blockHtml(board.people, it, laneRow[it.lane]! + it.track);

  const note =
    outside > 0
      ? `<p class="note">${outside} booking${outside === 1 ? '' : 's'} outside 08:00${DASH}22:00 ${outside === 1 ? 'is' : 'are'} listed below only.</p>`
      : '';

  const body = dayBlocks.length === 0 ? '<p class="empty">No bookings</p>' : listHtml(board.people, dayBlocks);

  return (
    `<section class="day" data-day="${key}" data-date="${esc(date)}">` +
    `<h2>${title} <span class="date">${esc(dateLabel(date))}</span></h2>` +
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
  if (a.unverified) out.push('<span class="badge b-unverified">unverified</span>');
  if (a.flags.has('redundant')) out.push('<span class="badge b-redundant">possibly redundant</span>');
  if (a.flags.has('duplicate')) out.push('<span class="badge b-duplicate">duplicate room</span>');
  return out;
}

function blockHtml(people: Person[], it: Item, row: number): string {
  const b = it.a.block;
  const label = blockLabel(people, b);
  const compact = blockLabel(people, b, true);
  const cls = [
    'blk',
    b.kind === 'room' ? 'k-room' : 'k-seat',
    personClass(laneIndex(people, b.personId)),
    stClass(b.status),
    startClass(it.first),
    spanClass(it.end - it.first),
    rowClass(row),
    rowSpanClass(1),
    ...(it.ghost ? ['ghost'] : []),
  ];
  const title = `${label} · ${range(b)} · ${STATUS_LABEL[b.status]}`;
  return (
    `<div class="${cls.join(' ')}" data-person="${esc(b.personId)}" data-lane="${esc(people[it.lane]?.id ?? '')}"` +
    ` data-unit="${esc(b.unit)}" data-kind="${b.kind}" data-status="${b.status}" title="${esc(title)}">` +
    `<span class="lbl">${esc(compact)}</span>` +
    (it.ghost ? '' : badges(it.a).join('')) +
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
      const what = b.kind === 'seat' ? `Seat ${esc(b.unit)}` : `Room ${esc(b.unit)}` + (b.pax !== undefined ? ` · ${b.pax} pax` : '');
      return (
        `<tr class="item ${stClass(b.status)} ${personClass(laneIndex(people, b.personId))}" data-person="${esc(b.personId)}">` +
        `<td class="c-time" data-label="Time">${range(b)}</td>` +
        `<td class="c-who" data-label="Who">${esc(nameOf(people, b.personId))}</td>` +
        `<td class="c-where" data-label="Where">${where}</td>` +
        `<td class="c-what" data-label="Seat / room">${what}</td>` +
        `<td class="c-status" data-label="Status">${STATUS_LABEL[b.status]}</td>` +
        `<td class="c-notes" data-label="Notes">${badges(a).join(' ')}</td></tr>`
      );
    })
    .join('');
  return `<div class="list-scroll"><table class="list">${head}<tbody>${rows}</tbody></table></div>`;
}
