# System status

> Roll-up of every <component>/STATUS.md. Detail lives in the linked file.

| Component | State | Headline gap | In flight | Detail |
| --- | --- | --- | --- | --- |
| domain | ✅ built | the no-show auto-cancel action code is not yet observed | — | [domain/STATUS.md](domain/STATUS.md) |
| push-client | ✅ built, field-tested (Android bookmarklet) | userscript not yet run on real NLB | — | [push-client/STATUS.md](push-client/STATUS.md) |
| board | ✅ built, deployed | — | — | [board/STATUS.md](board/STATUS.md) |
| viewer | ✅ built | — | — | [viewer/STATUS.md](viewer/STATUS.md) |

## Cross-cutting
- 419 tests green; typecheck clean.
- The drift check gives 0 dead / 136 refs when files are tracked by git. Until you commit or stage, it reports every ref as dead, because it resolves against `git ls-files`.
- Deployed on the user's Cloudflare account (free plan) on 2026-10-09.
- OpenSpec change `add-shared-view` is archived; its specs now live in `openspec/specs/`.
