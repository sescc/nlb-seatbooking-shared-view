import { afterEach, describe, expect, it } from 'vitest';
import { booking } from '../shared/src/fixtures';
import type { Board, Booking, Snapshot } from '../shared/src/types';
import { render, type ViewPrefs } from './render';

// web/tsconfig.json deliberately has no node types (the viewer targets the browser); tests only need process.env.TZ.
declare const process: { env: Record<string, string | undefined> };

// ---- fixtures -------------------------------------------------------------------------------

const NOW = '2026-10-08T14:15:00+08:00';
const TODAY = '2026-10-08';
const TOMORROW = '2026-10-09';

/** Prefs that show cancelled blocks, for tests about how cancelled bookings look. */
const SHOW: ViewPrefs = { showCancelled: true, reveal: {}, legendOpen: false };
const HIDE: ViewPrefs = { showCancelled: false, reveal: {}, legendOpen: false };

const iso = (date: string, hhmm: string) => `${date}T${hhmm}:00+08:00`;

/** One hourly seat/room row. `h` is the start hour (may be fractional via hhmm override). */
function row(opts: {
  ref: string;
  unit: string;
  kind?: 'seat' | 'room';
  date?: string;
  from: string; // HH:MM
  to: string; // HH:MM
  status?: Booking['status'];
  pax?: number;
  area?: string;
}): Booking {
  const kind = opts.kind ?? (opts.unit.startsWith('R') ? 'room' : 'seat');
  const b = booking({
    ref: opts.ref,
    kind,
    unit: opts.unit,
    area: opts.area ?? (kind === 'room' ? 'Discussion Room' : 'Long Study Space'),
    start: iso(opts.date ?? TODAY, opts.from),
    end: iso(opts.date ?? TODAY, opts.to),
    status: opts.status ?? 'booked',
  });
  if (kind === 'room') b.pax = opts.pax ?? 2;
  if (opts.pax !== undefined) b.pax = opts.pax;
  return b;
}

function snap(personId: string, bookings: Booking[], receivedAt = '2026-10-08T14:10:00+08:00'): Snapshot {
  return { personId, receivedAt, bookings };
}

function makeBoard(
  a: Booking[] | null,
  b: Booking[] | null,
  opts: { aAt?: string; bAt?: string; names?: [string, string] } = {},
): Board {
  const [na, nb] = opts.names ?? ['Alice', 'Bob'];
  return {
    serverNow: NOW,
    people: [
      { id: 'a', name: na },
      { id: 'b', name: nb },
    ],
    snapshots: {
      a: a === null ? null : snap('a', a, opts.aAt),
      b: b === null ? null : snap('b', b, opts.bAt),
    },
  };
}

// ---- tiny html helpers ----------------------------------------------------------------------

function section(html: string, day: 'today' | 'tomorrow'): string {
  const m = html.match(new RegExp(`<section class="day" data-day="${day}"[\\s\\S]*?</section>`));
  if (!m) throw new Error(`no ${day} section in html`);
  return m[0];
}

interface El {
  cls: string[];
  attrs: string;
  inner: string;
  text: string;
}
const textOf = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Timeline block elements (`<div class="blk ...">`; they never nest other divs). */
function blocks(sec: string): El[] {
  return [...sec.matchAll(/<div class="(blk [^"]*)"([^>]*)>([\s\S]*?)<\/div>/g)].map((m) => ({
    cls: m[1]!.split(/\s+/),
    attrs: m[2]!,
    inner: m[3]!,
    text: textOf(m[3]!),
  }));
}
/** Overlap highlight bands in the timeline. */
function bands(sec: string): El[] {
  return [...sec.matchAll(/<div class="(ovl [^"]*)"([^>]*)>([\s\S]*?)<\/div>/g)].map((m) => ({
    cls: m[1]!.split(/\s+/),
    attrs: m[2]!,
    inner: m[3]!,
    text: textOf(m[3]!),
  }));
}
/** Detail list rows. */
function rows(sec: string): El[] {
  return [...sec.matchAll(/<tr class="(item[^"]*)"([^>]*)>([\s\S]*?)<\/tr>/g)].map((m) => ({
    cls: m[1]!.split(/\s+/),
    attrs: m[2]!,
    inner: m[3]!,
    text: textOf(m[3]!),
  }));
}
const attr = (el: El, name: string) => el.attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1];

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

// ---- Requirement: Today and Tomorrow on one page ----------------------------------------------

