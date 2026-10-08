import { describe, expect, it } from 'vitest';
import { CANCELLED_OPACITY, DARK_TOKENS, GHOST_OPACITY, LIGHT_TOKENS, viewerCss } from './styles';

const css = viewerCss();
const norm = (s: string) => s.replace(/\s+/g, '');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

describe('viewer CSS: theming', () => {
  const n = norm(css);
  const dark = norm(DARK_TOKENS);

  it('declares the light tokens once, on :root', () => {
    expect(count(n, norm(LIGHT_TOKENS))).toBe(1);
    expect(n).toContain(`:root{color-scheme:lightdark;${norm(LIGHT_TOKENS)}}`);
  });

  it('puts the dark tokens on both paths (OS preference unless forced light, and forced dark) from one source', () => {
    expect(n).toContain(`@media(prefers-color-scheme:dark){:root:not([data-theme=light]){${dark}}}`);
    expect(n).toContain(`:root[data-theme=dark]{${dark}`);
    expect(count(n, dark)).toBe(2); // no third copy of the token literal
  });

  it('keeps color-scheme in step with a forced theme', () => {
    expect(n).toContain(':root[data-theme=light]{color-scheme:light}');
    expect(n).toMatch(/:root\[data-theme=dark\]\{[^}]*color-scheme:dark/);
  });

  it('defines the same token names in light and dark', () => {
    const names = (t: string) => [...t.matchAll(/(--[\w-]+):/g)].map((m) => m[1]).sort();
    expect(names(DARK_TOKENS)).toEqual(names(LIGHT_TOKENS));
  });

  it('styles the theme control without inline styles', () => {
    expect(css).toMatch(/\.seg\b/);
    expect(css).toMatch(/\[aria-pressed=true\]/);
    expect(css).toMatch(/:focus-visible/);
  });
});

interface Rule {
  selector: string;
  body: string;
}
// Flat rule list; the one level of @media nesting is handled because inner rules match on their own.
const rules: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1]!.trim(),
  body: m[2]!.replace(/\s+/g, ''),
}));
const rulesFor = (re: RegExp) => rules.filter((r) => re.test(r.selector));

// ---- WCAG AA contrast of text in both themes (light was never checked before this) ------------------

type RGB = [number, number, number];
function parseColor(v: string): { rgb: RGB; a: number } {
  const rgba = v.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  if (rgba) return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], a: Number(rgba[4]) };
  let h = v.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB, a: 1 };
}
const over = (fg: { rgb: RGB; a: number }, bg: RGB, extra = 1): RGB =>
  fg.rgb.map((c, i) => c * fg.a * extra + bg[i]! * (1 - fg.a * extra)) as RGB;
const luminance = (c: RGB) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const tokenMap = (decls: string) =>
  Object.fromEntries(decls.split(';').map((d) => [d.slice(2, d.indexOf(':')), parseColor(d.slice(d.indexOf(':') + 1))]));

