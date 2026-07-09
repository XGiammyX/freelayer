# GitHub Actions Egress Audit (TECH-09)

_Date: 2026-07-09 · Complements [GITHUB_ACTIONS_AUDIT.md](../GITHUB_ACTIONS_AUDIT.md) with an egress-specific lens._

## Purpose

Distinguish **development/CI egress** (which necessarily contacts GitHub and the package registry) from **app runtime egress** (which must be zero). This audit confirms CI contacts **only GitHub-provided infrastructure** — no third-party upload, telemetry, deploy, or publish.

## Workflows reviewed

`.github/workflows/`: `ci.yml`, `privacy-regression.yml`, `codeql.yml`, `dependency-review.yml`, plus GitHub-managed Dependabot.

## External services contacted (by CI, not the app)

| Service | Why | Acceptable? |
| --- | --- | --- |
| GitHub (checkout, Actions runners, API) | Running CI at all | Yes — the development platform |
| npm registry (via `pnpm install`) | Installing dependencies | Yes — package registry; frozen lockfile; no install scripts run unapproved |
| GitHub CodeQL | Static security analysis | Yes — GitHub security tooling |
| GitHub Dependency Review / Dependabot | Supply-chain review | Yes — GitHub security tooling |
| GitGuardian (account-level app) | Secret scanning on PRs | GitHub App integration, not a workflow in this repo; scans, does not exfiltrate project data |

## Checked for — and NOT present

- ❌ Coverage upload (Codecov/Coveralls) — none.
- ❌ Third-party artifact upload to external services — none (no artifacts uploaded at all).
- ❌ Telemetry/analytics services — none.
- ❌ Package publish / deploy — none.
- ❌ `curl`/`wget` to external endpoints — none.
- ❌ External (non-GitHub, non-official) actions — none; all actions are official GitHub/pnpm, pinned by SHA.
- ❌ `pull_request_target` — not used.
- ❌ Repository secrets — none exist.

## Permissions

Least privilege: `contents: read` baseline; `security-events: write` only in CodeQL; `pull-requests: write` only in dependency review. Documented in [GITHUB_ACTIONS_AUDIT.md](../GITHUB_ACTIONS_AUDIT.md).

## Honest statement

FreeLayer's **app runtime zero-egress claim does not mean development tooling never uses the internet** — `pnpm install` contacts the npm registry and GitHub Actions contact GitHub. That is CI/development behavior, documented here and in [PBOM.md](../PBOM.md), and is separate from the built app, which performs zero automatic network egress on load.

## TODO

- Consider egress-blocked CI runners (allowlist GitHub + registry only) — Phase 10.
- Re-audit on every workflow change.
