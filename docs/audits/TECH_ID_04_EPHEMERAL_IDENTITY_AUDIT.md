# TECH-ID-04 — Ephemeral Identity — Audit Report

- **Date:** 2026-07-22
- **Branch:** `tech/identity-ephemeral-v1` (stacked on `tech/identity-local-scaffolding` → `architecture/identity-firewall-adr` → `research/identity-competitor-threat-model` → `tech/sensitive-room-secure-device-contract` → `main`)
- **Base HEAD:** `84644a94704bb4e5d590af8c26a4a65b2b82efe8` — `feat(identity): add local identity scaffolding` (TECH-ID-03 tip / PR #58 head). This branch's TECH-ID-04 work (the `packages/identity/src/ephemeral/` module + the additive `rootKind` discriminant) sits in the working tree, not yet committed.
- **Task type:** second Identity Firewall implementation — an **independent, current-process, non-recoverable, non-cryptographic** local ephemeral identity context
- **Verdict:** ✅ **Complete**

## Prerequisites & stacked dependency

Linear stack, each PR open and unmerged: **#48** (TECH-23, Secure Device admission contract) → **#49** (RESEARCH-ID-01, identity research) → **#57** (TECH-ID-02 / **ADR-0013 Accepted**) → **#58** (TECH-ID-03, local scaffolding) → **TECH-ID-04** (this branch; no PR opened yet). ADR-0013 §13/§21 endorses ephemeral identities as **independent, no-recovery roots** and §24 sequences TECH-ID-04 immediately after TECH-ID-03. Precheck: [TECH_ID_04_PRECHECK.md](TECH_ID_04_PRECHECK.md). Schema note: [TECH_ID_04_SCHEMA_COMPATIBILITY.md](TECH_ID_04_SCHEMA_COMPATIBILITY.md). Threat model: [TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md](TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md). Boundary: [EPHEMERAL_IDENTITY_BOUNDARY_AUDIT.md](EPHEMERAL_IDENTITY_BOUNDARY_AUDIT.md).

- **TECH-ID-02 (ADR-0013):** Accepted. Decides structure/invariants, not algorithms.
- **TECH-ID-03:** implemented and unmerged (PR #58 OPEN); provides the base `@freelayer/identity` package this task extends. Its `LocalIdentityRootV1` schema is still internal.

## Source research

RESEARCH-ID-01 (complete, PR #49) directly informs this task: `IDENTITY_TERMINOLOGY_MODEL.md` defines an ephemeral identity as short-lived, limited-continuity, **not recoverable by default, not a durable account**; `IDENTITY_ARCHITECTURE_DECISION_INPUTS.md` Q11 records **"Ephemeral identities support recovery? — rejected"**. Implementation research (NIST SP 800-63 lifecycle boundaries, SP 800-88 media-sanitization limits, W3C pairwise-identifier privacy, SimpleX/Signal disappearing-context patterns) was consulted **offline, from prior knowledge, and must be re-verified against primary sources** before being relied on for a security decision.

## Schema compatibility decision

A **root-kind discriminant** `LocalIdentityRootKindV1 = "long_lived_local" | "ephemeral_current_process"` is added — **not** an `ephemeral: boolean` flag, and **not** a folded/union vault. Long-lived `LocalIdentityRootV1` gains one **additive** required field `rootKind: "long_lived_local"` (single reducer construction site; transitions inherit it by spread; `schemaVersion` stays `1`). Ephemeral roots are a **separate** `EphemeralIdentityRootV1` in a **separate** current-process store. Permitted because the identity schema is internal/unreleased (PRs #57/#58 unmerged, no external consumer, nothing persisted); unknown kinds fail closed (ADR-0013 §23). No data migration required.

## Root-kind model

`EphemeralIdentityRootV1` is a distinct type: `rootKind: "ephemeral_current_process"`, `assurance: "unverified_local"` (initial), an `EphemeralProcessBindingV1`, and an `EphemeralIdentityLifetimeV1`. It structurally pins `persistence/recovery/export/synchronization/promotion/longLivedRootLink: "forbidden"` and `keyMaterialState/deviceAuthorizationState` to `not_implemented` Gate F/G markers. It carries **no** parent/long-lived id, no key material, no contact/device identifier, no DevicePosture.

## Process-epoch model

`IdentityProcessEpochId` is an opaque, local, branded slug (`epoch-…`) injected at bootstrap. It contains **no** OS process id or device id, is **never** persisted, and is **never** exposed to peers. `EphemeralProcessBindingV1` fixes `crossRestartValidity: false`. A mismatch between a root's bound epoch and the current epoch is treated as operationally expired/destroyed — there is no restart restoration (the repository reads back `null` across epochs).

## Lifetime model + limits

Local time is treated as untrusted. Lifetime is bounded via an **injected** clock (`IdentityLocalClockV1.nowLocal()` → `local:<ms>`); the reducer never reads an ambient clock. `EPHEMERAL_IDENTITY_LIMITS_V1` sets conservative **engineering defaults, not security guarantees**: min 60s, default 1h, max 24h, max 8 active roots. Two modes: `current_process` and `current_process_with_local_deadline` (deadline computed as `created + duration`). Lifetime may only be **shortened** (`shorten_lifetime` requires the new deadline strictly earlier than the current one); `extensionAllowed: false`, and there is no extend command.

## Lifecycle

Root lifecycle `draft_current_process → active_current_process → expired_local | compromised_suspected → destroyed_tombstone`, enforced by an explicit transition table (unknown/self transitions deny; destruction removes the record rather than leaving a tombstone). Restrictive transitions (`mark_compromised`, `expire`, `destroy`, relationship `block`) are permitted even in Emergency mode. Persona/relationship/room-binding aggregates have their own bounded lifecycles; expiry/destruction of a root propagates to its children.

## Persona / relationship / room-binding isolation

Personas, pairwise relationships, and room-identity bindings under an ephemeral root are **local placeholders** with no inheritance from any long-lived context: relationships pin `trustState: "not_inherited"` and `assurance: "unverified_local"`; aliases/room-aliases/credentials are `not_implemented` (TECH-ID-05/06 / Gate F). No long-lived contact, trust note, verification state, or peer-facing identifier is copied in. A relationship/room-binding must reference a persona under the **same** ephemeral root (cross-reference checked in the reducer), and duplicate active room bindings for the same persona+room are rejected.

## No promotion / recovery / export / synchronization

The command union is closed and carries **no** promote/attach/copy/enable-recovery/export/serialize/synchronize/extend command. Validation rejects mass-assigned caller fields (`persistent`, `recoverable`, `recovery`, `parentRootId`, `longLivedRootId`, `promote`, `exportable`, `synchronized`, `trusted`, `verified`, `anonymous`, `unlinkable`, key/seed/mnemonic fields, `email`/`phone`/`username`/`did`, `devicePosture`, `screenShieldActive`) and dangerous keys (`__proto__`/`prototype`/`constructor`). The policy resolver fixes `recoveryAllowed`/`promotionAllowed`/`exportAllowed`/`synchronizationAllowed`/`persistentStorageAllowed`/`networkAllowed`/`notificationAllowed`/`aiAllowed` to `false`; the Policy Matrix DENYs `promotion`/`recovery`/`export`/`synchronize`/`persistent_storage` across all modes.

## Expiration checks (fail-closed, pre-op)

`evaluateEphemeralIdentityExpirationV1` is pure and deterministic: destroyed/compromised lifecycle, epoch mismatch, or a passed local deadline expire; **backward clock movement or an unparseable timestamp fails closed** (`invalid_clock`). `assertEphemeralIdentityCurrentV1` throws a content-free error on any non-current state (including a never-activated draft) and is invoked by the pipeline **immediately before** each protected operation — creation-time validation is never treated as sufficient. An expired identity cannot act on a previously issued decision.

## Atomic destruction & disclosure

`destroyEphemeralIdentityV1` is one logical operation over the pure reducer: it removes the root **and every child** (personas, relationships, room bindings) with no orphan and no lingering tombstone, verifying afterward that nothing for that root remains. The redacted `EphemeralIdentityDestructionResultV1` discloses exactly what destruction does **not** do: `persistentMediaSanitized: false`, `remoteCopiesAffected: false`, `externalObservationsAffected: false`, `forensicErasureGuaranteed: false`. It claims **no** media sanitization, **no** remote deletion, and **no** forensic erasure — only that the in-process context was dropped.

## Repository behavior

`EphemeralIdentityRepositoryV1` has two implementations: `InMemory` (current-process memory, deep defensive `structuredClone`, `crossRestartValidity: false`, explicit `clearAll`, no serialization/recovery snapshot) and `Null` (retains nothing, never claims continuity). Both are **process-epoch bound** — a `readCurrent` under a different epoch returns `null` — and every operation requires an authentic `identity.ephemeral.*`-scoped `PolicyDecision`; a `null` persistence-class vault is discarded, not stored. Neither can persist to disk/browser/DB.

## Policy + PolicyDecision integration

`resolveEphemeralIdentityPolicyV1` is pure, fail-closed, strictest-wins across the seven privacy modes (Ghost is the primary intended mode; Bunker/Emergency deny expansive creates, Emergency permits only restrictive ops; DevicePosture may only tighten, never grant). The pipeline maps each operation to one of **8 new `identity.ephemeral.*` side-effect scopes** (`create`, `lifecycle`, `destroy`, `persona.create`, `relationship.create`, `relationship.block`, `room_binding.create`, `summary.read`) and requires an authentic **exact-scope** `PolicyDecision` — a fake, wrong-scope, or denied decision is rejected **before** mutation. An id, persona, RoomOS role, or DevicePosture never authorizes; a summary read needs its own `summary.read` decision.

## Regression + side-effect tests

`tests/privacy-regression/identity/ephemeral/` + `tests/security-regression/identity/ephemeral/` — **22 new ephemeral tests (613 total)** covering: independent-root construction + fail-closed validation, policy-gated creation, lifetime bounds + lifecycle transitions, expiration/fail-closed (epoch mismatch, clock rollback, invalid/past deadline, pre-op assertion), shorten-only (no extend/promote), atomic destruction (no orphan + honest disclosure), current-process-memory/null repositories (epoch-bound reads, decision enforcement), and per-mode privacy behavior. Security suite adds **sentinel** leak traps + **side-effect** traps (no storage/network/notification/AI/crypto imports or calls), matrix/policy agreement with forbidden ops denied, and a guardrail-spawn + honest-docs check.

## Guardrail

`check:no-ephemeral-identity-bypass` (`scripts/check-no-ephemeral-identity-bypass.mjs`) statically scans `apps/`+`packages/` for bypass tokens: boolean-only/parent-link models, promotion/conversion, recovery/export/serialize/synchronize/extend implementations, background timers as enforcement (inside the ephemeral module), global/ambient current ephemeral identity, caller `anonymous`/`unlinkable`/`verified: true`, crypto/key record fields, DevicePosture-as-identity / active ScreenShield, `forensicErasureGuaranteed: true` / secure-erase / remote-delete guarantee claims, persistent-storage adapters, and network calls referencing ephemeral state. Validator/error/matrix modules are allowlisted (they legitimately name rejected fields). Wired into `audit:privacy` and CI, with a `tests/fixtures/ephemeral-identity-bypass/` fixture.

## Documentation / PBOM / Trust Center

Documentation is kept honest: ADR-0013 (§13/§21/§24), roadmap, privacy model, and glossary describe ephemeral identity as independent, current-process, non-recoverable, non-anonymous. The schema-compatibility note, precheck, threat model, and this audit + the boundary audit record the design and its limits without overclaiming. The Policy Matrix graduates the ephemeral rows (+13: **226 specs → 1582 rules**), with promotion/recovery/export/synchronize/persistent-storage denied across modes; the conflict suite enforces this.

## Secure Device separation

Preserved. The ephemeral module imports no Secure Device / DevicePosture implementation. It binds lifetime to a local **process epoch** ("no OS process id, never persisted, never exposed to peers"), not a device/attestation signal. DevicePosture remains tighten-only in policy and is a rejected caller field in validation.

## Known limitations

Ephemeral identity is a local scope change, not a cryptographic or network capability. It provides **no anonymity** (network/IP/endpoint observation is unchanged), **no remote deletion**, **no forensic erasure** (SP 800-88 media sanitization is out of scope), **no endpoint guarantee** (a compromised device sees everything — Secure Device is external), and **no cryptographic unlinkability** (independence is structural/organizational; Gate F must derive any future material independently). Lifetime limits are engineering defaults, not guarantees. Key material (Gate F), wire formats (Gate E), and synchronization/distributed revocation (Gate H) are deferred. **Not safe for real secrets.**

## Verdict

**Complete.** The independent current-process ephemeral identity context is implemented with a separate root type, vault, and repository; process-epoch binding; bounded injected-clock lifetime; fail-closed pre-op expiration; atomic honest destruction; exact-scope policy gating; isolated placeholders with no long-lived inheritance; a static guardrail; and honest documentation. Enforcement note (see boundary audit): the sdk/core Identity Firewall facade that wires RoomOS to the ephemeral result surface is a later task. Next: **TECH-ID-05 — pairwise aliases** (not started).
