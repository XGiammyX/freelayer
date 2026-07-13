# TECH-21 — Revocation + Authorization Threat Model

_Scope: local revocation semantics + execution-time authorization revalidation. Extends [TECH_20_MEMBERSHIP_CAPABILITY_THREAT_MODEL.md](TECH_20_MEMBERSHIP_CAPABILITY_THREAT_MODEL.md)._

## Stale authorization

Capability resolved before suspension / role downgrade / removal / room-policy tightening / privacy-mode tightening / object-sensitivity change; an old descriptor reused after reactivation; an old authorization context reused after a membership-revision change. **Mitigation:** `prepareRoomAuthorizationV1` binds a `RoomAuthorizationRevisionV1` fence (room + membership revision + local policy revision + lifecycle + privacy mode); `assertPreparedRoomAuthorizationCurrentV1` re-derives the fence from CURRENT state and rejects any mismatch, then re-checks descriptor currency + requires an authentic exact-scope decision. An earlier `prepare` is never sufficient.

## Check/use race (TOCTOU)

Authorization checked only during preparation; membership/operation/object/view changes before execution; the log append occurring before the final check; partial state changes after a stale-context rejection. **Mitigation:** revalidation is the FINAL gate immediately before the first side effect (in the revocation pipeline, before the event/log/reducer); all validation precedes any side effect, so a failure yields no event/log/projection change; the context is never auto-refreshed.

## Privilege escalation

A downgrade failing to remove old broad capabilities; suspension still permitting queries; a removed member using a cached descriptor; a viewer descriptor widened to editor; a restrictive operation performing expansion; an emergency-removal helper allowing role elevation; the last-owner rule bypassed via a multi-step transition. **Mitigation:** any role/state/revision change flips the fence → reject; `classifyMembershipChangeDirectionV1` marks a restrictive command carrying an expansive target as `RestrictiveOperationEscalationError`; capability-set comparison (not role names) drives direction; owner continuity is recomputed from the CURRENT projection at execution.

## Cache

An allow result cached globally; a role-matrix result cached without revision; a membership record cached after removal; query authorization memoized; a capability descriptor persisted; stale object-specific access surviving object changes. **Mitigation:** **no authorization cache exists** ([ROOM_AUTHORIZATION_CACHE_AUDIT.md](ROOM_AUTHORIZATION_CACHE_AUDIT.md)); descriptors/contexts are `persistence: "forbidden"`; matrix rows `room.authorization.cache`/`context_persist`/`context_serialize` deny; the guard `check:no-room-authorization-bypass` bans caches, global allow booleans, and serialization.

## Cross-scope

Query authorization used for mutation; object detail used for list/count; a suspension authorization used for removal; one target/room/object authorization used for another. **Mitigation:** the prepared context binds `requiredCapability` + `requiredSideEffect` + `objectId`/`objectKind`/`requestedView`/`targetMembershipId`+revision; any mismatch → an operation/object/view/target binding error; the decision's exact side-effect scope must match the actual execution.

## Privacy

A revocation reason leaking content; a target membership appearing in logs; denial reports revealing room relationships; authorization-failure counts becoming telemetry; stale-context errors disclosing the current role/state. **Mitigation:** errors are codes + STATIC detail only (sentinel-tested); the `LocalAuthorizationInvalidationReportV1` is content-free (no member ref/role/reason), says `current_local_projection_only`, and never persists; no failure telemetry.

## Distributed limitations (stated)

Local removal does not reach other devices; unknown remote copies retain their own state; no causal revocation broadcast; no signed revocation; no authenticated actor; no global authorization epoch. All are Gate H/F/G.

## Endpoint separation

Endpoint-risk state re-enabling access; a "safe device" bypassing suspension; ScreenShield status treated as authorization evidence. **Mitigation:** device-risk can only TIGHTEN capability resolution and never grants/restores authority; matrix `room.authorization.endpoint_assurance` denies; the guard bans `endpointGrantsAccess`/`endpointRestoresAccess`.

## Limits (stated plainly)

Revocation is local only; capability descriptors + prepared contexts are not credentials; no global consistency; no verified identity; no endpoint assurance; not safe for real secrets.