describe('Today and Tomorrow on one page', () => {
  it('Both days visible: A today and B tomorrow appear in their own day sections and lanes', () => {
    const board = makeBoard(
      [row({ ref: 'A1', unit: 'S101', from: '10:00', to: '11:00' })],
      [row({ ref: 'B1', unit: 'S202', date: TOMORROW, from: '15:00', to: '16:00' })],
    );
    const html = render(board, NOW);
    const today = section(html, 'today');
    const tomorrow = section(html, 'tomorrow');

    expect(html.indexOf('data-day="today"')).toBeLessThan(html.indexOf('data-day="tomorrow"'));
    expect(today).toContain('Today');
    expect(tomorrow).toContain('Tomorrow');

    const todayBlocks = blocks(today);
    expect(todayBlocks).toHaveLength(1);
    expect(attr(todayBlocks[0]!, 'data-person')).toBe('a');
    expect(todayBlocks[0]!.text).toContain('S101');
    expect(today).not.toContain('S202');

    const tomorrowBlocks = blocks(tomorrow);
    expect(tomorrowBlocks).toHaveLength(1);
    expect(attr(tomorrowBlocks[0]!, 'data-person')).toBe('b');
    expect(tomorrowBlocks[0]!.text).toContain('S202');
    expect(tomorrow).not.toContain('S101');
  });

  it('is stacked on one page with no tabs', () => {
    const html = render(makeBoard([], []), NOW);
    expect(html).not.toMatch(/role="tab/);
    expect(html).not.toMatch(/<(button|input|select)\b/);
  });

  it('a day with no bookings shows "No bookings"; a day with bookings does not', () => {
    const board = makeBoard([row({ ref: 'A1', unit: 'S101', from: '10:00', to: '11:00' })], []);
    const html = render(board, NOW);
    expect(section(html, 'today')).not.toContain('No bookings');
    expect(section(html, 'tomorrow')).toContain('No bookings');
    expect(render(makeBoard(null, null), NOW).match(/No bookings/g)).toHaveLength(2);
  });

  it('a day holding only cancelled bookings is not empty', () => {
    const board = makeBoard([row({ ref: 'A1', unit: 'S101', from: '10:00', to: '11:00', status: 'cancelled' })], []);
    expect(section(render(board, NOW), 'today')).not.toContain('No bookings');
  });

  it('bookings outside Today/Tomorrow are not shown', () => {
    const board = makeBoard(
      [
        row({ ref: 'A0', unit: 'S100', date: '2026-10-07', from: '10:00', to: '11:00' }),
        row({ ref: 'A3', unit: 'S103', date: '2026-10-10', from: '10:00', to: '11:00' }),
      ],
      [],
    );
    const html = render(board, NOW);
    expect(html).not.toContain('S100');
    expect(html).not.toContain('S103');
  });

  it('Device in another time zone: 14:00-15:00 SGT is displayed as 14:00-15:00', () => {
    const board = makeBoard([row({ ref: 'A1', unit: 'S101', from: '14:00', to: '15:00' })], []);
    const outputs = ['UTC', 'America/New_York', 'Pacific/Auckland'].map((tz) => {
      process.env.TZ = tz;
      return render(board, NOW);
    });
    for (const html of outputs) {
      expect(rows(section(html, 'today'))[0]!.text).toContain('14:00–15:00');
    }
    expect(outputs[1]).toBe(outputs[0]);
    expect(outputs[2]).toBe(outputs[0]);
  });

  it('shows instants given in UTC as SGT wall-clock time', () => {
    const b = booking({ ref: 'Z1', unit: 'S9', start: '2026-10-08T06:00:00Z', end: '2026-10-08T07:00:00Z' });
    const html = render(makeBoard([b], []), NOW);
    expect(rows(section(html, 'today'))[0]!.text).toContain('14:00–15:00');
  });

  it('Today and Tomorrow are SGT calendar days of nowIso, also when nowIso is expressed in UTC', () => {
    const board = makeBoard(
      [
        row({ ref: 'A1', unit: 'S101', date: '2026-10-09', from: '10:00', to: '11:00' }),
        row({ ref: 'A2', unit: 'S102', date: '2026-10-10', from: '10:00', to: '11:00' }),
        row({ ref: 'A0', unit: 'S100', date: '2026-10-08', from: '10:00', to: '11:00' }),
      ],
      [],
    );
    // 2026-10-08T16:30Z is 00:30 SGT on the 9th: Today = 9th, Tomorrow = 10th.
    const html = render(board, '2026-10-08T16:30:00Z');
    expect(section(html, 'today')).toContain('S101');
    expect(section(html, 'tomorrow')).toContain('S102');
    expect(html).not.toContain('S100');
  });
});

// ---- Requirement: Consecutive hourly slots shown as one block ----------------------------------

describe('Consecutive hourly slots shown as one block', () => {
  const four = [11, 12, 13, 14].map((h) =>
    row({ ref: `H${h}`, unit: 'S201', from: `${h}:00`.padStart(5, '0'), to: `${h + 1}:00`.padStart(5, '0') }),
  );

  it('Four hourly rows: timeline and list each show a single 11:00-15:00 S201 block', () => {
    const sec = section(render(makeBoard(four, []), NOW), 'today');
    const bl = blocks(sec);
    expect(bl).toHaveLength(1);
    expect(bl[0]!.cls).toContain('s-1100');
    expect(bl[0]!.cls).toContain('d-8');
    expect(bl[0]!.text).toContain('S201');
    const ls = rows(sec);
    expect(ls).toHaveLength(1);
    expect(ls[0]!.text).toContain('11:00–15:00');
  });

  it('a gap breaks the block', () => {
    const gapped = [four[0]!, four[1]!, four[3]!];
    const sec = section(render(makeBoard(gapped, []), NOW), 'today');
    expect(blocks(sec)).toHaveLength(2);
    expect(rows(sec)).toHaveLength(2);
  });
});

// ---- Requirement: Rooms are shared --------------------------------------------------------------

describe('Rooms are shared', () => {
  const roomA = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00', pax: 4 });

  it('Room spans lanes: the 12-13 room is drawn once, straddling both lanes, marked as booked by A', () => {
    const sec = section(render(makeBoard([roomA], []), NOW), 'today');
    const bl = blocks(sec);
    expect(bl).toHaveLength(1);
    const b = bl[0]!;
    expect(b.cls).toContain('s-1200');
    expect(b.cls).toContain('d-2');
    expect(b.cls).toContain('k-room');
    // compact in the timeline; the full wording (who booked it) stays in the title and the list
    expect(b.text).toContain('R3 · Alice · 4 pax');
    expect(b.text).not.toContain('booked by');
    expect(attr(b, 'title')).toContain('R3 · booked by Alice · 4 pax');
    // A's inner row (row 2, just above the centre) and B's inner row (row 3): row 2, spanning 2
    expect(b.cls).toContain('r-2');
    expect(b.cls).toContain('h-2');
    expect(attr(b, 'data-lane')).toBe('span');
    expect(attr(b, 'data-person')).toBe('a');
    const listRow = rows(sec)[0]!;
    expect(listRow.text).toContain('Alice');
    expect(listRow.text).toContain('Room R3 · 4 pax');
    expect(rows(sec)).toHaveLength(1);
  });

  it('a room with unknown pax omits the pax from its label', () => {
    const r = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00' });
    delete r.pax;
    const bl = blocks(section(render(makeBoard([r], []), NOW), 'today'));
    expect(bl[0]!.text).toContain('R3 · Alice');
    expect(bl[0]!.text).not.toContain('pax');
    expect(attr(bl[0]!, 'title')).toContain('R3 · booked by Alice');
  });

  it('the booker is named correctly when the partner books the room', () => {
    const r = row({ ref: 'RB', unit: 'R5', from: '09:00', to: '10:00', pax: 3 });
    const bl = blocks(section(render(makeBoard([], [r]), NOW), 'today'));
    expect(bl).toHaveLength(1);
    expect(bl[0]!.text).toContain('R5 · Bob · 3 pax');
    expect(attr(bl[0]!, 'data-person')).toBe('b');
  });});

// ---- Requirement: Cancelled bookings -------------------------------------------------------------

describe('Cancelled bookings', () => {
  it('Cancelled seat: shown struck through, and no overlap involving it is flagged', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'B1', unit: 'S201', from: '13:00', to: '14:00', status: 'cancelled' });
    const sec = section(render(makeBoard([room], [seat]), NOW, SHOW), 'today');

    const seatBlock = blocks(sec).find((b) => b.text.includes('S201'))!;
    expect(seatBlock.cls).toContain('st-cancelled');
    const seatRow = rows(sec).find((r) => r.text.includes('S201'))!;
    expect(seatRow.cls).toContain('st-cancelled');
    expect(seatRow.text).toContain('Cancelled');

    expect(bands(sec)).toHaveLength(0);
    expect(sec).not.toContain('possibly redundant');
    expect(sec).not.toContain('duplicate room');
  });

  it('a cancelled room does not produce a duplicate-room badge', () => {
    const live = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00' });
    const dead = row({ ref: 'RB', unit: 'R4', from: '12:00', to: '13:00', status: 'cancelled' });
    const sec = section(render(makeBoard([live], [dead]), NOW, SHOW), 'today');
    expect(sec).not.toContain('duplicate room');
    expect(bands(sec)).toHaveLength(0);
    expect(blocks(sec).some((b) => b.cls.includes('st-cancelled'))).toBe(true);
  });

  it('non-cancelled blocks are not struck through', () => {
    const sec = section(render(makeBoard([row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00' })], []), NOW), 'today');
    expect(sec).not.toContain('st-cancelled');
  });
});

// ---- No-show and NLB notes -----------------------------------------------------------------------

const NOTE_CANCELLED = 'Cancelled';
const NOTE_PARTIAL = 'Partially cancelled';
const NOTE_NO_SHOW = 'This booking has been cancelled as you did not check-in, 1 hour has been deducted from your daily quota.';
const notesCell = (r: El) => r.inner.match(/<td class="c-notes"[^>]*>([\s\S]*?)<\/td>/)![1]!;

describe('NLB notes in the detail list', () => {
  const listRow = (status: Booking['status'], extra: Booking[] = []) => {
    const own = row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00', status });
    return rows(section(render(makeBoard([own], extra), NOW, SHOW), 'today'))[0]!;
  };

  it.each([
    ['cancelled', NOTE_CANCELLED],
    ['partial_cancelled', NOTE_PARTIAL],
    ['no_show', NOTE_NO_SHOW],
  ] as const)('%s shows NLB\'s exact wording, wrapped in .nlb-note', (status, note) => {
    expect(notesCell(listRow(status))).toBe(`<span class="nlb-note">${note}</span>`);
  });

  it.each(['booked', 'checked_in'] as const)('%s has an empty Notes cell', (status) => {
    expect(notesCell(listRow(status))).toBe('');
  });

  it('a stale booked row shows only the unverified badge (no note)', () => {
    const own = row({ ref: 'A1', unit: 'S1', from: '14:00', to: '15:00' }); // 14:15 deadline passed, pushed 14:10
    const cell = notesCell(rows(section(render(makeBoard([own], []), NOW), 'today'))[0]!);
    expect(cell).toBe('<span class="badge b-unverified">unverified</span>');
  });

  it('the note comes first, then the badge, joined by a space', () => {
    const mine = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00', status: 'partial_cancelled' });
    const theirs = row({ ref: 'RB', unit: 'R5', from: '12:00', to: '13:00' });
    const r = rows(section(render(makeBoard([mine], [theirs]), NOW), 'today')).find((x) => x.text.includes('Alice'))!;
    const cell = notesCell(r);
    expect(cell).toBe(`<span class="nlb-note">${NOTE_PARTIAL}</span> <span class="badge b-duplicate">duplicate room</span>`);
    expect(cell.indexOf('nlb-note')).toBeLessThan(cell.indexOf('badge'));
  });

  it('the note is HTML-escaped (via the class wrapper) and carries no markup of its own', () => {
    const cell = notesCell(listRow('no_show'));
    expect(cell).toMatch(/^<span class="nlb-note">[^<>]*<\/span>$/);
  });

  it('the timeline block carries no note text; the title has the status label', () => {
    const own = row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00', status: 'no_show' });
    const b = blocks(section(render(makeBoard([own], []), NOW), 'today'))[0]!;
    expect(b.text).toBe('S1');
    expect(b.inner).not.toContain('nlb-note');
    expect(attr(b, 'title')).toContain('No-show (auto-cancelled)');
  });
});

describe('No-show bookings', () => {
  it('get st-no-show on the block and on the list row, and data-status', () => {
    const own = row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00', status: 'no_show' });
    const sec = section(render(makeBoard([own], []), NOW), 'today');
    const b = blocks(sec)[0]!;
    expect(b.cls).toContain('st-no-show');
    expect(attr(b, 'data-status')).toBe('no_show');
    expect(rows(sec)[0]!.cls).toContain('st-no-show');
    expect(rows(sec)[0]!.text).toContain('No-show (auto-cancelled)');
    expect(sec).not.toContain('st-cancelled');
  });

  it('a no_show seat inside the partner\'s room gets no "possibly redundant" badge and no overlap band', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'B1', unit: 'S201', from: '13:00', to: '14:00', status: 'no_show' });
    const sec = section(render(makeBoard([room], [seat]), NOW), 'today');
    expect(bands(sec)).toHaveLength(0);
    expect(sec).not.toContain('possibly redundant');
  });

  it('a no_show room gives no duplicate-room badge or band', () => {
    const live = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00' });
    const dead = row({ ref: 'RB', unit: 'R4', from: '12:00', to: '13:00', status: 'no_show' });
    const sec = section(render(makeBoard([live], [dead]), NOW), 'today');
    expect(bands(sec)).toHaveLength(0);
    expect(sec).not.toContain('duplicate room');
  });

  it('a partial_cancelled seat inside the partner\'s room DOES get the badge (still no band)', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'B1', unit: 'S201', from: '13:00', to: '14:00', status: 'partial_cancelled' });
    const sec = section(render(makeBoard([room], [seat]), NOW), 'today');
    expect(bands(sec)).toHaveLength(0);
    expect(blocks(sec).find((b) => b.text.includes('S201'))!.text).toContain('possibly redundant');
    expect(rows(sec).find((r) => r.text.includes('S201'))!.text).toContain('possibly redundant');
  });

  it('a no_show hour next to a booked hour of the same seat stays a separate block', () => {
    const a = row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00', status: 'no_show' });
    const b = row({ ref: 'A2', unit: 'S1', from: '11:00', to: '12:00' });
    const bl = blocks(section(render(makeBoard([a, b], []), NOW), 'today'));
    expect(bl.map((x) => x.cls.includes('st-no-show'))).toEqual([true, false]);
  });
});

