# Dependency Policy

## Purpose

Dependencies are the largest attack surface a privacy project voluntarily accepts. This policy defines when a dependency may be added, how it is reviewed, and which classes of dependency are forbidden outright. It extends [ADR-0009](adr/ADR-0009-security-sensitive-pr-review-rules.md) and [CONTRIBUTING_SECURITY.md](CONTRIBUTING_SECURITY.md).

## Current status

**Active from Phase 0.** The workspace currently carries three dev-only dependencies (`turbo`, `typescript`, `prettier`); every future addition is subject to this policy.

## Rules

1. **Sensitive packages default to zero dependencies.** `packages/crypto`, `packages/security`, `packages/privacy`, and `packages/protocol` accept dependencies only with written justification explaining why vendoring or writing the code is worse. Prefer vendoring tiny utilities over adding dependency surface.
2. **Every dependency needs a stated case**, recorded in the PR that adds it: purpose (what it does that we should not write ourselves), license (must be AGPL-3.0-compatible — [ADR-0011](adr/ADR-0011-license-strategy.md)), maintenance status (release cadence, maintainer count, issue responsiveness), and transitive risk (what it drags in; a small direct dependency with a large transitive tree is a large dependency).
3. **Install scripts trigger elevated review.** Dependencies with `preinstall`/`postinstall`/`prepare` scripts require explicit justification and two-maintainer approval; pnpm's script-blocking should be configured so unapproved scripts do not run.
4. **No telemetry or analytics dependencies.** Not in apps, not in packages, not in dev tooling that ships. ([ADR-0008](adr/ADR-0008-no-external-assets-or-telemetry.md))
5. **No remote asset/font dependencies** — nothing that fetches from a CDN or font service at build or run time. ([NO_EXTERNAL_ASSETS_POLICY.md](NO_EXTERNAL_ASSETS_POLICY.md))
6. **No obfuscated or minified-only dependencies in source.** If the published package cannot be read and diffed, it cannot be reviewed, and it does not ship.
7. **Dependency changes touching sensitive packages require CODEOWNERS approval** per [GOVERNANCE.md](../GOVERNANCE.md) — including lockfile-only bumps.
8. **Dependabot PRs still need review.** Automation proposes; humans verify changelogs and diffs. A green CI run is not a review.

## Review flow

New or updated dependency → PR includes the stated case (rule 2) → [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md) dependency items answered → CODEOWNERS approval where sensitive → PBOM updated when the dependency affects network, storage, or build behavior ([PBOM.md](PBOM.md), section 10).

## Adopted dev dependencies (stabilize/harden pass)

ESLint tooling was adopted with a stated case: **ESLint + typescript-eslint + @eslint/js + globals** (all MIT, standard, well-maintained) provide **AST-backed enforcement** of the constitution (no-restricted-globals/imports) — the definitive upgrade of the regex guardrails. **@vitest/coverage-v8** (matches the pinned vitest major) gives regression-visibility coverage. All are dev-only, ship nothing to users, and are covered by `check:no-network-deps` (none is a network/analytics/AI client). Update cadence: [MAINTENANCE.md](MAINTENANCE.md).

## TODO

- [ ] Define a dependency budget per package (target counts; sensitive packages: 0 default)
- [ ] Install-script detection in CI (fail on new install scripts without an allowlist entry)
- [ ] License check workflow (AGPL-compatibility allowlist in `dependency-review.yml`)
- [ ] Supply-chain risk scoring (maintainers, provenance/attestations, typosquat distance) — Phase 10
