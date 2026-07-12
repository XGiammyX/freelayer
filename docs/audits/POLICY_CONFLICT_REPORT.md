# Policy Conflict Report

_Date: 2026-07-10 · Branch: `tech/policy-conflict-regression-suite` (on TECH-13 `0f2f992`). Regenerate/update this report whenever the conflict suite or matrix changes._

## Summary

The Policy Conflict Regression Suite compared the Policy Matrix against every concrete engine (Storage/Network/Metadata/LinkPreview/ExternalAsset/Notification), the composition rules, the deferred gates, the externalized endpoint-defense hooks, and the docs/PBOM/Trust Center contracts.

**Current conflicts found: 0.** All layers agree.

## Conflict categories checked (17)

`allow_vs_deny` · `persistent_allowed_conflict` · `network_allowed_conflict` · `metadata_allowed_conflict` · `redaction_conflict` · `future_gate_treated_as_allow` · `not_implemented_treated_as_allow` · `user_action_required_without_user_action` · `room_policy_loosened_device_policy` · `feature_policy_loosened_mode_policy` · `unknown_input_allowed` · `docs_code_mismatch` · `pbom_code_mismatch` · `trust_center_test_mismatch` · `externalized_component_marked_implemented` · `guardrail_allowlist_hides_violation` · `unknown`

## How it is enforced

- **Tests** (`tests/privacy-regression/policy-conflicts/`, `tests/security-regression/policy-conflicts/`): table-driven matrix↔engine comparisons; composition safety (room/feature tighten-only, Emergency override, Offline denial); gated features not executable; unknown inputs deny; fixture detection; explanation stability + sentinel-freedom.
- **Validator** (`scripts/check-policy-conflicts.mjs`, in `audit:privacy` + CI): matrix-export invariants (always-forbidden never allowed, strict persistence, offline network, deferred domains, externalized capabilities), Trust Center overclaim scan (negation-aware), docs externalization statements, forbidden endpoint-monitoring/push dependencies.
- **Fixtures** (`tests/fixtures/policy-conflicts/`): a deliberately contradictory matrix (9 planted conflicts → 48 findings) and an overclaiming Trust Center (10 findings) prove the validator actually detects each category.

## Conflicts resolved during TECH-14

None required — TECH-10…13 integration tests had already forced agreement. The suite's job is keeping it that way.

## Deferred / accepted (unchanged)

Crypto (Gate F) · encrypted storage (Gate F) · capsules (Gate D/E) · room sync (Gate H) · identity (Gate G) · local AI (Gate I) · push/service workers · user-initiated preview · same-realm reflection reuse (accepted, Gate B) · hostile room members ignoring room policy (accepted).

## Anti-spyware externalization status

**Externalized, hook-only, integration-gated.** Verified in [ANTISPYWARE_EXTERNALIZATION_AUDIT.md](ANTISPYWARE_EXTERNALIZATION_AUDIT.md): no implementation, no monitoring dependencies, no native permissions; matrix capability rows `future_gate` in every mode; Trust Center makes no active-protection claim.

## PBOM / Trust Center consistency

PBOM sections 14–17 agree with the matrix (machine-checked mentions + dependency scan). Trust Center passes the overclaim scan; its claims map to existing tests.

## Known limitations

A regression suite, not formal verification: it prevents *known* contradiction classes from returning and compares critical rows exhaustively, but does not enumerate every input product, does not solve deferred gates, and does not defend against same-realm hostile code beyond existing `PolicyDecision` scope checks. No anonymity or forensic guarantees.

## Next work

TECH-15 (Policy Developer Experience + Contributor Workflow); at Gate B, consider deriving engine tables from matrix specs (or vice versa) to eliminate the dual-maintenance surface entirely.
