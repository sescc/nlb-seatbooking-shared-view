## Why
Fully cancelled bookings (NLB `ManualFullCancel`) clutter both the timeline and the list, even after the hollow restyle. The user wants them hidden by default, with a way to see them when needed.

## What Changes
- Cancelled bookings are hidden by default, in both the timeline (including partner-lane copies of a cancelled room) and the list. The timeline closes up around them; the hour header and lanes are still always drawn.
- A "Show cancelled" checkbox beside the theme switch. It is remembered per browser and applies to both days.
- Each day heading shows "· N cancelled hidden", which reveals that day only, or "· Hide N cancelled", which re-hides it. A per-day reveal lasts until reload.
- Changing the checkbox resets every per-day reveal.
- A day with only cancelled bookings shows "No active bookings".
- No-show and partly cancelled bookings are never hidden.

## Capabilities
### Modified Capabilities
- `shared-view`: cancelled bookings are hidden by default; new cancelled-visibility controls.

## Impact
- `web/render.ts` (`render` takes `ViewPrefs`), new `web/cancelled.ts`, `web/shell.ts`, `web/app.ts`, `web/styles.ts`.
- No server, wire-format or domain change.
