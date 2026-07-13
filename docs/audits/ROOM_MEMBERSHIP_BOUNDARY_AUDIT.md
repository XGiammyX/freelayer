# RoomOS Membership Boundary Audit (TECH-20)

_Date: 2026-07-13. Verifies `apps → sdk/core authorization facade → rooms/membership` and `apps → sdk/core operation/query facades → rooms`._

## Enforced today (mechanical)

- **Apps cannot import `@freelayer/rooms` at all** (`scripts/check-boundaries.mjs` allows apps only `ui`, `sdk`, `core`, `privacy`). So apps cannot mutate the membership projection, construct authoritative memberships, construct trusted capability tokens, call internal reducers, derive capabilities from caller-supplied roles, bypass current-revision checks, or grant permissions directly.
- **`check:no-room-membership-bypass`** statically forbids: direct membership-array mutation; role-string authorization outside the membership package; caller-controlled authority/trust fields (`isAdmin`/`isOwner`/`trustedDevice`/`endpointSafe`…); wildcard permissions / `room.policy.loosen`; capability serialization/persistence/delegation/cache; JWT/macaroon/UCAN/DID/OpenFGA/SpiceDB dependencies; invite URLs/codes; presence/contact fields; network/crypto/AI/monitoring in membership modules; and endpoint-as-authority flags. A fixture proves it catches representative violations.
- Every membership mutation passes an explicit `RoomAuthorizationContextV1` (current membership + current non-authoritative descriptor + authentic exact-scope decision) or, for bootstrap, an exact bootstrap decision + empty membership. The membership mutation and the membership-log append are SEPARATE decisions.
- Capability descriptors are `authoritative: false` and bound to room+membership+revision; they never authorize on their own.

## Documented limitation (honest)

Within-boundary granularity is convention + review, not compile-time: `core` (and tests) can import any rooms export, including `resolveRoomLocalCapabilityV1`, `applyLocalRoomMembershipMutationV1`, and the reducers. Tests legitimately do. Full **construction-authority confinement** — minting capability descriptors only via a core-issued capability, and hiding the membership pipeline behind it — remains **Gate B** and is deliberately not implemented early. Descriptors being non-authoritative means this limitation cannot be leveraged to authorize a side effect without an authentic `PolicyDecision`.

## Future step (Gate B)

Route capability minting + membership mutation through a core authorization facade behind a capability token; narrow `packages/rooms` public exports so the pipeline, policies, and reducers are unreachable outside it.
