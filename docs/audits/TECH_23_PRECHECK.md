# TECH-23 Precheck — Sensitive Room Admission + Secure Device Integration Contract

_Date 2026-07-13 · Branch `tech/sensitive-room-secure-device-contract` · Commit `09520ff` (`09520ffc46b8dc38345f10e433607a3e7a6f3dfc`)_

[← Docs Index](../README.md) · [Roadmap](../ROADMAP.md) · [Implementation Gates](../IMPLEMENTATION_GATES.md) · [Reconciliation](TECH_23_ROADMAP_RECONCILIATION.md)

## Purpose

Record ground truth before TECH-23 is finished: what exists in the tree, what the
stacked TECH-20/21/22 dependencies provide, the current DevicePosture and
protected-content contracts, the sensitive-room admission code, endpoint hook
state, and the documentation-vs-code coupling. Nothing is marked complete without
citing a source file, a test, or a CI wiring. This is an honest snapshot: the
branch is mid-implementation, not merged.

## Status tokens

`present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## Repository state

- **HEAD**: `09520ffc46b8dc38345f10e433607a3e7a6f3dfc` (`09520ff feat(rooms): add room policy composition + governance (TECH-22) (#47)`).
- **Branch**: `tech/sensitive-room-secure-device-contract`, branched fresh from `main` at the TECH-22 merge.
- **Working tree**: **not clean** — TECH-23 is in progress. Uncommitted changes:
  - Modified: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`docs/policy-matrix.v1.json`](../policy-matrix.v1.json), [`package.json`](../../package.json), [`packages/privacy/src/policyMatrix.ts`](../../packages/privacy/src/policyMatrix.ts), [`packages/rooms/src/index.ts`](../../packages/rooms/src/index.ts), [`packages/rooms/src/policy-composition/index.ts`](../../packages/rooms/src/policy-composition/index.ts), [`scripts/check-policy-conflicts.mjs`](../../scripts/check-policy-conflicts.mjs), [`tests/privacy-regression/rooms/policy-composition/composition.test.ts`](../../tests/privacy-regression/rooms/policy-composition/composition.test.ts).
  - Deleted: `packages/rooms/src/policy-composition/sensitive-admission.ts` (superseded by the dedicated `secure-device/` module).
  - Untracked: `packages/rooms/src/secure-device/`, `scripts/check-no-secure-device-core-implementation.mjs`, `tests/fixtures/secure-device-contract/`, `tests/fixtures/secure-device-core-implementation/`, `tests/privacy-regression/rooms/secure-device-contract/`, `tests/security-regression/rooms/secure-device-contract/`.

## Pull requests

- **Open PRs**: none.
- **Merged (recent)**: #47 TECH-22 (policy composition + governance), #46 TECH-21 (revocation authorization), #45 TECH-20 (membership + capability scaffolding), #44 TECH-19 (query model), #43 TECH-18 (object model), #42 TECH-17, #41 TECH-16, #40 platform-state refresh. TECH-23 has no PR yet.

## Stacked-dependency evidence (TECH-20 / TECH-21 / TECH-22 present)

| Dependency                              | Evidence (source)                                                                                                                                                                                                                     | Status                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| TECH-20 Membership + capabilities       | [`packages/rooms/src/membership/`](../../packages/rooms/src/membership/) — `membership-types.ts`, `capability-types.ts`, `membership-roles.ts`, pipeline/reducer/log; header names TECH-20                                            | present / stacked dependency |
| TECH-21 Revocation authorization        | [`packages/rooms/src/authorization/`](../../packages/rooms/src/authorization/) — `prepared-authorization.ts`, `authorization-revalidation.ts`, `revocation-pipeline.ts`, `role-authority.ts`; header names TECH-21                    | present / stacked dependency |
| TECH-22 Policy composition + governance | [`packages/rooms/src/policy-composition/`](../../packages/rooms/src/policy-composition/) — `device-posture.ts`, `protected-content.ts`, `room-policy-document.ts`, `policy-composition.ts`, governance pipeline; header names TECH-22 | present / stacked dependency |

TECH-23 imports directly from all three (e.g. `sensitive-room-admission.ts` pulls
`RoomMembershipRecordV1`, `RoomLocalCapabilityDescriptorV1`,
`devicePostureSatisfiesMinimumV1`, `resolveProtectedPresentationStatusV1`,
`RoomPolicyDocumentV1`), confirming the stack is real, not vestigial.

## TECH-23 module inventory

[`packages/rooms/src/secure-device/`](../../packages/rooms/src/secure-device/) —
present, exported from [`index.ts`](../../packages/rooms/src/secure-device/index.ts):

