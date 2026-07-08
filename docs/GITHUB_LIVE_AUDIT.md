# GitHub Live Audit — INFRA-02

## Summary

Full health check of the live public repository. **Result: healthy.** All local checks pass, all live workflows green, zero open PRs, branch protection verified, no contradictions between public claims and verified status after this pass's fixes.

- **Repository:** <https://github.com/XGiammyX/freelayer>
- **Date:** 2026-07-08
- **Audited from commit:** `1213809` (main after PR #14) — polish changes ship via the INFRA-02 PR
- **Auditor:** INFRA-02 pass (agent-assisted, human-merged)

## Local checks (all pass, exit 0)

`install` · `typecheck` · `lint` · `test` · `build` · `check:boundaries` · `check:no-external-assets` · `check:no-telemetry` · `check:no-forbidden-storage` · `audit:privacy` · `audit:security` · `audit:supply-chain` (no known vulnerabilities)

## Live GitHub state (verified via `gh`)

| Item | Verified state |
| --- | --- |
| Visibility | PUBLIC |
| Default branch | `main` |
| Description | "Serverless private communication. Sovereign rooms. Encrypted capsules. No central backend." |
| Topics | 14 (privacy, local-first, serverless, e2ee, …) |
| License detection | GNU AGPL v3.0 (from root LICENSE) |
| Workflows | CI, Privacy regression, CodeQL, Dependency review, Dependabot Updates — all active |
| Recent runs | All green on `main` (CI, CodeQL, Privacy regression) |
| Open PRs | 0 at audit time |
| Branch protection | Verified via API: 4 required checks (strict), 1 required review, conversation resolution, no force-push/delete; `enforce_admins` off (documented solo trade-off) |
| Security settings | Secret scanning ✅, push protection ✅, Dependabot alerts + security updates ✅, private vulnerability reporting ✅ ([GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md)) |
| CODEOWNERS / SECURITY.md / templates | Present (CODEOWNERS uses the documented `@maintainers` placeholder) |
| Governance docs | CONTRIBUTING, GOVERNANCE, CODE_OF_CONDUCT, Trust Center, PBOM, Roadmap — present and current |
| Discussions | Not enabled — deliberate for now; issues + PRs are the channels until the contributor base grows (decision recorded in [GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md)) |

Actions/permissions detail: [GITHUB_ACTIONS_AUDIT.md](GITHUB_ACTIONS_AUDIT.md).

## Quality assessment

| Area | Status after INFRA-02 |
| --- | --- |
| README | Rewritten as a plain-language landing page: problem → one-minute idea → analogy → pillars → honest status table → simple comparison → technical depth below the fold |
| Docs | New plain-English layer (PUBLIC_EXPLANATION, GLOSSARY, docs index, CONTRIBUTOR_TASKS); comparison split into readable vs research-grade |
| Landing page (`apps/web`) | Redesigned: dark privacy aesthetic, system fonts, responsive cards, visible status warning, zero external assets |
| Overclaim scan | No forbidden claims (unbreakable/perfect anonymity/forensic erasure/spyware-proof) outside sentences forbidding them |

## Issues found → fixes applied

1. ARCHITECTURE said "no package contains implementation code" — stale since TECH-03 → updated to describe the typed scaffolding honestly.
2. ARCHITECTURE cited "ADR-0001 through ADR-0010" as the lock range — stale → now 0001–0012.
3. INSTALLATION described typecheck/test as no-ops and audits as placeholders — stale → real command descriptions.
4. Comparison docs lacked a readable public layer and mainstream-tool rows → PUBLIC_COMPARISON rewritten by category (messengers, federated, collaboration, transfer) with *TODO verify* marks on unvalidated details.
5. README led with architecture jargon → rewritten for non-technical readers first, technical section below.
6. Trust Center answered slowly → now opens with "Can I trust FreeLayer today? **No. Not with real secrets yet.**" plus a claim-by-claim table.
7. Discussions decision was undocumented → recorded.

## Remaining TODOs

- [ ] Verify rows marked *TODO verify* in PUBLIC_COMPARISON/COMPETITOR_COMPARISON (contributor tasks exist for each)
- [ ] Replace `@maintainers` CODEOWNERS placeholder when a real team exists
- [ ] Revisit `enforce_admins` when a second maintainer joins
- [ ] Re-run this audit after the INFRA-02 PR merges (statuses above reflect pre-merge main plus this pass's local verification)

## Manual verification steps (for anything CLI cannot see)

Settings → Code security (secret scanning/push protection toggles) · Settings → Branches (protection rule) · Settings → General → Features (Discussions off) · the README/landing rendering, checked by eye on github.com.