// ---- "Show cancelled" (ViewPrefs) ----------------------------------------------------------------

const cnt = (sec: string) => [...sec.matchAll(/<button type="button" class="cnt"([^>]*)>([^<]*)<\/button>/g)].map((m) => ({ attrs: m[1]!, text: m[2]! }));
const laneHds = (sec: string) => [...sec.matchAll(/<div class="(lane-hd [^"]*)"/g)].map((m) => m[1]!.split(/\s+/));
const hourHeaders = (sec: string) => (sec.match(/<div class="hd /g) ?? []).length;
const cancelledSeat = (ref: string, unit: string, from: string, to: string, date = TODAY) =>
  row({ ref, unit, from, to, status: 'cancelled', date });

describe('Show cancelled: default (hidden)', () => {
  const alice = [row({ ref: 'A1', unit: 'S1', from: '09:00', to: '10:00' }), cancelledSeat('A2', 'S2', '11:00', '12:00')];

  it('default prefs hide cancelled blocks in the timeline and the list', () => {
    const sec = section(render(makeBoard(alice, []), NOW), 'today');
    expect(blocks(sec).map((b) => attr(b, 'data-unit'))).toEqual(['S1']);
    expect(rows(sec)).toHaveLength(1);
    expect(sec).not.toContain('st-cancelled');
    expect(render(makeBoard(alice, []), NOW)).toBe(render(makeBoard(alice, []), NOW, HIDE));
  });

  it('hides a cancelled room, and shows it once', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00', status: 'cancelled' });
    const sec = section(render(makeBoard([room], []), NOW, HIDE), 'today');
    expect(blocks(sec)).toHaveLength(0);
    const shown = section(render(makeBoard([room], []), NOW, SHOW), 'today');
    expect(blocks(shown)).toHaveLength(1);
    expect(blocks(shown)[0]!.cls).toContain('h-2');
  });

  it('shows a "N cancelled hidden" button that offers to reveal', () => {
    const sec = section(render(makeBoard(alice, []), NOW), 'today');
    expect(cnt(sec)).toEqual([{ attrs: ' data-date="2026-10-08" data-reveal="1"', text: '· 1 cancelled hidden' }]);
    expect(sec).toMatch(/<h2>Today <span class="date">[^<]*<\/span> <button type="button" class="cnt"/);
  });

  it('no_show and partial_cancelled stay visible under default prefs', () => {
    const rowsIn = [
      row({ ref: 'N', unit: 'S1', from: '09:00', to: '10:00', status: 'no_show' }),
      row({ ref: 'P', unit: 'S2', from: '11:00', to: '12:00', status: 'partial_cancelled' }),
    ];
    const sec = section(render(makeBoard(rowsIn, []), NOW), 'today');
    expect(blocks(sec).map((b) => attr(b, 'data-status'))).toEqual(['no_show', 'partial_cancelled']);
    expect(rows(sec)).toHaveLength(2);
    expect(cnt(sec)).toEqual([]);
  });

  it('no button when the day has no cancelled blocks (also with showCancelled on)', () => {
    const only = [row({ ref: 'A1', unit: 'S1', from: '09:00', to: '10:00' })];
    expect(cnt(section(render(makeBoard(only, []), NOW), 'today'))).toEqual([]);
    expect(cnt(section(render(makeBoard(only, []), NOW, SHOW), 'today'))).toEqual([]);
    expect(cnt(section(render(makeBoard(null, null), NOW, SHOW), 'tomorrow'))).toEqual([]);
  });
});

describe('Show cancelled: shown', () => {
  const alice = [row({ ref: 'A1', unit: 'S1', from: '09:00', to: '10:00' }), cancelledSeat('A2', 'S2', '11:00', '12:00')];

  it('showCancelled: true shows them and offers "Hide N cancelled"', () => {
    const sec = section(render(makeBoard(alice, []), NOW, SHOW), 'today');
    expect(blocks(sec)).toHaveLength(2);
    expect(rows(sec)).toHaveLength(2);
    expect(blocks(sec).some((b) => b.cls.includes('st-cancelled'))).toBe(true);
    expect(cnt(sec)).toEqual([{ attrs: ' data-date="2026-10-08" data-reveal="0"', text: '· Hide 1 cancelled' }]);
  });

  it('the checkbox default applies to both days', () => {
    const tmr = cancelledSeat('A3', 'S3', '09:00', '10:00', TOMORROW);
    const html = render(makeBoard([...alice, tmr], []), NOW, SHOW);
    for (const d of ['today', 'tomorrow'] as const) expect(cnt(section(html, d))[0]!.text).toMatch(/^· Hide 1 cancelled$/);
  });
});

describe('Show cancelled: per-day reveal', () => {
  const both = [cancelledSeat('A1', 'S1', '09:00', '10:00'), cancelledSeat('A2', 'S2', '09:00', '10:00', TOMORROW)];
  const prefs = (showCancelled: boolean, reveal: Record<string, boolean>): ViewPrefs => ({ showCancelled, reveal, legendOpen: false });
  const shown = (html: string, d: 'today' | 'tomorrow') => blocks(section(html, d)).length;

  it('revealing Today leaves Tomorrow hidden', () => {
    const html = render(makeBoard(both, []), NOW, prefs(false, { [TODAY]: true }));
    expect(shown(html, 'today')).toBe(1);
    expect(shown(html, 'tomorrow')).toBe(0);
    expect(cnt(section(html, 'today'))[0]!.text).toBe('· Hide 1 cancelled');
    expect(cnt(section(html, 'tomorrow'))[0]!.text).toBe('· 1 cancelled hidden');
  });

  it('revealing Tomorrow leaves Today hidden', () => {
    const html = render(makeBoard(both, []), NOW, prefs(false, { [TOMORROW]: true }));
    expect(shown(html, 'today')).toBe(0);
    expect(shown(html, 'tomorrow')).toBe(1);
  });

  it('reveal false overrides showCancelled true, for that date only', () => {
    const html = render(makeBoard(both, []), NOW, prefs(true, { [TODAY]: false }));
    expect(shown(html, 'today')).toBe(0);
    expect(shown(html, 'tomorrow')).toBe(1);
    expect(cnt(section(html, 'today'))[0]).toMatchObject({ attrs: ' data-date="2026-10-08" data-reveal="1"', text: '· 1 cancelled hidden' });
  });

  it('reveal true agrees with showCancelled true; reveal for other dates is ignored', () => {
    expect(render(makeBoard(both, []), NOW, prefs(true, { [TODAY]: true }))).toBe(render(makeBoard(both, []), NOW, SHOW));
    expect(render(makeBoard(both, []), NOW, prefs(false, { '2030-01-01': true }))).toBe(render(makeBoard(both, []), NOW, HIDE));
  });

  it('is keyed by calendar date, so it follows the date across midnight rollover', () => {
    const p = prefs(false, { [TOMORROW]: true });
    const before = render(makeBoard(both, []), NOW, p); // Tomorrow = 10-09 revealed
    const after = render(makeBoard(both, []), '2026-10-09T00:05:00+08:00', p); // 10-09 is now "Today"
    expect(shown(before, 'tomorrow')).toBe(1);
    expect(shown(after, 'today')).toBe(1);
    expect(section(after, 'today')).toContain('data-date="2026-10-09"');
  });
});

describe('Show cancelled: counting', () => {
  it('N counts merged blocks: 3 hourly cancelled rows are 1', () => {
    const hrs = [
      cancelledSeat('H1', 'S1', '09:00', '10:00'),
      cancelledSeat('H2', 'S1', '10:00', '11:00'),
      cancelledSeat('H3', 'S1', '11:00', '12:00'),
    ];
    const sec = section(render(makeBoard(hrs, []), NOW), 'today');
    expect(cnt(sec).map((c) => c.text)).toEqual(['· 1 cancelled hidden']);
    expect(blocks(section(render(makeBoard(hrs, []), NOW, SHOW), 'today'))).toHaveLength(1);
  });

  it('separate cancelled blocks (a gap, different units, different people) each count once', () => {
    const a = [cancelledSeat('A1', 'S1', '09:00', '10:00'), cancelledSeat('A2', 'S1', '11:00', '12:00')];
    const b = [cancelledSeat('B1', 'S2', '09:00', '10:00')];
    expect(cnt(section(render(makeBoard(a, b), NOW), 'today'))[0]!.text).toBe('· 3 cancelled hidden');
  });

  it('a cancelled room counts once', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00', status: 'cancelled' });
    expect(cnt(section(render(makeBoard([room], []), NOW), 'today'))[0]!.text).toBe('· 1 cancelled hidden');
    expect(cnt(section(render(makeBoard([room], []), NOW, SHOW), 'today'))[0]!.text).toBe('· Hide 1 cancelled');
  });

  it('counts per day, and cancelled outside 08:00-22:00 still count', () => {
    const rowsIn = [cancelledSeat('A1', 'S1', '06:00', '07:00'), cancelledSeat('A2', 'S2', '09:00', '10:00', TOMORROW)];
    const html = render(makeBoard(rowsIn, []), NOW);
    expect(cnt(section(html, 'today'))[0]!.text).toBe('· 1 cancelled hidden');
    expect(cnt(section(html, 'tomorrow'))[0]!.text).toBe('· 1 cancelled hidden');
  });

  it('data-date is the day\'s calendar date', () => {
    const html = render(makeBoard([cancelledSeat('A1', 'S1', '09:00', '10:00', TOMORROW)], []), NOW);
    expect(cnt(section(html, 'tomorrow'))[0]!.attrs).toContain('data-date="2026-10-09"');
    expect(cnt(section(html, 'today'))).toEqual([]);
  });
});