| File                          | Role                                                                                                                                                     | Status  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `secure-device-errors.ts`     | Redacted error taxonomy (codes + static messages only)                                                                                                   | present |
| `secure-device-roles.ts`      | RATS roles (RFC 9334); core = future Relying Party only                                                                                                  | present |
| `secure-device-provider.ts`   | Provider lifecycle/status/capabilities + port; production status limited to `not_integrated`/`unavailable`/`failed`; `trustedForPostureElevation: false` | present |
| `posture-assessment.ts`       | Normalized transient assessment; WeakSet provenance registry; forbidden-field rejection; production factory yields `unverified`/`at_risk` only           | present |
| `freshness-policy.ts`         | Current-process-only validity; no trusted clock/nonce/epoch; rollback rejected                                                                           | present |
| `null-provider.ts`            | `NullSecureDeviceProviderV1` — the only shipping provider; side-effect-free                                                                              | present |
| `sensitive-room-admission.ts` | `resolveSensitiveRoomAdmissionV1` — deterministic fail-closed local gate                                                                                 | present |
| `sensitive-room-session.ts`   | Transient current-process admission session; any change invalidates                                                                                      | present |
| `protected-content-intent.ts` | Data-only ProtectedContent intent; future-required → deny content                                                                                        | present |
| `provider-recovery.ts`        | Fail-closed transition/recovery classifier; no session restore, no auto-reveal                                                                           | present |
| `index.ts`                    | Barrel export                                                                                                                                            | present |

## DevicePosture + protected-content contract state

- **DevicePosture types** — [`packages/rooms/src/policy-composition/device-posture.ts`](../../packages/rooms/src/policy-composition/device-posture.ts): `DevicePosture = unverified | basic | hardened | high_assurance | managed_bunker | at_risk`. `resolveEffectiveDevicePostureV1` fails closed: unknown/malformed/missing → `unverified`; `at_risk` always tightens; any elevation claim is reduced to `unverified` (`elevation_ignored_no_provider`). `devicePostureSatisfiesMinimumV1` uses an explicit rank; `at_risk` satisfies nothing. **present** — core can satisfy only `unverified`.
- **Protected-content types** — [`packages/rooms/src/policy-composition/protected-content.ts`](../../packages/rooms/src/policy-composition/protected-content.ts): `ProtectedContentRequirementV1`; `resolveProtectedPresentationStatusV1` returns `requirementSatisfied: true` only for `none`/`policy_redaction_only`; every `*_future_required` value is unsatisfied with `activeProtectionClaim: false`. **present** — no silent downgrade, no active-protection claim.
- **TECH-23 posture assessment** binds to the above via `resolveEffectiveDevicePostureV1` and `providerIntegration: "not_integrated"`; the only production effective postures are `unverified` and `at_risk`. **present**.

## Room-policy + admission code

- **Admission** — [`sensitive-room-admission.ts`](../../packages/rooms/src/secure-device/sensitive-room-admission.ts): deterministic, fail-closed, redacted (codes only). Order: validate action → Emergency deny → lifecycle deny → membership/capability screen → redacted summary allow → manage actions (deny on `at_risk`, else separately-authorized) → content actions (`at_risk` deny; provider-required deny when no trusted provider; freshness; minimum posture; protected presentation / Bunker; export/copy/file/AI `deny_not_implemented`; else allow). Content DENIES whenever a room requires `basic+` because no provider exists. **present**.
- **Session** — [`sensitive-room-session.ts`](../../packages/rooms/src/secure-device/sensitive-room-session.ts): transient, `persistence: "forbidden"`, `crossRestartValidity: false`; a denied decision cannot mint an admitted session; `assertSensitiveRoomSessionCurrentV1` throws on any revision/mode/posture/provider/freshness/lifecycle change. **present**.
- **RoomPolicyDocument** — consumed via TECH-22 [`room-policy-document.ts`](../../packages/rooms/src/policy-composition/room-policy-document.ts) (`minimumDevicePosture`, `protectedContentRequirement`, `revision`). **stacked dependency / present**.

## Endpoint hooks

- [`packages/rooms/src/room-types.ts`](../../packages/rooms/src/room-types.ts): `endpoint_hook_ref` object kind and `endpoint.hook_ref_placeholder` operation are **placeholders only** — data class `endpoint_redaction_state`, `contentBearing: false`, `futureGate: "gate_r_endpoint"`, commented "EXTERNALIZED — hook-only, never active". **present as placeholder / not applicable to active protection**.
- No live endpoint hook, anti-spyware scanner, attestation, or MDM path exists in core. **missing (by design)**.

## No accidental endpoint implementation in core (verified)

`node scripts/check-no-secure-device-core-implementation.mjs` → **OK, no violations**. The
guard ([`scripts/check-no-secure-device-core-implementation.mjs`](../../scripts/check-no-secure-device-core-implementation.mjs))
static-scans `apps/` + `packages/` for implementation tokens — evidence/attestation
parsing, device serials/IMEI/Android-ID, app-inventory scanning,
Accessibility/overlay/clipboard/`MediaProjection`/screenshot/process monitoring,
`DevicePolicyManager`/Device Owner, Play Integrity/SafetyNet/key-attestation,
GrapheneOS install/custom ROM/phone-wide firewall, trusted-posture literals
(`effectivePosture: "basic"…`, `trustedForElevation: true`, `lifecycle: "ready_future"`),
production mock/native providers, assessment persistence, active-protection claims,
and native RN/Expo attestation packages — plus a same-line provider-network regex.
Manual read of every `secure-device/*.ts` file confirms: no raw Evidence parsing,
no device identifiers, no telemetry, no native calls; `buildProductionProviderStatusV1`
coerces any future/ready lifecycle to `unavailable`; `providerTrustedForElevationV1`
can only ever return `false`. **Confirmed: no real anti-spyware/attestation/MDM
implementation is present in core.**

