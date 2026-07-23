# Device Key Model Package-Boundary Audit (TECH-ID-07)

- **Date:** 2026-07-23
- **Branch:** `tech/identity-device-key-model-v1` (stacked on `tech/identity-room-aliases-v1` / TECH-ID-06, PR #61)
- **Module:** `@freelayer/identity` → [`packages/identity/src/devices/`](../../packages/identity/src/devices) (16 files)

This audit covers the package/dependency boundary of the **device key model** module and proves it stays within its declared limits: **local, root-authorization-scoped, non-cryptographic device-authorization metadata** — not a key, not a signature, not an attestation, not identity, not DevicePosture, not a `RoomMemberRef`, not a hardware identifier. A `DeviceAuthorizationRecordV1` references **exactly one** identity root (`rootId`/`rootKind`), lives in a **separate** aggregate (`DeviceKeyModelStateV1`), holds **no** key material, and never mutates a root, a persona, a room binding, or a RoomOS membership. There is no network, no persistence beyond memory/null, no cryptography, no remote revocation, and no hardware binding. Companion notes: [TECH_ID_07_PRECHECK.md](TECH_ID_07_PRECHECK.md), threat model [TECH_ID_07_DEVICE_KEY_THREAT_MODEL.md](TECH_ID_07_DEVICE_KEY_THREAT_MODEL.md), implementation research [DEVICE_KEY_MODEL_IMPLEMENTATION_RESEARCH.md](../research/DEVICE_KEY_MODEL_IMPLEMENTATION_RESEARCH.md), main audit [TECH_ID_07_DEVICE_KEY_MODEL_AUDIT.md](TECH_ID_07_DEVICE_KEY_MODEL_AUDIT.md). House style follows [ROOM_ALIAS_BOUNDARY_AUDIT.md](ROOM_ALIAS_BOUNDARY_AUDIT.md) (TECH-ID-06).

## Desired dependency direction

```
apps → sdk/core Identity Firewall facade → @freelayer/identity (devices module)
        → @freelayer/privacy (PolicyDecision, PolicySideEffectScope, PrivacyMode)
          + @freelayer/security (Brand, via ../identifiers)
        → sibling identity read contracts (root / persona / relationship /
          room-binding IDENTIFIERS only: LocalIdentityRootId, IdentityPersonaId,
          PairwiseRelationshipId, RoomIdentityBindingId, LocalIdentityRootKindV1)
        → reused TECH-ID-05 normalization (../aliases: normalizeContactAliasDisplayTextV1)
        → device-key-model policy + memory / null repository
        → a caller-resolved DeviceRootRefV1 (root usable / compromised asserted by caller)
RoomOS ──(later, narrow policy-safe device-authorization RESULT only)──▶ consumer
Crypto ──(later, after Gate F, purpose-specific key-slot DESCRIPTORS only)──▶ consumer
```

The devices module depends **only** on `@freelayer/privacy` (`PolicyDecision`/`isPolicyDecision`, `PolicySideEffectScope`, `PrivacyMode`), sibling identity identifiers/types (`../identifiers` — the opaque brands + `IdentityLocalRevision`/`FIRST_IDENTITY_REVISION`/`nextIdentityRevision`; `../identity-types` — `LocalIdentityRootKindV1`), the reused TECH-ID-05 normalizer (`../aliases` — `normalizeContactAliasDisplayTextV1`), and, transitively via `../identifiers`, `@freelayer/security` (`Brand`). It imports **no** UI, **no** network transports, **no** Crypto implementation, **no** Secure Device / DevicePosture / ScreenShield / attestation implementation, **no** platform / OS / hardware APIs, and — critically — **it never imports `@freelayer/rooms`** and never touches a RoomOS mutation API.

Unlike the per-room alias module, the device model needs **no** RoomOS read-model mirror at all: a room is referenced only as an opaque `RoomIdentityBindingId` brand inside a `DeviceAuthorizationScopeV1` (a *maximum future context*, never a membership, role, or graph read). The model is therefore strictly more self-contained than TECH-ID-06 — it reads no RoomOS-owned state and asserts no cross-package atomicity with membership.

## Separate aggregate / repository — isolation rationale

Device authorizations are held in a **separate** `DeviceKeyModelStateV1` (`persistenceClass: "memory_only" | "null"`; authorizations + key slots + labels — [`device-types.ts`](../../packages/identity/src/devices/device-types.ts)), served by a **separate** `DeviceKeyModelRepositoryV1` (`InMemory…` = current-process memory, or `Null…` — [`device-repository.ts`](../../packages/identity/src/devices/device-repository.ts)), keyed to a **caller-resolved** `DeviceRootRefV1`. Records are never added to a `LocalIdentityRootV1`, an `EphemeralIdentityRootV1`, a `RoomIdentityBindingV1`, or a `RoomMembershipRecordV1`. Deliberate isolation, not incidental layering:

- **Revocation cannot disturb the root, persona, binding, or membership.** Because the aggregate references the root by id (`DeviceRootRefV1`) and lives in its own store, restrict/mark_compromised/revoke rewrites only device records ([`device-reducer.ts`](../../packages/identity/src/devices/device-reducer.ts)); the root lifecycle, key-material state, persona label, room binding, and RoomOS membership are untouched. `LocalDeviceRevocationResultV1` discloses exactly what a revoke does **not** do (`remoteDevicesAffected: false`, `messageKeysRotated: false`, `roomKeysRotated: false`, `deviceDataErased: false`, `cryptographicRevocationPerformed: false`).
- **Root remains authoritative; any root-side hint is derived.** The root record's `deviceAuthorizationState` stays the `"not_implemented_gate_f_g"` placeholder; the device record is the only authority for device-authorization state, and the caller supplies the root's usability (`rootActive` / `rootCompromised`) rather than the module reaching into root internals.
- **Fail-closed blast radius.** A bug in one path cannot leak a device record into the identity vault, the binding, or the membership graph, or vice versa; the repository accepts only its own aggregate type and only an `identity.device.*`-scoped decision (`isAuthentic` — [`device-repository.ts`](../../packages/identity/src/devices/device-repository.ts)).
- **One bootstrap only.** The reducer refuses a second device record for a root that already has one (`DeviceAdditionUnavailableError` — `device_already_exists`); there is no producible `cryptographicallyAuthorized: true` state and no second-device path.

## What a consumer may consume (narrow, safe)

Only policy-safe result surfaces, mapped by the (future) facade — never the internal aggregate:

- **RoomOS (later)** may consume only a **policy-safe device authorization result** — a redacted `LocalDeviceSummaryV1` (trust flags `cryptographicallyAuthorized` / `hardwareAttested` / `postureVerified` / `remotelySynchronized` fixed `false`; strict modes omit the device ref, label, scope details, capability count) or a `LocalDeviceRevocationResultV1`, built only behind its own `identity.device.summary.read` decision ([`device-summary.ts`](../../packages/identity/src/devices/device-summary.ts)). RoomOS never receives the raw record, the scope internals, the key slots, or a device list keyed to the persona/relationship/room graph. A device authorization is **not** a room membership and confers none.
- **Crypto (later, after Gate F)** may consume only **purpose-specific key-slot descriptors** — a `RedactedKeySlotViewV1` exposing `purpose` + `lifecycle` (`algorithm: "not_selected_gate_f"`, `publicMaterialPresent: false`, `privateMaterialPresent: false`) ([`device-summary.ts`](../../packages/identity/src/devices/device-summary.ts)). No slot holds key bytes today; when Gate F ships, crypto binds material to a slot's **fixed, one-per-slot purpose** (`keyReuseAcrossPurposes: "forbidden"`), never reads a slot id as authority, and never treats a descriptor as a present key.

Both are architecture-rule contracts: no facade is wired yet (Gate G). The result types exist and are redaction-correct; the RoomOS↔device and Crypto↔slot integrations are later tasks.

## What must NEVER cross the boundary (never-cross list)

- **hardware / device / OS metadata** — no serial, model, MAC, IMEI, advertising id, hostname, OS build, user-agent, or attestation; `hardwareId` / `serialNumber` / `imei` / `macAddress` / `advertisingId` / `hostname` / `osBuild` / `attestation` are rejected caller fields (`HardwareIdentifierForbiddenError` — [`device-validation.ts`](../../packages/identity/src/devices/device-validation.ts)), and the module probes no `navigator`/`os` API (guardrail `DEVICE_HARDWARE_RE`). A device reference (`LocalDeviceRef`, `dev-…`) is an opaque local handle, never a hardware identifier;
- **device labels** to peers, rooms, notifications, telemetry, logs, or persistent storage — a `LocalDeviceLabelV1` is `visibility: "local_only"`, `peerShared: false`, `authority: "none"`, `postureEvidence: false`; raw label logging is banned (guardrail `DEVICE_LOG_RE`);
- **key slots directly** — the internal `DeviceKeySlotV1` (with its `slotId`) never crosses; only the purpose+lifecycle `RedactedKeySlotViewV1` may (post-Gate F). No slot id, algorithm, or material is exposed;
- **root internals** — the private root id / key-material state / persona label; a device record never exposes, derives from, or serializes root material; the caller asserts root usability via `DeviceRootRefV1` rather than the module reading the root aggregate;
- **a device list / correlation surface** — no persistent device registry or history (`identity.device.history` is `deny`); no export/sync; summaries carry no relationship/room/persona ids and expose no cross-root linkage (refs are per-`DeviceRootRefV1`);
- **DevicePosture as authority** — posture may only **tighten** (`postureTightens: true` denies in the snapshot check — [`device-authorization-context.ts`](../../packages/identity/src/devices/device-authorization-context.ts)); `devicePosture` / `screenShieldActive` are rejected caller fields (`DevicePostureAuthorityError`); a RoomOS role or membership never authorizes a device (guardrail bans `postureAuthorizesDevice` / `roomRoleAuthorizesDevice` / `membershipAuthorizesDevice`);
- **key material / crypto** — `publicKey` / `privateKey` / `secretKey` / `seed` / `mnemonic` / `signature` / `certificate` are rejected (`DeviceKeyMaterialForbiddenError`); the devices module uses no `crypto`/`webcrypto`/`generateKeyPair`/`randomBytes` (guardrail `DEVICE_CRYPTO_RE`);
- **remote effects** — no `fetch`/`WebSocket`/`RTCPeerConnection` (guardrail `DEVICE_NETWORK_RE`); revocation is local-only and claims no remote deletion, session/key rotation, or erasure.

## No peer-facing text, no side effects, no automatic mutation

The devices module performs no storage/network/notification/AI/crypto/randomness. It never sends a device ref or label anywhere. Bootstrapping, restricting, marking compromised, or revoking a device does not create, alter, or revoke a root, persona, room binding, or RoomOS membership, and produces no remote effect. There is no directory, no second-device link, no QR approval, no import, no passport issuance, and no attestation — those commands are future-gated and simply do not exist (`DEVICE_FUTURE_GATED_COMMAND_NAMES` reject as unavailable — [`device-commands.ts`](../../packages/identity/src/devices/device-commands.ts)). A device record is never seeded automatically from a hardware signal, a posture reading, a room role, or a `RoomMemberRef` — it comes only from an explicit bootstrap of the current installation placeholder with injected ids.

## Note on the two existing Secure Device / posture guards

The device model's policy makes an **honest negative disclosure** — `hardwareAttestationAvailable: false` in every privacy mode ([`device-policy.ts`](../../packages/identity/src/devices/device-policy.ts)). Because both existing separation guards scan for attestation/posture tokens, each **explicitly allowlists** `packages/identity/src/devices/device-policy.ts` so the honest `false` disclosure is not mistaken for a bypass: `check:no-secure-device-core-implementation` ([`scripts/check-no-secure-device-core-implementation.mjs`](../../scripts/check-no-secure-device-core-implementation.mjs) — the TECH-ID-07 device-policy allowlist) and `check:no-device-posture-or-governance-bypass` ([`scripts/check-no-device-posture-or-governance-bypass.mjs`](../../scripts/check-no-device-posture-or-governance-bypass.mjs)). This confirms the boundary from the other side: the device model discloses the **absence** of attestation/posture authority rather than implementing or consuming it, and Secure Device stays externalized.

## Boundary summary

| Boundary | Rule | Allowed flow | Never crosses | Status |
| --- | --- | --- | --- | --- |
| Devices module → `@freelayer/rooms` | forbidden (avoid cycle; separation) | opaque `RoomIdentityBindingId` brand inside a scope only | any `@freelayer/rooms` import; any RoomOS mutation API | enforced (no import; guardrail) |
| Devices module → UI / transports / crypto / Secure Device / platform APIs | forbidden | (none) | UI, network, crypto, DevicePosture, ScreenShield, OS/hardware APIs | enforced (`check:no-device-key-model-bypass` regexes + no such imports) |
| Device aggregate vs root / binding / membership records | separate stores | device record ↔ `DeviceKeyModelRepositoryV1` only; root by `DeviceRootRefV1` | device onto root / `RoomIdentityBindingV1` / `RoomMembershipRecordV1` | enforced (distinct type + repo; ref-by-id; root `deviceAuthorizationState` stays placeholder) |
| Root / persona / binding / membership mutation from a device op | forbidden | validated read-only `DeviceRootRefV1` | any write to root / persona / binding / membership lifecycle | enforced (reducer writes only device records) |
| DevicePosture / RoomOS role / membership as device authority | forbidden | posture/role may only RESTRICT via policy / snapshot | posture/role/membership as an authorizer of a device | enforced (`postureTightens` denies; rejected caller fields; guardrail) |
| RoomOS ← device results | narrow result types only | redacted `LocalDeviceSummaryV1` / `LocalDeviceRevocationResultV1` | raw aggregate, scope internals, key slots, device list, root id | architecture-rule (facade not yet wired; Gate G) |
| Crypto ← key-slot descriptors | purpose-specific, post-Gate F | `RedactedKeySlotViewV1` (purpose + lifecycle) | slot ids, key bytes, algorithm assertion, cross-purpose reuse | future-gate (no material today; Gate F) |
| Hardware / device / OS metadata | forbidden | opaque non-hardware `LocalDeviceRef` only | serial / model / MAC / IMEI / advertising id / hostname / OS build / attestation | enforced (rejected fields; no hardware probe; guardrail) |
| Device label → disk / network / logs / telemetry / notifications | forbidden | memory or null retention only | disk / localStorage / sessionStorage / IndexedDB / DB / fetch / WS / console | enforced (`check:no-device-key-model-bypass` + repository types + content-free errors) |
| Key material / signatures / cross-signing | not implemented | (none — `not_selected_gate_f`) | key bytes, signatures, fingerprints, certificates | enforced (rejected fields; markers `false`; guardrail) |
| Second-device add / link / QR / import / passport / attestation | future-gated | (none — commands do not exist) | any add / link / approve_qr / import / issue_passport / verify_attestation path | enforced (future-gated command names reject; Policy Matrix future_gate) |
| Remote / distributed / cryptographic revocation | not implemented (Gate H) | local terminal tombstone only | any remote deletion / session-kill / key-rotation / erasure / sync | enforced (`LocalDeviceRevocationResultV1` fields `false`; guardrail; `identity.device.remote_revoke` future_gate) |

## Honest enforcement status

- **Enforced today:** dependency set (privacy + security + sibling identity identifiers/types + reused TECH-ID-05 normalization only), no `@freelayer/rooms` import, no-transport/UI/crypto/Secure-Device/platform imports, memory/null-only storage, separate aggregate with root-by-`DeviceRootRefV1` (no root/persona/binding/membership rewrite), exactly one root per record and no producible cryptographically-authorized state, attenuation-only scope + capability narrowing, one-purpose-per-slot with no key material, exact-scope `identity.device.*` `PolicyDecision` on every pipeline and repository op (re-checked by `isAuthentic`, which requires the `identity.device.` prefix), the 14 Policy Matrix rows (incl. 5 structural denies/future-gates), and the `check:no-device-key-model-bypass` static guardrail (wired into `audit:privacy` and CI, with a `tests/fixtures/device-key-model-bypass/` intentional-failure fixture). Both existing Secure Device / posture guards allowlist the device policy's honest `hardwareAttestationAvailable: false` disclosure.
- **Architecture-rule (not yet code-enforced end to end):** RoomOS and Crypto do **not** yet consume the device model — **no facade is wired.** The narrow device-authorization result surface (redacted summary / revocation result) and the purpose-specific key-slot descriptor exist and are redaction-correct, but the sdk/core Identity Firewall facade that maps them to RoomOS / Crypto is a later task (Gate G). Until then, "what a consumer may consume" describes the intended contract, not a live integration.
- **Future-gate:** cryptographic device authorization / key bytes / signatures / verification fingerprints are Gate F; the signed root↔device Device Passport and device linking are TECH-ID-08 (+ Gate E/F); synchronization / distributed device revocation is Gate H; wire/remote exchange is Gate E. This module claims none of them, and no external Secure Device / Endpoint Defense capability is implemented in core — only contracts, policy inputs, and honest disclosures.

## Mandatory honest boundary statements

A DeviceKey is **not** DevicePosture; DevicePosture is **not** identity; a device is **not** a person; a device reference is **not** a hardware identifier; a device label is **not** authority; a local authorization record is **not** a cryptographic proof; RoomOS membership is **not** device authorization; device revocation is **not** remote erasure. There is **no real key security**, **no cryptographic authorization**, **no remote revocation**, **no hardware binding**, and **no endpoint guarantee** in this module; it is **not safe for real secrets**. Deferred: Gate F (crypto / real keys / signatures / verification), TECH-ID-08 (Device Passport / device linking), Gate E (wire formats), Gate H (synchronization / distributed revocation). Secure Device / Endpoint Defense / ScreenShield remain **externalized**, never implemented or consumed in core.

## Unresolved dependency direction (honest)

As in TECH-ID-03/04/05/06, no shared-contract package was introduced for cross-domain references; the identity-local brands suffice, and — unlike the room-alias module — the device model needs no RoomOS read-model mirror because it reads no RoomOS-owned state. Its one honest concession is that the caller, not the module, resolves the root's usability into `DeviceRootRefV1`; the module fails closed on a not-usable root but cannot itself prove the root is current (that is a caller/Gate F obligation). If a future task needs bidirectional root↔device↔RoomOS types, extract a `@freelayer/contracts` package and move the ref brands there. The device↔RoomOS/Crypto integrations remain later tasks (Gate G / Gate F); this audit fixes the boundary they must honor when they land — above all, that a device authorization is local, non-cryptographic metadata, that identity never imports or mutates RoomOS, and that neither a device, a device label, a posture reading, nor a RoomOS role is identity, authority, verification, or a key.

## Verdict

**Complete (boundary).** The device key model module holds a clean, cycle-free dependency graph: privacy + security + sibling identity identifiers/types + the reused TECH-ID-05 normalizer only, with **no** `@freelayer/rooms`, UI, transport, crypto, Secure Device, or platform import; a separate memory/null aggregate keyed to a caller-resolved root ref that never rewrites a root, persona, binding, or membership; exact-scope `identity.device.*` gating at the pipeline and repository; and a dedicated static guardrail wired into `audit:privacy` and CI. The RoomOS↔device and Crypto↔slot consumer contracts are documented and structurally supported but not yet wired (Gate G). No boundary regression found.

## Sign-off checklist

| Check | Status | Evidence |
| --- | --- | --- |
| Dependency set: privacy + security + sibling identity ids/types + reused TECH-ID-05 normalizer only | ✅ | module imports — [`device-*.ts`](../../packages/identity/src/devices) |
| No `@freelayer/rooms` import; no RoomOS mutation API; room referenced only by opaque `RoomIdentityBindingId` | ✅ | [`device-scopes.ts`](../../packages/identity/src/devices/device-scopes.ts); guardrail |
| No UI / transport / crypto / Secure Device / platform imports | ✅ | [`check-no-device-key-model-bypass.mjs`](../../scripts/check-no-device-key-model-bypass.mjs) (crypto/hardware/log/network regexes) |
| Separate memory/null aggregate; root by `DeviceRootRefV1`; no root/persona/binding/membership rewrite | ✅ | [`device-types.ts`](../../packages/identity/src/devices/device-types.ts); [`device-reducer.ts`](../../packages/identity/src/devices/device-reducer.ts) |
| Never-cross list held: hardware metadata, labels, key slots, root internals, device list, posture-as-authority | ✅ | [`device-validation.ts`](../../packages/identity/src/devices/device-validation.ts); [`device-authorization-context.ts`](../../packages/identity/src/devices/device-authorization-context.ts); guardrail |
| Consumer contracts narrow: RoomOS ← policy-safe result; Crypto ← purpose-specific slot descriptor (post-Gate F) | ✅ (architecture-rule; facade not wired) | [`device-summary.ts`](../../packages/identity/src/devices/device-summary.ts) |
| Exact-scope `identity.device.*` `PolicyDecision` at pipeline + repository (`isAuthentic` prefix check) | ✅ | [`device-pipeline.ts`](../../packages/identity/src/devices/device-pipeline.ts); [`device-repository.ts`](../../packages/identity/src/devices/device-repository.ts) |
| Two existing Secure Device / posture guards allowlist honest `hardwareAttestationAvailable: false` | ✅ | [`check-no-secure-device-core-implementation.mjs`](../../scripts/check-no-secure-device-core-implementation.mjs); [`check-no-device-posture-or-governance-bypass.mjs`](../../scripts/check-no-device-posture-or-governance-bypass.mjs) |
| Guardrail + fixture + CI + `audit:privacy` | ✅ | [`check-no-device-key-model-bypass.mjs`](../../scripts/check-no-device-key-model-bypass.mjs); [`ci.yml`](../../.github/workflows/ci.yml); `package.json` `audit:privacy` |
| Honest limits stated (no keys / crypto / remote revocation / hardware binding; Gates E/F/H + TECH-ID-08) | ✅ | this audit; [TECH_ID_07_DEVICE_KEY_THREAT_MODEL.md](TECH_ID_07_DEVICE_KEY_THREAT_MODEL.md) |
