# OpenSSF Readiness Checklist (TECH-15)

_Self-assessment against OpenSSF Scorecard / Best Practices Badge criteria. **No badge is claimed; no Scorecard score is claimed** — neither has been run/obtained. This is a readiness checklist, not marketing._

| Criterion | Status | Evidence |
| --- | --- | --- |
| SECURITY.md / private vulnerability reporting | ✅ met | [SECURITY.md](../../SECURITY.md) |
| CONTRIBUTING.md + contribution process | ✅ met | [CONTRIBUTING.md](../../CONTRIBUTING.md), [CONTRIBUTOR_WORKFLOW.md](../CONTRIBUTOR_WORKFLOW.md) |
| License | ✅ met | AGPL-3.0-or-later (+ CC BY-SA 4.0 docs) |
| CI on every PR | ✅ met | `.github/workflows/` — typecheck/lint/test/build + 12 guards |
| Tests | ✅ met | 337+ tests incl. privacy/security regression |
| Dependency update strategy | ✅ met | [MAINTENANCE.md](../MAINTENANCE.md), Dependabot groups |
| Pinned GitHub Actions (by SHA) | ✅ met | [GITHUB_ACTIONS_EGRESS_AUDIT.md](GITHUB_ACTIONS_EGRESS_AUDIT.md) |
| Token permissions (least privilege) | ✅ met | `permissions: contents: read` in workflows |
| No dangerous workflows | ✅ met | no `pull_request_target` script injection patterns; audited |
| Branch protection | 🟡 partial | documented in [GITHUB_REPOSITORY_SETUP.md](../GITHUB_REPOSITORY_SETUP.md); solo-dev `enforce_admins` trade-off accepted and honest |
| Code review / CODEOWNERS | 🟡 partial | CODEOWNERS exists with `@maintainers` placeholder; activates fully with a second maintainer ([CODEOWNERS_REVIEW_AUDIT.md](CODEOWNERS_REVIEW_AUDIT.md)) |
| Maintained status | ✅ met | active development; roadmap current |
| Static analysis | ✅ met | CodeQL + AST ESLint + 12 custom guards |
| Fuzzing | ⏳ deferred | Phase 10 / Gate E (parser fuzzing) |
| Signed releases | ⏳ deferred | Phase 11 (no releases exist yet) |
| SBOM | ⏳ deferred | Phase 10 (PBOM exists; SBOM at release) |
| Vulnerability disclosure workflow | ✅ met | SECURITY.md private reporting |
| No telemetry/external assets by default | ✅ met | machine-checked (zero-egress suite) |
| PBOM / Trust Center transparency | ✅ met | [PBOM.md](../PBOM.md), [TRUST_CENTER.md](../TRUST_CENTER.md) |

## TODOs

- [ ] Run OpenSSF Scorecard against the public repo and record the actual result here (do not guess a score).
- [ ] Complete the Best Practices Badge self-assessment questionnaire when nearing alpha (Phase 11); claim nothing before it is granted.
- [ ] Re-run this checklist when a second maintainer joins (branch protection + CODEOWNERS move to ✅).
