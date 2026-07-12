# TECH-14 — Policy Conflict Regression Suite Audit

_Branch: `tech/policy-conflict-regression-suite` (stacked on TECH-13 @ `0f2f992`) · Date: 2026-07-10._

## Commands run

`pnpm typecheck` · `lint` · `test` · `build` · all guardrails · `check:policy-matrix` · `check:policy-docs` · **`check:policy-conflicts`** · `check:doc-links` · `audit:privacy` · `audit:supply-chain` · `test:coverage`. All green.

## Precheck

TECH-10/11/12/13 all `present`. One documented baseline difference (stacked PR #36 open, non-blocking). → [TECH_14_PRECHECK.md](TECH_14_PRECHECK.md).

## Research summary

NIST ABAC (combination testing across attributes), OWASP ASVS (claims map to tests; trusted enforcement layer), NIST SP 800-53 AC-3/AC-4 (PDP=matrix, PEPs=barriers; verify flows), regression-strategy reasoning (table-driven, named fixtures, self-explaining failures, no coverage theater), conflict-pattern taxonomy, and a full internal review (no live contradictions; externalization/coverage/dependency gaps found and fixed). → [../research/POLICY_CONFLICT_REGRESSION_RESEARCH.md](../research/POLICY_CONFLICT_REGRESSION_RESEARCH.md). Threat model → [TECH_14_POLICY_CONFLICT_THREAT_MODEL.md](TECH_14_POLICY_CONFLICT_THREAT_MODEL.md). (Live internet unavailable → verification-pending marker.)

## Implementation

- **Conflict taxonomy** (`packages/privacy/src/policyConflicts.ts`): 17 `PolicyConflictCategory` values, `PolicyConflict`, and `explainPolicyConflict` — deterministic, redacted (hostile tokens stripped), snapshot-safe.
- **Assertion helpers** (`tests/helpers/policy-conflict-helpers.ts`): `assertPoliciesAgree`, `assertDeniedEverywhere`, `assertNotExecutableEverywhere`, `assertFutureGatedEverywhere`, `assertExternalizedHookOnly`, `assertRoomPolicyCannotLoosenDevicePolicy`, `assertFeaturePolicyCannotLoosenModePolicy`, `assertNoPolicyAllows{Network,Persistence,Metadata}WhenMatrixDenies` — all compare REAL resolver outcomes; nothing fabricated.
- **Fixtures** (`tests/fixtures/policy-conflicts/`): a contradictory matrix (9 planted specs → **48 findings**) and an overclaiming Trust Center (**10 findings**).
- **Validator** (`scripts/check-policy-conflicts.mjs`, in `audit:privacy` + CI): matrix invariants, Trust Center overclaim scan (negation-aware — honest "not unbreakable" phrasing passes), docs externalization statements, endpoint-monitoring/push dependency bans. Fixture mode (`--matrix`/`--trust-center`) makes its own detection testable.
- **Docs-consistency extended** (`check:policy-docs`): required statements for always-denied behaviors, gates, non-guarantees, externalization.

## Cross-policy consistency (all agree)

Storage (Ghost/Bunker persistence, preview caches, notification-content storage) ✅ · Network (Offline denial, telemetry/assets/previews/push) ✅ · Metadata (receipts/typing/presence/notification-preview, all modes) ✅ · LinkPreview (automatic/OpenGraph/favicon) ✅ · ExternalAsset (image/font/script × all modes) ✅ · Notification (message preview, Bunker badge, push/service-worker) ✅ · AI (remote denied everywhere; Ghost/Bunker denied) ✅ · Deferred gates not executable (crypto/storage/capsule/room/identity + badge/permission) ✅ · Composition (room/feature tighten-only, Emergency override, Offline polling) ✅ · Unknown inputs deny across matrix AND engines ✅.

## Anti-spyware externalization

Documented and **enforced**: ROADMAP EDL track marked externalized; PBOM §18 + Trust Center honesty; Gate R (integration gate) created; `assertExternalizedHookOnly` test + validator capability checks + dependency bans. → [ANTISPYWARE_EXTERNALIZATION_AUDIT.md](ANTISPYWARE_EXTERNALIZATION_AUDIT.md).

## Tests added

17 new (**337 total**) across `tests/privacy-regression/policy-conflicts/` and `tests/security-regression/policy-conflicts/`.

## Known limitations

A regression suite, not formal verification; critical rows exhaustive, not every input product; deferred gates unchanged; same-realm hostile code beyond `PolicyDecision` scopes, anonymity, and forensic guarantees remain out of scope. Docs-statement checks are phrase-based (stable, not semantic).

## Verdict

**TECH-14 is complete.** All acceptance criteria met; **0 conflicts** ([POLICY_CONFLICT_REPORT.md](POLICY_CONFLICT_REPORT.md)); all local checks green. Recommended next prompt: **TECH-15 — Policy Developer Experience + Contributor Workflow**.
