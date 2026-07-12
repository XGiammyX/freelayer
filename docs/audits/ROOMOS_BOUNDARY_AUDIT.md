# RoomOS Boundary Audit (TECH-17)

_Date: 2026-07-13. Verifies the `apps → sdk/core → rooms` dependency direction._

## Enforced today (mechanical)

- **Apps cannot import `@freelayer/rooms` at all**: `scripts/check-boundaries.mjs` allows apps only `ui`, `sdk`, `core`, `privacy` — so apps cannot instantiate operation logs, call projection internals, construct events, or touch validators directly. ESLint `no-restricted-imports` adds AST-level enforcement for side-effect packages.
- **Rooms may import only `protocol`, `privacy`, `security`, `capsules`** — no storage/transports/crypto access from RoomOS (verified by boundaries + an import-hygiene test).
- Every mutation path requires an authentic, exactly-scoped `PolicyDecision` (WeakSet provenance), and log access requires separate log-scoped decisions — even code that CAN import rooms cannot bypass policy.
- The `check:no-roomos-bypass` guardrail bans direct state mutation, event serialization, and nondeterministic calls in replay modules.

## Documented limitation (honest)

Within-boundary granularity is convention + review, not compile-time: `core` (and tests) can import any rooms export, including `InMemoryRoomOperationLog` and `validateRoomOperationEventV1`. Tests legitimately do; nothing else currently exists that could. Full capability-token / construction-token confinement (making privileged constructors unreachable without a core-issued capability) remains **Gate B** and is deliberately not implemented early.

## Future step

At Gate B, route room event creation and log construction through the core operation pipeline (factory tokens), then narrow `packages/rooms` public exports to types + read-side APIs.
