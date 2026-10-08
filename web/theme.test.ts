import { describe, expect, it } from 'vitest';
import {
  THEME_KEY,
  initialTheme,
  parseTheme,
  saveTheme,
  setTheme,
  themeControlHtml,
  themeInitScript,
  wireThemeControl,
  type ThemeButton,
} from './theme';

// ---- fakes ---------------------------------------------------------------------------------------

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

function fakeButtons() {
  return (['auto', 'light', 'dark'] as const).map((c) => {
    const attrs: Record<string, string> = { 'aria-pressed': c === 'auto' ? 'true' : 'false' };
    const b: ThemeButton & { attrs: Record<string, string> } = {
      dataset: { themeChoice: c },
      attrs,
      setAttribute: (n, v) => {
        attrs[n] = v;
      },
    };
    return b;
  });
}
const pressed = (bs: ReturnType<typeof fakeButtons>) => bs.map((b) => b.attrs['aria-pressed']);

// ---- parse / storage -------------------------------------------------------------------------------

describe('parseTheme', () => {
  it('accepts the three choices and treats anything else as auto', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('auto')).toBe('auto');
    for (const bad of [null, undefined, '', 'Dark', 'blue', 42, {}]) expect(parseTheme(bad)).toBe('auto');
  });
});

describe('initialTheme', () => {
  it('reads the stored choice under the key "theme"', () => {
    expect(THEME_KEY).toBe('theme');
    expect(initialTheme(fakeStorage({ theme: 'light' }))).toBe('light');
    expect(initialTheme(fakeStorage({ theme: 'dark' }))).toBe('dark');
  });
  it('defaults to auto when nothing, junk, or no storage', () => {
    expect(initialTheme(fakeStorage())).toBe('auto');
    expect(initialTheme(fakeStorage({ theme: 'purple' }))).toBe('auto');
    expect(initialTheme(null)).toBe('auto');
    expect(initialTheme(undefined)).toBe('auto');
  });
  it('survives storage that throws', () => {
    expect(initialTheme(throwingStorage)).toBe('auto');
  });
});

describe('saveTheme', () => {
  it('writes the choice under "theme"', () => {
    const s = fakeStorage();
    saveTheme(s, 'dark');
    expect(s.data).toEqual({ theme: 'dark' });
  });
  it('never throws, whatever the storage does', () => {
    expect(() => saveTheme(throwingStorage, 'light')).not.toThrow();
    expect(() => saveTheme(null, 'light')).not.toThrow();
  });
});

// ---- the head script (applied before first paint) -------------------------------------------------

describe('themeInitScript', () => {
  const run = (storage: unknown) => {
    const root = { dataset: {} as Record<string, string | undefined> };
    new Function('localStorage', 'document', themeInitScript())(storage, { documentElement: root });
    return root.dataset.theme;
  };
  it('applies a stored light or dark choice to <html data-theme>', () => {
    expect(run(fakeStorage({ theme: 'light' }))).toBe('light');
    expect(run(fakeStorage({ theme: 'dark' }))).toBe('dark');
  });
  it('leaves data-theme unset for auto, junk, and empty storage', () => {
    expect(run(fakeStorage({ theme: 'auto' }))).toBeUndefined();
    expect(run(fakeStorage({ theme: '<script>' }))).toBeUndefined();
    expect(run(fakeStorage())).toBeUndefined();
  });
  it('does not throw when storage throws', () => {
    expect(run(throwingStorage)).toBeUndefined();
  });
  it('is tiny and has no closing script tag', () => {
    expect(themeInitScript().length).toBeLessThan(250);
    expect(themeInitScript()).not.toMatch(/<\/?script/i);
  });
});

// ---- the control -----------------------------------------------------------------------------------

