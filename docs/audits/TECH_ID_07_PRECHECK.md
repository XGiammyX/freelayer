# TECH-ID-07 — Device Key Model — Precheck

**Status legend:** `present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## 1. Repository state

| Item | Value |
| --- | --- |
| Branch (work) | `tech/identity-device-key-model-v1` |
| Base branch | `tech/identity-room-aliases-v1` (TECH-ID-06, PR #61, **open/unmerged**) |
| Base SHA | `77b185a` (`feat(identity): add per-room alias foundations`) |
| Working tree at branch point | clean |
| Stacked dependency | **stacked dependency** — TECH-ID-07 → TECH-ID-06 (#61) → TECH-ID-05 (#60) → TECH-ID-04 → TECH-ID-03 → ADR-0013 |

Hosted CI runs only on `main`-targeted PRs, so this stacked PR is verified **locally**.

## 2. Prerequisite status (TECH-ID-02–06)

| Prerequisite | Status | Evidence |
| --- | --- | --- |
| TECH-ID-02 — Identity Architecture ADR | `present` | `docs/adr/ADR-0013-identity-firewall-architecture.md` (Accepted); anticipates "subordinate revocable device authorizations (each device independent key material)" |
| TECH-ID-03 — Local Identity Scaffolding | `present` | roots/personas/relationships/room-bindings + validators + reducer + policy + memory/null repos |
| TECH-ID-04 — Ephemeral Identity | `present` | `packages/identity/src/ephemeral/` — process-epoch-bound roots, fail-closed expiration |
| TECH-ID-05 — Per-Contact Aliases | `present` (unmerged) | `packages/identity/src/aliases/` |
| TECH-ID-06 — Per-Room Aliases | `present` (unmerged) | `packages/identity/src/room-aliases/` |

## 3. Existing device/key/passport surface

| Item | Status | Note |
| --- | --- | --- |
| `deviceId`/`deviceKey`/`clientId`/`installationId`/`passport`/`attestation`/`trustedDevice` usage | `not applicable` | None used inconsistently; no production device model exists. `DeviceAuthorizationRef` is a declared future-reference brand only (`identifiers.ts`, "never key material"). |
| Hardware/device identifier storage | `not applicable` / none | `identity-validation.ts` already rejects `hardwareId`; no code collects serial/model/MAC/IMEI/advertising ids. |
| DevicePosture ↔ identity coupling | `not applicable` | DevicePosture lives in RoomOS/Secure-Device contracts; `check:no-device-posture-or-governance-bypass` + `check:no-secure-device-core-implementation` enforce separation. Posture never authorizes identity. |
| Existing device matrix rows | `present` | `identity.device_key_future` (operation `identity.device_key`, future_gate) and `identity.device_passport_future` (future_gate). Reused: key generation stays Gate F; passport stays TECH-ID-08. |
| `identity.device.*` PolicyDecision scopes | `missing` | None yet — TECH-ID-07 adds 8. |
| Identity revision model | `present` | `IdentityLocalRevision` + `FIRST_IDENTITY_REVISION`/`nextIdentityRevision` — reused for device-authorization revisions. |
| RoomOS membership boundary | `present` | RoomOS membership is authorization-only; never a device credential (documented + guarded). |
| Storage/metadata behavior | `present` | memory/null repositories + policy-gated, exact-scope `PolicyDecision` established across identity. |

## 4. Determinations

1. **TECH-ID-03–06 implemented** — `present` (03/04 implemented; 05/06 complete but unmerged, stacked).
2. **ADR accepted + current** — `present`; ADR-0013 already carries the root→subordinate-device model.
3. **Device types already exist?** — `partial` — only the `DeviceAuthorizationRef` future-reference brand; no records/lifecycle/scopes/slots. TECH-ID-07 introduces them under `packages/identity/src/devices/`.
4. **Inconsistent device naming?** — `not applicable`; the device vocabulary is introduced cleanly here.
5. **Hardware identifiers stored?** — no.
6. **DevicePosture coupled to authorization?** — no (tightening-only, external).
7. **TECH-ID-07 branch/PR exists?** — `missing` (this is the first).
8. **Schema versioned extension needed?** — `partial`. New additive `devices/` module + a new `DeviceKeyModelStateV1` aggregate (separate, memory/null, like the alias aggregates). A caller-resolved `DeviceRootRefV1` decouples the model from a specific vault and covers long-lived + ephemeral roots. No existing persisted data to migrate.

## 5. Guardrails / policy baseline

| Item | Status |
| --- | --- |
| Policy Matrix | `present` — 253 specs → 1771 rules (post TECH-ID-06) |
| Exact-scope `PolicyDecision` | `present` |
| Existing guardrails | `present` — identity-scaffolding / ephemeral / contact-alias / room-alias bypass guards; secure-device-core; device-posture-or-governance; roomos family; policy-* |
| Secure Device separation | `present` — externalized; `check:no-secure-device-core-implementation` enforces |

## 6. Blockers

**None.** All prerequisites `present`. Proceed on a stacked branch. Honest limitation carried forward: TECH-ID-07 is **non-cryptographic** — no key bytes, no signatures, no remote/cryptographic revocation, no hardware binding, no endpoint guarantee; not safe for real secrets. Real keys are Gate F; Device Passport is TECH-ID-08; synchronization is Gate H.
