# Whole-system categorical map (Dat/Trn/Loc/Trm)

> Top-level architecture doc (FRAMEWORK §4). Names the four atoms, lists components (each
> linking to its ARCHITECTURE.md), reifies placement where it is a relation, and runs the
> §4.5 coherence checklist. Detail lives in the component docs. Greenfield: every row is
> `planned` until built. Source of record: the approved plan and the 2026-10-08 grilling (see
> `docs/sessions/`).

## 1. Why
The whole product is one datum (`Booking`) that crosses three sites: it is captured on the NLB page, stored on our server,
and rendered on a viewer. The main hazard is a **stale copy** being trusted as truth, e.g. a cancelled
room that still shows as booked. Modelling the system as `Loc`/`Trm` makes every copy an explicit
`DataLoc`, with a `receivedAt` time and the transmission that delivered it. Staleness then becomes a
*deduced morphism* rather than a hope. Hard constraint as a law: **no `Trm` has `c_to = NLB`
originating from our server**. The only NLB-touching site is the user's own browser tab.

## 2. The four atoms (at a glance)

**Dat**
| Object | Shape | Authoritative at |
| --- | --- | --- |
| `NlbBooking` | NLB's raw `accountInfo.bookings[i]` | NLB (external); read on L1 only |
| `Booking` | `{ref, kind: seat\|room, library, area, floor, unit, start, end, pax?, status}` | L3 (the latest pushed snapshot) |
| `NlbRow` | an `NlbBooking` trimmed to `NLB_ROW_KEYS` | transient (on the wire T1/T1') |
| `Snapshot` | `{personId, receivedAt, bookings: Booking*}` | L3 |
| `Board` | `{people: Person*, snapshots: Snapshot*}` | L3 (deduced view on read) |
| `Person` | `{id, name, pushToken}` | Worker secret `PEOPLE` (JSON; one source of truth) |
| `Block` | consecutive same-unit/same-status `Booking`s merged | deduced; never stored (NLB returns 1 row per hour) |
| `Overlap` | `{kind: both_booked\|seat_in_partner_room, start, end, refs}` | deduced; never stored |
| `Staleness` | `{personId, ageMin, unverifiedRefs}` | deduced; never stored |

**Trn**
| Trn | t_from → t_to | Component |
| --- | --- | --- |
| `trim` | `NlbBooking* → NlbRow*` | push-client (L1) |
| `extract` | `NlbRow* → Booking*` | domain (placed at L2) |
| `ingest ⊸` | `Person × NlbRow* → Snapshot` | board |
| `boardView` | `Snapshot* × Person* → Board` | board |
| `computeOverlaps` | `Board → Overlap*` | domain (placed at L4) |
| `computeStaleness` | `Board × Now → Staleness*` | domain (placed at L4) |
| `render ⊸` | `Board × Overlap* × Staleness* → DOM` | viewer |
| `buildPushClient` | `Origin × Person → Bookmarklet ⊕ Userscript` | board (setup) |

**Loc**
- `L1`: the NLB page in the user's own browser tab (desktop Chrome / Android Chrome / Firefox+Violentmonkey).
- `L2`: the Cloudflare Worker (stateless isolate).
- `L3`: the `Board` Durable Object (single instance, SQLite storage).
- `L4`: the viewer browser tab.

**Trm**
| Trm | carries | c_from → c_to |
| --- | --- | --- |
| `T1` | `NlbRow*` (form field `rows`) | L1 → L2 (form POST, target=_blank) |
| `T1'` | `NlbRow*` (JSON) | L1 → L2 (`GM_xmlhttpRequest`) |
| `T2` | `Person × Booking*` / `Board` | L2 ↔ L3 (DO RPC) |
| `T3` | `Board` | L2 → L4 (`GET /api/<view>/board`, 5 s poll while visible) |
| `T4` | `Bookmarklet ⊕ Userscript` | L2 → L1, via the user installing it from `/setup/<view>` |

## 3. Components
| Component | Owned `Trn` | Built/active when | Doc |
| --- | --- | --- | --- |
| `domain` | extract, computeOverlaps, computeStaleness | always (pure lib, multi-placed) | [domain/ARCHITECTURE.md](domain/ARCHITECTURE.md) |
| `push-client` | (placement of `extract` at L1) + T1/T1' sending | user taps the bookmarklet / userscript fires | [push-client/ARCHITECTURE.md](push-client/ARCHITECTURE.md) |
| `board` | ingest, boardView, buildPushClient, routing | always (Worker + DO) | [board/ARCHITECTURE.md](board/ARCHITECTURE.md) |
| `viewer` | render (+ placement of overlaps/staleness at L4) | page open and visible | [viewer/ARCHITECTURE.md](viewer/ARCHITECTURE.md) |

## 4. Placement (where runsAt is a relation)
| `Trn`/`Dat` | placements | why it matters |
| --- | --- | --- |
| `trim` (whitelist `NLB_ROW_KEYS`) | L1 (push-client) and L2 (board, defence in depth) | runs *before* T1, so profile data never leaves NLB's page (R4.4) |
| `extract` | L2 (board ingest) | moved off L1 (D41): the bookmarklet must be ≤ 1 KB for Android Chrome |
| `Booking` schema validation | L1 (shape by construction) and L2 (`ingest` re-validates) | never trust the client (§7.2): the push token holder could send anything |
| `computeOverlaps`, `computeStaleness` | L4 only | deduced per render; L3 never stores them (§5 deduce-don't-store) |
| `Booking` | L1 (transient), wire, L3 (authoritative copy), L4 (render copy) | 4 DataLocs over one Dat; staleness is measured between L3's `receivedAt` and Now |

## 5. Coherence checklist (§4.5) against the plan
- [x] 1. Placement honesty: `computeStaleness` at L4 needs `receivedAt` and the bookings, and both arrive in `Board` via T3; `extract` at L1 reads `NlbBooking` fetched same-origin on L1.
- [x] 2. Transmission well-typing: every Trm is typed, and each crosses a real boundary.
- [x] 3. Placement totality: every Trn has a component and a site (planned).
- [x] 4. Dependency mediation: viewer→board is via T3 only, and push-client→board via T1/T1' only. No component reaches NLB except push-client on L1.
- [x] 5. Composition soundness: roll-ups are deduced from component docs.
- [x] 6. runsAt is a relation: `Booking` validation is placed twice on purpose (L1 shape, L2 enforcement).

## 6. Modeling smells swept (§3)
- **Seat and room bookings are one object.** `Booking` carries a `kind` discriminator, with `pax?` partial (rooms only). There are no parallel `SeatBooking`/`RoomBooking` types.
- **Overlaps and staleness are deduced, never stored.** The only stored state is `Snapshot`.
- **`Person` is one source of truth.** It lives in the Worker secrets. The setup page, push tokens and display names are all deduced from it.
