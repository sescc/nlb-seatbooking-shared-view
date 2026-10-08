# 2026-10-09 — theme-switcher

## 0. Continuation brief
**Current state.**
- The viewer has an **Auto · Light · Dark** switch. Auto follows the OS; the choice is stored per browser and applied before first paint.
- Light and dark tokens pass a WCAG AA contrast unit test.
- 419 tests are green and the typecheck is clean.
- This change and the earlier badge fix are **not deployed yet**.
- Nothing is committed.

**Next step.** The user commits, then runs `npm run deploy`, and decides the repo name (recommendation `nlb-shared-view`, D48).

**Resume check.** `npm test`, then read `docs/STATUS.md`.

## 2. Decisions
| Decision | Verdict | Why |
| --- | --- | --- |
| 2-way Light/Dark toggle | discarded | Auto (follow the OS) is the right default; 3-way keeps it |
| Theme stored server-side in Board | discarded | a per-viewer preference; keeps `render` pure (viewer rule 4) |
| Apply theme in app.ts after load | discarded | causes a flash; a nonce'd head script is used instead |
| Repo name `nlb-seatbooking-sharedview` | advised against | inconsistent hyphenation; recommended `nlb-shared-view` |

## 3. Checks
| Check | Result |
| --- | --- |
| `npm test` | 21 files, 419 passed (118 in web/) |
| `npm run typecheck` | clean |
| Browser pane at 1280×800 in Light, throwaway secrets | badges, ghost rooms, overlap bands and cancelled row readable |
| Agent checks | Dark, Auto, keyboard, mobile Light, toast, reload without flash, no CSP violations |

## 4. Live handoff state
| Type | Handle | State | Inspect | Cleanup |
| --- | --- | --- | --- | --- |
| deployment | Worker `nlb-shared-view` | previous version, without the badge fix or the theme switcher | `npx wrangler deployments list` | `npm run deploy` |
| process | local dev servers | stopped | — | none |

## 6. Open items
| Priority | Item | Next action | Done when |
| --- | --- | --- | --- |
| P1 | Deploy the badge fix and the theme switcher | `npm run deploy` | the deployed page shows the switch |
| P1 | Commit | the user commits | `git status` is clean |
| P2 | Decide the repo name | rename on GitHub | done |
| P2 | Userscript on real NLB; no-show action code | see `2026-10-09-add-shared-view.md` §6 | as recorded there |

## 8. Docs reconciled
- `docs/viewer/ARCHITECTURE.md`: the §1 line, the `setTheme ⊸` row and rule 4, written by the agent from my brief.
- `docs/viewer/IMPLEMENTATION.md`.
- `CLAUDE.md`: D48–D50.

## 10. Files changed
- New: `web/theme.ts`, `web/theme.test.ts`.
- Edited: `web/styles.ts`, `web/shell.ts`, `web/app.ts`, `web/styles.test.ts`, `web/shell.test.ts`.
- Docs: `docs/viewer/*`, `CLAUDE.md`.
