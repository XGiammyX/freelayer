# TECH-14 — Precheck

_Branch: `tech/policy-conflict-regression-suite` (stacked on TECH-13 `tech/policy-matrix-v1` @ `0f2f992`, which is PR #36 on `main` @ `79af52b`). Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable`._

## Platform baseline

| Item | Evidence | Status |
| --- | --- | --- |
| Baseline green | 320 tests + all guards at branch point | present |
| AST ESLint guardrails / regex scanners | `eslint.config.mjs`, `scripts/check-*.mjs` | present |
| WeakSet `PolicyDecision` authenticity | `packages/privacy/src/index.ts` + regression test | present |
| Maintenance docs / zero-egress scanners / PBOM / Trust Center | all present and active | present |
| Baseline note | The prompt's "0 open PRs" predates the stacked flow: PR #36 (TECH-13) is open and green; TECH-14 stacks on it. Non-blocking; documented. | present but different |

## TECH-10 / TECH-11 / TECH-12

MetadataPolicy (+ taxonomy, redacted audit model, guardrail, integrations) — **present**. LinkPreviewPolicy/ExternalAssetPolicy (+ URL classifier, hardened scanners, WEB_SECURITY_HEADERS, PBOM §15) — **present**. NotificationPolicy (+ taxonomies, redaction, badge/sound/vibration/push helpers, guardrail, trap, Tauri + SW/push audits) — **present**.

## TECH-13

| Item | Evidence | Status |
| --- | --- | --- |
| Policy Matrix v1 (94 specs → 658 rules) | `packages/privacy/src/policyMatrix.ts` | present |
| Machine-readable export | `docs/policy-matrix.v1.json` (verbatim sync test) | present |
| Validation script | `scripts/validate-policy-matrix.mjs` (`check:policy-matrix`) | present |
| Matrix docs / coverage / integration tests | `docs/POLICY_MATRIX.md`, `tests/*/policy-matrix/` | present |

## Anti-spyware separation (new direction)

Before TECH-14 the docs described endpoint-defense as deferred TECH-EDL roadmap work *inside* this repo. TECH-14 updates them to the externalized model: implementation in a separate project, core keeps hooks only, integration behind a dedicated ADR/gate. Verified: no monitoring implementation, no anti-spyware dependencies, zero native permissions ([ANTISPYWARE_EXTERNALIZATION_AUDIT.md](ANTISPYWARE_EXTERNALIZATION_AUDIT.md)) — **present** after this pass.

## Verdict

All dependencies **present**; nothing missing had to be built. TECH-14 adds the conflict regression layer and the externalization documentation; it modifies no engine behavior.
