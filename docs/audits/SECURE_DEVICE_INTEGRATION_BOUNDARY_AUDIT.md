# Secure Device Integration Boundary Audit

> Date: 2026-07-13 · Branch: `tech/sensitive-room-secure-device-contract` · Task: TECH-23 "Sensitive Room Admission + Secure Device Integration Contract"

This audit documents the desired data-flow boundary between FreeLayer core and a
future external Secure Device provider, and proves — file by file — that core
stays on the Relying-Party side of that boundary. It is a package-boundary
audit, not a security marketing document: every rule below is paired with the
concrete mechanism that enforces it and an honest status.

Scope reviewed:

- `packages/rooms/src/secure-device/` (all 11 modules + `index.ts`)
- `packages/rooms/src/index.ts` (TECH-23 re-export block)
- `scripts/check-no-secure-device-core-implementation.mjs` (core-boundary guardrail)
- `tests/security-regression/rooms/secure-device-contract/secure-device-security.test.ts`

---

## 1. Desired data-flow boundary

FreeLayer core is the **RATS Relying Party (RFC 9334) only**. The Attester and
Verifier are external. Core never touches raw Evidence; it consumes a single
normalized, transient, evidence-free assessment and applies its own room policy.

Intended flow (left of the double bar is external and unbuilt today; right of it
is core and shipped):

```
 EXTERNAL Secure Device project (future)            ‖   FreeLayer core (this repo)
 ────────────────────────────────────────           ‖   ─────────────────────────────────────────────
                                                     ‖
 device Attester ──▶ Evidence                        ‖
        │                                            ‖
        ▼                                            ‖
 external Verifier ──▶ Attestation Results           ‖
        │                                            ‖
        ▼                                            ‖
 Secure Device adapter                               ‖
        │  implements                                ‖
        ▼                                            ‖
 SecureDeviceProviderPortV1  ───────────────────────╫──▶  normalized DevicePostureAssessmentV1
 (contractVersion 1)                                 ‖     (transient, evidence-free, provenance-registered)
                                                     ‖              │
                                                     ‖              ▼
                                                     ‖     resolveSensitiveRoomAdmissionV1  (14-step gate)
                                                     ‖              │  (+ Privacy Mode, lifecycle, membership,
                                                     ‖              │     provider status/capabilities, room policy)
                                                     ‖              ▼
                                                     ‖     current authorization + PolicyDecision (TECH-21)
                                                     ‖              │  assertRoomOperationAllowed / execution-time revalidation
                                                     ‖              ▼
                                                     ‖     protected operation (reveal / mutate / manage)
```

Today the double bar is a hard wall: **no external provider is integrated.** The
only shipped implementation of the port is `NullSecureDeviceProviderV1`, so the
posture that ever reaches admission is `unverified` (or a `at_risk` tightening).
The admission gate is an _additional_ gate — it never replaces membership,
capability, or the TECH-21 PolicyDecision; it runs immediately before them.

As sequential steps:

1. (future) external Attester emits Evidence; external Verifier appraises it.
2. (future) external adapter implements `SecureDeviceProviderPortV1` and returns
   a normalized `DevicePostureAssessmentV1` — never raw Evidence.
3. Core validates provenance + structure of the assessment
   (`isAcceptedDevicePostureAssessmentV1`).
4. `resolveSensitiveRoomAdmissionV1` fuses assessment + provider status +
   room policy + Privacy Mode + lifecycle + membership/capability into a
   redacted, fail-closed admission decision.
5. The decision feeds current authorization + an authentic exact-scope
   PolicyDecision (TECH-21) before any side effect.
6. Only then may the protected operation proceed.

---

## 2. Rules apps (and core) must NOT break, and their enforcement

Each rule states the prohibited behavior and the mechanism that structurally
prevents it. "Structural" means a TypeScript literal type or a runtime coercion
that cannot be satisfied, not merely a convention.

### 2.1 Apps must NOT construct trusted assessments

An app cannot hand-build a `DevicePostureAssessmentV1` and have it treated as
real. Provenance is enforced by a **module-private `WeakSet` registry**
(`issuedAssessments`, `posture-assessment.ts:56`). Only objects this module
itself created via `register()` are members. `isAcceptedDevicePostureAssessmentV1`
(`:129`) requires both `isStructurallyValidAssessmentV1` **and**
`issuedAssessments.has(value)`. A hand-crafted look-alike fails the `WeakSet`
membership test and is rejected; the admission resolver then treats posture as
`unverified` with `assessmentRevision: 0` (`sensitive-room-admission.ts:157,163,171`).
This is the same object-capability pattern as PolicyDecision — unforgeable within
the JS realm, though explicitly **not cryptographic** (Gate F).

