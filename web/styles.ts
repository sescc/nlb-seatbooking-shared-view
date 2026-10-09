// All viewer CSS, delivered in the single nonced <style> by shell.ts. No external resources of any kind.
// The positional classes used by render.ts (.s-HHMM .d-N .r-N .h-N, see layout.ts) are generated here.
import { MAX_ROWS, SLOTS, SLOT_MIN, slotHHMM } from './layout';

// A 1-hour block (two half-hour columns) must fit a unit name plus a wrapped badge word: 72px per hour.
// Below this the timeline scrolls inside its own container (.tl-scroll); the page itself never does.
const COL_MIN_PX = 38;
const TL_MIN_PX = SLOTS * COL_MIN_PX; // 1064

function positionalCss(): string {
  let css = '';
  for (let i = 0; i < SLOTS; i++) css += `.s-${slotHHMM(i)}{grid-column-start:${i + 2}}`;
  for (let n = 1; n <= SLOTS; n++) css += `.d-${n}{grid-column-end:span ${n}}`;
  for (let n = 1; n <= MAX_ROWS; n++) css += `.r-${n}{grid-row-start:${n}}`;
  for (let n = 1; n <= MAX_ROWS; n++) css += `.h-${n}{grid-row-end:span ${n}}`;
  // minutes into a half-hour slot: .mo-N offsets the now-line / chip, .mw-N is the width of the partial wash (N/30 of the column)
  const pct = (n: number) => +((n * 100) / SLOT_MIN).toFixed(3);
  for (let n = 0; n < SLOT_MIN; n++) css += `.mo-${n}{margin-left:${pct(n)}%}`;
  for (let n = 1; n < SLOT_MIN; n++) css += `.mw-${n}{width:${pct(n)}%}`;
  return css;
}

// Colour tokens: ONE source for both themes. The dark set is emitted twice (OS preference, and forced dark)
// from the same string, never copied. Contrast (WCAG AA for text) is checked in styles.test.ts.
// Wash over the past part of Today, in front of blocks. The alpha is the darkest (2 decimals) that keeps every block text/fill pair at AA once both are blended; styles.test.ts recomputes it.
export const WASH_ALPHA = { light: 0.26, dark: 0.34 } as const;
export const LIGHT = {
  bg: '#f4f5f7', fg: '#1b2027', muted: '#667085', card: '#ffffff', line: '#d5dae1',
  dup: '#991b1b', dupfg: '#7a1c1c', dupbg: 'rgba(239,68,68,.22)',
  warn: '#92400e', warnbg: '#fef3c7', toast: '#14532d', toastfg: '#ffffff',
  p0: '#2563eb', p0bg: '#dbeafe', p1: '#c2410c', p1bg: '#ffedd5', p2: '#0f766e', p2bg: '#ccfbf1',
  p3: '#7e22ce', p3bg: '#f3e8ff', p4: '#be185d', p4bg: '#fce7f3',
  p0fade: '#edf5ff', p1fade: '#fff6ea', p2fade: '#e6fdf8', p3fade: '#f9f4ff', p4fade: '#fef3f9',
  nsbg: '#eef0f3', nsfg: '#475467', cxfg: '#4b5563', wash: `rgba(71,84,103,${WASH_ALPHA.light})`,
} as const;
export const DARK: Record<keyof typeof LIGHT, string> = {
  bg: '#11151a', fg: '#e6e9ee', muted: '#9aa4b2', card: '#1a2028', line: '#323b47',
  dup: '#fecaca', dupfg: '#ffe4e6', dupbg: 'rgba(239,68,68,.3)',
  warn: '#fcd34d', warnbg: '#422006', toast: '#bbf7d0', toastfg: '#052e16',
  p0: '#60a5fa', p0bg: '#1e3a5f', p1: '#fb923c', p1bg: '#5a2a0c', p2: '#2dd4bf', p2bg: '#0f3d3a',
  p3: '#c084fc', p3bg: '#3b1a5c', p4: '#f472b6', p4bg: '#5a1238',
  p0fade: '#1c2d44', p1fade: '#3a251a', p2fade: '#152f31', p3fade: '#2b1d42', p4fade: '#3a1930',
  nsbg: '#262d36', nsfg: '#c3cad4', cxfg: '#c3cad4', wash: `rgba(0,0,0,${WASH_ALPHA.dark})`,
};
const decl = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';');
export const LIGHT_TOKENS = decl(LIGHT);
export const DARK_TOKENS = decl(DARK);
// cxfg is the text colour of a cancelled block only (--muted stays for the list): a little stronger than muted so the wash can be dark; dupfg is the duplicate badge's text (--dup stays the band's border).
// .blk.st-cancelled looks hollow but is filled with the card colour: opaque, so an overlap band behind it can't lower the text contrast.

