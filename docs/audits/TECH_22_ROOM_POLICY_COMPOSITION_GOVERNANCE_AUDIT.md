# TECH-22 — Room Policy Composition + Governance Audit

_Branch: `tech/roomos-policy-composition-governance` · **Stacked on PR #46** (TECH-21) → **#45** (TECH-20) → main · Date: 2026-07-13. Merge order: 45 → 46 → 22._

## Precondition / commands

TECH-16…21 verified `present` ([TECH_22_PRECHECK.md](TECH_22_PRECHECK.md)). Commands run green: typecheck · lint · **521 tests** · build (15/15) · `check:no-device-posture-or-governance-bypass` (new) + all prior RoomOS guards · `check:policy-matrix` (171 specs → 1197 rules) · `check:policy-conflicts` · `check:policy-docs` · `check:boundaries` · `audit:privacy` · `audit:supply-chain`.

## Project-separation update

FreeLayer / ChatControl and **Secure Device / Endpoint Defense** are now clearly separated. Secure Device (Pixel/GrapheneOS/isolated profile/Device Posture Checker/Bunker Session/ScreenShield/ProtectedContent) is a separate project. TECH-22 implements only the DevicePosture CONTRACT + fail-closed behavior + minimum-posture/protected-content requirements + future integration hooks + disclosures — **no provider, no device management, no attestation, no anti-spyware**.

## Research summary

NIST ABAC (SP 800-162) attribute mapping; NIST attribute assurance (SP 800-205 — provenance/freshness, fail-closed); NIST Zero Trust (SP 800-207 — user ≠ device inputs); OWASP authorization; XACML combining algorithms → **deny-overrides + strictest-wins** (no permit-overrides); GrapheneOS compartmentalization (future integration only). → [../research/ROOMOS_POLICY_COMPOSITION_GOVERNANCE_RESEARCH.md](../research/ROOMOS_POLICY_COMPOSITION_GOVERNANCE_RESEARCH.md). Threat model → [TECH_22_POLICY_COMPOSITION_GOVERNANCE_THREAT_MODEL.md](TECH_22_POLICY_COMPOSITION_GOVERNANCE_THREAT_MODEL.md). (Internet unavailable → verification-pending marker.)

## Created / modified

**Created** (`packages/rooms/src/policy-composition/`, 11 modules): `policy-composition-errors`, `device-posture`, `protected-content`, `policy-layers`, `room-policy-document`, `policy-comparison`, `policy-composition`, `sensitive-admission`, `governance-commands`, `governance-events`, `governance-pipeline`, `index`. Plus `scripts/check-no-device-posture-or-governance-bypass.mjs`, a fixture, 2 test files, 5 docs.
**Modified:** rooms `index.ts` (export policy-composition), `room-state.ts` (+`policyDocument`), authorization `authorization-revision.ts`/`prepared-authorization.ts`/`authorization-revalidation.ts` (posture binding), privacy `index.ts` (+2 governance scopes), `policyMatrix.ts` (+14 rows), matrix JSON (171/1197), `package.json` + `ci.yml`, membership guard allowlist (matrix data), 15 model docs.

## Status highlights

- **DevicePosture contract:** enum + `DevicePostureSignalV1`; `resolveEffectiveDevicePostureV1` yields only `unverified`/`at_risk` (no provider; untrusted cannot elevate; `at_risk` overrides; unknown/malformed fail closed); `devicePostureSatisfiesMinimumV1` explicit ranks (never lexical; `at_risk` satisfies nothing).
- **Protected content:** future-required → `requirementSatisfied: false`; `activeProtectionClaim: false`; no silent downgrade.
- **Policy layers/effects:** fixed taxonomy; `foldStrictestEffectV1` deny-overrides + strictest-wins; `deny`/`not_implemented`/`future_gate`/unknown never permit.
- **RoomPolicyDocument v1 + defaults:** versioned, tighten-only; structural falses; mode-aware defaults (Bunker → screen_shield_future_required).
- **Monotonic comparison:** `compareRoomPoliciesV1` (stricter/equal/looser/incomparable/unknown); only `stricter` accepted by governance.
- **Composition resolver:** pure/deterministic `EffectiveRoomPolicyV1` (content/storage/network/metadata/notification/ai + posture/protected satisfaction + constraints + reasonCodes); no content in the result.
- **Sensitive admission:** content denies when the provider is absent / `at_risk` / unmet posture / future-protected; redacted summary allowed; membership/governance separately authorized.
- **Posture revision binding:** the TECH-21 authorization fence now includes `effectiveDevicePosture` + `devicePostureSignalRevision`; a posture change invalidates prepared authorization.
- **Governance pipeline:** owner-only capability + authentic exact-scope decision + execution-time revalidation + monotonic tightening + separate storage decision + pure reducer; no partial effects; content-free events.
- **Conflict-suite integration:** matrix rows + guard + `check:policy-conflicts` cover global-deny-vs-room-allow, posture-vs-content, ScreenShield-unavailable, Bunker-active-protection, Emergency-content, Offline-network, at-risk-ignored, untrusted-elevation, governance-loosening, and PBOM/Trust-Center overclaims.

## Tests added

21 new (**521 total**): posture resolution + satisfiesMinimum ordering, protected-content, composition (deny-overrides/strictest-wins/posture/emergency/bunker), sensitive admission, cross-mode matrix (privacy), governance tighten-only (stricter/equal/looser/incomparable/unknown), owner-only + suspended/removed + fake/wrong-scope/stale-revision, reducer purity/determinism, leak-freedom, guardrail + import hygiene (security).

## Known limitations

FreeLayer enforces policies only in compliant local clients; room policy is not cryptographically authoritative; DevicePosture verification is unavailable (core cannot satisfy `basic+`); ScreenShield/ProtectedContent runtime is not implemented; no signed/verified/distributed governance (Gates F/G/H); Secure Device is external (future Integration Gate); a malicious client can ignore room policy; not safe for real secrets.

## Verdict

**TECH-22 is complete** (stacked on #46; merges after 45 → 46). All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-23 (read from the canonical roadmap)**. Do not auto-merge (§40).