describe('Show cancelled: empty states and timeline', () => {
  const onlyCancelled = [cancelledSeat('A1', 'S1', '09:00', '10:00')];

  it('"No active bookings" when only hidden cancelled blocks remain; "No bookings" when the day is empty', () => {
    const hidden = section(render(makeBoard(onlyCancelled, []), NOW), 'today');
    expect(hidden).toContain('<p class="empty">No active bookings</p>');
    expect(hidden).not.toContain('<table');
    const empty = section(render(makeBoard([], []), NOW), 'tomorrow');
    expect(empty).toContain('<p class="empty">No bookings</p>');
    expect(empty).not.toContain('No active bookings');
  });

  it('shown again, the list replaces the empty text', () => {
    const sec = section(render(makeBoard(onlyCancelled, []), NOW, SHOW), 'today');
    expect(sec).not.toContain('class="empty"');
    expect(rows(sec)).toHaveLength(1);
  });

  it('the hour header and both lanes are drawn in every case', () => {
    for (const html of [
      render(makeBoard(onlyCancelled, []), NOW), // only hidden cancelled
      render(makeBoard([], []), NOW), // nothing at all
      render(makeBoard(null, null), NOW), // never pushed
      render(makeBoard(onlyCancelled, []), NOW, SHOW),
    ]) {
      for (const d of ['today', 'tomorrow'] as const) {
        const sec = section(html, d);
        expect(hourHeaders(sec)).toBe(14);
        expect(laneHds(sec)).toHaveLength(2);
        expect(sec).toContain('class="tl-scroll"');
      }
    }
  });

  it('hidden blocks free their track: a lane goes from 2 tracks back to 1', () => {
    const rowsIn = [row({ ref: 'A1', unit: 'S1', from: '10:00', to: '12:00' }), cancelledSeat('A2', 'S2', '10:00', '11:00')];
    const shownLanes = laneHds(section(render(makeBoard(rowsIn, [row({ ref: 'B1', unit: 'S9', from: '10:00', to: '11:00' })]), NOW, SHOW), 'today'));
    const hiddenLanes = laneHds(section(render(makeBoard(rowsIn, [row({ ref: 'B1', unit: 'S9', from: '10:00', to: '11:00' })]), NOW), 'today'));
    expect(shownLanes[0]).toContain('h-2');
    expect(shownLanes[1]).toContain('r-4'); // Bob's lane starts below Alice's two tracks
    expect(hiddenLanes[0]).toContain('h-1');
    expect(hiddenLanes[1]).toContain('r-3');
  });

  it("a cancelled room never pushes the partner's seat outward; an active room does", () => {
    const bob = [row({ ref: 'B1', unit: 'S9', from: '10:00', to: '11:00' })];
    const cancelledRoom = row({ ref: 'RA', unit: 'R3', from: '10:00', to: '12:00', status: 'cancelled' });
    const activeRoom = row({ ref: 'RA', unit: 'R3', from: '10:00', to: '12:00' });
    const cancelledLanes = laneHds(section(render(makeBoard([cancelledRoom], bob), NOW, SHOW), 'today'));
    expect(cancelledLanes[1]).toContain('h-1'); // the seat took Bob's track 0 first; the room sits in Alice's lane
    const hiddenLanes = laneHds(section(render(makeBoard([cancelledRoom], bob), NOW), 'today'));
    expect(hiddenLanes[1]).toContain('h-1');
    const activeLanes = laneHds(section(render(makeBoard([activeRoom], bob), NOW), 'today'));
    expect(activeLanes[1]).toContain('h-2'); // the spanning room holds Bob's track 0
  });

  it('the outside-hours note counts visible blocks only', () => {
    const early = cancelledSeat('A1', 'S1', '06:00', '07:00');
    const early2 = row({ ref: 'A2', unit: 'S2', from: '06:00', to: '07:00' });
    expect(section(render(makeBoard([early], []), NOW), 'today')).not.toContain('outside 08:00');
    expect(section(render(makeBoard([early], []), NOW, SHOW), 'today')).toContain('1 booking outside 08:00');
    expect(section(render(makeBoard([early, early2], []), NOW), 'today')).toContain('1 booking outside 08:00');
    expect(section(render(makeBoard([early, early2], []), NOW, SHOW), 'today')).toContain('2 bookings outside 08:00');
  });

  it('the duplicate-room band is unchanged by the preference', () => {
    const a = [row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' })];
    const b = [row({ ref: 'RB', unit: 'R5', from: '13:00', to: '15:00' }), cancelledSeat('B2', 'S5', '12:00', '13:00')];
    expect(bands(section(render(makeBoard(a, b), NOW), 'today'))).toHaveLength(1);
    expect(bands(section(render(makeBoard(a, b), NOW, SHOW), 'today'))).toHaveLength(1);
  });

  it('is pure: same inputs, same output', () => {
    const board = makeBoard(onlyCancelled, []);
    const p: ViewPrefs = { showCancelled: false, reveal: { [TODAY]: true }, legendOpen: false };
    expect(render(board, NOW, p)).toBe(render(board, NOW, p));
    expect(p).toEqual({ showCancelled: false, reveal: { [TODAY]: true }, legendOpen: false });
  });
});

// ---- Requirement: Overlap badges -----------------------------------------------------------------

describe('Overlap badges', () => {
  it('Seat inside partner room: no band, and B\'s seat is marked possibly redundant', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'B1', unit: 'S201', from: '13:00', to: '14:00' });
    const sec = section(render(makeBoard([room], [seat]), NOW), 'today');

    expect(bands(sec)).toHaveLength(0); // no band for a seat in a room: the badge says it

    const seatBlock = blocks(sec).find((b) => b.text.includes('S201'))!;
    expect(seatBlock.text).toContain('possibly redundant');
    for (const rb of blocks(sec).filter((b) => b.cls.includes('k-room'))) {
      expect(rb.text).not.toContain('possibly redundant');
    }
    const seatRow = rows(sec).find((r) => r.text.includes('S201'))!;
    expect(seatRow.text).toContain('possibly redundant');
    expect(rows(sec).find((r) => r.text.includes('R3'))!.text).not.toContain('possibly redundant');
  });

  it('the seat-in-room badge is symmetric in who holds which', () => {
    const room = row({ ref: 'RB', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'A1', unit: 'S201', from: '13:00', to: '14:00' });
    const sec = section(render(makeBoard([seat], [room]), NOW), 'today');
    expect(blocks(sec).find((b) => b.text.includes('S201'))!.text).toContain('possibly redundant');
  });

  it('only the seat block that intersects the room is marked, not another block of the same seat', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00' });
    const early = row({ ref: 'B1', unit: 'S201', from: '12:00', to: '13:00' });
    const late = row({ ref: 'B2', unit: 'S201', from: '16:00', to: '17:00' });
    const sec = section(render(makeBoard([room], [early, late]), NOW), 'today');
    const s201 = blocks(sec).filter((b) => b.text.includes('S201'));
    expect(s201).toHaveLength(2);
    expect(s201.filter((b) => b.text.includes('possibly redundant'))).toHaveLength(1);
    expect(s201.find((b) => b.cls.includes('s-1200'))!.text).toContain('possibly redundant');
  });

  it('Both booked a room: 12-13 is flagged and both rooms are marked "duplicate room"', () => {
    const ra = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00' });
    const rb = row({ ref: 'RB', unit: 'R5', from: '12:00', to: '13:00' });
    const sec = section(render(makeBoard([ra], [rb]), NOW), 'today');

    const bd = bands(sec);
    expect(bd).toHaveLength(1);
    expect(bd[0]!.cls).toEqual(expect.arrayContaining(['ovl', 'ovl-room', 's-1200', 'd-2', 'r-2', 'h-2'])); // full timeline height (two lane rows)
    expect(sec.match(/class="ovl /g)).toHaveLength(1);

    const real = blocks(sec);
    expect(real).toHaveLength(2);
    for (const b of real) expect(b.text).toContain('duplicate room');
    const lr = rows(sec);
    expect(lr).toHaveLength(2);
    for (const r of lr) expect(r.text).toContain('duplicate room');
    expect(sec).not.toContain('possibly redundant');
  });

  it('Touching bookings: seat 10-11 and seat 11-12 are not flagged', () => {
    const a = row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00' });
    const b = row({ ref: 'B1', unit: 'S2', from: '11:00', to: '12:00' });
    const sec = section(render(makeBoard([a], [b]), NOW), 'today');
    expect(bands(sec)).toHaveLength(0);
    expect(sec).not.toContain('possibly redundant');
    expect(sec).not.toContain('duplicate room');
  });

  it('two overlapping seats: no band and no room-specific badges', () => {
    const a = row({ ref: 'A1', unit: 'S1', from: '10:00', to: '12:00' });
    const b = row({ ref: 'B1', unit: 'S2', from: '11:00', to: '13:00' });
    const sec = section(render(makeBoard([a], [b]), NOW), 'today');
    expect(bands(sec)).toHaveLength(0);
    expect(sec).not.toContain('possibly redundant');
    expect(sec).not.toContain('duplicate room');
  });

  it('a person never overlaps themself', () => {
    const a1 = row({ ref: 'A1', unit: 'S1', from: '10:00', to: '12:00' });
    const a2 = row({ ref: 'A2', unit: 'R3', from: '11:00', to: '13:00' });
    expect(bands(section(render(makeBoard([a1, a2], []), NOW), 'today'))).toHaveLength(0);
  });
});

