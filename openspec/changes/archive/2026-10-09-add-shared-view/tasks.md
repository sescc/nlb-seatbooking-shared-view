# Tasks: add-shared-view

## 1. Scaffold + domain (agent A, first)
- [x] 1.1 package.json, tsconfig.json, vitest.config.ts (unit + worker projects), wrangler.toml (no vars/secrets), .gitignore, .dev.vars.example
- [x] 1.2 shared/src/types.ts exactly as in design.md
- [x] 1.3 shared/src/time.ts + booking.ts (toSgtIso, detectKind, mapStatus, extract), TDD with fixtures built from the spike S1 shape (seat, room, cancelled, auto-check-in, hourly rows, offset-less times, visitBookings ignored, profile keys never copied)
- [x] 1.4 shared/src/payload.ts validatePayload, TDD (bad types, v≠1, start≥end, bad offset, >200 bookings, pushedAt 5 min+1 s in future rejected, exactly 5 min accepted)
- [x] 1.5 shared/src/blocks.ts mergeBlocks, TDD (4 hourly rows → 1 block; gap breaks; status change breaks; different unit breaks)
- [x] 1.6 shared/src/overlap.ts computeOverlaps, TDD (touching = none; seat in partner room → seat_in_partner_room + redundantSeat; cancelled excluded; same person never overlaps self)
- [x] 1.7 shared/src/staleness.ts computeStaleness, TDD (exactly start+15 → unverified; push after deadline → verified; checked_in never; never-pushed → nulls)

## 2. Board (agent B, after 1)
- [x] 2.1 scripts/build.mjs (esbuild → worker/src/generated/assets.ts); npm scripts build/pretest/predeploy
- [x] 2.2 worker/src/config.ts (parse PEOPLE/VIEW_SECRET, constant-time compare)
- [x] 2.3 worker/src/board.ts Board DO (SQLite snapshot table, put with 2 s rate limit, board view)
- [x] 2.4 worker/src/index.ts router + guard, per design; push form → 303, JSON → 204, 400/429/404 cases
- [x] 2.5 worker tests: every booking-push + deployment-privacy scenario (wrong secret/unknown path/`/` byte-identical 404; headers on all responses; view secret as push token → 404; 64 KB cap; empty push clears; replace semantics; no outbound fetch — assert via a fetch spy/outboundService)
- [x] 2.6 push/bookmarklet.ts + push/userscript.ts per design; unit tests for payload building with a stubbed document/store
- [x] 2.7 worker/src/pages.ts setupHtml + userscriptFile (inject origin + token as JSON-escaped literals); test that output contains the token and the request origin
- [x] 2.8 scripts/init-secrets.mjs + README.md (clone → npm i → wrangler login → init-secrets → deploy → open /setup/<view>; leak caveats; rotation)

## 3. Viewer (agent C, after 1, parallel with 2)
- [x] 3.1 web/render.ts render(board, nowIso) pure, HTML-escaped; tests for every shared-view scenario (both days, UTC device irrelevant since SGT strings, merged block, room spans lanes with booker + pax, struck-through cancelled, overlap highlight + possibly-redundant, freshness labels, unverified badge, "No bookings")
- [x] 3.2 web/app.ts polling (5 s visible-only, immediate on visible, 30 s re-render tick, ?pushed toast + replaceState); test visibility logic with a fake document/timer
- [x] 3.3 worker/src/pages.ts viewerHtml shell (nonce'd inline script/style, noindex meta), coordinated with agent B (B owns pages.ts; C supplies CSS + markup shell as web/shell.ts exporting functions)

## 4. Reconcile + verify (orchestrator)
- [x] 4.1 `npm test` all green; `npm run typecheck`
- [x] 4.2 wrangler dev + browser pane: form POST fixture → 303 → view; second tab updates ≤5 s; hidden tab stops polling (hidden-tab stop covered by web/poller.test.ts; the browser pane keeps background tabs visible)
- [x] 4.3 Every new morphism gets a row in docs/<component>/IMPLEMENTATION.md with its file:symbol; reconcile ARCHITECTURE.md, IMPLEMENTATION.md, STATUS.md
- [x] 4.4 supercharge drift check passes (files staged with `git add -N` by the user if needed) (0 dead / 136 refs in a tracked throwaway copy; untracked files show as dead in the working repo)
- [x] 4.5 Review files docs/<component>/reviews/review-add-shared-view.md (§4.5 checklist)
