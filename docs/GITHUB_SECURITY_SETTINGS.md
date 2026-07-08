# GitHub Security Settings Checklist

## Purpose

Per-setting status of the repository's security configuration. **A status is claimed only after verification** — "Workflow present" means the file exists and is pushed; "Verified enabled" means the live setting/run was checked.

Status labels: **Verified enabled** · **Workflow present** · **Manual setup required** · **Not available** · **TODO**

_Last verified: pending first live validation — statuses below are updated by the publication pass and recorded in [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md)._

| Setting | Status | Notes |
| --- | --- | --- |
| Public repository | TODO | Verify after `gh repo create` |
| Default branch `main` | TODO | Verify after push |
| Branch protection on `main` | TODO | Apply via API or document manual steps ([GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md)) |
| Required pull requests | TODO | Part of branch protection |
| Required status checks | TODO | CI / privacy guards / CodeQL / dependency review |
| CodeQL / code scanning | Workflow present | `.github/workflows/codeql.yml`, security-extended; verify first run |
| Dependabot alerts | TODO | Enable via API/Settings → Code security |
| Dependabot security updates | TODO | Enable via API/Settings → Code security |
| Dependabot version updates | Workflow present | `.github/dependabot.yml` (weekly npm + actions) |
| Dependency Review Action | Workflow present | `.github/workflows/dependency-review.yml`; runs on PRs |
| Secret scanning | TODO | Default-on for public repos; verify in Settings → Code security |
| Push protection | TODO | Verify/enable in Settings → Code security |
| CODEOWNERS | Verified enabled (file) | `.github/CODEOWNERS`; `@maintainers` placeholder — replace when an org/team exists |
| PR template | Verified enabled (file) | `.github/PULL_REQUEST_TEMPLATE.md` with privacy/security checklist |
| Issue templates | Verified enabled (files) | 4 forms + config routing vulnerabilities to private reporting |
| SECURITY.md | Verified enabled (file) | Private reporting via Security Advisories |
| Private vulnerability reporting | TODO | Enable via API/Settings → Advisories |
| Least-privilege Actions permissions | Verified enabled (files) | `contents: read` baseline; `security-events: write` only in CodeQL; `pull-requests: write` only in dependency review |
| No deploy tokens | Verified enabled | No deployment exists anywhere in the repository |
| No GitHub secrets | Verified enabled | This prompt creates none; workflows reference none |
| No package publishing tokens | Verified enabled | No publishing configured; all packages `private: true` |

## Standing rules

- Never create repository secrets for CI at this stage — nothing needs them, and their absence is itself a verifiable property.
- Never grant a workflow write permissions it does not demonstrably need.
- `pull_request_target` is not used; introducing it requires a documented security justification and elevated review.
- **TODO:** pin actions by commit SHA after workflows stabilize.

## How to re-verify

```bash
gh repo view --json visibility,defaultBranchRef,licenseInfo
gh api repos/XGiammyX/freelayer/branches/main/protection
gh api repos/XGiammyX/freelayer | jq .security_and_analysis
gh workflow list && gh run list --limit 5
```
