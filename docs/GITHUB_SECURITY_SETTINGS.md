# GitHub Security Settings Checklist

## Purpose

Per-setting status of the repository's security configuration. **A status is claimed only after verification** — "Workflow present" means the file exists and is pushed; "Verified enabled" means the live setting/run was checked.

Status labels: **Verified enabled** · **Workflow present** · **Manual setup required** · **Not available** · **TODO**

_Last verified: 2026-07-08, during Infra-01 live validation ([LIVE_CI_REPORT.md](LIVE_CI_REPORT.md))._

| Setting | Status | Notes |
| --- | --- | --- |
| Public repository | Verified enabled | `gh repo view`: PUBLIC, <https://github.com/XGiammyX/freelayer> |
| Default branch `main` | Verified enabled | `gh repo view`: defaultBranchRef = main |
| Branch protection on `main` | Verified enabled | Applied via API; see below for the exact rule set |
| Required pull requests | Verified enabled | 1 approving review; `enforce_admins` off (documented solo-dev trade-off) |
| Required status checks | Verified enabled | `Typecheck, lint, test, build` · `Static privacy guards` · `Analyze (JavaScript/TypeScript)` · `Review dependency changes` (strict up-to-date) |
| CodeQL / code scanning | Verified enabled | First runs green on `main` and PR #11 (security-extended) |
| Dependabot alerts | Verified enabled | Enabled via API (HTTP 204) |
| Dependabot security updates | Verified enabled | `security_and_analysis.dependabot_security_updates: enabled` |
| Dependabot version updates | Verified enabled | First version-bump PRs opened on day one |
| Dependency Review Action | Verified enabled | Green on PR #11 |
| Secret scanning | Verified enabled | `security_and_analysis.secret_scanning: enabled` |
| Push protection | Verified enabled | `security_and_analysis.secret_scanning_push_protection: enabled` |
| CODEOWNERS | Verified enabled (file) | `.github/CODEOWNERS`; `@maintainers` placeholder — replace when an org/team exists |
| PR template | Verified enabled (file) | `.github/PULL_REQUEST_TEMPLATE.md` with privacy/security checklist |
| Issue templates | Verified enabled (files) | 4 forms + config routing vulnerabilities to private reporting |
| SECURITY.md | Verified enabled (file) | Private reporting via Security Advisories |
| Private vulnerability reporting | Verified enabled | Enabled via API (HTTP 204) |
| Least-privilege Actions permissions | Verified enabled (files) | `contents: read` baseline; `security-events: write` only in CodeQL; `pull-requests: write` only in dependency review |
| No deploy tokens | Verified enabled | No deployment exists anywhere in the repository |
| No GitHub secrets | Verified enabled | This prompt creates none; workflows reference none |
| No package publishing tokens | Verified enabled | No publishing configured; all packages `private: true` |

## Standing rules

- Never create repository secrets for CI at this stage — nothing needs them, and their absence is itself a verifiable property.
- Never grant a workflow write permissions it does not demonstrably need.
- `pull_request_target` is not used; introducing it requires a documented security justification and elevated review.
- Actions are pinned by commit SHA with version comments (see [GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md)); version bumps land by updating the pin, reviewed like any dependency change.

## How to re-verify

```bash
gh repo view --json visibility,defaultBranchRef,licenseInfo
gh api repos/XGiammyX/freelayer/branches/main/protection
gh api repos/XGiammyX/freelayer | jq .security_and_analysis
gh workflow list && gh run list --limit 5
```