### 2.2 Apps must NOT choose the effective posture

The effective posture is computed, never supplied. `resolveDevicePostureAssessmentV1`
(`posture-assessment.ts:149`) always routes through the fail-closed TECH-22
`resolveEffectiveDevicePostureV1` with `providerIntegration: "not_integrated"`,
so untrusted input **may only tighten** — the result is `unverified` or
`at_risk`, never elevated. In admission, even an assessment that claims a higher
`effectivePosture` is clamped: `rawEffective` above `unverified` (other than
`at_risk`) is reduced to `unverified` unless `providerTrustedForElevationV1`
returns true, which it structurally cannot (§2.3).

### 2.3 Apps must NOT mark a provider ready / trusted for elevation

`SecureDeviceProviderStatusV1.trustedForPostureElevation` is the **literal type
`false`** (`secure-device-provider.ts:52`) — no value other than `false` type-checks.
`buildProductionProviderStatusV1` (`:89`) is the only production constructor and
**coerces** any `initializing_future`/`ready_future`/`degraded_future` lifecycle
to `unavailable` (allow-list = `PRODUCTION_PROVIDER_LIFECYCLES` = `not_integrated`,
`unavailable`, `failed`) with reason `future_lifecycle_coerced_unavailable`.
`providerTrustedForElevationV1` (`:116`) requires
`trustedForPostureElevation === true` (impossible) AND `lifecycle === "ready_future"`
(uncoerceable) AND `canAssessPosture === true` — so it is provably always `false`.

### 2.4 Apps must NOT bypass admission

`resolveSensitiveRoomAdmissionV1` (`sensitive-room-admission.ts:137`) is the sole,
deterministic, fail-closed gate. It classifies the action, denies on unknown
actions, emergency mode, locked lifecycles, inactive membership, and stale
capability _before_ any content path. A denied decision cannot be laundered into
a session: `createSensitiveRoomSessionV1` throws `SensitiveRoomAdmissionDeniedError`
on `!decision.allowed` (`sensitive-room-session.ts:61`). Sessions are revalidated
by `assertSensitiveRoomSessionCurrentV1` (`:106`) on every relevant change and by
TECH-21 authorization before the side effect.

### 2.5 Apps must NOT read raw evidence

There is no raw-evidence field to read. `FORBIDDEN_ASSESSMENT_FIELDS`
(`posture-assessment.ts:59`) enumerates 25 evidence/identifier field names
(`rawEvidence`, `attestation`, `measurementLog`, `deviceId`, `serial`, `imei`,
`installedApps`, `certificateChain`, `signature`, …). `hasForbiddenField` rejects
any object carrying one, and `isStructurallyValidAssessmentV1` (`:101`) fails
such objects **before** they can influence policy. Capabilities pin
`rawEvidenceExport: "forbidden"` permanently (`secure-device-provider.ts:66`).

### 2.6 Apps must NOT persist assessments

Assessments are transient and current-process-only. The module imports **no**
storage backend (verified in §4). `DevicePostureFreshnessPolicyV1` sets
`crossRestartValidity: false` and no trusted clock/nonce/epoch
(`freshness-policy.ts:20`); sessions set `persistence: "forbidden"` and
`crossRestartValidity: false` (`sensitive-room-session.ts:45-46,82-83`). The
guardrail forbids `persistDevicePostureAssessment`, `saveDevicePostureAssessment`,
`storeAssessmentHistory`, `persistAssessmentHistory`
(`check-no-secure-device-core-implementation.mjs:87-90`). The security-regression
test additionally asserts `resolveStoragePolicy({ dataClass: "device_risk_state" })`
returns `persistentAllowed: false`.

### 2.7 Apps must NOT mark ScreenShield / protected surface active

`ProtectedContentIntentV1` fixes `screenShieldIntegrated: false` and
`protectedSurfaceAvailable: false` as **literal `false` types**
(`protected-content-intent.ts:44-45`), set unconditionally by
`buildProtectedContentIntentV1` (`:87-88`). Any future-required protection
resolves to `deny_content` (`:69`), never a silent downgrade. The guardrail
forbids the token literals `screenShieldActive: true`,
`screenShieldIntegrated: true`, `protectedSurfaceAvailable: true`,
`activeProtectionClaim: true`, `bunkerSessionActive: true` (`:91-96`).

### 2.8 Apps must NOT call endpoint-monitoring or GrapheneOS-management code

