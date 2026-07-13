# Secure Device Integration Contract — Research Note (TECH-23)

_Date: 2026-07-13. Informs the Sensitive Room Admission + Secure Device integration contract in `packages/rooms/src/secure-device/`._

> [!IMPORTANT]
> **Primary sources were consulted from prior knowledge / offline. Live internet access was unavailable in the build environment.**
> The specifications summarized below (RFC 9334, NIST SP 800-205, NIST SP 800-207, GrapheneOS documentation) are stable, well-established, and drawn from the author's knowledge as of the 2026-01 cutoff. This note **describes concepts accurately** but deliberately **avoids fabricated direct quotes and avoids citing exact section numbers** where they cannot be verified offline. Specific spec wordings, section identifiers, and current-version details must be re-confirmed against the primary sources before any of this is cited externally. No claim here depends on an unverified novel result.

## Why this pass

FreeLayer/ChatControl needs a way for a room to require a stronger device posture ("this room may only reveal content on a hardened/managed device") **without FreeLayer core becoming a device-attestation product**. Device measurement, firmware appraisal, anti-spyware, GrapheneOS management, and capture protection all belong to the **separate Secure Device / Endpoint Defense project** (TECH-22, `docs/ENDPOINT_DEFENSE_MODEL.md`). TECH-23 defines only the **contract**: the roles, the provider port, a normalized transient assessment, the admission gate, the transient session, and the honest limitations. This research grounds that contract in four external bodies of work and records exactly what FreeLayer adopts, rejects, and defers.

Scope boundary, stated once: **core is a future consumer of a normalized posture result, never a producer of Evidence.** Everything below is read through that lens.

---

## 1. RATS architecture — Remote ATtestation procedureS (RFC 9334)

**Reviewed (from prior knowledge, pending live re-confirm):** IETF RFC 9334, the RATS architecture. The conceptual roles, the information flow, and the freshness/privacy discussion.

### The roles and the information flow

RATS separates the _production_ of trustworthiness claims from their _appraisal_ and from their _consumption_. The core roles:

