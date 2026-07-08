# GitHub Repository Setup

## Purpose

The authoritative record of how the FreeLayer GitHub repository is configured, what is enforced automatically, and what requires manual setup. Statuses here are updated only after verification — see [GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md) for the per-setting checklist and [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md) for the latest live validation.

**GitHub is the development and publication platform only.** The FreeLayer runtime has no GitHub dependency and no required hosted service of any kind (hard constraint, [ADR-0001](adr/ADR-0001-no-project-owned-infrastructure.md)).

## Repository

- **URL:** <https://github.com/XGiammyX/freelayer>
- **Visibility:** public
- **Default branch:** `main`
- **License detection:** AGPL-3.0 (root `LICENSE` carries the canonical text)

## Workflows

| Workflow | File | Trigger | Purpose |
| --- | --- | --- | --- |
| CI | `.github/workflows/ci.yml` | push/PR to `main` | install → typecheck → lint → test → build → 4 privacy guards → `audit:privacy` |
| Privacy regression | `.github/workflows/privacy-regression.yml` | push/PR to `main` | static telemetry/external-asset greps + full `audit:privacy` |
| CodeQL | `.github/workflows/codeql.yml` | push/PR + weekly cron | static analysis, `security-extended` query pack |
| Dependency review | `.github/workflows/dependency-review.yml` | PR to `main` | blocks known-vulnerable dependency changes (moderate+) |

Permissions follow least privilege: `contents: read` everywhere, plus only `security-events: write` for CodeQL uploads and `pull-requests: write` for dependency-review PR comments. No deployment, no publishing, no secrets.

All actions are **pinned by commit SHA** with the version noted in a comment (supply-chain hardening); Dependabot continues to propose updates against the pins. Pinned versions: checkout v7, pnpm/action-setup v6, setup-node v6, codeql-action v4, dependency-review-action v5 — each adopted only after its Dependabot bump PR ran green on live CI.

## Branch protection target for `main`

Desired configuration (apply via Settings → Branches → Add rule, or the API):

- Require a pull request before merging, with **at least 1 approval**
- Require conversation resolution before merging
- Require status checks to pass, with branch up to date where practical
- Block force pushes and deletions
- **Solo-development trade-off:** with a 1-approval requirement and a single maintainer, PRs cannot be self-approved; either leave "include administrators" off (admin merges bypass the review requirement, honestly documented) or accept that every merge needs a second maintainer. Revisit when the maintainer team grows.

### Required status checks (check names as reported by Actions)

- `Typecheck, lint, test, build` (CI)
- `Static privacy guards` (privacy regression)
- `Analyze (JavaScript/TypeScript)` (CodeQL)
- `Review dependency changes` (dependency review — PRs only)

These cover typecheck, lint, test, build, `check:boundaries`, `check:no-external-assets`, `check:no-telemetry`, `check:no-forbidden-storage`, and `audit:privacy`, which run as steps inside the CI and privacy-regression jobs.

## Security features

- **CodeQL:** workflow-based (see above); results under the repository Security tab → Code scanning.
- **Dependency review:** workflow-based, runs on every PR.
- **Dependabot:** `.github/dependabot.yml` — weekly npm + github-actions update PRs; security-relevant packages still require CODEOWNERS review ([DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md)).
- **Secret scanning / push protection:** GitHub-managed for public repositories; verify under Settings → Code security. Statuses recorded in [GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md).
- **Private vulnerability reporting:** Security tab → "Report a vulnerability"; policy in [SECURITY.md](../SECURITY.md).
- **CODEOWNERS:** `.github/CODEOWNERS` routes sensitive paths to `@maintainers` (placeholder — replace with a real team when the org exists; on a personal repo, unknown teams are inert and review rules are enforced procedurally per [GOVERNANCE.md](../GOVERNANCE.md)).
- **Templates:** PR template with the privacy/security checklist; four issue forms (bug, feature, security concern, documentation) with private-reporting routing.

## Inspecting failing workflows

```bash
gh run list --limit 10          # recent runs
gh run view <run-id>            # summary of one run
gh run view <run-id> --log-failed   # only the failing steps' logs
gh pr checks <pr-number>        # checks on a PR
```

**Rule: never disable privacy/security checks just to merge faster.** A red `check:boundaries`, `check:no-external-assets`, `check:no-telemetry`, `check:no-forbidden-storage`, or `audit:privacy` is a defect in the change, not in the check. Fixing the cause is the only accepted path to green ([CONTRIBUTING_SECURITY.md](CONTRIBUTING_SECURITY.md) — no silent privacy change rule).

## Feature decisions

- **Discussions: not enabled (deliberate).** Issues and PRs are the working channels while the contributor base is small; enabling Discussions is revisited when conversation volume justifies it. Recorded here per INFRA-02 so "not enabled" reads as a choice, not an oversight.
- **Wiki: not enabled.** Documentation lives versioned in `docs/`, where it is reviewed like code.
- **GitHub Pages: not enabled yet.** The `apps/docs` placeholder may become a Pages site later; that will be its own reviewed change with PBOM notes.

## Manual setup still required

Tracked with statuses in [GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md). Anything not verifiable by CLI is listed there as *Manual setup required* rather than claimed.
