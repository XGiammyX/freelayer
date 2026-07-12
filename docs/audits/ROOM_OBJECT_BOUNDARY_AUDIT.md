# RoomOS Object Model Boundary Audit (TECH-18)

_Date: 2026-07-13. Verifies the `apps → sdk/core operation pipeline → rooms` dependency direction for object mutations._

## Enforced today (mechanical)

- **Apps cannot import `@freelayer/rooms` at all** (`scripts/check-boundaries.mjs` allows apps only `ui`, `sdk`, `core`, `privacy`). So apps cannot construct accepted object events, import internal reducers, mutate `RoomObjectProjectionV1`, instantiate internal logs, bypass mutation policy, call internal validators as a feature API, or reach storage/network through rooms.
- **`check:no-room-object-bypass`** statically bans direct projection mutation, generic/JSON patching, `Object.assign`/spread into domain objects, `__proto__`/`prototype`/`constructor`, command/object serialization in shipped source, HTML/Markdown rendering, link-preview calls, file/path/URL access, fetch/WebSocket/WebRTC, notifications, CRDT/crypto/AI/endpoint-monitoring imports, active ScreenShield flags, and nondeterminism in the object reducer/log modules. A fixture proves it catches representative violations.
- Every mutation requires an authentic, exactly-scoped `PolicyDecision` (WeakSet provenance); the mutation and the object-log append require SEPARATE decisions — even code that *can* import rooms cannot bypass policy.
- The projection is immutable (`readonly` collections; reducers return new objects) and object content is separated from metadata-only summaries.

## Documented limitation (honest)

Within-boundary granularity is convention + review, not compile-time: `core` (and tests) can import any rooms export, including `applyLocalRoomObjectMutationV1`, the internal validators, and the log classes. Tests legitimately do. Full **construction-authority confinement** (making privileged constructors/pipelines unreachable without a core-issued capability/factory token) remains **Gate B** and is deliberately not implemented early.

## Future step (Gate B)

Route object event creation and log construction through the core operation pipeline via factory/capability tokens, then narrow `packages/rooms` public exports to types + read-side/summary APIs, so the mutation pipeline is reachable only with a core-issued capability.