- **Attester** — the entity (a device, a TEE, a platform component) that produces **Evidence**: signed claims about its own state (boot measurements, firmware versions, configuration, key provenance). The Attester holds attestation keys and knows how to measure itself.
- **Verifier** — appraises Evidence against an **appraisal policy for Evidence**, using reference values (known-good measurements) and endorsements (manufacturer statements about the Attester's capabilities). Its output is **Attestation Results**: a normalized, Verifier-signed judgment ("this device is in an acceptable state", plus structured claims), _not_ the raw Evidence.
- **Relying Party** — consumes **Attestation Results**, applies its own **appraisal policy for Attestation Results**, and makes an authorization / resource-access decision. The Relying Party does **not** need to understand firmware formats, measurement logs, or attestation-key cryptography; it trusts the Verifier to have done that.

Supporting concepts:

- **Evidence** — raw, device-produced, security-sensitive claims. Correlatable and privacy-laden.
- **Attestation Results** — the Verifier's normalized appraisal. This is the artifact a well-designed Relying Party consumes.
- **Appraisal policies** — two distinct policies: one the Verifier applies to Evidence, one the Relying Party applies to Attestation Results. Separating them lets the consumer stay simple and lets the appraisal authority evolve independently.
- **Freshness** — Evidence must be _recent_, or a captured old-but-valid attestation can be replayed. RATS discusses two families: a **nonce/challenge** model (the appraiser supplies an unpredictable nonce that the Attester binds into Evidence — strong replay resistance) and a **timestamp/epoch** model (Evidence carries a trusted time or epoch value, requiring a trusted clock or synchronized epoch). Each has trade-offs; both require capabilities FreeLayer core does not have.
- **Privacy risks** — attestation is a privacy hazard. Evidence and even stable Attestation Results can carry **correlatable identifiers** (device keys, serials, per-device certificates) that let a Verifier or Relying Party track a device across sessions and contexts. RATS explicitly treats this as a first-class concern; mitigations (per-use keys, privacy CAs, selective disclosure) live on the Attester/Verifier side.

### FreeLayer decision (record verbatim)

> **FreeLayer is the future Relying Party. It consumes a normalized assessment result. It does not consume, parse or store raw Evidence in TECH-23.**

### Mapping to code

- **`packages/rooms/src/secure-device/secure-device-roles.ts`** models all three RATS roles explicitly. `SecureDeviceIntegrationRoleV1` is the union `secure_device_attester_external | secure_device_verifier_external | freelayer_relying_party`. `SECURE_DEVICE_ROLE_MODEL` records, per role, `ownedBy` (external project vs. `freelayer_core`), the `ratsRole` mapping, and `processesRawEvidence`. Only the two **external** roles have `processesRawEvidence: true`; `freelayer_relying_party` is `processesRawEvidence: false`. `FREELAYER_SECURE_DEVICE_ROLE` pins core to the single Relying-Party role, documented and future-only.
- **`posture-assessment.ts`** defines `DevicePostureAssessmentV1` as the **normalized result the Relying Party consumes — the analogue of Attestation Results, NOT Evidence.** The module docstring states plainly it "is the ONLY posture data core consumes — a privacy-minimized result, NOT raw Evidence" and carries "NO device identifier, serial, OS/build fingerprint, installed-app inventory, measurement log, or assessment history." The Attester→Verifier→Evidence pipeline is entirely outside core.
- **Appraisal policy split** — core's "appraisal policy for Attestation Results" is `resolveSensitiveRoomAdmissionV1` in `sensitive-room-admission.ts`: it takes the normalized assessment and the room policy and produces an authorization outcome. It never appraises Evidence.
- **Freshness** — because core has neither a nonce channel nor a trusted clock, it adopts _neither_ RATS freshness model. `freshness-policy.ts` sets `nonceVerificationAvailable: false`, `epochVerificationAvailable: false`, `trustedClockAvailable: false`, and accepts only `current_process_only` validity with **no replay-resistance claim** (see §2/§3). This is an honest downgrade, documented as such, gated behind the Secure Device Integration Gate.
- **Privacy risk** — core's answer to the correlatable-identifier hazard is to structurally refuse to receive identifiers at all (see §5): `FORBIDDEN_ASSESSMENT_FIELDS` rejects `attestation`, `attestationToken`, `certificateChain`, `signature`, `nonce`, `measurementLog`, and every device identifier on sight.

---

## 2. Attribute assurance — NIST SP 800-205 (Attribute Metadata / attribute assurance)

**Reviewed (from prior knowledge, pending live re-confirm):** NIST SP 800-205, attribute metadata and attribute assurance for attribute-based access control (ABAC). The guidance frames how a relying system should reason about the _quality_ of an attribute it did not itself produce.

### The dimensions of attribute assurance

An attribute (here: device posture) is only as trustworthy as the metadata about it. SP 800-205 organizes this into several dimensions:

- **Attribute authority** — _who asserted this attribute?_ The relying system must know the source and whether it is authoritative for that attribute. An attribute from an unknown or unauthoritative source has low assurance.
- **Allowable values** — the attribute must draw from a defined, bounded value set; out-of-range or unrecognized values are rejected, not guessed.
- **Accuracy & integrity** — is the value correct, and has it been altered between the authority and the consumer? Integrity protection (signing, trusted channels) raises assurance; its absence caps it.
- **Provenance** — the chain of custody of the value: where it originated and how it reached the consumer. Provenance lets the consumer decide how much weight to give the attribute.
- **Update / revocation** — attributes change and get revoked; a consumer that caches a stale attribute makes wrong decisions. There must be a way to invalidate a previously good value.
- **Availability & freshness (currency)** — the attribute must be available when needed and recent enough to be meaningful; stale attributes are treated as lower assurance or refused.

### Mapping to the future provider contract

- **Attribute authority = the external Verifier.** In the future integrated world, the authoritative source for the posture attribute is the Secure Device project's Verifier (the RATS Verifier of §1). FreeLayer core is never the authority; it is the consumer. `secure-device-roles.ts` encodes exactly this ownership split.
- **Posture is an environment attribute with a bounded allowable-value set.** The TECH-22 `DevicePosture` enum — `unverified | basic | hardened | high_assurance | managed_bunker | at_risk` — is the allowable-value set. Unknown/missing values fail closed. Posture is explicitly an **environment attribute, never identity** (`ENDPOINT_DEFENSE_MODEL.md`): membership and device assurance stay separate inputs.
- **Provenance via a module-private registry (non-cryptographic).** Core has no signing/verification (Gate F), so it cannot enforce cryptographic integrity. Instead it enforces provenance within the JavaScript object-capability model: `posture-assessment.ts` keeps a module-private `WeakSet<DevicePostureAssessmentV1>` (`issuedAssessments`). Only assessments this module actually issued (via `register`) pass `isAcceptedDevicePostureAssessmentV1`. A hand-crafted look-alike is not a member and is rejected. The docstring is explicit that this is "genuinely unforgeable within the JS object-capability model but is NOT cryptographic (Gate F) — it does not defend against same-realm reflection on a real assessment." This is the honest, current-capability substitute for attribute integrity/authority, not a claim of cryptographic provenance.
- **Currency / freshness via current-process-only.** Availability/freshness maps to `freshness-policy.ts`: the only accepted freshness is `current_process_only`; there is no trusted clock, no cross-restart validity, and a revision rollback (`assessmentRevision` lower than one already seen) is rejected as `revision_rollback`. A restart invalidates everything and forces a fresh assessment and a fresh admission.
- **Revocation via session invalidation.** The update/revocation dimension maps to `sensitive-room-session.ts`: a `SensitiveRoomSessionV1` is bound to the exact revisions it depended on (`assessmentRevision`, `roomPolicyRevision`, `membershipRevision`, `privacyMode`, `protectedContentRequirement`). `assertSensitiveRoomSessionCurrentV1` throws a content-free `SensitiveRoomSessionStaleError` on **any** change, and `invalidateSensitiveRoomSessionV1` returns a permanently invalidated copy (never resurrectable). A downgraded/`at_risk`/stale attribute invalidates the session immediately — the consumer never rides a revoked attribute.

---

## 3. Zero-trust device context — NIST SP 800-207 (Zero Trust Architecture)

**Reviewed (from prior knowledge, pending live re-confirm):** NIST SP 800-207, Zero Trust Architecture. The tenets, the Policy Decision Point / Policy Enforcement Point split, and the treatment of device state as a distinct trust input.

### Relevant principles

- **No implicit trust.** No asset is trusted by virtue of network location, prior authentication, or ownership. Trust is never inherited; it is evaluated.
- **User identity and device posture are separate authorization inputs.** _Who you are_ and _what device you are on_ are distinct signals. A valid user on a non-compliant device is not automatically authorized; the two are combined at decision time, not conflated.
- **Per-resource, per-operation decisions.** Access is granted per request to a specific resource for a specific operation — not as a broad, durable session grant. Each sensitive operation is its own decision.
- **Environmental changes re-trigger evaluation.** Posture and context are dynamic. A change in device state (compromise, downgrade, loss of a required control) must re-trigger evaluation and can revoke access mid-session.
- **Policy Decision Point (PDP) vs. Policy Enforcement Point (PEP).** The PDP evaluates policy and decides; the PEP sits in front of the resource and enforces the decision (allow/deny/terminate). In enterprise ZTA these are often network components (gateways, proxies, micro-segmentation).

### FreeLayer's local application — explicitly NOT enterprise network infrastructure

FreeLayer does **not** copy enterprise ZTA infrastructure. There are **no PEP gateways, no network micro-segmentation, no policy-enforcement proxies**. FreeLayer is a local-first, zero-egress application; it applies the _principles_ locally rather than deploying the _architecture_:

- **No implicit trust → fail-closed clamping.** `resolveSensitiveRoomAdmissionV1` never trusts a claimed elevation. A non-issued/forged assessment is treated as `unverified`; any posture above `unverified` (except `at_risk`) is clamped to `unverified` unless a trusted, ready provider authorizes it — and no such provider exists in core (`providerTrustedForElevationV1` can never return true today).
- **Identity and posture are separate inputs.** Membership/capability eligibility is screened separately from posture; posture is an _additional_ gate resolved immediately before authorization/execution, never a replacement for membership, capability, or `PolicyDecision`. This is the SP 800-207 separation applied verbatim.
- **Per-operation decisions.** Admission is evaluated per `SensitiveRoomAdmissionActionV1` (`room.content.read`, `room.content.mutate`, `room.membership.manage`, …), not once per room. Each action re-enters the resolver.
- **Environmental change re-triggers evaluation.** The transient session is the local PDP-decision cache; `assertSensitiveRoomSessionCurrentV1` re-checks the environment on every use and invalidates on posture downgrade, `at_risk`, provider loss, staleness, or any revision change. `at_risk` tightens/denies but can **never** grant, restore, or prove identity (`ENDPOINT_DEFENSE_MODEL.md`).
- **PDP/PEP, collapsed and local.** Core plays the PDP role: the admission resolver decides; the session-assertion and the call site enforce (deny content, throw content-free errors). There is no network PEP because there is no network path to gate — the enforcement is in-process and the decisions are redacted (codes only, no content, no evidence, no identifiers).

---

## 4. GrapheneOS context — documentation-only assumptions and limitations

**Reviewed (from prior knowledge, pending live re-confirm):** GrapheneOS project documentation — supported-device policy, the multi-user / secondary-profile model, and profile lifecycle behavior.

> [!IMPORTANT]
> This section documents **assumptions and limitations only**. FreeLayer does **not implement or verify any of the following**. They belong to the **external Secure Device project / preconfigured-device track**. Nothing here is a capability of core.

Documented assumptions (not implemented, not verified by core):

- **Officially supported devices.** GrapheneOS supports a specific set of Google Pixel devices, a scope driven by hardware/firmware security requirements (verified boot with user-controllable keys, strong hardware-backed keystore, timely firmware updates, hardware memory-safety features). This is a **Pixel hardware/firmware dependency**; the "hardened/high-assurance" device story assumes such a device exists and is correctly provisioned — by the external project, not FreeLayer.
- **Secondary user profiles.** GrapheneOS leverages Android's multi-user support so a dedicated, isolated secondary profile can run ChatControl separately from the owner profile, with its own encryption and app set. FreeLayer does not create, manage, or detect profiles.
- **Ending profile sessions.** A secondary profile's session can be fully ended, evicting its decryption keys from memory and returning its data to at-rest protection. FreeLayer does not orchestrate or observe profile session end.
- **Profile data-at-rest.** When a profile is not running, its data is at rest under that profile's encryption. FreeLayer relies on OS/profile at-rest protection conceptually but implements none of it.
- **Disabling app installation in secondary profiles.** GrapheneOS can restrict installing apps within a secondary profile, reducing the attack surface of the ChatControl profile. FreeLayer neither sets nor checks this control.

The role of these facts in TECH-23 is solely to describe the _kind of environment_ a future `hardened`/`managed_bunker` posture might attest to, so that the contract's vocabulary is realistic. Core ships none of it and verifies none of it; it merely leaves a well-shaped hole (the provider port) for the external project to fill after real validation.

---

## 5. Privacy minimization — what FreeLayer deliberately does NOT collect

Attestation is a privacy hazard (§1) and attribute metadata can be an identifier vector (§2). FreeLayer's response is **structural refusal**: the normalized assessment is defined so that privacy-laden data _cannot be present_, and this is enforced at runtime and by a build guard.

### Deliberately not collected — and why

| Not collected                                                           | Why                                                                                                                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Raw Evidence / attestation tokens**                                   | Core is a Relying Party, not a Verifier; Evidence is security-sensitive and correlatable. Parsing it would pull device-attestation responsibility into core. |
| **Serial numbers / device identifiers (IMEI, Android ID, hardware ID)** | Stable per-device identifiers are the classic cross-context tracking vector; posture is an environment attribute, never identity.                            |
| **OS build / firmware fingerprint**                                     | A build fingerprint is a fingerprinting/correlation surface and implies firmware appraisal, which is the external Verifier's job.                            |
| **Installed-app / package inventory**                                   | App-inventory scanning is invasive surveillance and out of scope; it reveals far more than a posture level.                                                  |
| **Measurement log**                                                     | Measurement logs are raw Evidence; appraising them is the Verifier's role, not the Relying Party's.                                                          |
| **Persistent assessment history**                                       | History enables longitudinal profiling and replay; assessments are transient, current-process-only, never persisted.                                         |
| **Telemetry**                                                           | Zero-egress, local-first: no posture signal is emitted anywhere; telemetry is structurally `forbidden`.                                                      |

### Mapping to code

- **`FORBIDDEN_ASSESSMENT_FIELDS` (`posture-assessment.ts`).** An explicit denylist — `rawEvidence`, `evidence`, `attestation`, `attestationToken`, `measurementLog`, `measurements`, `deviceId`, `serial`, `imei`, `androidId`, `hardwareId`, `osBuild`, `osFingerprint`, `buildFingerprint`, `installedApps`, `packages`, `assessmentHistory`, `history`, `nonce`, `certificateChain`, `signature`, and more. `hasForbiddenField` rejects any object bearing one of these keys _before_ it can influence policy, in both `isStructurallyValidAssessmentV1` and (transitively) `isAcceptedDevicePostureAssessmentV1`.
- **Structural literals on `DevicePostureAssessmentV1`.** The type pins privacy-negative facts as compile-time-and-runtime-checked constants: `rawEvidenceIncluded: false`, `deviceIdentifiersIncluded: false`, `deviceManagementPerformed: false`, `telemetryEmitted: false`, plus `trustedForElevation: false` and `mayTighten: true`. The validator rejects any object whose literals differ, so an assessment can never _claim_ to carry evidence/identifiers and still be accepted. The provider layer mirrors this: `SecureDeviceCapabilitiesV1` marks `rawEvidenceExport`, `deviceManagement`, and `telemetry` as `"forbidden"` — always.
- **The build guard (`scripts/check-no-secure-device-core-implementation.mjs`).** A static identifier scan over `apps/` and `packages/` that fails the build if core grows any measurement/collection/elevation implementation: `parseEvidence`, `verifyAttestation`, `readMeasurementLog`, `getSerialNumber`, `getImei`, `getInstalledApps`, `AccessibilityService`, `MediaProjection`, `DevicePolicyManager`, `PlayIntegrity`, GrapheneOS-management tokens, production trusted-posture literals (`effectivePosture: "hardened"`, `trustedForElevation: true`, `lifecycle: "ready_future"`, …), production mock/native providers, assessment persistence (`persistDevicePostureAssessment`, `storeAssessmentHistory`), native dependency specifiers (`react-native-device-info`, `expo-screen-capture`, …), and a narrow regex flagging provider **network** calls. It is a static token scan (not prose-aware), with a small allowlist for tests and the policy-matrix data file. This turns the privacy-minimization intent into an enforced, regression-tested boundary rather than a convention.

---

## 6. Summary — sources, decisions, limitations, and the Integration Gate

| Category                                                                    | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sources reviewed** (offline, from prior knowledge)                        | RFC 9334 (RATS architecture: Attester/Verifier/Relying Party, Evidence, Attestation Results, appraisal policies, nonce vs. epoch freshness, correlatable-identifier privacy risk); NIST SP 800-205 (attribute metadata / attribute assurance: authority, allowable values, accuracy & integrity, provenance, revocation, availability & freshness); NIST SP 800-207 (Zero Trust Architecture: no implicit trust, identity vs. device separation, per-operation decisions, environmental re-evaluation, PDP/PEP); GrapheneOS documentation (supported Pixel devices, secondary profiles, ending profile sessions, profile data-at-rest, disabling app installation).                                                                                                                                                                                                 |
| **Adopted decisions**                                                       | Core is **only the future RATS Relying Party** (`secure-device-roles.ts`). Core consumes a **normalized assessment, never raw Evidence** (`DevicePostureAssessmentV1`). Posture is an **environment attribute with a bounded value set**, never identity. **Non-cryptographic provenance** via a module-private `WeakSet` registry (honest, object-capability-bounded). **Fail-closed** resolution: untrusted signals may only tighten/deny, never elevate/restore/prove identity. **Per-operation** admission gate + **transient current-process-only** session that invalidates on any change. **Structural privacy minimization**: forbidden-field denylist + `false`-literal flags + build guard. Zero telemetry, zero persistence, zero egress.                                                                                                                |
| **Rejected decisions**                                                      | No Evidence parsing / firmware appraisal / measurement-log reading in core. No device identifiers, serials, OS/build fingerprints, or app inventory. No cryptographic attestation claim (no signing/verification — Gate F). No nonce or trusted-clock/epoch freshness. No enterprise ZTA network infrastructure (no PEP gateways, no micro-segmentation, no proxies). No GrapheneOS install/management. No production `basic+`/trusted-posture factory. No MDM/Device Owner. No assessment persistence/history. No telemetry. No production mock/native providers.                                                                                                                                                                                                                                                                                                  |
| **Current limitations (honest)**                                            | Provenance is **not cryptographic** — it does not defend against same-realm reflection on a real assessment (Gate F). Freshness is **current-process-only** with **no replay-resistance claim**; a restart invalidates everything. Core can resolve **only `unverified` (default) or `at_risk` (tightening)** because **no provider is integrated**; `ready_future`/`degraded_future`/`initializing_future` lifecycles exist in the contract but are **not constructible** by production factories. A room requiring `basic+`, protected presentation, or managed-Bunker therefore **denies content today** (a redacted summary may still be permitted). Rooms cannot actually be hardened by core — only _gated_.                                                                                                                                                  |
| **Future-gate requirements (Secure Device Integration Gate prerequisites)** | Before any real posture verification (`basic`+) or provider integration ships: a dedicated ADR for the gate; a **provider trust model**; **posture provenance** (cryptographic, replacing the object-capability substitute); **freshness / expiration** and **anti-replay** (nonce or trusted-epoch, replacing current-process-only); a **native-permission audit**; and a **compromised-provider threat model**. Additionally: the external Attester/Verifier must exist and be validated; the provider port (`SecureDeviceProviderPortV1`) must be implemented by a real adapter (core ships only the deterministic Null provider); and the build guard's forbidden-token set must be revisited so that legitimately-gated capabilities can be enabled deliberately, not accidentally. Until all of this lands, core stays fail-closed at `unverified`/`at_risk`. |

---

### Files this note maps to

- `packages/rooms/src/secure-device/secure-device-roles.ts` — RATS role model; core pinned to `freelayer_relying_party`.
- `packages/rooms/src/secure-device/posture-assessment.ts` — normalized transient assessment (Attestation-Results analogue), forbidden-field denylist, module-private provenance registry.
- `packages/rooms/src/secure-device/secure-device-provider.ts` — provider lifecycle/status/capabilities and the future provider port; fail-closed production factories.
- `packages/rooms/src/secure-device/freshness-policy.ts` — current-process-only freshness; no nonce, no epoch, no trusted clock, no replay-resistance claim.
- `packages/rooms/src/secure-device/sensitive-room-admission.ts` — the per-operation, fail-closed local appraisal policy for Attestation Results (the PDP).
- `packages/rooms/src/secure-device/sensitive-room-session.ts` — transient, current-process-only decision record that invalidates on any environmental/revision change (revocation/re-evaluation).
- `scripts/check-no-secure-device-core-implementation.mjs` — static build guard enforcing the core/Secure-Device boundary and privacy minimization.
- `docs/ENDPOINT_DEFENSE_MODEL.md` — the TECH-22 project-separation and DevicePosture contract this work extends.
