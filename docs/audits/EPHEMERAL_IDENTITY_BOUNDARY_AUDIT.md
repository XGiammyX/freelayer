# Ephemeral Identity Package-Boundary Audit (TECH-ID-04)

- **Date:** 2026-07-22
- **Branch:** `tech/identity-ephemeral-v1` (stacked on `tech/identity-local-scaffolding` / ADR-0013)
- **Module:** `@freelayer/identity` → `packages/identity/src/ephemeral/` (12 files)

This audit covers the package/dependency boundary of the **ephemeral identity** module: what may cross into it, what result surface it exposes, and what must never leave it. The ephemeral context is an INDEPENDENT current-process root — it is **not** stored in the long-lived `LocalIdentityVaultStateV1` and does **not** reuse the long-lived repository path. Companion notes: [TECH_ID_04_SCHEMA_COMPATIBILITY.md](TECH_ID_04_SCHEMA_COMPATIBILITY.md), [TECH_ID_04_PRECHECK.md](TECH_ID_04_PRECHECK.md), threat model [TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md](TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md). House style follows [IDENTITY_SCAFFOLDING_BOUNDARY_AUDIT.md](IDENTITY_SCAFFOLDING_BOUNDARY_AUDIT.md) (TECH-ID-03).

## Desired dependency direction

```
apps → sdk/core Identity Firewall facade → @freelayer/identity (ephemeral module)
        → @freelayer/privacy (PolicyDecision, PrivacyMode) + @freelayer/security (Brand)
        → ephemeral policy + current-process-memory / null repository
RoomOS ──(narrow safe references + results only)──▶ ephemeral result types
```

The ephemeral module depends **only** on `@freelayer/privacy` (`PolicyDecision`/`isPolicyDecision`, `PolicySideEffectScope`, `PrivacyMode`) and, transitively via `identifiers.ts`, `@freelayer/security` (`Brand`). It imports **no** UI, **no** network transports, **no** Crypto implementation, **no** Secure Device implementation, and it never imports `@freelayer/rooms`. It mutates **no** RoomOS membership: a `room_binding.create_placeholder` records a local placeholder referencing a narrow `RoomLocalIdRef`/`RoomMembershipIdRef` and performs no room-side write.

## Separate ephemeral vault / repository — isolation rationale

Ephemeral roots are a **separate** `EphemeralIdentityRootV1` (`rootKind: "ephemeral_current_process"`) held in a **separate** `EphemeralIdentityVaultStateV1`, served by a **separate** `EphemeralIdentityRepositoryV1` (`InMemory` = current-process memory, or `Null`). They are never added to `LocalIdentityVaultStateV1.roots` and never travel the long-lived repository. This is deliberate isolation, not incidental layering:

- **Lifetime containment.** The ephemeral vault is `crossRestartValidity: false` and process-epoch bound; a `processEpochId` mismatch reads back `null` (no restart restoration). Keeping ephemeral state out of the long-lived vault guarantees it cannot ride the memory-retaining long-lived path or survive an epoch change.
- **Invariant separation.** The long-lived root carries recovery/device-authorization/verification lifecycle states; the ephemeral root carries **none** of these and instead pins `recovery/export/synchronization/promotion/longLivedRootLink/persistence: "forbidden"`. Two types + two stores let each invariant set be validated exhaustively without "not applicable here" branches.
- **Fail-closed blast radius.** A bug or unknown `rootKind` in one path cannot leak a root into the other store; each repository accepts only its own aggregate type.
- **Honest destruction.** Atomic destruction (`destroyEphemeralIdentityV1`) is "drop the in-process context and every child" with nothing to reconcile against a retained long-lived aggregate.

## What RoomOS may consume (narrow, safe)

Only a policy-safe result surface, mapped by the facade — never the internal vault:

- an explicit **current ephemeral root / persona reference** (opaque branded id) for a binding it was given;
- an explicit **ephemeral room identity-binding result** (the `EphemeralRoomIdentityBindingV1` placeholder — room ref, persona ref, lifecycle, `not_implemented` alias/credential markers);
- a **current / expired status** (`EphemeralIdentityExpirationStatusV1`: `current` vs `expired_deadline`/`expired_process_epoch`/`invalid_clock`/`destroyed`/`compromised`) so a consumer can fail closed on a stale context;
- a **policy-safe assurance / summary state** (`EphemeralIdentitySummaryV1`, which is structurally `anonymous: false`, `persistent: false`, `recoveryAvailable: false`, and redacts in strict modes).

To avoid an `identity ↔ rooms` cycle, the ephemeral module (like TECH-ID-03) defines narrow identity-local brands `RoomLocalIdRef`/`RoomMembershipIdRef`; RoomOS or the facade maps its own `RoomLocalId`/`RoomMembershipId` at the boundary. The dependency direction stays one-way.

## What RoomOS (and any external consumer) must NOT access