describe('themeControlHtml', () => {
  const buttons = (html: string) =>
    [...html.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map((m) => ({
      attrs: m[1]!,
      label: m[2]!,
      choice: m[1]!.match(/data-theme-choice="([^"]*)"/)?.[1],
      pressed: m[1]!.match(/aria-pressed="([^"]*)"/)?.[1],
    }));

  it('renders Auto, Light, Dark as real buttons, in that order', () => {
    const bs = buttons(themeControlHtml('auto'));
    expect(bs.map((b) => b.label)).toEqual(['Auto', 'Light', 'Dark']);
    expect(bs.map((b) => b.choice)).toEqual(['auto', 'light', 'dark']);
    for (const b of bs) expect(b.attrs).toMatch(/type="button"/);
  });
  it('marks only the current choice as pressed', () => {
    expect(buttons(themeControlHtml('auto')).map((b) => b.pressed)).toEqual(['true', 'false', 'false']);
    expect(buttons(themeControlHtml('light')).map((b) => b.pressed)).toEqual(['false', 'true', 'false']);
    expect(buttons(themeControlHtml('dark')).map((b) => b.pressed)).toEqual(['false', 'false', 'true']);
  });
  it('is a labelled group with no inline styles or handlers', () => {
    const html = themeControlHtml('auto');
    expect(html).toMatch(/role="group"/);
    expect(html).toMatch(/aria-label="[^"]+"/);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
});

describe('setTheme', () => {
  it('light and dark set data-theme, persist, and update aria-pressed', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const storage = fakeStorage();
    const bs = fakeButtons();
    setTheme('light', { root, storage, buttons: bs });
    expect(root.dataset.theme).toBe('light');
    expect(storage.data.theme).toBe('light');
    expect(pressed(bs)).toEqual(['false', 'true', 'false']);
    setTheme('dark', { root, storage, buttons: bs });
    expect(root.dataset.theme).toBe('dark');
    expect(storage.data.theme).toBe('dark');
    expect(pressed(bs)).toEqual(['false', 'false', 'true']);
  });

  it('Auto removes the attribute, so the OS preference applies again', () => {
    const root = { dataset: { theme: 'dark' } as Record<string, string | undefined> };
    const storage = fakeStorage({ theme: 'dark' });
    const bs = fakeButtons();
    setTheme('auto', { root, storage, buttons: bs });
    expect('theme' in root.dataset).toBe(false);
    expect(storage.data.theme).toBe('auto');
    expect(pressed(bs)).toEqual(['true', 'false', 'false']);
  });

  it('still applies the theme when storage throws', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const bs = fakeButtons();
    expect(() => setTheme('dark', { root, storage: throwingStorage, buttons: bs })).not.toThrow();
    expect(root.dataset.theme).toBe('dark');
    expect(pressed(bs)).toEqual(['false', 'false', 'true']);
  });
});

describe('wireThemeControl', () => {
  function setup(stored: Record<string, string> = {}) {
    let handler: ((e: { target: unknown }) => void) | null = null;
    const container = {
      addEventListener: (type: 'click', fn: (e: { target: unknown }) => void) => {
        expect(type).toBe('click');
        handler = fn;
      },
    };
    const root = { dataset: {} as Record<string, string | undefined> };
    const storage = fakeStorage(stored);
    const bs = fakeButtons();
    wireThemeControl({ container, root, storage, buttons: bs });
    // a click lands on a button (or something inside it); `closest` finds the button
    const click = (b: ThemeButton | null) =>
      handler!({ target: { closest: (sel: string) => (sel.includes('data-theme-choice') ? b : null) } });
    return { root, storage, bs, click };
  }

  it('clicking Light / Dark sets data-theme and persists', () => {
    const t = setup();
    t.click(t.bs[1]!);
    expect(t.root.dataset.theme).toBe('light');
    expect(t.storage.data.theme).toBe('light');
    t.click(t.bs[2]!);
    expect(t.root.dataset.theme).toBe('dark');
    expect(t.storage.data.theme).toBe('dark');
  });

  it('clicking Auto removes data-theme', () => {
    const t = setup();
    t.click(t.bs[2]!);
    t.click(t.bs[0]!);
    expect(t.root.dataset.theme).toBeUndefined();
    expect(pressed(t.bs)).toEqual(['true', 'false', 'false']);
  });

  it('clicks outside any button do nothing', () => {
    const t = setup();
    t.click(null);
    expect(t.root.dataset.theme).toBeUndefined();
    expect(t.storage.data).toEqual({});
  });

  it('shows the stored choice as pressed on load (without rewriting storage)', () => {
    const t = setup({ theme: 'dark' });
    expect(pressed(t.bs)).toEqual(['false', 'false', 'true']);
    expect(t.storage.data).toEqual({ theme: 'dark' });
  });
});
