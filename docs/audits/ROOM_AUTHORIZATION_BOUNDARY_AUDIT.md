# RoomOS Authorization Boundary Audit (TECH-21)

_Date: 2026-07-13. Verifies `apps → sdk/core operation/query facade → current membership resolution → capability resolution → execution-time revalidation → RoomOS pipeline`._

## Enforced today (mechanical)

- **Apps cannot import `@freelayer/rooms` at all** (`scripts/check-boundaries.mjs` allows apps only `ui`, `sdk`, `core`, `privacy`). So apps cannot cache allow decisions, construct authoritative contexts, bypass final revalidation, inspect private membership arrays to self-authorize, perform direct role checks, use endpoint state as authority, or call reducers directly.
- **`check:no-room-authorization-bypass`** forbids authorization/capability caches, global allow booleans, prepared-context/capability serialization/persistence, `localStorage`/`IndexedDB` authorization storage, caller-controlled authorization revisions, endpoint-grants-access, treating suspended/removed as active, wildcard capabilities, automatic owner promotion, and unbacked distributed/crypto-revocation claims; plus role-string authorization outside the membership/authorization packages. A fixture proves it catches representative violations.
- **`assertPreparedRoomAuthorizationCurrentV1`** is the single final gate: it revalidates the revision fence against CURRENT state, re-checks descriptor currency, and requires an authentic exact-scope `PolicyDecision`. The prepared context is `authoritative: false` and never authorizes alone.
- No authorization cache exists ([ROOM_AUTHORIZATION_CACHE_AUDIT.md](ROOM_AUTHORIZATION_CACHE_AUDIT.md)); descriptors/contexts are transient.

## Documented limitation (honest)

Within-boundary granularity is convention + review, not compile-time: `core` (and tests) can import `prepareRoomAuthorizationV1` / `assertPreparedRoomAuthorizationCurrentV1` / the revocation pipeline directly. Tests legitimately do. Full **construction-authority confinement** — making the prepare/revalidate gate the only reachable path and issuing single-use/nonce-bound decisions — remains **Gate B** and is deliberately not implemented early. Because prepared contexts are non-authoritative and a fresh authentic decision is always required, this limitation cannot be leveraged to skip the final gate.

## Future step (Gate B)

Introduce single-use or nonce-bound `PolicyDecision`s and a core authorization facade that owns prepare→revalidate→execute behind a capability token; narrow `packages/rooms` public exports so the pipelines are unreachable outside it.