// ---- Requirement: Freshness indicators -----------------------------------------------------------

describe('Freshness indicators', () => {
  const unverifiedIn = (el: El[]) => el.filter((e) => e.text.includes('unverified'));

  it('lane headers show "pushed HH:MM (X min ago)" or "never pushed"', () => {
    const board = makeBoard([], null, { aAt: '2026-10-08T13:50:00+08:00' });
    const html = render(board, NOW);
    expect(html).toContain('pushed 13:50 (25 min ago)');
    expect(html).toContain('never pushed');
    // once per day section, for the pushed person
    expect(section(html, 'today')).toContain('pushed 13:50 (25 min ago)');
    expect(section(html, 'tomorrow')).toContain('pushed 13:50 (25 min ago)');
    expect(section(html, 'today')).toContain('never pushed');
  });

  it('shows the lane header name next to its freshness', () => {
    const html = render(makeBoard([], null, { aAt: '2026-10-08T13:50:00+08:00' }), NOW);
    expect(html).toMatch(/Alice[\s\S]{0,200}pushed 13:50/);
    expect(html).toMatch(/Bob[\s\S]{0,200}never pushed/);
  });

  it('Deadline passed without a newer push: booking at 14:00, push 13:50, now 14:15 shows "unverified"', () => {
    const b = row({ ref: 'A1', unit: 'S1', from: '14:00', to: '15:00' });
    const sec = section(render(makeBoard([b], [], { aAt: '2026-10-08T13:50:00+08:00' }), '2026-10-08T14:15:00+08:00'), 'today');
    expect(unverifiedIn(blocks(sec))).toHaveLength(1);
    expect(unverifiedIn(rows(sec))).toHaveLength(1);
  });

  it('is not unverified before the check-in deadline (14:14)', () => {
    const b = row({ ref: 'A1', unit: 'S1', from: '14:00', to: '15:00' });
    const sec = section(render(makeBoard([b], [], { aAt: '2026-10-08T13:50:00+08:00' }), '2026-10-08T14:14:00+08:00'), 'today');
    expect(sec).not.toContain('unverified');
  });

  it('Pushed after deadline: a push at 14:20 clears "unverified"', () => {
    const b = row({ ref: 'A1', unit: 'S1', from: '14:00', to: '15:00' });
    const sec = section(render(makeBoard([b], [], { aAt: '2026-10-08T14:20:00+08:00' }), '2026-10-08T14:25:00+08:00'), 'today');
    expect(sec).not.toContain('unverified');
  });

  it('Checked in: a checked-in booking never shows "unverified"', () => {
    const b = row({ ref: 'A1', unit: 'S1', from: '14:00', to: '15:00', status: 'checked_in' });
    const sec = section(render(makeBoard([b], [], { aAt: '2026-10-08T13:50:00+08:00' }), '2026-10-08T14:15:00+08:00'), 'today');
    expect(sec).not.toContain('unverified');
  });

  it('a cancelled booking never shows "unverified"', () => {
    const b = row({ ref: 'A1', unit: 'S1', from: '14:00', to: '15:00', status: 'cancelled' });
    const sec = section(render(makeBoard([b], [], { aAt: '2026-10-08T13:50:00+08:00' }), '2026-10-08T14:15:00+08:00'), 'today');
    expect(sec).not.toContain('unverified');
  });

  it('a merged block is unverified if any of its refs is', () => {
    const rowsA = [
      row({ ref: 'A1', unit: 'S1', from: '13:00', to: '14:00' }),
      row({ ref: 'A2', unit: 'S1', from: '14:00', to: '15:00' }),
    ];
    // push at 13:50: A1 deadline 13:15 passed before the push (verified); A2 deadline 14:15 passed after it
    const sec = section(render(makeBoard(rowsA, [], { aAt: '2026-10-08T13:50:00+08:00' }), '2026-10-08T14:20:00+08:00'), 'today');
    expect(blocks(sec)).toHaveLength(1);
    expect(unverifiedIn(blocks(sec))).toHaveLength(1);
  });

  it('the badge is on the single room block', () => {
    const r = row({ ref: 'RA', unit: 'R3', from: '14:00', to: '15:00' });
    const sec = section(render(makeBoard([r], [], { aAt: '2026-10-08T13:50:00+08:00' }), '2026-10-08T14:15:00+08:00'), 'today');
    expect(unverifiedIn(blocks(sec))).toHaveLength(1);
  });
});

