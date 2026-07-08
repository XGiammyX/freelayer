# GitHub Actions Audit

## Purpose

Standing audit of every workflow: triggers, permissions, third-party actions, and risk posture. Re-run this audit whenever a workflow changes (workflow changes are supply-chain changes — ADR-0009).

_Last audited: 2026-07-08 (INFRA-02)._

## Workflows found

| Workflow | File | Triggers | Permissions | Notes |
| --- | --- | --- | --- | --- |
| CI | `ci.yml` | push/PR → `main` | `contents: read` | typecheck, lint, test, build + 4 privacy guards + doc-link integrity + `audit:privacy`; concurrency-cancelled per ref |
| Privacy regression | `privacy-regression.yml` | push/PR → `main` | `contents: read` | manifest/source greps + full `audit:privacy` |
| CodeQL | `codeql.yml` | push/PR → `main` + weekly cron | `contents: read`, `security-events: write` | write scope required for uploading scan results — minimal and justified |
| Dependency review | `dependency-review.yml` | PR → `main` | `contents: read`, `pull-requests: write` | write scope only for the on-failure PR comment — acceptable; could be dropped if comments are disabled |
| Dependabot Updates | (GitHub-managed) | schedule per `dependabot.yml` | GitHub-managed | weekly npm + github-actions; PRs require human review per [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md) |

## Actions used (all pinned by commit SHA with version comments)

- `actions/checkout` @ SHA (v7)
- `pnpm/action-setup` @ SHA (v6)
- `actions/setup-node` @ SHA (v6)
- `github/codeql-action/{init,autobuild,analyze}` @ SHA (v4)
- `actions/dependency-review-action` @ SHA (v5)

All are official GitHub/pnpm actions; **no other third-party actions** are used. (The GitGuardian check visible on PRs is an account-level GitHub App integration, not a workflow in this repository.)

## Rule-by-rule check

| Rule | Status |
| --- | --- |
| No unnecessary write permissions | ✅ `contents: read` baseline; only the two justified write scopes above |
| No secrets | ✅ zero repository secrets exist; workflows reference none |
| No deploy / no package publish | ✅ nothing publishes or deploys |
| No telemetry upload / external reporting service | ✅ no external endpoints contacted beyond the pinned actions themselves |
| No `pull_request_target` | ✅ not used anywhere |
| No disabled security checks | ✅ no check is skipped or soft-failed |
| No `continue-on-error` | ✅ not used; the only intentional soft-fail is the `pnpm audit` fallback message inside `audit:supply-chain` (local script, documented) |
| No broad artifact uploads | ✅ no artifacts are uploaded at all |

## Risk notes

- **Action supply chain:** mitigated by SHA pinning; Dependabot proposes pin bumps, humans review diffs.
- **`pull-requests: write` in dependency review:** smallest realistic scope for its comment feature; revisit if the comment adds no value.
- **CodeQL `security-events: write`:** inherent to code scanning; scoped to that workflow only.

## Improvements applied (history)

- INFRA-01: least-privilege permissions verified, placeholder fallback that could mask failures removed from privacy-regression, `--frozen-lockfile` adopted.
- Post-INFRA-01: all actions pinned by commit SHA (PR #12); action majors adopted only after green live runs.

## Remaining TODOs

- [ ] Re-audit on every workflow change (checklist item in [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md))
- [ ] Evaluate dropping the dependency-review PR comment to reach pure `contents: read` everywhere except CodeQL
- [ ] Add a Rust CodeQL job when the Tauri shell gains real Rust code
