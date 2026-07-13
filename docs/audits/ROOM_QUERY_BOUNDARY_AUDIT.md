# RoomOS Query Boundary Audit (TECH-19)

_Date: 2026-07-13. Verifies the `apps → sdk/core query facade → rooms/query → immutable projection` direction._

## Enforced today (mechanical)

- **Apps cannot import `@freelayer/rooms` at all** (`scripts/check-boundaries.mjs` allows apps only `ui`, `sdk`, `core`, `privacy`). So apps cannot import internal reducers, read operation logs, traverse raw projection objects, instantiate query policies to loosen them, return raw domain objects, construct fake results, or bypass redaction helpers.
- **`check:no-room-query-bypass`** statically forbids: direct `roomState.objects.*` traversal outside the query/objects packages; query history/result cache/persistent index; full-text-search dependencies (Fuse/Lunr/MiniSearch/FlexSearch); dynamic `RegExp` from query input; `JSON.stringify(query|request|result|cursor)`; query-term logging; localStorage/IndexedDB; HTML rendering / link preview; file/network calls; AI/endpoint-monitoring imports; active ScreenShield flags; and nondeterminism in query modules. A fixture proves it catches representative violations.
- Every query requires an authentic, exactly-scoped `PolicyDecision`; the query executor reads a frozen snapshot and performs no side effects — even code that *can* import rooms cannot bypass policy or mutate state.
- Results and snapshots are defensively cloned + frozen; the query modules import no storage/network/AI/monitoring package (import-hygiene test).

## Documented limitation (honest)

Within-boundary granularity is convention + review, not compile-time: `core` (and tests) can import any rooms export, including `executeRoomQueryV1`, `resolveRoomQueryPolicy`, and the internal validators. Tests legitimately do. Full **construction-authority confinement** (making the query facade reachable only with a core-issued capability, and hiding the raw projection behind it) remains **Gate B** and is deliberately not implemented early.

## Future step (Gate B)

Expose a single core query facade that owns snapshot creation + policy resolution behind a capability token, and narrow `packages/rooms` public exports so raw projection traversal and policy construction are unreachable outside it.
