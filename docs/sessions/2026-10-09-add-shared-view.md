# 2026-10-09 — add-shared-view

## 0. Continuation brief
**Current state.**
- The NLB shared booking view is built, tested (378 vitest tests, typecheck clean), deployed to the user's Cloudflare account, and field-verified:
  - the user pushed real bookings from NLB via the 911-byte bookmarklet on Android Chrome and saw them on the shared page;
  - the desktop bookmarklet path was proven by spike S1.
- OpenSpec change `add-shared-view` is archived, and its specs are merged into `openspec/specs/`.
- Nothing is committed yet. The user does all git commits.

**Next step.** The user commits. Then, optionally:
- try the userscript on a real NLB page;
- record the action code NLB uses for a no-show auto-cancel when one occurs.

**Resume check.** Run `npm test` and read `docs/STATUS.md`.

## 1. Work completed
- **Grilling and plan.** Approved plan: `C:\Users\FMW\.claude\plans\q1-a-q2-awareness-gentle-wand.md`. The decision log, D1–D45, is in `CLAUDE.md`.
- **Research, with no NLB login by any agent.**
  - NLB seat booking is a Vue 2 SPA using an OIDC/CAS cookie session behind AWS WAF.
  - CSP: `connect-src` blocks cross-origin fetch, and there is no `form-action`.
  - GetAccountInfo holds the bookings.
- **Spike S1** (`spike/`): run by the user on desktop Chrome. It gave the real booking shape: offset-less SGT times, hourly rows, `infoJson.NumberOfPeople` for rooms, and cancelled bookings still returned.
- **supercharge scaffold.**
  - `docs/` tree with four components: domain, push-client, board, viewer.
  - `openspec/config.yaml` rules.
  - Model before code.
- **Code, delegated to Sonnet agents and reviewed.**
  - `shared/src`, `worker/src`, `web/`, `push/`, `scripts/`, README.
- **Mid-session redesign (D41–D43).** Android Chrome truncated the 3.8 KB bookmarklet.
  - The wire format is now raw NLB rows trimmed to `NLB_ROW_KEYS`, with `extract` running on the server.
  - The bookmarklet is now 911 bytes.
- **Local end-to-end checks** with throwaway secrets, plus the user's real deployment and Android test.
- Reviews `docs/*/reviews/review-add-shared-view.md` written; change archived.

## 2. Decisions
The full list, with who decided and why, is in `CLAUDE.md`. Key kept and discarded options:

| Decision | Verdict | Why |
| --- | --- | --- |
| Server logs in to NLB with stored passwords | discarded (user) | NLB ToS §6; credential risk |
| Server holds the NLB session token | discarded | equivalent to holding the password; needs keep-alive pings |
| Email ingestion (Gmail Apps Script) | discarded | only one person uses Gmail; can't see cancellations reliably |
| One-tap push from the NLB page (bookmarklet + optional userscript) | kept (user) | exact data, no credentials |
| Live-mode toggle with auto-off | superseded → always live while the page is visible | the server never calls NLB, so polling costs NLB nothing |
| Run `extract` on the NLB page (L1) | superseded → extract on the Worker (L2) | Android bookmark URL length limit |
| Tabs for Today/Tomorrow | discarded (user) | both days on one page |
| Secret URL vs Cloudflare Access login | secret URL kept (user) | simplest; noindex, no-referrer and bare 404s mitigate discovery |
| Room+room overlap flag | added (D38) | the core duplication case |

## 3. Tests, checks, benchmarks
| Check | Result | What it proved |
| --- | --- | --- |
| `npm test` | 19 files, 378 passed | domain rules, worker routes, privacy, push clients, viewer |
| `npm run typecheck` | clean (root + web + push) | types consistent across L1/L2/L4 code |
| drift check in a tracked throwaway copy | 0 dead / 136 refs | IMPLEMENTATION.md refs resolve |
| local `wrangler dev` + `push2.mjs` | form 303, JSON 204, re-push within 2 s → 429, 70 KB → 400, Purpose not stored | ingest contract |
| browser pane, 1280 px and about 420 px | layout correct; merged blocks; badges | shared-view spec |
| two tabs + re-push | second tab updated within 6 s | live polling |
| user: Android Chrome bookmarklet on real NLB, deployed Worker | push received and shown | the end-to-end production path |
| bookmarklet size | 911 B served (60-char origin, 43-char token) | fits Android |

