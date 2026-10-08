# Review — add-shared-view (push-client)

> §4.5 checklist run after building, 2026-10-09.

## Coherence
- [x] **1. Placement honesty.** `trim` at L1 reads `NlbBooking` rows, which the same-origin GetAccountInfo fetch materialises on L1.
- [x] **2. Transmission well-typing.**
  - T1 is a form POST with the field `rows` (bookmarklet).
  - T1' is a `GM_xmlhttpRequest` JSON POST (userscript).
  - Both carry `NlbRow*`, trimmed to `NLB_ROW_KEYS`.
- [x] **4. Dependency mediation.** This component is the only one that touches NLB, and it calls read endpoints only. No NLB write endpoint is referenced, per push tests.
- [x] **6. runsAt is a relation.** There are two parallel realisations of one contract, the bookmarklet and the userscript (§4.4), sharing the single `NLB_ROW_KEYS` constant.

## Privacy (R4.4 / D19)
- No profile key (name, email, userId, accountId) appears in either client's request. Tested in push/bookmarklet.test.ts, userscript.test.ts, and bundle.test.ts, which runs the served bundles.

## Field results
- **Spike S1:** desktop Chrome 154 runs a bookmarklet under NLB's nonce CSP.
- **Android Chrome:** the 911-byte bookmarklet saves whole and pushes successfully. This was confirmed by the user against the deployed Worker on 2026-10-09.
- **Userscript:** not yet run on a real NLB page. Recorded as an open item.

## Exceptions
- `alert()` is used for "Log in to NLB first" instead of a CSSOM overlay, because of the size budget (D43).