const BASE = `
:root{color-scheme:light dark;${LIGHT_TOKENS}}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${DARK_TOKENS}}}
:root[data-theme=dark]{${DARK_TOKENS};color-scheme:dark}
:root[data-theme=light]{color-scheme:light}*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1320px;margin:0 auto;padding:1rem 16px 4rem}
h1{font-size:1.25rem;margin:0}
h2{font-size:1.1rem;margin:0 0 .5rem}
.date{color:var(--muted);font-weight:400;font-size:.9rem;margin-left:.4rem}
.top{margin-bottom:1rem}
.key{margin:0 0 .5rem;font-size:.78rem;color:var(--muted)}
.key summary{display:inline-block;cursor:pointer;padding:.1rem 0;text-decoration:underline dotted;text-underline-offset:3px}
.key summary:focus-visible{outline:2px solid var(--p0);outline-offset:2px;border-radius:3px}
.key-items{display:flex;flex-wrap:wrap;gap:.35rem 1.1rem;margin-top:.4rem;color:var(--fg)}
.ki{display:inline-flex;align-items:center;gap:.35rem}
.ki .badge{flex:none}
.themebar{float:right;margin:.1rem 0 .5rem .75rem;display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:.4rem .9rem}
.cb{display:inline-flex;align-items:center;gap:.35rem;font-size:.78rem;color:var(--fg);cursor:pointer;white-space:nowrap}
.cb input{margin:0;width:1rem;height:1rem;accent-color:var(--p0);cursor:pointer}
.cb:focus-within{outline:2px solid var(--p0);outline-offset:2px;border-radius:4px}
.cnt{font:inherit;font-size:.8rem;font-weight:400;color:var(--muted);background:none;border:0;padding:.1rem .2rem;margin-left:.3rem;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}
.cnt:focus-visible{outline:2px solid var(--p0);outline-offset:2px;border-radius:3px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;background:var(--card);overflow:hidden}
.seg button{font:inherit;font-size:.78rem;color:var(--fg);background:transparent;border:0;padding:.3rem .7rem;cursor:pointer}
.seg button+button{border-left:1px solid var(--line)}
.seg button[aria-pressed=true]{background:var(--fg);color:var(--card);font-weight:600}
.seg button:focus-visible{outline:2px solid var(--p0);outline-offset:-2px}
.sub,.note{color:var(--muted);font-size:.85rem;margin:.2rem 0 .6rem}
.empty,.loading{color:var(--muted);padding:.8rem 0}
.day{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.9rem;margin-bottom:1.25rem;min-width:0}
.tl-scroll,.list-scroll{overflow-x:auto;max-width:100%}
.tl{display:grid;grid-template-columns:6.5rem repeat(${SLOTS},minmax(${COL_MIN_PX}px,1fr));grid-auto-rows:minmax(2.6rem,auto);min-width:calc(6.5rem + ${TL_MIN_PX}px);position:relative}
.hd{font-size:.72rem;color:var(--muted);border-left:1px solid var(--line);padding:0 .25rem .2rem;align-self:end;white-space:nowrap}
.lane-hd{grid-column:1;position:sticky;left:0;z-index:6;background:var(--card);display:flex;flex-direction:column;justify-content:center;padding:.2rem .5rem .2rem 0;border-right:1px solid var(--line);min-width:0}
.lane-hd .who{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lane-hd .fresh{font-size:.72rem;color:var(--muted)}
.lane-hd .never{font-style:italic}
.lane-bg{grid-column:2/-1;z-index:0;border-top:1px solid var(--line);background-image:linear-gradient(to right,var(--line) 1px,transparent 1px);background-size:calc(100%/14) 100%}
.lane-bg.centre,.lane-hd.centre{border-top:2px solid var(--muted)}
.wash{z-index:3;background:var(--wash);pointer-events:none;justify-self:start;width:100%}
.now{z-index:4;width:2px;background:var(--fg);justify-self:start;pointer-events:none}
.now-chip{z-index:5;justify-self:start;align-self:start;transform:translateX(-50%);margin-top:.15rem;padding:0 .35rem;border-radius:8px;background:var(--fg);color:var(--card);font-size:.68rem;font-weight:600;line-height:1.3;white-space:nowrap;pointer-events:none}
.blk{z-index:2;margin:3px 1px;padding:.15rem .25rem;border-radius:6px;border-left:3px solid var(--line);font-size:.78rem;line-height:1.25;display:flex;flex-wrap:wrap;gap:.15rem .35rem;align-content:center;min-width:0}
.blk .lbl{font-weight:600;overflow-wrap:anywhere}
.k-room .lbl{font-weight:500}
.blk.p-0{background:var(--p0bg);border-left-color:var(--p0)}
.blk.p-1{background:var(--p1bg);border-left-color:var(--p1)}
.blk.p-2{background:var(--p2bg);border-left-color:var(--p2)}
.blk.p-3{background:var(--p3bg);border-left-color:var(--p3)}
.blk.p-4{background:var(--p4bg);border-left-color:var(--p4)}
.blk.k-room{border-style:solid;border-top:1px dashed var(--muted);border-right:1px dashed var(--muted);border-bottom:1px dashed var(--muted)}
.blk.st-partial-cancelled.p-0{background:var(--p0fade)}
.blk.st-partial-cancelled.p-1{background:var(--p1fade)}
.blk.st-partial-cancelled.p-2{background:var(--p2fade)}
.blk.st-partial-cancelled.p-3{background:var(--p3fade)}
.blk.st-partial-cancelled.p-4{background:var(--p4fade)}
.blk.st-cancelled{background:var(--card);border:1px dashed var(--muted);border-left-width:3px;color:var(--cxfg)}
.blk.st-no-show{background:var(--nsbg);color:var(--nsfg);border:1px dotted var(--muted);border-left-width:3px}
.blk.st-cancelled .lbl{text-decoration:line-through}
.sw{flex:none}
.blk.sw{display:inline-flex;align-items:center;justify-content:center;margin:0;padding:0 .2rem;min-width:1.9rem;height:1.1rem;font-size:.68rem;line-height:1}
.ovl.sw{display:inline-block;width:1.9rem;height:1.1rem;margin:0}
.ovl{z-index:1;border:1px dashed var(--dup);background:var(--dupbg);pointer-events:none;border-radius:4px;margin:1px 0}
.ovl-lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.badge{display:inline-block;font-size:.62rem;font-weight:600;line-height:1.3;padding:0 .25rem;border-radius:8px;background:var(--warnbg);color:var(--warn);border:1px solid currentColor;white-space:normal;overflow-wrap:anywhere;min-width:0}
.b-duplicate{background:var(--dupbg);color:var(--dupfg)}
.list{width:100%;border-collapse:collapse;margin-top:.9rem;font-size:.86rem}
.list th{text-align:left;color:var(--muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;padding:.3rem .5rem;border-bottom:1px solid var(--line)}
.list td{padding:.4rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}
.list .c-time{white-space:nowrap;font-variant-numeric:tabular-nums}
.item.st-cancelled td{color:var(--muted);text-decoration:line-through}
.item.st-cancelled .c-notes{text-decoration:none}
.item.st-no-show td{color:var(--muted)}
.nlb-note{color:var(--muted);font-size:.8rem}
.item.p-0 .c-who{box-shadow:inset 3px 0 var(--p0)}
.item.p-1 .c-who{box-shadow:inset 3px 0 var(--p1)}
.item.p-2 .c-who{box-shadow:inset 3px 0 var(--p2)}
.item.p-3 .c-who{box-shadow:inset 3px 0 var(--p3)}
.item.p-4 .c-who{box-shadow:inset 3px 0 var(--p4)}
.item .c-who{padding-left:.7rem}
#conn{position:fixed;top:.5rem;right:.75rem;z-index:20;font-size:.78rem;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:.1rem .6rem}
#toast{position:fixed;left:50%;bottom:1.25rem;transform:translateX(-50%);z-index:30;background:var(--toast);color:var(--toastfg);padding:.55rem 1rem;border-radius:999px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.25)}
@media (max-width:640px){
main{padding:.75rem 16px 4rem}
.seg button{padding:.4rem .8rem}
.day{padding:.65rem}
.tl{grid-template-columns:5.5rem repeat(${SLOTS},minmax(${COL_MIN_PX}px,1fr));min-width:calc(5.5rem + ${TL_MIN_PX}px)}
.list thead{display:none}
.list,.list tbody,.list tr,.list td{display:block;width:100%}
.list tr{border:1px solid var(--line);border-radius:8px;margin-bottom:.5rem;padding:.25rem 0}
.list td{border:0;padding:.15rem .6rem;display:flex;gap:.6rem}
.list td::before{content:attr(data-label);flex:0 0 5.2rem;color:var(--muted);font-size:.72rem;text-transform:uppercase;padding-top:.15rem}
.item .c-who{padding-left:.6rem}
}
`;

export function viewerCss(): string {
  return BASE.trim() + '\n' + positionalCss();
}
