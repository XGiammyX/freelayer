# TECH-23 — Sensitive Room Admission + Secure Device Integration Contract — Audit

- **Date:** 2026-07-13
- **Branch:** `tech/sensitive-room-secure-device-contract` (stacked on `main` @ `09520ff`, TECH-22 merged)
- **Scope:** contract only — no trusted provider, no attestation, no endpoint implementation
- **Verdict:** ✅ **Complete** (see [Final verification](#final-verification))

## 1. Roadmap reconciliation

Canonical order preserved: TECH-20 → TECH-21 → TECH-22 → **TECH-23**. Likely next macro track: `RESEARCH-ID-01 — Identity Competitor + Threat Research` (not started). Details in [TECH_23_ROADMAP_RECONCILIATION.md](TECH_23_ROADMAP_RECONCILIATION.md) and [TECH_23_PRECHECK.md](TECH_23_PRECHECK.md). Secure Device / Endpoint Defense remains a **separate, externalized** project; core did not return to an endpoint-defense implementation track.

## 2. TECH-20/21/22 evidence

Present and merged: `packages/rooms/src/membership/` (TECH-20), `packages/rooms/src/authorization/` (TECH-21), `packages/rooms/src/policy-composition/` (TECH-22). TECH-23 reuses the TECH-22 `DevicePosture` type, `MinimumDevicePostureV1`, `ProtectedContentRequirementV1`, and `RoomPolicyDocumentV1`, and the TECH-21 authorization fence pattern.

## 3. Architecture role boundary (RATS / RFC 9334)

FreeLayer core is the **Relying Party only** (`SecureDeviceIntegrationRoleV1`, `secure-device-roles.ts`). The Attester (produces Evidence) and Verifier (appraises Evidence) are external. Core never parses Evidence, appraises firmware, inspects measurements, or infers posture from user agent / OS / device model / membership. Full boundary: [SECURE_DEVICE_INTEGRATION_BOUNDARY_AUDIT.md](SECURE_DEVICE_INTEGRATION_BOUNDARY_AUDIT.md).

## 4. Provider lifecycle, capabilities, Null provider

`SecureDeviceProviderLifecycleV1` (`not_integrated`/`unavailable`/`initializing_future`/`ready_future`/`degraded_future`/`failed`); production factory `buildProductionProviderStatusV1` constructs only `not_integrated`/`unavailable`/`failed` and **coerces** any future/ready lifecycle to `unavailable`. `SecureDeviceProviderStatusV1.trustedForPostureElevation` is structurally `false`; `providerTrustedForElevationV1` is therefore always `false`. `SecureDeviceCapabilitiesV1` are `unavailable`/`future_gate` with `rawEvidenceExport`/`deviceManagement`/`telemetry` = `"forbidden"`. The only shipped provider is `NullSecureDeviceProviderV1` (deterministic, side-effect-free, `not_integrated`, effective `unverified`).

## 5. Assessment schema + provenance

`DevicePostureAssessmentV1` is versioned (`schemaVersion`/`contractVersion` = 1), transient, and carries structural literals `trustedForElevation:false`, `mayTighten:true`, `rawEvidenceIncluded:false`, `deviceIdentifiersIncluded:false`, `deviceManagementPerformed:false`, `telemetryEmitted:false`. Provenance is a module-private `WeakSet` registry (`isAcceptedDevicePostureAssessmentV1`), mirroring `PolicyDecision` — genuinely unforgeable in the JS object-capability model but **non-cryptographic** (Gate F). `FORBIDDEN_ASSESSMENT_FIELDS` rejects any evidence-/identifier-/inventory-/history-bearing object. The only production factory (`resolveDevicePostureAssessmentV1`) yields `unverified` or `at_risk` — there is **no** production `basic+`/`high_assurance` factory.

## 6. Freshness / current-process model

`DevicePostureFreshnessPolicyV1`: `acceptedFreshness:"current_process_only"`, `trustedClockAvailable:false`, `nonceVerificationAvailable:false`, `epochVerificationAvailable:false`, `crossRestartValidity:false`. `checkAssessmentFreshnessV1` treats `stale` as not-fresh and **rejects a revision rollback**. No replay-resistance claim.

## 7. Admission actions / outcomes / resolver

11 `SensitiveRoomAdmissionActionV1` × 13 fail-closed `SensitiveRoomAdmissionOutcomeV1`. `resolveSensitiveRoomAdmissionV1` runs the required 14-step order (validate → policy/mode → lifecycle → membership/capability → provenance → reduce untrusted elevation → `at_risk` denial → provider lifecycle → freshness → minimum posture → protected presentation → Bunker session → action-specific → redacted decision). Default deny; unknown actions fail closed. The decision is redacted (codes only), carries no `PolicyDecision` fields, and never authorizes a side effect.

## 8. Session + per-operation revalidation

`SensitiveRoomSessionV1` is transient (`persistence:"forbidden"`, `crossRestartValidity:false`); a denied admission cannot mint an admitted session (throws content-free `SensitiveRoomAdmissionDeniedError`). `assertSensitiveRoomSessionCurrentV1` invalidates on any assessment/policy/membership/mode/lifecycle/action/posture(`at_risk`)/provider(`unavailable`/`failed`)/freshness(`stale`)/protected-requirement change — never silently refreshed. `provider-recovery.ts` documents fail-closed recovery (fresh assessment + admission + authorization; never restore an old session, never auto-reveal, never notify).

## 9. ProtectedContent contract

`ProtectedContentIntentV1` is data-only (`screenShieldIntegrated:false`, `protectedSurfaceAvailable:false`). `resolveProtectedContentIntentHandlingV1`: `none` → normal policy; `policy_redaction_only` → redacted core view; every future-required protection → **deny content**. Core never renders content, blocks screenshots, or claims capture protection.

## 10. Policy / Storage / Metadata integration

24 new Policy Matrix rows (**195 specs → 1365 rules**): reads memory-only; raw evidence / identifiers / history / inventory **deny**; `at_risk` tightening allowed only as a restriction; content export/copy/file/AI `not_implemented`; trusted-provider elevation / ScreenShield / Bunker **future_gate**. Conflict suite (`check-policy-conflicts.mjs`) adds `SECURE_DEVICE_NEVER_ALLOWED_PREFIXES` + `SECURE_DEVICE_FUTURE_GATE_SPEC_IDS`. StoragePolicy denies posture persistence; MetadataPolicy denies persistent posture sinks; posture/admission are treated as sensitive, redacted metadata.

## 11. Tests + guardrail

- `tests/privacy-regression/rooms/secure-device-contract/admission.test.ts` — §23 (1-28).
- `tests/security-regression/rooms/secure-device-contract/secure-device-security.test.ts` — §23 (29-33) + sentinel leak traps + side-effect traps (module imports no storage/network/AI sink; no `fetch`/`localStorage`).
- `tests/fixtures/secure-device-contract/v1/synthetic.ts` — synthetic posture states only (no real tokens/identifiers).
- Guardrail `scripts/check-no-secure-device-core-implementation.mjs` (+ `tests/fixtures/secure-device-core-implementation/` fixture; guard passes on real code, fails on fixture with 29 findings). Wired into `package.json`, `audit:privacy`, and `.github/workflows/ci.yml`.
- Sentinel `FREELAYER_SECURE_DEVICE_CONTRACT_SENTINEL_DO_NOT_LEAK` appears in no error/report/log/source.

## 12. PBOM / Trust Center

PBOM adds a Secure Device row set (contract implemented; provider not implemented; verification unavailable; assessment transient; evidence/history/identifiers forbidden; ScreenShield/Bunker/anti-spyware external). Trust Center adds an honest "what we claim" section (no trusted provider, no raw evidence, no spyware-proof/capture-proof claim, not safe for real secrets). Overclaim scanner passes.

## 13. Externalization status

No network, attestation, GrapheneOS management, MDM, anti-spyware, ScreenShield, or Bunker runtime exists in core. The Secure Device Integration Gate is expanded with every §3 prerequisite ([IMPLEMENTATION_GATES.md](../IMPLEMENTATION_GATES.md)).

## 14. Known limitations & deferred gates

Provenance is non-cryptographic (Gate F); no trusted clock/nonce/epoch (freshness is current-process-only); no identity (Gate G); no sync (Gate H); no transferable capabilities/construction authority (Gate B); no serialized posture capsules / hostile evidence parsing (Gate E). No endpoint guarantee, no spyware-proof/capture-proof guarantee. **Not safe for real secrets.** Threat model: [TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md). Research: [../research/SECURE_DEVICE_INTEGRATION_CONTRACT_RESEARCH.md](../research/SECURE_DEVICE_INTEGRATION_CONTRACT_RESEARCH.md).

## Final verification

`pnpm typecheck` (0 errors), `pnpm lint`, `pnpm test`, `pnpm build`, all `check:*` guards (incl. `check:no-secure-device-core-implementation`), `check:policy-matrix` (195 specs → 1365 rules), `check:policy-conflicts`, `check:policy-docs`, `check:doc-links`, and `audit:privacy`/`audit:security`/`audit:supply-chain` pass on this branch. See the PR checks for the CI record.