No such code exists in core, and it cannot be added under the guardrail. The
static scanner forbids Accessibility/overlay/clipboard/capture/process-monitoring
APIs, MDM/Device-Owner APIs, Play Integrity / attestation libs, and GrapheneOS
install/management / custom-ROM / phone-wide-firewall tokens
(`check-no-secure-device-core-implementation.mjs:40-66`), plus native dependency
specifiers (`react-native-device-info`, `expo-screen-capture`, …, `:98-101`).
The Policy Matrix independently denies these operations, and the security test
confirms GrapheneOS management / MDM / attestation / anti-spyware remain absent.

---

## 3. Provider port and the only shipped implementation

The provider boundary is **versioned**: `SecureDeviceProviderPortV1` carries
`contractVersion: 1` and exposes exactly three read-only methods — `status()`,
`capabilities()`, `currentAssessment()` (`secure-device-provider.ts:128-133`). A
future external adapter would implement this port; nothing else in core does.

The **only shipped implementation is `NullSecureDeviceProviderV1`**
(`null-provider.ts:30`), exported as the singleton `NULL_SECURE_DEVICE_PROVIDER`.
It is:

- **Side-effect-free** — no storage/network/native calls; §4 verifies the imports.
- **Deterministic** — `status()` returns a frozen `NULL_STATUS`; `capabilities()`
  returns `NOT_INTEGRATED_CAPABILITIES`; `currentAssessment()` mints a fresh
  transient `unverified` assessment via `noProviderAssessmentV1()`.
- **`not_integrated`** — status lifecycle and reason `null_provider_not_integrated`.
- **`unverified`** — every assessment resolves fail-closed to `unverified`, never
  elevated, never trusted for elevation.

There is no Mock / Fake / Real / Android / Graphene / Tauri / iOS provider; those
class names are all in the guardrail's forbidden list (`:79-85`).

---

## 4. Zero side-effect imports (asserted by the security-regression test)

`tests/security-regression/rooms/secure-device-contract/secure-device-security.test.ts`
(the "Side-effect traps" block, lines 83-103) reads every file in
`packages/rooms/src/secure-device/` and asserts none contains:

- imports: `@freelayer/storage`, `@freelayer/transports`, `@freelayer/ai`,
  `node:fs`, `node:net`, `node:http`
- calls: `fetch(`, `XMLHttpRequest`, `WebSocket(`, `sendBeacon`, `localStorage`

Manual review of all 11 modules confirms their only imports are sibling
secure-device modules, sibling `policy-composition`/`membership`/`room-types`
type-only imports, and `@freelayer/privacy` types — no I/O sinks. The guardrail's
`PROVIDER_NETWORK_RE` (`:107`) additionally flags any network primitive appearing
on the same line as `assessment`/`posture`/`provider`/`secureDevice`.

---

## 5. RATS role boundary

`secure-device-roles.ts` encodes the RFC 9334 role split as data. FreeLayer's
single role is `freelayer_relying_party` (`FREELAYER_SECURE_DEVICE_ROLE`, `:62`),
`ownedBy: "freelayer_core"`, `ratsRole: "relying_party"`, and crucially
`processesRawEvidence: false` (`:56`). The Attester and Verifier descriptors are
`ownedBy: "secure_device_external_project"` with `processesRawEvidence: true`
"in the EXTERNAL project only" (`:42,49`).

Core therefore never parses Evidence, appraises firmware, inspects measurements,
or infers posture from user agent / OS name / device model / membership — the
module header states this explicitly (`:6-9`) and the forbidden-field list plus
the guardrail's `parseEvidence`/`verifyAttestation`/`appraiseEvidence`/
`readMeasurementLog` tokens (`:20-25`) make it unrepresentable. Membership and
capability are used only to _screen out_ obviously-revoked local authority in
admission — they never _supply_ posture.

---

## 6. Concern → rule → enforcement → status

