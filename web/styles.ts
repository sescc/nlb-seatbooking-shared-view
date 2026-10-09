// All viewer CSS, delivered in the single nonced <style> by shell.ts. No external resources of any kind.
// The positional classes used by render.ts (.s-HHMM .d-N .r-N .h-N, see layout.ts) are generated here.
import { MAX_ROWS, SLOTS, slotHHMM } from './layout';

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
  return css;
}

// Colour tokens: ONE source for both themes. The dark set is emitted twice (OS preference, and forced dark)
// from the same string, never copied. Contrast (WCAG AA for text) is checked in styles.test.ts.
export const LIGHT = {
  bg: '#f4f5f7', fg: '#1b2027', muted: '#667085', card: '#ffffff', line: '#d5dae1',
  ovl: '#ca8a04', ovlbg: 'rgba(250,204,21,.28)', dup: '#991b1b', dupbg: 'rgba(239,68,68,.22)',
  warn: '#92400e', warnbg: '#fef3c7', toast: '#14532d', toastfg: '#ffffff',
  p0: '#2563eb', p0bg: '#dbeafe', p1: '#c2410c', p1bg: '#ffedd5', p2: '#0f766e', p2bg: '#ccfbf1',
  p3: '#7e22ce', p3bg: '#f3e8ff', p4: '#be185d', p4bg: '#fce7f3',
  nsbg: '#f7e6e6', nsfg: '#7a2e2e',
} as const;
export const DARK: Record<keyof typeof LIGHT, string> = {
  bg: '#11151a', fg: '#e6e9ee', muted: '#9aa4b2', card: '#1a2028', line: '#323b47',
  ovl: '#facc15', ovlbg: 'rgba(250,204,21,.22)', dup: '#fecaca', dupbg: 'rgba(239,68,68,.3)',
  warn: '#fcd34d', warnbg: '#422006', toast: '#bbf7d0', toastfg: '#052e16',
  p0: '#60a5fa', p0bg: '#1e3a5f', p1: '#fb923c', p1bg: '#5a2a0c', p2: '#2dd4bf', p2bg: '#0f3d3a',
  p3: '#c084fc', p3bg: '#3b1a5c', p4: '#f472b6', p4bg: '#5a1238',
  nsbg: '#3b2326', nsfg: '#e8c6c6',
};
const decl = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';');
export const LIGHT_TOKENS = decl(LIGHT);
export const DARK_TOKENS = decl(DARK);
// Dimming for partner-room copies; high enough to keep text at AA in both themes.
export const GHOST_OPACITY = 0.8;
// .blk.st-cancelled looks hollow but is filled with the card colour: opaque, so an overlap band behind it can't lower the text contrast.
// Its partner-room copy is not dimmed (muted text at GHOST_OPACITY would fail AA).

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
.lane-hd{grid-column:1;position:sticky;left:0;z-index:4;background:var(--card);display:flex;flex-direction:column;justify-content:center;padding:.2rem .5rem .2rem 0;border-right:1px solid var(--line);min-width:0}
.lane-hd .who{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lane-hd .fresh{font-size:.72rem;color:var(--muted)}
.lane-hd .never{font-style:italic}
.lane-bg{grid-column:2/-1;z-index:0;border-top:1px solid var(--line);background-image:linear-gradient(to right,var(--line) 1px,transparent 1px);background-size:calc(100%/14) 100%}
.blk{z-index:2;margin:3px 1px;padding:.15rem .25rem;border-radius:6px;border-left:3px solid var(--line);font-size:.78rem;line-height:1.25;display:flex;flex-wrap:wrap;gap:.15rem .35rem;align-content:center;min-width:0}
.blk .lbl{font-weight:600;overflow-wrap:anywhere}
.k-room .lbl{font-weight:500}
.blk.p-0{background:var(--p0bg);border-left-color:var(--p0)}
.blk.p-1{background:var(--p1bg);border-left-color:var(--p1)}
.blk.p-2{background:var(--p2bg);border-left-color:var(--p2)}
.blk.p-3{background:var(--p3bg);border-left-color:var(--p3)}
.blk.p-4{background:var(--p4bg);border-left-color:var(--p4)}
.blk.k-room{border-style:solid;border-top:1px dashed var(--muted);border-right:1px dashed var(--muted);border-bottom:1px dashed var(--muted)}
.blk.ghost{opacity:${GHOST_OPACITY};background-image:repeating-linear-gradient(135deg,transparent 0 5px,rgba(127,127,127,.3) 5px 7px)}
.blk.st-cancelled{background:var(--card);background-image:none;border:1px dashed var(--muted);border-left-width:3px;color:var(--muted)}
.blk.ghost.st-cancelled{opacity:1}
.blk.st-no-show{background:var(--nsbg);background-image:none;color:var(--nsfg);border-left-color:var(--nsfg)}
.blk.st-cancelled .lbl{text-decoration:line-through}
.ovl{z-index:1;border:1px dashed var(--ovl);background:var(--ovlbg);pointer-events:none;border-radius:4px;margin:1px 0}
.ovl-room{border-color:var(--dup);background:var(--dupbg)}
.ovl-lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.badge{display:inline-block;font-size:.62rem;font-weight:600;line-height:1.3;padding:0 .25rem;border-radius:8px;background:var(--warnbg);color:var(--warn);border:1px solid currentColor;white-space:normal;overflow-wrap:anywhere;min-width:0}
.b-duplicate{background:var(--dupbg);color:var(--dup)}
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