## 4. Live handoff state
| Type | Handle / location | State | Inspect / resume | Stop / cleanup |
| --- | --- | --- | --- | --- |
| deployment | Cloudflare Worker `nlb-shared-view` on the user's account | deployed, serving | `npx wrangler deployments list` | `npx wrangler delete` (user only) |
| secrets | Worker secrets `VIEW_SECRET`, `PEOPLE` (names only) | set by the user via `init-secrets` | `npx wrangler secret list` | rotate: `npm run init-secrets -- <names> --force`, then `npm run deploy` |
| artifact | `.dev.vars` (git-ignored) | holds the real local secrets (user ran with `--force`) | — | keep; never commit |
| branch | git repo, no commits yet | all files untracked | `wsl -e bash -c 'cd /mnt/c/FMW/Code/Claude/NLBSeatBookingOptimiser && git status --short'` | user commits |
| process | local wrangler dev servers | stopped | — | none |
| artifact | `printpreview.pdf` in repo root | unknown origin (created 2026-10-08 12:57) | user to inspect | user decides; not git-ignored |
| artifact | `spike/` | throwaway probe kept for reference | — | may delete after commit |

## 5. In-flight changes (from OpenSpec)
| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| none | — | `add-shared-view` archived as `2026-10-09-add-shared-view` (23/23 tasks) | — |

## 6. Open items
| Priority | Item | Doc/code reference | Next action | Done when |
| --- | --- | --- | --- | --- |
| P1 | Commit the work | repo root | the user runs `git add` / `git commit` (message in the chat reply) | `git status` is clean |
| P2 | Userscript untested on real NLB | `push/userscript.ts` | install from `/setup/<view>` in Violentmonkey; book or cancel on NLB | a push arrives without tapping |
| P2 | No-show auto-cancel action code unobserved | `shared/src/booking.ts:mapStatus` | after a no-show, run spike S1 and check `actions` | the code maps to cancelled or partial_cancelled, with a test added |
| P3 | Badge text clipped in 1-hour timeline blocks | `web/styles.ts` | show the badge as an icon with a tooltip, or move it below the block | the badge is readable at 1280 px |
| P3 | `printpreview.pdf` of unknown origin | repo root | the user inspects or deletes it | file gone or explained |

## 7. Architecture / model changes
- **New system.**
  - Atoms: L1 the NLB page, L2 the Worker, L3 the Board DO, L4 the viewer.
  - Transmissions: T1/T1' push, T2 DO RPC, T3 board poll, T4 setup.
- **D41.** `extract` moved from L1 to L2. `trim` (`NLB_ROW_KEYS`) is placed at L1 and L2.
- **D42.** `pushedAt` was removed, leaving `Snapshot = {personId, receivedAt, bookings}`.
- **D38.** `Overlap.kind` gained `duplicate_rooms`.
- **Coherence.** All §4.5 laws pass; see the reviews. No known model/code divergence.

## 8. Docs reconciled
| Doc | Change |
| --- | --- |
| `docs/architecture-map.md` | atoms, placements, Trm types after D41/D42 |
| `docs/{domain,push-client,board,viewer}/ARCHITECTURE.md` | models; D38, D41, D42, D33 |
| `docs/*/IMPLEMENTATION.md` | built rows + rule → code → test tables (written by the implementing agents) |
| `docs/*/STATUS.md`, `docs/STATUS.md` | built/deployed state, open items |
| `docs/IMPLEMENTATION.md` | system roll-up (still lists code roots; ports described at system level) |
| `docs/*/reviews/review-add-shared-view.md` | §4.5 checklist runs |
| `openspec/specs/*` | merged by archive |
| `CLAUDE.md` | decision log D1–D45, edge cases |

## 9. Drift check
`drift-check` in the working repo → every ref reported dead, because no file is tracked yet. In a throwaway copy with `git add -A`: **0 dead / 136 refs**. It will pass in the repo once the user commits.

## 10. Files changed
All new (greenfield):
- Root: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `wrangler.toml`, `.gitignore`, `.dev.vars.example`, `README.md`, `CLAUDE.md`, `.claude/launch.json`.
- Code: `shared/src/*`, `worker/src/*`, `web/*`, `push/*`, `scripts/*`, `spike/*`.
- Docs and specs: `docs/**`, `openspec/**`.
- OpenSpec tooling: `.claude/commands/opsx/*`, `.claude/skills/openspec-*` (written by `openspec init`).