| Concern                                                      | Rule                                       | Enforcement mechanism                                                                                                                                                                                       | Status                |
| ------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Forged assessments                                           | Only module-issued assessments are trusted | Module-private `WeakSet` registry + `isAcceptedDevicePostureAssessmentV1` (`posture-assessment.ts:56,129`)                                                                                                  | Enforced              |
| Posture choice                                               | Apps cannot pick effective posture         | Fail-closed `resolveEffectiveDevicePostureV1` (tighten-only) + admission clamp to `unverified`/`at_risk` (`posture-assessment.ts:157`, `sensitive-room-admission.ts:163-169`)                               | Enforced              |
| Provider "ready"                                             | No provider is trusted for elevation       | `trustedForPostureElevation: false` literal + `buildProductionProviderStatusV1` coercion + `providerTrustedForElevationV1` always false (`secure-device-provider.ts:52,89,116`)                             | Enforced              |
| Admission bypass                                             | Every protected op passes the gate         | 14-step `resolveSensitiveRoomAdmissionV1` + denied→no session (`sensitive-room-admission.ts:137`, `sensitive-room-session.ts:61`)                                                                           | Enforced              |
| Raw evidence read                                            | No evidence field may exist                | `FORBIDDEN_ASSESSMENT_FIELDS` + structural reject + `rawEvidenceExport: "forbidden"` (`posture-assessment.ts:59,101`; `secure-device-provider.ts:66`)                                                       | Enforced              |
| Persistence                                                  | Assessments/sessions never persist         | No storage import (test-asserted) + `persistence: "forbidden"` / `crossRestartValidity: false` + guardrail persist-token ban (`sensitive-room-session.ts:45`, `freshness-policy.ts:20`, guardrail `:87-90`) | Enforced              |
| ScreenShield active                                          | No active capture protection claimed       | Literal `false` on `screenShieldIntegrated`/`protectedSurfaceAvailable` + future-required→`deny_content` (`protected-content-intent.ts:44-45,69`)                                                           | Enforced              |
| Endpoint monitoring                                          | No monitoring/MDM code in core             | Static guardrail token scan (Accessibility/MDM/Play Integrity/GrapheneOS/native deps) `check-no-secure-device-core-implementation.mjs:40-101`                                                               | Enforced              |
| GrapheneOS mgmt                                              | Externalized, absent from core             | Guardrail tokens `:62-66` + Policy Matrix denial + security-regression test (33)                                                                                                                            | Enforced              |
| Side-effect imports                                          | No storage/transport/AI/node-io/net        | Security-regression import/call scan of the whole dir (`secure-device-security.test.ts:83-103`) + guardrail network regex                                                                                   | Enforced              |
| RATS role                                                    | Relying Party only; no Evidence parsing    | `SECURE_DEVICE_ROLE_MODEL` (`processesRawEvidence:false` for core) + evidence-parse token ban (`secure-device-roles.ts:52-58`, guardrail `:20-25`)                                                          | Enforced              |
| Freshness / replay                                           | Current-process only; rollback rejected    | `checkAssessmentFreshnessV1` + `DevicePostureFreshnessPolicyV1` (no trusted clock/nonce/epoch) (`freshness-policy.ts:20,40`)                                                                                | Enforced              |
| Provider recovery                                            | No auto-restore / auto-reveal              | `PROVIDER_RECOVERY_REQUIREMENT_V1` + `classifyProviderTransitionV1` (`provider-recovery.ts:32,45`)                                                                                                          | Enforced              |
| Redaction / leak                                             | Codes only; no content/identifiers         | `SensitiveRoomAdmissionDecisionV1.redacted: true` + content-free error taxonomy + sentinel leak traps (`secure-device-errors.ts`, `secure-device-security.test.ts:49-81`)                                   | Enforced              |
| Port versioning                                              | Boundary is explicitly versioned           | `SecureDeviceProviderPortV1.contractVersion: 1` (`secure-device-provider.ts:129`)                                                                                                                           | Documented (contract) |
| Provider elevation / protected presentation / Bunker session | Reachable only behind a future gate        | `future_gate` capability states + Policy Matrix `future_gate` effect (`secure-device-provider.ts:56`, `secure-device-security.test.ts:137-151`)                                                             | Future-gate           |
| External adapter                                             | Real posture requires the external project | `SecureDeviceProviderPortV1` unimplemented except Null provider; `docs/ENDPOINT_DEFENSE_MODEL.md` disclaims implementation                                                                                  | Future-gate           |

---

## 7. Findings

- **No boundary violation found.** Core plays only the Relying-Party role. The
  only shipped provider is the deterministic, side-effect-free
  `NullSecureDeviceProviderV1`; posture above `unverified` is unreachable and no
  status can ever be trusted for elevation.
- The prohibitions are enforced by construction (literal `false` types + a
  private provenance registry + fail-closed resolvers), not by convention, and
  are backed by a static guardrail and a security-regression test that scans the
  shipped source.
- Honest limits, as the module headers state: provenance is object-capability
  strength, **not cryptographic** (Gate F); there is no trusted time, nonce, or
  replay resistance; the boundary is "not safe for real secrets" until the
  external Secure Device project and its gates (F/G/H/B/E) exist.