describe.each([
  ['light', LIGHT_TOKENS],
  ['dark', DARK_TOKENS],
])('viewer CSS: %s theme text contrast (WCAG AA, 4.5:1)', (_name, tokens) => {
  const t = tokenMap(tokens) as Record<string, { rgb: RGB; a: number }>;
  const T = (k: string) => t[k]!;
  const card = T('card').rgb;
  const AA = 4.5;

  it('muted text on the page and on cards', () => {
    expect(contrast(T('muted').rgb, card)).toBeGreaterThanOrEqual(AA);
    expect(contrast(T('muted').rgb, T('bg').rgb)).toBeGreaterThanOrEqual(AA);
    expect(contrast(T('fg').rgb, card)).toBeGreaterThanOrEqual(AA);
  });

  it('badges: unverified / possibly redundant, and duplicate room on a card or on any lane colour', () => {
    expect(contrast(T('warn').rgb, T('warnbg').rgb)).toBeGreaterThanOrEqual(AA);
    expect(contrast(T('dup').rgb, over(T('dupbg'), card))).toBeGreaterThanOrEqual(AA);
    for (let i = 0; i < 5; i++) {
      expect(contrast(T('dup').rgb, over(T('dupbg'), T(`p${i}bg`).rgb)), `p${i}`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('block text on every lane colour, also when dimmed (room copies, cancelled) and over an overlap band', () => {
    const band = over(T('ovlbg'), card);
    for (let i = 0; i < 5; i++) {
      const bg = T(`p${i}bg`).rgb;
      expect(contrast(T('fg').rgb, bg), `p${i}`).toBeGreaterThanOrEqual(AA);
      for (const [label, op] of [['ghost', GHOST_OPACITY], ['cancelled', CANCELLED_OPACITY]] as const) {
        for (const base of [card, band]) {
          const text = over({ rgb: T('fg').rgb, a: op }, base);
          const bgd = over({ rgb: bg, a: op }, base);
          expect(contrast(text, bgd), `${label} p${i}`).toBeGreaterThanOrEqual(AA);
        }
      }
    }
  });

  it('the toast', () => {
    expect(contrast(T('toastfg').rgb, T('toast').rgb)).toBeGreaterThanOrEqual(AA);
  });
});

describe('viewer CSS: nothing in a timeline block is clipped', () => {
  // `.badge`, `.lbl` inside `.blk`, and `.blk` itself (overflow:hidden on the block would clip its content)
  const targets = rulesFor(/\.badge\b|\.lbl\b|(^|[\s,])\.blk(\.[\w-]+)*($|[\s,])/);

  it('finds the rules it is checking', () => {
    expect(targets.length).toBeGreaterThan(3);
  });

  it('has no nowrap, ellipsis or overflow:hidden on .badge, .blk or .blk .lbl', () => {
    for (const r of targets) {
      expect(r.body, r.selector).not.toMatch(/nowrap/);
      expect(r.body, r.selector).not.toMatch(/ellipsis/);
      expect(r.body, r.selector).not.toMatch(/overflow(-x|-y)?:hidden/);
    }
  });

  it('lets long unbroken words wrap instead of spilling out of the block', () => {
    const badge = rulesFor(/^\.badge$/)[0]!;
    expect(badge.body).toMatch(/overflow-wrap:anywhere|word-break:break-word|white-space:normal/);
  });
});

describe('viewer CSS: timeline geometry', () => {
  const tl = rulesFor(/^\.tl$/);

  it('grid rows are content-sized, so a taller block never overlaps the next one', () => {
    for (const r of tl) {
      expect(r.body).not.toMatch(/grid-template-rows:/);
    }
    const auto = tl.find((r) => /grid-auto-rows:/.test(r.body))!;
    expect(auto.body).toMatch(/grid-auto-rows:(auto|minmax\([^,]+,auto\))[;}]?/);
  });

  it('gives every half-hour column at least 36px (72px per hour), on desktop and on narrow screens', () => {
    const withCols = tl.filter((r) => /grid-template-columns:/.test(r.body));
    expect(withCols.length).toBeGreaterThanOrEqual(2); // base + narrow-screen override
    for (const r of withCols) {
      const m = r.body.match(/repeat\(28,minmax\((\d+)px,1fr\)\)/);
      expect(m, r.body).not.toBeNull();
      expect(Number(m![1])).toBeGreaterThanOrEqual(36);
    }
  });

  it('keeps a minimum timeline width so it scrolls in its own container when narrower', () => {
    for (const r of tl.filter((x) => /grid-template-columns:/.test(x.body))) {
      const col = Number(r.body.match(/minmax\((\d+)px,1fr\)/)![1]);
      const min = r.body.match(/min-width:calc\([\d.]+rem\+(\d+)px\)/); // label column + 28 columns
      expect(min, r.body).not.toBeNull();
      expect(Number(min![1])).toBe(28 * col);
      expect(Number(min![1])).toBeGreaterThanOrEqual(28 * 36);
    }
    const scroll = rulesFor(/\.tl-scroll/)[0]!;
    expect(scroll.body).toMatch(/overflow-x:auto/);
  });
});
