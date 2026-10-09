import { describe, expect, it } from 'vitest';
import * as styles from './styles';
import { DARK_TOKENS, LIGHT_TOKENS, WASH_ALPHA, viewerCss } from './styles';

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
    expect(contrast(T('dupfg').rgb, over(T('dupbg'), card))).toBeGreaterThanOrEqual(AA);
    for (let i = 0; i < 5; i++) {
      expect(contrast(T('dupfg').rgb, over(T('dupbg'), T(`p${i}bg`).rgb)), `p${i}`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('block text (fg) on every lane colour and on its faded partly-cancelled variant', () => {
    for (let i = 0; i < 5; i++) {
      expect(contrast(T('fg').rgb, T(`p${i}bg`).rgb), `p${i}bg`).toBeGreaterThanOrEqual(AA);
      expect(contrast(T('fg').rgb, T(`p${i}fade`).rgb), `p${i}fade`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('the faded colour is roughly the lane colour mixed half-and-half with the card', () => {
    for (let i = 0; i < 5; i++) {
      T(`p${i}bg`).rgb.forEach((c, k) => {
        expect(Math.abs(T(`p${i}fade`).rgb[k]! - (c + card[k]!) / 2), `p${i} ch${k}`).toBeLessThanOrEqual(1.5);
      });
    }
  });

  it('no-show block: nsfg on nsbg (neutral grey: the channels are close together)', () => {
    expect(contrast(T('nsfg').rgb, T('nsbg').rgb)).toBeGreaterThanOrEqual(AA);
    for (const k of ['nsbg', 'nsfg']) expect(Math.max(...T(k).rgb) - Math.min(...T(k).rgb), k).toBeLessThanOrEqual(40);
  });

  it('cancelled block (hollow): cxfg text on the card, still quieter than fg (it reads as muted)', () => {
    expect(contrast(T('cxfg').rgb, card)).toBeGreaterThanOrEqual(AA);
    expect(contrast(T('cxfg').rgb, card)).toBeLessThan(contrast(T('fg').rgb, card));
  });

  it('no-show list text (muted) and the NLB note (muted) on the card', () => {
    expect(contrast(T('muted').rgb, card)).toBeGreaterThanOrEqual(AA);
  });

  it('the toast', () => {
    expect(contrast(T('toastfg').rgb, T('toast').rgb)).toBeGreaterThanOrEqual(AA);
  });
});

describe('viewer CSS: cancelled and no-show blocks', () => {
  const cancelled = rulesFor(/^\.blk\.st-cancelled$/)[0]!;
  const noShow = rulesFor(/^\.blk\.st-no-show$/)[0]!;
  const order = (sel: string) => css.indexOf(sel + '{');

  it('cancelled block looks hollow: card-coloured (opaque), no image, dashed muted outline, struck-through label', () => {
    expect(cancelled.body).toMatch(/background:var\(--card\)/);
    expect(cancelled.body).toMatch(/border:1pxdashedvar\(--muted\)/);
    expect(cancelled.body).toMatch(/color:var\(--cxfg\)/);
    expect(cancelled.body).not.toMatch(/opacity/);
    expect(rulesFor(/^\.blk\.st-cancelled \.lbl$/)[0]!.body).toMatch(/line-through/);
    expect(css).not.toMatch(/CANCELLED_OPACITY/);
  });

  it('the cancelled / no-show rules come after the lane-colour and room rules they must override', () => {
    for (const sel of ['.blk.p-0', '.blk.p-4', '.blk.k-room']) {
      expect(order('.blk.st-cancelled'), sel).toBeGreaterThan(order(sel));
      expect(order('.blk.st-no-show'), sel).toBeGreaterThan(order(sel));
    }
  });

  it('no-show block is neutral grey (nsbg / nsfg) with a dotted muted border, 3px on the left, not struck through', () => {
    expect(noShow.body).toMatch(/background:var\(--nsbg\)/);
    expect(noShow.body).toMatch(/color:var\(--nsfg\)/);
    expect(noShow.body).toMatch(/border:1pxdottedvar\(--muted\)/);
    expect(noShow.body).toMatch(/border-left-width:3px/);
    expect(noShow.body).not.toMatch(/line-through|opacity/);
    expect(rulesFor(/st-no-show.*\.lbl/)).toEqual([]);
  });

  it('partly-cancelled blocks use the faded lane colour, keep the solid lane edge, and are not struck through', () => {
    for (let i = 0; i < 5; i++) {
      const r = rulesFor(new RegExp(`^\\.blk\\.st-partial-cancelled\\.p-${i}$`));
      expect(r, `p-${i}`).toHaveLength(1);
      expect(r[0]!.body).toBe(`background:var(--p${i}fade)`); // border-left-color comes from .blk.p-N
      expect(css.indexOf(`.blk.st-partial-cancelled.p-${i}{`), `p-${i}`).toBeGreaterThan(css.indexOf(`.blk.p-${i}{`));
    }
    expect(rulesFor(/st-partial-cancelled.*\.lbl/)).toEqual([]);
  });

  it('has no ghost rules, no hatch and no GHOST_OPACITY', () => {
    expect(css).not.toMatch(/ghost/i);
    expect(css).not.toMatch(/repeating-linear-gradient/);
    expect('GHOST_OPACITY' in styles).toBe(false);
  });

  it('list rows: no-show text is muted without line-through; the note is small muted text', () => {
    const li = rulesFor(/^\.item\.st-no-show td$/)[0]!;
    expect(li.body).toMatch(/color:var\(--muted\)/);
    expect(li.body).not.toMatch(/line-through/);
    expect(rulesFor(/^\.nlb-note$/)[0]!.body).toMatch(/color:var\(--muted\)/);
    expect(rulesFor(/^\.item\.st-cancelled \.c-notes$/)[0]!.body).toMatch(/text-decoration:none/);
  });

  it('the day-heading count button is muted, link-style, with a visible focus ring', () => {
    const b = rulesFor(/^\.cnt$/)[0]!;
    expect(b.body).toMatch(/color:var\(--muted\)/);
    expect(b.body).toMatch(/background:none/);
    expect(b.body).toMatch(/border:0/);
    expect(b.body).toMatch(/text-decoration:underlinedotted/);
    expect(b.body).toMatch(/font:inherit/);
    expect(b.body).toMatch(/cursor:pointer/);
    expect(rulesFor(/^\.cnt:focus-visible$/)[0]!.body).toMatch(/outline:2pxsolid/);
  });

  it('the Show cancelled checkbox sits in the theme bar, which can wrap on narrow screens', () => {
    expect(rulesFor(/^\.themebar$/)[0]!.body).toMatch(/display:flex/);
    expect(rulesFor(/^\.themebar$/)[0]!.body).toMatch(/flex-wrap:wrap/);
    expect(rulesFor(/^\.cb$/)[0]!.body).toMatch(/color:var\(--fg\)/);
    expect(rulesFor(/^\.cb:focus-within$/)[0]!.body).toMatch(/outline/);
  });

  it('cxfg / dupfg are scoped: the duplicate badge text uses dupfg while the band keeps --dup; list cancelled rows stay muted', () => {
    expect(rulesFor(/^\.b-duplicate$/)[0]!.body).toMatch(/color:var\(--dupfg\)/);
    expect(rulesFor(/^\.ovl$/)[0]!.body).toMatch(/border:1pxdashedvar\(--dup\)/); // the red duplicate-room band
    expect(rulesFor(/^\.ovl$/)[0]!.body).toMatch(/background:var\(--dupbg\)/);
    expect(rulesFor(/^\.item\.st-cancelled td$/)[0]!.body).toMatch(/color:var\(--muted\)/);
    expect(css.match(/var\(--cxfg\)/g)).toHaveLength(1); // only the cancelled block's text
  });

  it('has no yellow overlap band: no ovl / ovlbg tokens and no .ovl-seat / .ovl-both rules', () => {
    for (const t of [LIGHT_TOKENS, DARK_TOKENS]) expect(t).not.toMatch(/--ovl/);
    expect(css).not.toMatch(/ovl-seat|ovl-both|--ovl|rgba\(250,204,21/);
    expect(rulesFor(/^\.ovl-room$/)).toEqual([]);
  });

  it('defines the no-show and faded tokens in both themes', () => {
    for (const t of [LIGHT_TOKENS, DARK_TOKENS]) {
      expect(t).toMatch(/--nsbg:#\w+;--nsfg:#\w+/);
      expect(t).toMatch(/--cxfg:#\w+/);
      expect(t).toMatch(/--dupfg:#\w+/);
      for (let i = 0; i < 5; i++) expect(t).toMatch(new RegExp(`--p${i}fade:#\\w+`));
    }
  });
});

// ---- the past wash: as dark as it can be while every text-on-fill pair in a block stays AA --------------

describe.each([
  ['light', LIGHT_TOKENS, WASH_ALPHA.light],
  ['dark', DARK_TOKENS, WASH_ALPHA.dark],
])('viewer CSS: %s past wash', (_name, tokens, alpha) => {
  const t = tokenMap(tokens) as Record<string, { rgb: RGB; a: number }>;
  const T = (k: string) => t[k]!;
  const card = T('card').rgb;
  const wash = T('wash').rgb;

  // [name, text colour, fill colour] for every pair that can appear inside a block
  const pairs: Array<[string, RGB, RGB]> = [];
  for (let i = 0; i < 5; i++) {
    pairs.push([`fg/p${i}bg`, T('fg').rgb, T(`p${i}bg`).rgb], [`fg/p${i}fade`, T('fg').rgb, T(`p${i}fade`).rgb]);
  }
  pairs.push(['nsfg/nsbg', T('nsfg').rgb, T('nsbg').rgb], ['cxfg/card', T('cxfg').rgb, card], ['warn/warnbg', T('warn').rgb, T('warnbg').rgb]);
  const fills: Array<[string, RGB]> = [['card', card]];
  for (let i = 0; i < 5; i++) fills.push([`p${i}bg`, T(`p${i}bg`).rgb], [`p${i}fade`, T(`p${i}fade`).rgb]);
  for (const [n, f] of fills) pairs.push([`dupfg/dupbg on ${n}`, T('dupfg').rgb, over(T('dupbg'), f)]);

  const blend = (c: RGB, a: number): RGB => c.map((v, k) => v * (1 - a) + wash[k]! * a) as RGB;
  const at = ([, fg, bg]: [string, RGB, RGB], a: number) => contrast(blend(fg, a), blend(bg, a));
  const maxAlpha = (p: [string, RGB, RGB]) => {
    let [lo, hi] = [0, 1];
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (at(p, mid) >= 4.5) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const limit = Math.min(...pairs.map(maxAlpha));

  it('every pair is AA before any wash (the search below starts from a valid state)', () => {
    for (const p of pairs) expect(at(p, 0), p[0]).toBeGreaterThanOrEqual(4.5);
  });

  it('the token carries exactly the exported alpha, over the documented colour', () => {
    expect(T('wash').a).toBe(alpha);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  it('keeps every text-on-fill pair at AA once text and fill are blended with the wash', () => {
    for (const p of pairs) expect(at(p, alpha), p[0]).toBeGreaterThanOrEqual(4.5);
  });

  it('is as dark as possible: within 0.01 of the AA maximum (rounded down to two decimals)', () => {
    expect(alpha).toBeLessThanOrEqual(limit);
    expect(limit - alpha).toBeLessThan(0.01);
    expect(Math.round(alpha * 100) / 100).toBe(alpha);
  });

  it('one hundredth more would break AA for some pair', () => {
    expect(pairs.some((p) => at(p, alpha + 0.01) < 4.5)).toBe(true);
  });
});

describe('viewer CSS: now-line, chip, wash and positional minute classes', () => {
  it('defines .mo-0 .. .mo-29 (left offset N/30 of the column) and .mw-1 .. .mw-29 (width N/30)', () => {
    const pct = (n: number) => +((n * 100) / 30).toFixed(3);
    for (let n = 0; n < 30; n++) expect(rulesFor(new RegExp(`^\\.mo-${n}$`))[0]!.body, `mo-${n}`).toBe(`margin-left:${pct(n)}%`);
    for (let n = 1; n < 30; n++) expect(rulesFor(new RegExp(`^\\.mw-${n}$`))[0]!.body, `mw-${n}`).toBe(`width:${pct(n)}%`);
    expect(rulesFor(/^\.mw-0$/)).toEqual([]);
    expect(rulesFor(/^\.mo-30$/)).toEqual([]);
  });

  it('mo / mw come after the base rules, so they override the default width', () => {
    expect(css.indexOf('.mw-1{')).toBeGreaterThan(css.indexOf('.wash{'));
    expect(css.indexOf('.mo-1{')).toBeGreaterThan(css.indexOf('.now{'));
  });

  it('the now-line is a 2px --fg line above the wash; the wash is in front of blocks, behind the line, and click-through', () => {
    const z = (sel: string) => Number(rulesFor(new RegExp(`^${sel.replace('.', '\\.')}$`))[0]!.body.match(/z-index:(\d+)/)![1]);
    const now = rulesFor(/^\.now$/)[0]!;
    expect(now.body).toMatch(/width:2px/);
    expect(now.body).toMatch(/background:var\(--fg\)/);
    const wash = rulesFor(/^\.wash$/)[0]!;
    expect(wash.body).toMatch(/background:var\(--wash\)/);
    expect(wash.body).toMatch(/pointer-events:none/);
    expect(z('.wash')).toBeGreaterThan(z('.blk'));
    expect(z('.now')).toBeGreaterThan(z('.wash'));
    expect(z('.now-chip')).toBeGreaterThan(z('.now'));
    expect(z('.lane-hd')).toBeGreaterThan(z('.now-chip')); // the sticky lane label stays on top when scrolled
  });

  it('the chip is --card text on --fg', () => {
    const chip = rulesFor(/^\.now-chip$/)[0]!;
    expect(chip.body).toMatch(/background:var\(--fg\)/);
    expect(chip.body).toMatch(/color:var\(--card\)/);
  });

  it('draws a visible centre divider on the second lane and its label', () => {
    const r = rulesFor(/^\.lane-bg\.centre,\.lane-hd\.centre$/)[0]!;
    expect(r.body).toMatch(/border-top:2pxsolidvar\(--muted\)/);
  });

  it('styles the legend: a details.key whose swatches reuse the block classes at a mini size', () => {
    expect(rulesFor(/^\.key$/)).toHaveLength(1);
    expect(rulesFor(/^\.key summary$/)).toHaveLength(1);
    expect(rulesFor(/^\.key-items$/)[0]!.body).toMatch(/flex-wrap:wrap/);
    const sw = rulesFor(/^\.blk\.sw$/)[0]!;
    expect(sw.body).toMatch(/margin:0/);
    expect(sw.body).toMatch(/height:1\.1rem/);
    expect(css.indexOf('.blk.sw{')).toBeGreaterThan(css.indexOf('.blk{'));
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