// ---- Timeline positioning --------------------------------------------------------------------------

describe('Timeline positioning', () => {
  const one = (r: Booking) => blocks(section(render(makeBoard([r], []), NOW), 'today'))[0]!;

  it('supports half-hour granularity', () => {
    const b = one(row({ ref: 'A1', unit: 'S1', from: '10:30', to: '11:30' }));
    expect(b.cls).toContain('s-1030');
    expect(b.cls).toContain('d-2');
    const c = one(row({ ref: 'A2', unit: 'S1', from: '09:00', to: '09:30' }));
    expect(c.cls).toContain('s-0900');
    expect(c.cls).toContain('d-1');
  });

  it('clamps to the 08:00-22:00 grid', () => {
    const late = one(row({ ref: 'A1', unit: 'S1', from: '21:00', to: '23:00' }));
    expect(late.cls).toContain('s-2100');
    expect(late.cls).toContain('d-2');
    const early = one(row({ ref: 'A2', unit: 'S1', from: '07:00', to: '09:00' }));
    expect(early.cls).toContain('s-0800');
    expect(early.cls).toContain('d-2');
  });

  it('a block entirely outside the grid is only in the list, with a note', () => {
    const sec = section(render(makeBoard([row({ ref: 'A1', unit: 'S1', from: '06:00', to: '07:00' })], []), NOW), 'today');
    expect(blocks(sec)).toHaveLength(0);
    expect(rows(sec)).toHaveLength(1);
    expect(sec).toContain('outside 08:00–22:00');
    expect(sec).not.toContain('No bookings');
  });

  it('draws an hour grid from 08:00 to 22:00', () => {
    const sec = section(render(makeBoard([], []), NOW), 'today');
    for (const h of ['08:00', '09:00', '15:00', '21:00']) expect(sec).toContain(h);
    expect(sec.match(/class="hd /g)).toHaveLength(14);
  });

  it("stacks a person's simultaneous blocks on separate tracks", () => {
    const seat = row({ ref: 'A1', unit: 'S1', from: '12:00', to: '13:00' });
    const room = row({ ref: 'A2', unit: 'R3', from: '12:00', to: '13:00' });
    const bl = blocks(section(render(makeBoard([seat, room], []), NOW), 'today'));
    expect(bl).toHaveLength(2);
    const r = (b: El) => b.cls.find((c) => /^r-\d+$/.test(c));
    expect(r(bl[0]!)).not.toBe(r(bl[1]!));
  });});

// ---- Detail list ------------------------------------------------------------------------------------

describe('Detail list', () => {
  it('has time range, who, library · area · floor, seat or room with pax, status', () => {
    const seat = row({ ref: 'A1', unit: 'S201', from: '10:00', to: '12:00' });
    const room = row({ ref: 'B1', unit: 'R3', from: '15:00', to: '16:00', pax: 5 });
    const sec = section(render(makeBoard([seat], [room]), NOW), 'today');
    const ls = rows(sec);
    expect(ls).toHaveLength(2);
    expect(ls[0]!.text).toContain('10:00–12:00');
    expect(ls[0]!.text).toContain('Alice');
    expect(ls[0]!.text).toContain('Test Library · Long Study Space · Floor 4');
    expect(ls[0]!.text).toContain('Seat S201');
    expect(ls[0]!.text).toContain('Booked');
    expect(ls[1]!.text).toContain('15:00–16:00');
    expect(ls[1]!.text).toContain('Bob');
    expect(ls[1]!.text).toContain('Room R3 · 5 pax');
  });

  it('is sorted by start time, whoever booked', () => {
    const a = row({ ref: 'A1', unit: 'S1', from: '15:00', to: '16:00' });
    const b = row({ ref: 'B1', unit: 'S2', from: '09:00', to: '10:00' });
    const ls = rows(section(render(makeBoard([a], [b]), NOW), 'today'));
    expect(ls[0]!.text).toContain('09:00');
    expect(ls[1]!.text).toContain('15:00');
  });

  it('labels each status', () => {
    const labels: Array<[Booking['status'], string]> = [
      ['checked_in', 'Checked in'],
      ['partial_cancelled', 'Partly cancelled'],
      ['cancelled', 'Cancelled'],
      ['no_show', 'No-show (auto-cancelled)'],
      ['booked', 'Booked'],
    ];
    for (const [status, label] of labels) {
      const html = render(makeBoard([row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00', status })], []), NOW, SHOW);
      expect(rows(section(html, 'today'))[0]!.text).toContain(label);
    }
  });
});

// ---- Centre layout, rooms, labels --------------------------------------------------------------------

const cls = (el: El, re: RegExp) => el.cls.find((c) => re.test(c));
const rowOf = (el: El) => Number(cls(el, /^r-\d+$/)!.slice(2));
const spanOf = (el: El) => Number(cls(el, /^h-\d+$/)!.slice(2));
const laneBgs = (sec: string) => [...sec.matchAll(/<div class="(lane-bg [^"]*)"/g)].map((m) => m[1]!.split(/\s+/));

describe('Centre layout (two people)', () => {
  const room = (who: 'a' | 'b', from = '12:00', to = '14:00', unit = 'R3') => row({ ref: `R${who}${unit}`, unit, from, to });
  const seat = (unit: string, from = '13:00', to = '14:00') => row({ ref: 'S' + unit, unit, from, to });
  const get = (bl: El[], unit: string) => bl.find((b) => attr(b, 'data-unit') === unit)!;

  it('no clashes: one row per person; rows are the header, then A, then B', () => {
    const sec = section(render(makeBoard([seat('S1')], [seat('S2')]), NOW), 'today');
    const hds = laneHds(sec);
    expect(hds[0]).toContain('r-2');
    expect(hds[0]).toContain('h-1');
    expect(hds[1]).toContain('r-3');
    expect(hds[1]).toContain('h-1');
    const bl = blocks(sec);
    expect(rowOf(get(bl, 'S1'))).toBe(2);
    expect(rowOf(get(bl, 'S2'))).toBe(3);
  });

  it('a room appears exactly once and spans A\'s inner row and B\'s inner row', () => {
    const sec = section(render(makeBoard([room('a')], []), NOW), 'today');
    const bl = blocks(sec);
    expect(bl).toHaveLength(1);
    expect(rowOf(bl[0]!)).toBe(2);
    expect(spanOf(bl[0]!)).toBe(2);
    expect(attr(bl[0]!, 'data-lane')).toBe('span');
    expect(sec.match(/data-unit="R3"/g)).toHaveLength(1);
  });

  it("a partner's seat inside the room goes below it (B grows downward); the room keeps rows 2-3", () => {
    const sec = section(render(makeBoard([room('a')], [seat('S9')]), NOW), 'today');
    const bl = blocks(sec);
    const hds = laneHds(sec);
    expect(hds[0]).toContain('h-1');
    expect(hds[1]).toContain('r-3');
    expect(hds[1]).toContain('h-2');
    expect([rowOf(get(bl, 'R3')), spanOf(get(bl, 'R3'))]).toEqual([2, 2]);
    expect(rowOf(get(bl, 'S9'))).toBe(4);
  });

  it("the owner's own seat during their room goes above it (A grows upward), so the room moves down a row", () => {
    const sec = section(render(makeBoard([room('a'), seat('S9')], []), NOW), 'today');
    const bl = blocks(sec);
    const hds = laneHds(sec);
    expect(hds[0]).toContain('h-2');
    expect(hds[1]).toContain('r-4');
    expect(rowOf(get(bl, 'S9'))).toBe(2); // outermost A row on top
    expect([rowOf(get(bl, 'R3')), spanOf(get(bl, 'R3'))]).toEqual([3, 2]); // A track 0 (row 3) + B track 0 (row 4)
  });

  it('A tracks stack upward from the centre, B tracks downward', () => {
    const a = [seat('S1', '10:00', '12:00'), seat('S2', '10:00', '12:00')];
    const b = [seat('S3', '10:00', '12:00'), seat('S4', '10:00', '12:00')];
    const bl = blocks(section(render(makeBoard(a, b), NOW), 'today'));
    expect([get(bl, 'S1'), get(bl, 'S2'), get(bl, 'S3'), get(bl, 'S4')].map(rowOf)).toEqual([3, 2, 4, 5]);
  });

  it('two overlapping rooms: neither spans, each in its booker\'s lane', () => {
    const ra = room('a', '12:00', '14:00', 'R3');
    const rb = row({ ref: 'RB5', unit: 'R5', from: '13:00', to: '15:00' });
    const bl = blocks(section(render(makeBoard([ra], [rb]), NOW), 'today'));
    expect(bl).toHaveLength(2);
    expect(bl.map((b) => spanOf(b))).toEqual([1, 1]);
    expect(rowOf(get(bl, 'R3'))).toBe(2);
    expect(rowOf(get(bl, 'R5'))).toBe(3);
    expect(attr(get(bl, 'R3'), 'data-lane')).toBe('a');
    expect(attr(get(bl, 'R5'), 'data-lane')).toBe('b');
  });

  it('touching rooms both span', () => {
    const bl = blocks(section(render(makeBoard([room('a', '10:00', '11:00')], [row({ ref: 'RB', unit: 'R5', from: '11:00', to: '12:00' })]), NOW), 'today'));
    expect(bl.map((b) => attr(b, 'data-lane'))).toEqual(['span', 'span']);
  });

  it('has a centre divider on the second lane only, once per day section', () => {
    const html = render(makeBoard([], []), NOW);
    for (const d of ['today', 'tomorrow'] as const) {
      const sec = section(html, d);
      const bgs = laneBgs(sec);
      expect(bgs.map((c) => c.includes('centre'))).toEqual([false, true]);
      expect(laneHds(sec).map((c) => c.includes('centre'))).toEqual([false, true]);
    }
  });

  it('never emits ghost copies', () => {
    const html = render(makeBoard([room('a')], [seat('S9')]), NOW, SHOW);
    expect(html).not.toMatch(/ghost/);
  });

  it('badges sit on the single room block: unverified, and duplicate room on both when both booked at once', () => {
    const late = '2026-10-08T14:15:00+08:00';
    const r = row({ ref: 'RA', unit: 'R3', from: '14:00', to: '15:00' });
    const solo = section(render(makeBoard([r], [], { aAt: '2026-10-08T13:50:00+08:00' }), late), 'today');
    expect(blocks(solo)).toHaveLength(1);
    expect(blocks(solo)[0]!.text).toContain('unverified');

    const dupA = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '13:00' });
    const dupB = row({ ref: 'RB', unit: 'R5', from: '12:00', to: '13:00' });
    const dup = blocks(section(render(makeBoard([dupA], [dupB]), NOW), 'today'));
    expect(dup).toHaveLength(2);
    for (const b of dup) expect(b.text).toContain('duplicate room');
  });
});

describe('Checked-in tick', () => {
  const tl = (status: Booking['status']) =>
    blocks(section(render(makeBoard([row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00', status })], []), NOW, SHOW), 'today'))[0]!;

  it('prefixes the timeline label of a checked-in block with "✓ "', () => {
    expect(tl('checked_in').inner).toContain('<span class="lbl">✓ S1</span>');
  });

  it.each(['booked', 'cancelled', 'partial_cancelled', 'no_show'] as const)('%s has no tick', (status) => {
    expect(tl(status).text).not.toContain('✓');
  });

  it('a checked-in room has the tick too, with its compact label', () => {
    const r = row({ ref: 'R1', unit: 'R3', from: '10:00', to: '11:00', status: 'checked_in', pax: 2 });
    expect(blocks(section(render(makeBoard([r], []), NOW), 'today'))[0]!.text).toBe('✓ R3 · Alice · 2 pax');
  });

  it('the list and the title keep the plain wording', () => {
    const sec = section(render(makeBoard([row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00', status: 'checked_in' })], []), NOW), 'today');
    expect(rows(sec)[0]!.text).toContain('Checked in');
    expect(rows(sec)[0]!.text).not.toContain('✓');
    expect(attr(blocks(sec)[0]!, 'title')).not.toContain('✓');
  });
});

// ---- Now-line and past wash ------------------------------------------------------------------------------

const at = (hhmm: string) => `2026-10-08T${hhmm}:00+08:00`;
const divsOf = (sec: string, first: string) =>
  [...sec.matchAll(new RegExp(`<div class="(${first}(?: [^"]*)?)"[^>]*>([^<]*)</div>`, 'g'))].map((m) => ({ cls: m[1]!.split(/\s+/), text: m[2]! }));

describe('Now-line and past wash (Today only)', () => {
  const todaySec = (hhmm: string, board = makeBoard([], [])) => section(render(board, at(hhmm)), 'today');

  it.each([
    // time, slot class, minute class, full-wash columns, partial-wash minutes
    ['08:00', 's-0800', 'mo-0', null, null],
    ['08:01', 's-0800', 'mo-1', null, 1],
    ['08:29', 's-0800', 'mo-29', null, 29],
    ['08:30', 's-0830', 'mo-0', 'd-1', null],
    ['14:15', 's-1400', 'mo-15', 'd-12', 15],
    ['21:29', 's-2100', 'mo-29', 'd-26', 29],
    ['21:30', 's-2130', 'mo-0', 'd-27', null],
    ['21:59', 's-2130', 'mo-29', 'd-27', 29],
  ] as const)('at %s: now-line %s %s, wash %s / %s', (hhmm, slot, mo, full, partial) => {
    const sec = todaySec(hhmm);
    const now = divsOf(sec, 'now');
    expect(now).toHaveLength(1);
    expect(now[0]!.cls).toEqual(expect.arrayContaining(['now', slot, mo, 'r-2', 'h-2']));
    const chip = divsOf(sec, 'now-chip');
    expect(chip).toHaveLength(1);
    expect(chip[0]!.cls).toEqual(expect.arrayContaining([slot, mo, 'r-1']));
    expect(chip[0]!.text).toBe(hhmm);

    const wash = divsOf(sec, 'wash');
    const fullEls = wash.filter((w) => w.cls.some((c) => /^d-\d+$/.test(c)));
    const partialEls = wash.filter((w) => w.cls.some((c) => /^mw-\d+$/.test(c)));
    expect(fullEls.length + partialEls.length).toBe(wash.length);
    if (full === null) expect(fullEls).toHaveLength(0);
    else {
      expect(fullEls).toHaveLength(1);
      expect(fullEls[0]!.cls).toEqual(expect.arrayContaining(['s-0800', full, 'r-2', 'h-2']));
    }
    if (partial === null) expect(partialEls).toHaveLength(0);
    else {
      expect(partialEls).toHaveLength(1);
      expect(partialEls[0]!.cls).toEqual(expect.arrayContaining([slot, `mw-${partial}`, 'r-2', 'h-2']));
    }
  });

  it('at 22:00 and later there is no now-line or chip, and the wash covers the whole grid', () => {
    for (const hhmm of ['22:00', '22:01', '23:59']) {
      const sec = todaySec(hhmm);
      expect(divsOf(sec, 'now'), hhmm).toHaveLength(0);
      expect(divsOf(sec, 'now-chip'), hhmm).toHaveLength(0);
      const wash = divsOf(sec, 'wash');
      expect(wash, hhmm).toHaveLength(1);
      expect(wash[0]!.cls, hhmm).toEqual(expect.arrayContaining(['s-0800', 'd-28', 'r-2', 'h-2']));
    }
  });

  it('before 08:00 there is nothing: no now-line, no chip, no wash', () => {
    for (const hhmm of ['07:59', '00:00', '05:30']) {
      const sec = todaySec(hhmm);
      expect(sec, hhmm).not.toMatch(/class="(now|wash)[ "]/);
      expect(sec, hhmm).not.toContain('now-chip');
    }
  });

  it('Tomorrow never has a now-line or wash', () => {
    for (const hhmm of ['07:59', '08:00', '14:15', '22:00']) {
      const tomorrow = section(render(makeBoard([], []), at(hhmm)), 'tomorrow');
      expect(tomorrow, hhmm).not.toMatch(/class="(now|wash)/);
    }
  });

  it('spans every lane row, however many tracks there are', () => {
    const a = [row({ ref: 'A1', unit: 'S1', from: '10:00', to: '12:00' }), row({ ref: 'A2', unit: 'S2', from: '10:00', to: '12:00' })];
    const b = [row({ ref: 'B1', unit: 'S3', from: '10:00', to: '12:00' })];
    const sec = todaySec('14:15', makeBoard(a, b));
    expect(divsOf(sec, 'now')[0]!.cls).toContain('h-3');
    for (const w of divsOf(sec, 'wash')) expect(w.cls).toContain('h-3');
  });

  it('uses SGT, not the device time zone, and is pure', () => {
    const board = makeBoard([], []);
    const outputs = ['UTC', 'America/New_York', 'Pacific/Auckland'].map((tz) => {
      process.env.TZ = tz;
      return render(board, '2026-10-08T06:15:00Z'); // 14:15 SGT
    });
    expect(outputs[1]).toBe(outputs[0]);
    expect(outputs[2]).toBe(outputs[0]);
    expect(divsOf(section(outputs[0]!, 'today'), 'now-chip')[0]!.text).toBe('14:15');
  });

  it('has no inline styles even with the now-line', () => {
    expect(render(makeBoard([], []), at('14:15'))).not.toMatch(/\sstyle\s*=/i);
  });

  it('the subtitle still shows the time', () => {
    expect(render(makeBoard([], []), at('14:15'))).toContain('now 14:15');
  });
});

// ---- Legend ("Key") ---------------------------------------------------------------------------------

describe('Legend', () => {
  const header = (html: string) => html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  const keyOf = (prefs?: Partial<ViewPrefs>) => header(render(makeBoard([], []), NOW, { showCancelled: false, reveal: {}, legendOpen: false, ...prefs }));

  it('is a closed <details class="key"> with a Key summary under the subtitle by default', () => {
    const h = keyOf();
    expect(h).toMatch(/<\/p><details class="key"><summary>Key<\/summary>/);
    expect(h.indexOf('class="sub"')).toBeLessThan(h.indexOf('class="key"'));
    expect(h).not.toMatch(/<details[^>]* open/);
  });

  it('is open when prefs.legendOpen is true, and only then', () => {
    expect(keyOf({ legendOpen: true })).toMatch(/<details class="key" open>/);
    expect(keyOf({ legendOpen: false })).not.toContain(' open');
  });

  it('the default prefs (none passed) keep it closed', () => {
    expect(header(render(makeBoard([], []), NOW))).not.toContain(' open');
  });

  it('the preference does not change anything below the header', () => {
    const board = makeBoard([row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00' })], []);
    const tail = (h: string) => h.slice(h.indexOf('</header>'));
    expect(tail(render(board, NOW, { ...HIDE, legendOpen: true }))).toBe(tail(render(board, NOW, HIDE)));
  });

  it('lists every kind of block, the duplicate-room band and the badges, but not the trimmed items', () => {
    const h = keyOf();
    for (const text of [
      'Booked', 'Checked in', 'Partly cancelled', 'No-show', 'Cancelled', 'struck through',
      'Duplicate rooms', 'red', 'unverified', 'possibly redundant', 'duplicate room',
    ]) {
      expect(h, text).toContain(text);
    }
    for (const gone of ['Room (spans both lanes', 'Overlap (yellow band)', 'Now (line)', 'Past (shaded)', 'yellow']) expect(h, gone).not.toContain(gone);
    expect(h).not.toContain('ovl-seat');
    expect(h).not.toContain('class="now');
    expect(h).not.toContain('class="wash');
    expect(h).toContain('✓');
  });

  it('swatches reuse the real block classes in person 0\'s colours, with the .sw mini modifier and no grid positions', () => {
    const h = keyOf();
    const sw = [...h.matchAll(/<span class="(blk [^"]*)">/g)].map((m) => m[1]!.split(/\s+/));
    expect(sw).toHaveLength(5);
    for (const c of sw) {
      expect(c).toContain('sw');
      expect(c).toContain('p-0');
      expect(c.some((x) => /^(s|d|r|h)-\d+$/.test(x) || /^s-\d{4}$/.test(x))).toBe(false);
    }
    const all = sw.flat();
    for (const c of ['st-booked', 'st-checked-in', 'st-partial-cancelled', 'st-no-show', 'st-cancelled']) expect(all).toContain(c);
    expect(all).not.toContain('k-room');
    expect(h).toContain('<span class="ovl ovl-room sw"></span>');
    for (const b of ['b-unverified', 'b-redundant', 'b-duplicate']) expect(h).toContain(`class="badge ${b}"`);
  });

  it('is outside the day sections, so block and badge tests never see it', () => {
    const html = render(makeBoard([], []), NOW, { ...HIDE, legendOpen: true });
    for (const d of ['today', 'tomorrow'] as const) {
      expect(section(html, d)).not.toContain('class="key"');
      expect(blocks(section(html, d))).toHaveLength(0);
    }
  });
});

// ---- Other head counts: the rooms band --------------------------------------------------------------------

describe('Rooms band (any number of people other than two)', () => {
  const three = (a: Booking[], b: Booking[], c: Booking[]): Board => {
    const board = makeBoard(a, b);
    board.people.push({ id: 'c', name: 'Carol' });
    board.snapshots.c = snap('c', c);
    return board;
  };

  it('three people: a "Rooms" band above the lanes, no centre divider, one room block per room', () => {
    const board = three(
      [row({ ref: 'R1', unit: 'R3', from: '12:00', to: '14:00' }), row({ ref: 'S1', unit: 'S1', from: '12:00', to: '13:00' })],
      [row({ ref: 'R2', unit: 'R5', from: '13:00', to: '15:00' })],
      [],
    );
    const sec = section(render(board, NOW), 'today');
    const hds = laneHds(sec);
    expect(hds).toHaveLength(4);
    expect(hds[0]).toContain('band');
    expect(sec).toMatch(/class="lane-hd band [^"]*"><span class="who">Rooms<\/span>/);
    expect(hds[0]).toEqual(expect.arrayContaining(['r-2', 'h-2'])); // two overlapping rooms stack into 2 band rows
    expect(hds[1]).toContain('r-4');
    expect(laneBgs(sec).some((c) => c.includes('centre'))).toBe(false);
    const bl = blocks(section(render(board, NOW), 'today'));
    expect(bl).toHaveLength(3);
    const room3 = bl.find((b) => attr(b, 'data-unit') === 'R3')!;
    const room5 = bl.find((b) => attr(b, 'data-unit') === 'R5')!;
    expect(attr(room3, 'data-lane')).toBe('rooms');
    expect([rowOf(room3), rowOf(room5)]).toEqual([2, 3]);
    expect([spanOf(room3), spanOf(room5)]).toEqual([1, 1]);
    expect(bl.find((b) => attr(b, 'data-unit') === 'S1')!.cls).toContain('r-4');
  });

  it('three people with no rooms: no band at all', () => {
    const sec = section(render(three([row({ ref: 'S1', unit: 'S1', from: '12:00', to: '13:00' })], [], []), NOW), 'today');
    expect(laneHds(sec)).toHaveLength(3);
    expect(sec).not.toContain('Rooms');
  });

  it('one person: the room goes in the band above the single lane', () => {
    const board = makeBoard([row({ ref: 'R1', unit: 'R3', from: '12:00', to: '13:00' })], []);
    board.people.pop();
    const sec = section(render(board, NOW), 'today');
    expect(laneHds(sec)).toHaveLength(2);
    const room = blocks(sec)[0]!;
    expect(attr(room, 'data-lane')).toBe('rooms');
    expect(rowOf(room)).toBe(2);
    expect(laneBgs(sec).some((c) => c.includes('centre'))).toBe(false);
  });

  it('the now-line spans the band rows too', () => {
    const board = three([row({ ref: 'R1', unit: 'R3', from: '12:00', to: '14:00' })], [], []);
    const now = divsOf(section(render(board, NOW), 'today'), 'now')[0]!;
    expect(now.cls).toContain('h-4'); // 1 band row + 3 lanes
  });
});
// ---- Safety: escaping and CSP compatibility ---------------------------------------------------------

describe('Escaping and CSP compatibility', () => {
  const evil = `<script>alert(1)</script>"'&`;

  it('escapes every data string', () => {
    const b = booking({
      ref: evil, kind: 'room', unit: evil, library: evil, area: evil, floor: evil, pax: 2,
      start: iso(TODAY, '10:00'), end: iso(TODAY, '11:00'),
    });
    const board = makeBoard([b], [b], { names: [evil, evil + 'B'] });
    board.people[0]!.id = 'a';
    const html = render(board, NOW);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&amp;');
  });

  it('escapes person ids used in attributes', () => {
    const board = makeBoard([row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00' })], []);
    board.people[0]!.id = 'a"onmouseover="x';
    board.snapshots['a"onmouseover="x'] = snap('a', board.snapshots['a']!.bookings);
    const html = render(board, NOW);
    expect(html).not.toMatch(/\sonmouseover=/);
  });

  it('never emits inline style attributes or event handlers (nonce-only CSP)', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'B1', unit: 'S201', from: '13:00', to: '14:00' });
    const html = render(makeBoard([room, seat], [seat]), NOW);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/<(script|style|link|img|iframe)\b/i);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('is pure: same input, same output', () => {
    const board = makeBoard([row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00' })], null);
    expect(render(board, NOW)).toBe(render(board, NOW));
  });
});
