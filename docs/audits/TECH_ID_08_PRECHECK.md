# TECH-ID-08 — Device Passport — Precheck

**Status legend:** `present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## 1. Repository state

| Item | Value |
| --- | --- |
| Branch (work) | `tech/identity-device-passport-v1` |
| Base branch | `tech/identity-device-key-model-v1` (TECH-ID-07, PR #62, **open/unmerged**) |
| Base SHA | `8067596` (`feat(identity): add device key model foundation`) |
| Working tree at branch point | clean |
| Stacked dependency | **stacked dependency** — TECH-ID-08 → TECH-ID-07 (#62) → TECH-ID-06 (#61) → TECH-ID-05 (#60) → … → ADR-0013 |

Hosted CI runs only on `main`-targeted PRs, so this stacked PR is verified **locally**.

## 2. Prerequisite status (TECH-ID-02–07)

| Prerequisite | Status | Evidence |
| --- | --- | --- |
| TECH-ID-02 — Identity Architecture ADR | `present` | `docs/adr/ADR-0013-identity-firewall-architecture.md` (Accepted); anticipates a future signed root-to-device authorization (Device Passport) |
| TECH-ID-03 — Local Identity Scaffolding | `present` | roots/personas/relationships/room-bindings |
| TECH-ID-04 — Ephemeral Identity | `present` | `packages/identity/src/ephemeral/` (process epoch) |
| TECH-ID-05 — Per-Contact Aliases | `present` (unmerged) | `packages/identity/src/aliases/` (reused text normalizer) |
| TECH-ID-06 — Per-Room Aliases | `present` (unmerged) | `packages/identity/src/room-aliases/` |
| TECH-ID-07 — Device Key Model | `present` (unmerged) | `packages/identity/src/devices/` — reused here |

## 3. TECH-ID-07 device surface reused by TECH-ID-08

| Symbol | Home | Reuse |
| --- | --- | --- |
| `DeviceAuthorizationScopeV1` + `validateDeviceAuthorizationScopeV1` + `deviceScopeContainsV1` + `attenuateDeviceAuthorizationScopeV1` | `packages/identity/src/devices/device-scopes.ts` | passport scope attenuation |
| `DeviceIdentityCapabilityV1` + `attenuateDeviceCapabilitiesV1` + `DEVICE_UNAVAILABLE_CAPABILITIES` | `devices/device-types.ts` + `device-authorization-context.ts` | passport capability attenuation (intersection); add_future/recovery denied |
| `DeviceKeyPurposeV1` + `DeviceKeySlotId` + `validateDeviceKeySlotId` | `devices/device-key-purposes.ts` + `device-identifiers.ts` | empty key-slot commitments |
| `DeviceAuthorizationSnapshotV1` | `devices/device-authorization-context.ts` | approver device-authorization snapshot |
| `LocalDeviceRef` / `DeviceAuthorizationId` | `devices/device-identifiers.ts` | candidate + subject references |
| `LocalIdentityRootId` / `IdentityLocalRevision` / `FIRST_IDENTITY_REVISION` / `nextIdentityRevision` | `identifiers.ts` | root ref + revisions |
| `normalizeContactAliasDisplayTextV1` | `aliases/` | (not needed — passports carry no free text) |

## 4. Determinations

1. **TECH-ID-03–07 implemented** — `present` (03/04 implemented; 05/06/07 complete but unmerged, stacked).
2. **ADR current** — `present`.
3. **Device Key Model exists** — `present` (`packages/identity/src/devices/`).
4. **Existing passport/link/QR/approval types?** — `partial` — only `DevicePassportUnavailableError` (a TECH-ID-07 guard error for the future-gated device commands). No passport/link-request/challenge/epoch model exists. TECH-ID-08 introduces `packages/identity/src/device-passports/`.
5. **Any code creates a second active device?** — no. TECH-ID-07 explicitly forbids it; TECH-ID-08 preserves that (a local unsigned approval grants NO operational authority).
6. **Test fixtures becoming production issuers?** — guarded: `issued_future_signed`/`accepted_future_verified` states are not constructible in production; the new bypass guard + tests enforce it.
7. **DevicePosture / RoomOS role coupled to approval?** — no (both are non-authorities; guards enforce separation).
8. **Schema versioned extension needed?** — `partial`. New additive `device-passports/` module + a new `DevicePassportStateV1` aggregate (current-process memory/null). An `IdentityAuthorityEpoch` type + `IdentityAuthorityEpochStateV1` contract are added to `identity-types.ts` (additive); the current epoch is caller-resolved via the approver/root context in TECH-ID-08 (not stored on the root record — documented, avoids churn). No persisted data to migrate.

## 5. Guardrails / policy baseline

| Item | Status |
| --- | --- |
| Policy Matrix | `present` — 267 specs → 1869 rules (post TECH-ID-07) |
| Exact-scope `PolicyDecision` | `present` |
| Existing guardrails | `present` — identity-scaffolding / ephemeral / contact-alias / room-alias / device-key-model bypass guards; secure-device-core; device-posture-or-governance; roomos family; policy-* |
| Secure Device separation | `present` — externalized |

## 6. Blockers

**None.** All prerequisites `present`. Proceed on a stacked branch. Honest limitation carried forward: TECH-ID-08 is **non-cryptographic** — no signatures, no signed/verified passport, no remote activation/acceptance, no QR/Capsule transport, no remote revocation, no hardware/posture guarantee; a local unsigned approval is not cryptographic authorization and grants no operational device authority. Signed issuance + verification are Gate F; QR/transport are Gate E; synchronization/remote revocation are Gate H. Not safe for real secrets.