- the **process epoch** (`IdentityProcessEpochId` / `EphemeralProcessBindingV1`) — opaque, non-persisted, non-peer-facing, lifetime-internal;
- **repository internals** — the `#vault` field, defensive-clone behavior, `readCurrent`/`replaceCurrent`/`destroyCurrent`/`clearAll` (each already gated on an authentic `identity.ephemeral.*` decision);
- **relationship collections** (`relationships[]`) and raw persona/room-binding arrays;
- **lifetime policy internals** — `EPHEMERAL_IDENTITY_LIMITS_V1`, per-mode caps, deadline math (`local:<ms>` labels);
- **local labels** (`localLabel`) and any other local, sensitive, never-exported field;
- **future secrets / key material** — `keyMaterialState`/`deviceAuthorizationState` are `not_implemented` markers (Gate F/G), never key bytes.

## No automatic RoomOS mutation, no side effects

The ephemeral module performs no storage/network/notification/AI/crypto/randomness and runs no background timer as enforcement (expiry is evaluated purely, on demand, immediately before each protected op). Creating a room-binding placeholder does not create, alter, or revoke a RoomOS membership; it only records a local placeholder. Destruction clears local current-process state only and discloses `remoteCopiesAffected: false` / `externalObservationsAffected: false`.

## Boundary summary

| Boundary | Rule | Allowed flow | Never crosses | Status |
| --- | --- | --- | --- | --- |
| Ephemeral module → `@freelayer/rooms` | forbidden (avoid cycle) | narrow `RoomLocalIdRef`/`RoomMembershipIdRef` brands | any `@freelayer/rooms` import | architecture-rule (guardrail + side-effect trap) |
| Ephemeral module → UI / transports / crypto / Secure Device | forbidden | (none) | UI, network, crypto, DevicePosture, ScreenShield imports | enforced (`check:no-ephemeral-identity-bypass` + side-effect test) |
| Ephemeral vault vs long-lived vault | separate stores | ephemeral root ↔ `EphemeralIdentityRepositoryV1` only | ephemeral root into `LocalIdentityVaultStateV1`; long-lived root into ephemeral store | enforced (distinct types + repos) |
| RoomOS ← ephemeral results | narrow result types only | root/persona ref, binding result, current/expired status, safe summary/assurance | process epoch, repository internals, relationship collections, lifetime internals, local labels, future secrets | architecture-rule (facade not yet wired) |
| RoomOS membership mutation from ephemeral | forbidden | local room-binding placeholder only | any create/alter/revoke of a RoomOS membership | architecture-rule + docs |
| Process epoch exposure | forbidden | internal lifetime binding | epoch id to peers, RoomOS, or persistence | enforced (opaque brand; non-persisted; not in results) |
| Persistent / cross-restart storage | forbidden | current-process memory or null | disk / localStorage / sessionStorage / IndexedDB / DB | enforced (`check:no-ephemeral-identity-bypass` + repository types) |
| Recovery / promotion / export / synchronization | forbidden | (none — no such command exists) | any recover/promote/attach/export/sync path | enforced (no command + `"forbidden"` markers + policy DENY + guardrail) |
| Key material / cryptographic unlinkability | not implemented | `not_implemented_gate_f` markers | key bytes, signatures, unlinkability guarantee | future-gate (Gate F) |
| DevicePosture / ScreenShield as identity | forbidden | posture may only RESTRICT via policy | posture as an authority/grant; `screenShieldActive` field | enforced (policy tighten-only + guardrail) |
| Network / telemetry from ephemeral | forbidden | (none) | any `fetch`/WS/log egress referencing ephemeral state | enforced (side-effect trap + network regex guard) |

## Honest enforcement status

- **Enforced today:** dependency set (privacy + security only), no-transport/UI/crypto/Secure-Device imports, memory/null-only storage, no-recovery/promotion/export/sync (no command exists), exact-scope `identity.ephemeral.*` `PolicyDecision` on every repository and pipeline op, and the `check:no-ephemeral-identity-bypass` static guardrail (wired into `audit:privacy` + CI, with a `tests/fixtures/ephemeral-identity-bypass/` fixture). Side-effect and sentinel traps cover the module.
- **Architecture-rule (not yet code-enforced end to end):** RoomOS does **not** yet consume the ephemeral module — **no facade is wired**. The narrow result surface and "no automatic membership mutation" rule are documented and structurally supported (result types exist; RoomOS refs are brands), but the sdk/core Identity Firewall facade that maps RoomOS ids ↔ ephemeral refs is a later task. Until then, "what RoomOS may consume" describes the intended contract, not a live integration.
- **Future-gate:** cryptographic unlinkability, key material, and device authorization are Gate F/G; wire formats Gate E; synchronization/distributed revocation Gate H. This module claims none of them.

## Unresolved dependency direction (honest)

As in TECH-ID-03, no shared-contract package was introduced for room references — the identity-local brands suffice for one narrow ref pair. If a future task needs bidirectional room↔identity (or long-lived↔ephemeral) types, extract a `@freelayer/contracts` package and move the ref brands there. The ephemeral↔RoomOS integration remains a later task; this audit fixes the boundary it must honor when it lands.
