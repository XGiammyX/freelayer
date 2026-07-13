# RoomOS Authorization Cache Audit (TECH-21)

_Date: 2026-07-13. Confirms no persisted or stale-surviving authorization state exists._

## Rule

> No authorization allow-decision, capability descriptor, or prepared authorization context may be persisted or reused without current-revision revalidation.

## What was searched

`packages/rooms/src/` (membership, authorization, objects, query) and `apps/` for: authorization-result caches, capability caches, role-permission memoization, a global "current member" authorization, persisted prepared contexts, query-authorization caches, and object-access caches. The `check:no-room-authorization-bypass` guard enforces this continuously in CI.

## Findings (all `present` / clean)

| Concern | Status |
| --- | --- |
| Persistent authorization cache | **none** — descriptors/contexts are transient in-memory values only |
| Cache keyed by member ID or role | **none** |
| Global "last allow" boolean | **none** |
| Persisted capability descriptor | **forbidden** (`persistence: "forbidden"`; matrix `room.capability.persist`/`room.authorization.cache` deny) |
| Persisted prepared context | **forbidden** (`persistence: "forbidden"`; matrix `room.authorization.context_persist` deny) |
| Prepared-context serialization | **forbidden** (`serialization: "forbidden"`; matrix `room.authorization.context_serialize` deny) |
| Query-authorization memoization | **none** — every query re-checks current policy against the snapshot it reads |
| Stale membership snapshot reuse | **none** — revalidation reads the CURRENT projection and compares the membership/policy/mode/lifecycle revision fence |
| `localStorage`/`IndexedDB`/Cache API authorization storage | **forbidden** (`check:no-forbidden-storage` + `check:no-room-authorization-bypass`) |

## Allowed patterns

- Immutable role→capability constants (`ROLE_CAPABILITY_ELIGIBILITY`) — pure, revision-independent.
- Per-call local variables (a prepared context lives for one prepare→execute cycle and must be revalidated).
- Pure computation with no member/room state that cannot become stale.

## How staleness is prevented

`prepareRoomAuthorizationV1` binds a `RoomAuthorizationRevisionV1` fence (room + membership revision + local policy revision + lifecycle + privacy mode). `assertPreparedRoomAuthorizationCurrentV1` re-derives the fence from **current** state and rejects on any mismatch, then re-checks the capability descriptor currency and requires an authentic exact-scope `PolicyDecision`. A prepared context is never auto-refreshed — the caller must prepare again. There is no asynchronous gap hidden by the API.

## Limitation (honest)

This is LOCAL staleness protection for one projection. It is not distributed revocation (Gate H), not a global authorization epoch, and not cryptographically enforced (Gates F/G). It cannot revoke unknown remote copies.
