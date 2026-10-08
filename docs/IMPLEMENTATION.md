# System implementation map

> Whole-system functor architecture-map.md → code, deduced from the component
> IMPLEMENTATION.md files. System-level rows only. All planned (greenfield).

## Components → code root
| Component | Code root | Model | Code map |
| --- | --- | --- | --- |
| domain | shared/src/ (planned) | [domain/ARCHITECTURE.md](domain/ARCHITECTURE.md) | [domain/IMPLEMENTATION.md](domain/IMPLEMENTATION.md) |
| push-client | push/ (planned), spike/ (throwaway) | [push-client/ARCHITECTURE.md](push-client/ARCHITECTURE.md) | [push-client/IMPLEMENTATION.md](push-client/IMPLEMENTATION.md) |
| board | worker/src/ (planned) | [board/ARCHITECTURE.md](board/ARCHITECTURE.md) | [board/IMPLEMENTATION.md](board/IMPLEMENTATION.md) |
| viewer | web/ (planned) | [viewer/ARCHITECTURE.md](viewer/ARCHITECTURE.md) | [viewer/IMPLEMENTATION.md](viewer/IMPLEMENTATION.md) |

## Shared objects
| Object | Authoritative at | Also read by | Realised at |
| --- | --- | --- | --- |
| `Booking` | board (L3 snapshot) | push-client (builds it), viewer (renders it) | planned: shared/src/booking.ts |

## Inter-component transmissions / ports (Trm)
| Port | carries | c_from → c_to | Realising code |
| --- | --- | --- | --- |
| T1 / T1' | `PushPayload` | push-client → board | planned |
| T3 | `Board` | board → viewer | planned |
| T4 | bookmarklet / userscript | board → push-client (user installs it) | planned |

## System entry points
| Entry | Trn triggered | Code |
| --- | --- | --- |
| `POST /push/:token` | ingest | planned |
| `GET /api/:view/board` | boardView | planned |
| `GET /v/:view`, `GET /setup/:view` | render shell / buildPushClient | planned |
