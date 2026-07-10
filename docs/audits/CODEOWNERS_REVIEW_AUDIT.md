# CODEOWNERS Review Audit (TECH-15)

_Date: 2026-07-10._

## Current status

[.github/CODEOWNERS](../../.github/CODEOWNERS) exists and routes: everything → `@maintainers`; elevated paths for security-sensitive packages (`privacy`, `crypto`, `security`, `storage`, `transports`, `protocol`, `core`), guardrail scripts, workflows, and the security/privacy docs (PBOM, Trust Center, Threat/Privacy models, Policy Matrix, gates, SECURITY, GOVERNANCE) — now including the anti-spyware externalization boundary.

## Honest limitation (solo-dev)

`@maintainers` is a **placeholder team** — with a single maintainer, CODEOWNERS review is **not mechanically enforced**: branch protection's "require review from Code Owners" cannot be satisfied by the PR author, and `enforce_admins` is off (documented trade-off in [GOVERNANCE.md](../../GOVERNANCE.md) / [GITHUB_REPOSITORY_SETUP.md](../GITHUB_REPOSITORY_SETUP.md)). **We do not pretend otherwise.** The file's current value is routing + documentation of what *will* be enforced.

## Second-maintainer activation step

When a second maintainer joins: replace `@maintainers` with a real team; enable "Require review from Code Owners" + 2 approvals on security-sensitive paths; enable `enforce_admins`; re-run the [OpenSSF readiness checklist](OPENSSF_READINESS_CHECKLIST.md).

## Recommended branch protection (documented, not claimed active)

Protect `main`: require PR before merge · required status checks (CI, privacy guards, CodeQL, dependency review) · require conversation resolution · disallow force pushes · disallow deletions · CODEOWNERS review once a second maintainer exists. Full settings: [GITHUB_REPOSITORY_SETUP.md](../GITHUB_REPOSITORY_SETUP.md).