## Tests + CI state

| Area                   | Detail                                                                                                                                                                                                                | Status                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Privacy regression     | [`tests/privacy-regression/rooms/secure-device-contract/admission.test.ts`](../../tests/privacy-regression/rooms/secure-device-contract/admission.test.ts)                                                            | present                |
| Security regression    | [`tests/security-regression/rooms/secure-device-contract/secure-device-security.test.ts`](../../tests/security-regression/rooms/secure-device-contract/secure-device-security.test.ts)                                | present                |
| Fixtures               | `tests/fixtures/secure-device-contract/{v1, bad-secure-device.ts}`, `tests/fixtures/secure-device-core-implementation/`                                                                                               | present                |
| Contract test run      | `vitest run` over both dirs → **34 passed, 1 failed** (35 total)                                                                                                                                                      | partial                |
| Guardrail wiring       | `check:no-secure-device-core-implementation` in [`package.json`](../../package.json) `audit:privacy` and in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)                                              | present                |
| Policy Matrix          | `specCount` 195 → `ruleCount` 1365 in [`policy-matrix.v1.json`](../policy-matrix.v1.json) (was 171/1197 at TECH-22); +48 secure-device/posture references in `policyMatrix.ts`; `check:policy-matrix` unchanged/wired | present                |
| Full suite / hosted CI | not run this pass — only the secure-device subset executed locally                                                                                                                                                    | missing (not verified) |

### The one failing test (honest)

`secure-device-security.test.ts` asserts `docs/PBOM.md` contains the string
`"null provider"` (lowercased). [`docs/PBOM.md`](../PBOM.md) currently lists
`Secure Device provider | Not integrated` and `Anti-spyware scanner | External
Secure Device project` but does **not** yet name the Null provider. The
`TRUST_CENTER.md` half of the same assertion already passes (it mentions Secure
Device). This is the documentation-coupling gate doing its job on
work-in-progress: PBOM has not yet been updated for TECH-23. **mismatch with
documentation → remaining TECH-23 work** (out of scope for this precheck; not
fixed here).

## Documentation-vs-code checks

- [`docs/ROADMAP.md`](../ROADMAP.md): TECH-22 entry ends "**Next: TECH-23 (read from the canonical roadmap)**"; Secure Device externalization section and the future Secure Device Integration Gate are documented. A TECH-23 task entry is **not yet added** to the roadmap task list. **partial** — reconciled in [TECH_23_ROADMAP_RECONCILIATION.md](TECH_23_ROADMAP_RECONCILIATION.md).
- [`docs/IMPLEMENTATION_GATES.md`](../IMPLEMENTATION_GATES.md): the **Secure Device Integration Gate (future)** exists and states core resolves posture to `unverified`/`at_risk` only, stricter requirements deny content, and `activeProtectionClaim` stays `false` — consistent with the TECH-23 code. **present / consistent**. No new closed gate for TECH-23 has been added yet. **partial**.
- PBOM / Trust Center: Trust Center describes DevicePosture and sensitive-room admission (TECH-22 wording); **partial** for TECH-23 (see failing test) — PBOM Null-provider line and TECH-23 test counts still to be written.

## Tasks that exist only as prompts (not yet code)

- PBOM update naming the Null provider + TECH-23 test counts — **missing**.
- Trust Center TECH-23 paragraph (new tests / total) — **missing**.
- ROADMAP task-list entry for TECH-23 + "Next" pointer to the following track — **missing** (reconciliation doc records the intended canonical text).
- Research note / threat model / boundary / audit companion docs for TECH-23 — **missing** (TECH-16…22 shipped these; TECH-23 parity pending).
- Full local `check:all` + hosted CI green for the branch — **missing (not verified this pass)**.

## Summary

The TECH-23 code contract is `present` and internally consistent with the
fail-closed design of TECH-22: no Secure Device provider is integrated, the
Null provider is the only one shipping, posture cannot exceed `unverified`
(except `at_risk`, which only tightens), content is denied whenever a room
requires `basic+`, and no anti-spyware/attestation/MDM implementation exists in
core (guard green, manual read confirms). The branch is **not** finished: the
docs-coupling test fails because PBOM/Trust Center/roadmap have not yet been
updated for TECH-23, and the full suite + hosted CI have not been verified this
pass. Nothing above is marked complete beyond its cited evidence.
