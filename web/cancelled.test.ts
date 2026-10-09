import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SHOW_CANCELLED_ID,
  SHOW_CANCELLED_KEY,
  cancelledControlHtml,
  loadShowCancelled,
  saveShowCancelled,
  wireCancelledControl,
} from './cancelled';
import type { ViewPrefs } from './render';

// ---- fakes (same approach as theme.test.ts) ---------------------------------------------------------

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}
const throwingStorage = {
  getItem: (): string | null => {
    throw new Error('SecurityError');
  },
  setItem: (): void => {
    throw new Error('QuotaExceededError');
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('loadShowCancelled / saveShowCancelled', () => {
  it('uses the key "showCancelled" with values "1" / "0"', () => {
    expect(SHOW_CANCELLED_KEY).toBe('showCancelled');
    const s = fakeStorage();
    saveShowCancelled(true, s);
    expect(s.data).toEqual({ showCancelled: '1' });
    saveShowCancelled(false, s);
    expect(s.data).toEqual({ showCancelled: '0' });
  });

  it('round-trips', () => {
    const s = fakeStorage();
    saveShowCancelled(true, s);
    expect(loadShowCancelled(s)).toBe(true);
    saveShowCancelled(false, s);
    expect(loadShowCancelled(s)).toBe(false);
  });

  it('defaults to hidden: nothing stored, junk stored, or no storage', () => {
    expect(loadShowCancelled(fakeStorage())).toBe(false);
    for (const junk of ['', 'true', 'yes', '2', ' 1', 'on']) {
      expect(loadShowCancelled(fakeStorage({ showCancelled: junk })), junk).toBe(false);
    }
    expect(loadShowCancelled(null)).toBe(false);
  });

  it('survives storage that throws: hidden, and no crash on save', () => {
    expect(loadShowCancelled(throwingStorage)).toBe(false);
    expect(() => saveShowCancelled(true, throwingStorage)).not.toThrow();
    expect(() => saveShowCancelled(true, null)).not.toThrow();
  });

  it('with no storage argument it uses the page localStorage, and survives it being absent or throwing', () => {
    const s = fakeStorage({ showCancelled: '1' });
    vi.stubGlobal('localStorage', s);
    expect(loadShowCancelled()).toBe(true);
    saveShowCancelled(false);
    expect(s.data.showCancelled).toBe('0');

    vi.stubGlobal('localStorage', undefined);
    expect(loadShowCancelled()).toBe(false);
    expect(() => saveShowCancelled(true)).not.toThrow();

    vi.stubGlobal('localStorage', throwingStorage);
    expect(loadShowCancelled()).toBe(false);
    expect(() => saveShowCancelled(true)).not.toThrow();
  });
});

describe('cancelledControlHtml', () => {
  const html = cancelledControlHtml();
  it('is a labelled checkbox with the id the wiring looks for, and no inline handlers or styles', () => {
    expect(html).toContain('<input type="checkbox"');
    expect(html).toContain(`id="${SHOW_CANCELLED_ID}"`);
    expect(SHOW_CANCELLED_ID).toBe('show-cancelled');
    expect(html).toMatch(/^<label\b[\s\S]*Show cancelled<\/label>$/);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
  it('is not checked in the static markup (wiring sets it from the stored value)', () => {
    expect(html).not.toContain('checked');
  });
});

describe('wireCancelledControl', () => {
  function setup(opts: { prefs?: ViewPrefs; storage?: ReturnType<typeof fakeStorage> | typeof throwingStorage | null } = {}) {
    let onChange: (() => void) | null = null;
    let onClick: ((e: { target: unknown }) => void) | null = null;
    const box = {
      checked: false,
      addEventListener: (type: 'change', fn: () => void) => {
        expect(type).toBe('change');
        onChange = fn;
      },
    };
    const app = {
      addEventListener: (type: 'click', fn: (e: { target: unknown }) => void) => {
        expect(type).toBe('click');
        onClick = fn;
      },
    };
    const doc = { getElementById: (id: string) => (id === SHOW_CANCELLED_ID ? box : id === 'app' ? app : null) };
    const prefs: ViewPrefs = opts.prefs ?? { showCancelled: false, reveal: {} };
    const storage = opts.storage === undefined ? fakeStorage() : opts.storage;
    const rerender = vi.fn();
    wireCancelledControl(doc, prefs, rerender, storage);
    const toggle = (checked: boolean) => {
      box.checked = checked;
      onChange!();
    };
    // a click lands on `btn` (or inside it); `closest` finds the .cnt button
    const click = (btn: { dataset: Record<string, string | undefined> } | null) =>
      onClick!({ target: { closest: (sel: string) => (sel === 'button.cnt' ? btn : null) } });
    return { box, prefs, storage, rerender, toggle, click };
  }
  const cnt = (date: string, reveal: '0' | '1') => ({ dataset: { date, reveal } });

  it('shows the current preference as checked on load, without saving or rendering', () => {
    const t = setup({ prefs: { showCancelled: true, reveal: {} } });
    expect(t.box.checked).toBe(true);
    expect(t.rerender).not.toHaveBeenCalled();
    expect(t.storage && 'data' in t.storage ? t.storage.data : {}).toEqual({});
  });

  it('checking the box sets the preference, saves "1", and rerenders', () => {
    const t = setup();
    t.toggle(true);
    expect(t.prefs.showCancelled).toBe(true);
    expect((t.storage as ReturnType<typeof fakeStorage>).data).toEqual({ showCancelled: '1' });
    expect(t.rerender).toHaveBeenCalledTimes(1);
  });

  it('unchecking saves "0"', () => {
    const t = setup({ prefs: { showCancelled: true, reveal: {} } });
    t.toggle(false);
    expect(t.prefs.showCancelled).toBe(false);
    expect((t.storage as ReturnType<typeof fakeStorage>).data).toEqual({ showCancelled: '0' });
  });

  it('changing the checkbox clears ALL per-day reveals', () => {
    const t = setup({ prefs: { showCancelled: false, reveal: { '2026-10-08': true, '2026-10-09': false } } });
    t.toggle(true);
    expect(t.prefs.reveal).toEqual({});
    expect(t.rerender).toHaveBeenCalledTimes(1);
  });

  it('still works when storage throws or is absent (the choice just is not remembered)', () => {
    for (const storage of [throwingStorage, null]) {
      const t = setup({ storage });
      expect(() => t.toggle(true)).not.toThrow();
      expect(t.prefs.showCancelled).toBe(true);
      expect(t.rerender).toHaveBeenCalledTimes(1);
    }
  });

  it('clicking a count with data-reveal="1" reveals that date only, and rerenders', () => {
    const t = setup();
    t.click(cnt('2026-10-08', '1'));
    expect(t.prefs.reveal).toEqual({ '2026-10-08': true });
    expect(t.prefs.showCancelled).toBe(false);
    expect(t.rerender).toHaveBeenCalledTimes(1);
  });

  it('clicking a count with data-reveal="0" hides that date only', () => {
    const t = setup({ prefs: { showCancelled: true, reveal: {} } });
    t.click(cnt('2026-10-09', '0'));
    expect(t.prefs.reveal).toEqual({ '2026-10-09': false });
    expect(t.prefs.showCancelled).toBe(true);
  });

  it('per-day reveals are independent and can be toggled back', () => {
    const t = setup();
    t.click(cnt('2026-10-08', '1'));
    t.click(cnt('2026-10-09', '1'));
    t.click(cnt('2026-10-08', '0'));
    expect(t.prefs.reveal).toEqual({ '2026-10-08': false, '2026-10-09': true });
  });

  it('a reveal is never written to storage', () => {
    const t = setup();
    t.click(cnt('2026-10-08', '1'));
    expect((t.storage as ReturnType<typeof fakeStorage>).data).toEqual({});
  });

  it('clicks that are not on a count button, or a button without a date, do nothing', () => {
    const t = setup();
    t.click(null);
    t.click({ dataset: { reveal: '1' } });
    expect(t.prefs.reveal).toEqual({});
    expect(t.rerender).not.toHaveBeenCalled();
  });

  it('keeps the same prefs object (the app and the wiring share it)', () => {
    const prefs: ViewPrefs = { showCancelled: false, reveal: {} };
    const t = setup({ prefs });
    t.click(cnt('2026-10-08', '1'));
    expect(prefs.reveal['2026-10-08']).toBe(true);
    t.toggle(true);
    expect(prefs.reveal).toEqual({});
    expect(prefs.showCancelled).toBe(true);
  });

  it('does not throw when the page lacks the checkbox or #app', () => {
    expect(() => wireCancelledControl({ getElementById: () => null }, { showCancelled: false, reveal: {} }, () => {}, null)).not.toThrow();
  });
});
