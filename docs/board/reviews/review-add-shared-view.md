# Review — add-shared-view (board)

> §4.5 checklist run after building, 2026-10-09. Evidence is cited as tests or checks.

## Coherence
- [x] **1. Placement honesty.** `ingest` at L2 reads only the request body, which T1/T1' deliver. `boardView` at L3 reads only the stored `Snapshot` rows. Evidence: worker/src/router.test.ts and board.test.ts.
- [x] **2. Transmission well-typing.**
  - T1/T1' carry `NlbRow*`, and the body must be an array of at most 200 rows, otherwise 400.
  - T2 is DO RPC with `put`/`board`.
  - T3 carries `Board` JSON.
  - Each Trm crosses a real boundary.
- [x] **3. Placement totality.** Every Trn has a file:symbol in IMPLEMENTATION.md. The drift check passes, 0 dead out of 136 refs, in a tracked throwaway copy.
- [x] **4. Dependency mediation.** The server makes no outbound request: there is a dynamic fetch-spy test and a static source scan in worker/src/privacy.test.ts. The viewer reaches the board only via T3.
- [x] **5. Composition soundness.** The roll-ups in docs/ are deduced from the component docs.
- [x] **6. runsAt is a relation.** The whitelist `trim` is placed at L1 and L2 on purpose (D41). Validation is at L2.

## Modeling smells
- [x] One `Snapshot` per person, replaced on each push (D21). `pushedAt` was removed as a redundant stored value (D42).
- [x] `Board`, `Overlap` and `Staleness` are never persisted.
- [x] `Person` has one source of truth, the `PEOPLE` secret (D33).

## Verified behaviour (local wrangler dev, test secrets)
- The form push returns 303 to the view.
- The JSON push returns 204.
- A re-push within 2 s returns 429.
- A 70 KB body returns 400.
- Using the view secret as a push token returns 404.
- `/` returns 404 with `X-Robots-Tag`.
- A room `Purpose` sent on the wire is never stored.
- After deploying, the user confirmed a real NLB push from Android Chrome arrived.

## Exceptions
None.
