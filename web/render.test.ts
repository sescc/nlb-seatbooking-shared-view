import { afterEach, describe, expect, it } from 'vitest';
import { booking } from '../shared/src/fixtures';
import type { Board, Booking, Snapshot } from '../shared/src/types';
import { render } from './render';

// web/tsconfig.json deliberately has no node types (the viewer targets the browser); tests only need process.env.TZ.
declare const process: { env: Record<string, string | undefined> };

// ---- fixtures -------------------------------------------------------------------------------

const NOW = '2026-10-08T14:15:00+08:00';
const TODAY = '2026-10-08';
const TOMORROW = '2026-10-09';

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
const primary = (els: El[]) => els.filter((e) => !e.cls.includes('ghost'));

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

  it('Room spans lanes: the 12-13 slot shows the room in both lanes, marked as booked by A', () => {
    const sec = section(render(makeBoard([roomA], []), NOW), 'today');
    const bl = blocks(sec);
    expect(bl).toHaveLength(2);
    for (const b of bl) {
      expect(b.cls).toContain('s-1200');
      expect(b.cls).toContain('d-2');
      expect(b.cls).toContain('k-room');
      // compact in the timeline; the full wording (who booked it) stays in the title and the list
      expect(b.text).toContain('R3 · Alice · 4 pax');
      expect(b.text).not.toContain('booked by');
      expect(attr(b, 'title')).toContain('R3 · booked by Alice · 4 pax');
    }
    const listRow = rows(sec)[0]!;
    expect(listRow.text).toContain('Alice');
    expect(listRow.text).toContain('Room R3 · 4 pax');
    // one copy per lane: different grid rows
    const laneRows = bl.map((b) => b.cls.find((c) => /^r-\d+$/.test(c)));
    expect(new Set(laneRows).size).toBe(2);
    expect(bl.map((b) => attr(b, 'data-lane')).sort()).toEqual(['a', 'b']);
    // only the booker's copy is the real booking
    expect(bl.filter((b) => b.cls.includes('ghost'))).toHaveLength(1);
    // the detail list names the room once
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
    expect(bl).toHaveLength(2);
    expect(bl.every((b) => b.text.includes('R5 · Bob · 3 pax'))).toBe(true);
  });
});

// ---- Requirement: Cancelled bookings -------------------------------------------------------------

describe('Cancelled bookings', () => {
  it('Cancelled seat: shown struck through, and no overlap involving it is flagged', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'B1', unit: 'S201', from: '13:00', to: '14:00', status: 'cancelled' });
    const sec = section(render(makeBoard([room], [seat]), NOW), 'today');

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
    const sec = section(render(makeBoard([live], [dead]), NOW), 'today');
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
    return rows(section(render(makeBoard([own], extra), NOW), 'today'))[0]!;
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

  it('a partial_cancelled seat inside the partner\'s room DOES get the badge and a band', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'B1', unit: 'S201', from: '13:00', to: '14:00', status: 'partial_cancelled' });
    const sec = section(render(makeBoard([room], [seat]), NOW), 'today');
    expect(bands(sec)).toHaveLength(1);
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

// ---- Requirement: Overlap badges -----------------------------------------------------------------

describe('Overlap badges', () => {
  it('Seat inside partner room: 13-14 is flagged and B\'s seat is marked possibly redundant', () => {
    const room = row({ ref: 'RA', unit: 'R3', from: '12:00', to: '14:00' });
    const seat = row({ ref: 'B1', unit: 'S201', from: '13:00', to: '14:00' });
    const sec = section(render(makeBoard([room], [seat]), NOW), 'today');

    const bd = bands(sec);
    expect(bd).toHaveLength(1);
    expect(bd[0]!.cls).toContain('s-1300');
    expect(bd[0]!.cls).toContain('d-2');
    expect(bd[0]!.cls).toContain('ovl-seat');
    expect(bd[0]!.text).toContain('13:00–14:00');

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
    expect(bd[0]!.cls).toContain('s-1200');
    expect(bd[0]!.cls).toContain('d-2');
    expect(bd[0]!.cls).toContain('ovl-room');

    const real = primary(blocks(sec));
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

  it('two overlapping seats are highlighted without room-specific badges', () => {
    const a = row({ ref: 'A1', unit: 'S1', from: '10:00', to: '12:00' });
    const b = row({ ref: 'B1', unit: 'S2', from: '11:00', to: '13:00' });
    const sec = section(render(makeBoard([a], [b]), NOW), 'today');
    const bd = bands(sec);
    expect(bd).toHaveLength(1);
    expect(bd[0]!.cls).toContain('s-1100');
    expect(bd[0]!.cls).toContain('d-2');
    expect(bd[0]!.cls).toContain('ovl-both');
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

  it('the badge is on the room booker\'s own block, not on the lane copy', () => {
    const r = row({ ref: 'RA', unit: 'R3', from: '14:00', to: '15:00' });
    const sec = section(render(makeBoard([r], [], { aAt: '2026-10-08T13:50:00+08:00' }), '2026-10-08T14:15:00+08:00'), 'today');
    expect(unverifiedIn(blocks(sec))).toHaveLength(1);
    expect(unverifiedIn(primary(blocks(sec)))).toHaveLength(1);
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

  it('stacks a person\'s simultaneous blocks on separate tracks', () => {
    const seat = row({ ref: 'A1', unit: 'S1', from: '12:00', to: '13:00' });
    const room = row({ ref: 'A2', unit: 'R3', from: '12:00', to: '13:00' });
    const bl = blocks(section(render(makeBoard([seat, room], []), NOW), 'today')).filter((b) => attr(b, 'data-lane') === 'a');
    expect(bl).toHaveLength(2);
    const r0 = bl[0]!.cls.find((c) => /^r-\d+$/.test(c));
    const r1 = bl[1]!.cls.find((c) => /^r-\d+$/.test(c));
    expect(r0).not.toBe(r1);
  });
});

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
      const html = render(makeBoard([row({ ref: 'A1', unit: 'S1', from: '10:00', to: '11:00', status })], []), NOW);
      expect(rows(section(html, 'today'))[0]!.text).toContain(label);
    }
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
