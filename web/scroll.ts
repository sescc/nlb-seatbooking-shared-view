// First-paint helper: when Today's timeline scrolls sideways (narrow screens), bring the now-line to the middle.
// Duck-typed so it is unit-testable without a DOM; app.ts calls it once, after the first paint only.
interface ScrollerLike {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
  querySelector(sel: string): object | null;
}

/** Returns true when it scrolled. Does nothing when the timeline fits or there is no now-line (outside 08:00-22:00). */
export function centreNow(scroller: ScrollerLike | null): boolean {
  if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return false;
  const now = scroller.querySelector('.now') as { offsetLeft: number } | null;
  if (!now) return false;
  scroller.scrollLeft = Math.max(0, now.offsetLeft - scroller.clientWidth / 2);
  return true;
}
