# domain — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that realises it.
> Keep in sync WITH the code (§6.3). Planned targets are written as plain text (not backticked)
> until built, so the drift check only verifies real refs. Note: drift-check resolves against
> `git ls-files` — new files must be at least staged (`git add -N`) to resolve.

## Morphisms / objects → code
| Morphism / object | Realising code | State |
| --- | --- | --- |
| Booking / PushPayload / Snapshot / Board / Block / Overlap / Staleness types | `shared/src/types.ts:Booking` (all types in this file) | built |
| extract (NlbBooking → Booking), placed at L2 (the Worker runs it on pushed rows) | `shared/src/booking.ts:extract` | built |
| row whitelist (the only keys that leave the NLB page) | `shared/src/booking.ts:NLB_ROW_KEYS`, `shared/src/booking.ts:trimRow` | built |
| status functor (mapStatus) | `shared/src/booking.ts:mapStatus` | built |
| kind / pax? (detectKind) | `shared/src/booking.ts:detectKind` | built |
| SGT normalisation (toSgtIso) | `shared/src/booking.ts:toSgtIso` | built |
| SGT helpers (sgtDate, sgtHHMM, addMinutes) | `shared/src/time.ts:sgtDate` | built |
| mergeBlocks | `shared/src/blocks.ts:mergeBlocks` | built |
| validatePayload (validates the extracted `Booking[]`) | `shared/src/payload.ts:validatePayload` | built |
| ingest pipeline (rows → trim → extract → validate) | `shared/src/payload.ts:ingestRows` | built |
| computeOverlaps | `shared/src/overlap.ts:computeOverlaps` | built |
| computeStaleness | `shared/src/staleness.ts:computeStaleness` | built |
| test fixtures (real NLB shape, fake profile) | `shared/src/fixtures.ts:accountInfoResponse` | built |

## Composition rules → where enforced
| Rule (ARCHITECTURE §6) | Enforced at | Tested at |
| --- | --- | --- |
| 1. `start < end`, both +08:00 | `shared/src/booking.ts:toSgtIso`, `shared/src/booking.ts:extract` (drops rows with start ≥ end), `shared/src/payload.ts:validatePayload` | `shared/src/booking.test.ts`: "toSgtIso > appends +08:00 to an offset-less local SGT string", "extract > drops unparseable times and rows with start >= end", "extract > treats offset-less startTime/endTime as SGT"; `shared/src/payload.test.ts`: "rejects > start >= end", "rejects > start/end without the +08:00 offset …" |
| 2. only booking fields survive: the whitelist trims rows, `extract` emits only booking fields (no profile data, no `infoJson`/Purpose) | `shared/src/booking.ts:trimRow` (`NLB_ROW_KEYS`), `shared/src/booking.ts:extract` (reads only `bookings[]`), `shared/src/payload.ts:validatePayload` (rebuilds the payload, stripping unknown keys) | `shared/src/booking.test.ts`: "extract > reads only bookings[]: never touches visitBookings or profile keys", "extract > never leaks profile values into the output", "extract > ignores visitBookings entirely", "extract > emits only Booking keys"; `shared/src/booking.test.ts`: "NLB_ROW_KEYS / trimRow > keeps whitelisted keys and drops every other key …", "trimRow > Purpose inside infoJson survives trimming (it is on the wire) but never reaches a Booking"; `shared/src/payload.test.ts`: "validatePayload > strips unknown keys and does not mutate its input", "ingestRows > ignores non-whitelisted keys on a row …", "ingestRows > Purpose inside infoJson is accepted on the wire but never stored" |
| 3. status = statusFunctor ∘ actions; cancel > partial > checked_in > booked | `shared/src/booking.ts:mapStatus` | `shared/src/booking.test.ts`: "mapStatus > precedence: cancel > partial > checked_in > booked", "mapStatus > classifies unseen codes by suffix" |
| 4. overlaps: half-open, cancelled excluded; seat+seat `both_booked`, seat+room `seat_in_partner_room`, room+room `duplicate_rooms` (D38); one Overlap per block pair | `shared/src/overlap.ts:computeOverlaps` (via `shared/src/blocks.ts:mergeBlocks`) | `shared/src/overlap.test.ts`: "touching intervals are not overlaps", "cancelled bookings are excluded on either side", "B's seat inside A's room -> seat_in_partner_room …", "seat_in_partner_room is emitted instead of both_booked …", "room vs room -> duplicate_rooms …", "touching rooms are not duplicate_rooms", "a cancelled room does not produce duplicate_rooms", "seat vs seat stays both_booked", "the same person never overlaps themself" |
| 4a. one block per run of hourly rows | `shared/src/blocks.ts:mergeBlocks` | `shared/src/blocks.test.ts`: "merges 4 hourly rows into one block with all refs", "a gap breaks the block", "a status change breaks the block", "a different unit breaks the block" |
| 5. unverified ⟺ booked ∧ now ≥ start+15 ∧ receivedAt < start+15 | `shared/src/staleness.ts:computeStaleness` | `shared/src/staleness.test.ts`: "exactly start+15 with no newer push -> unverified", "push received after the deadline -> verified", "checked_in is never unverified", "never pushed -> nulls …" |
| 6. push body is an array of ≤ 200 rows; extracted bookings pass the schema (the 5-minute `pushedAt` skew rule was removed: no device clock exists) | `shared/src/payload.ts:ingestRows`, `shared/src/payload.ts:validatePayload` | `shared/src/payload.test.ts`: "ingestRows > rejects a body that is not an array: %s", "ingestRows > accepts exactly 200 rows and rejects 201", "ingestRows > ignores rows extract drops …", "validatePayload > accepts exactly 200 bookings and rejects 201" |
| 6a. payload ≤ 64 KB | not in the domain library: checked by the Worker on the raw body before parsing (`worker/src/router.ts:readBodyCapped`) | `worker/src/router.test.ts`: "body over 64 KB -> 400 and the previous snapshot remains (JSON and form)" |

## Notes / divergences
- Overlap kinds: design.md emits exactly one `Overlap` per block pair, *instead of* a generic
  `both_booked` where a more specific kind applies: seat+seat `both_booked`, seat+room
  `seat_in_partner_room` (with `redundantSeat`), room+room `duplicate_rooms` (D38, no `redundantSeat`).
  design.md wins and is what is built.
- `toSgtIso` throws `RangeError` on an invalid date-time. `extract` catches that and drops the row.
- `extract` also drops rows with no (or an empty) `bookingRefId`/`bookingId`, and rows whose `start ≥ end`, and ignores a negative 
  `NumberOfPeople`, so a single bad row can never make the whole push fail `validatePayload`.
- `mergeBlocks` merges a row into any open block of the same unit/status whose `end` equals `r.start`
  (not only the latest block), so a seat and a room held in the same hours still merge into one block each.
- `computeStaleness` clamps `ageMin` at 0 (a `receivedAt` marginally ahead of `now`).
- `validatePayload` rebuilds the payload from known fields only: unknown keys are never carried through.
- Booking `start`/`end` must be exactly `YYYY-MM-DDTHH:MM:SS+08:00` (no fractional seconds).
- **Wire format change (D41–D43):** a push is a bare JSON array of trimmed raw NLB rows (`NLB_ROW_KEYS`); `PushPayload` is now `{ bookings }` and `Snapshot` has no `pushedAt`. `extract` is placed at L2 (the Worker), not L1: the bookmarklet must stay under 1,000 bytes. The server runs `ingestRows` = `trimRow` → `extract` → `validatePayload`; rows `extract` drops are ignored; a non-array or > 200 rows is rejected.
