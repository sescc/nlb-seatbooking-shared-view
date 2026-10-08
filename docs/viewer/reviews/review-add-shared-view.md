# Review — add-shared-view (viewer)

> §4.5 checklist run after building, 2026-10-09.

## Coherence
- [x] **1. Placement honesty.** `render` reads only the last `Board`, delivered by T3, plus `now`. `now` is estimated from the server's `serverNow` plus the local time elapsed since the fetch, so no device clock skew affects it.
- [x] **4. Dependency mediation.** The page talks only to `/api/<view>/board` (CSP `connect-src 'self'`) and loads no third-party resources.
- [x] **Deduce, don't store.** Overlaps, staleness and blocks are recomputed on every render. Nothing is kept beyond the last `Board`.

## Verified (browser pane, local wrangler dev, test secrets)
- **Narrow layout (about 420 px):** the page doesn't scroll sideways; the timeline scrolls inside its own container, and the list becomes cards.
- **Desktop (1280 px):**
  - Today and Tomorrow are stacked.
  - Hourly rows are merged into blocks (S201 10:00–12:00, R3 14:00–16:00).
  - Rooms are shown in both lanes.
  - A cancelled seat is struck through.
  - A seat overlapping the partner's room shows "possibly redundant"; two rooms at the same time show "duplicate room".
- **Live update:** a second tab showed TestB's re-push (new 18:00 seat, old bookings gone) within 6 s.
- **Hidden-tab polling stop:** the browser pane keeps background tabs `visible`, so this could not be shown there. It is covered by web/poller.test.ts.

## Known cosmetic limits
- In a 1-hour block, the badge text is clipped at desktop width; the full badge is shown in the list's Notes column.
