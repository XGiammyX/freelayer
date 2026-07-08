# Live CI Report — Infra-01

## Summary

First live validation of FreeLayer's GitHub publication: **all workflows green on `main` and on the validation PR.** No CI fixes were required — the first hosted runs passed as-is.

- **Repository:** <https://github.com/XGiammyX/freelayer> (public)
- **Date:** 2026-07-08
- **Commit tested (main):** `159703a` (`chore: normalize line endings with gitattributes`, on top of `63481dc` `chore: establish FreeLayer foundation`)
- **Validation PR:** <https://github.com/XGiammyX/freelayer/pull/11> — `test: validate GitHub Actions live` (left open intentionally)

## Local command results (pre-publication, same tree)

| Command | Result |
| --- | --- |
| `pnpm install` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS (16/16) |
| `pnpm build` | PASS (incl. Vite production build) |
| `pnpm check:boundaries` | PASS |
| `pnpm check:no-external-assets` | PASS |
| `pnpm check:no-telemetry` | PASS |
| `pnpm check:no-forbidden-storage` | PASS |
| `pnpm audit:privacy` | PASS |

## Workflows detected

CI · Privacy regression · CodeQL · Dependency review · Dependabot Updates — all `active`.

## GitHub Actions results on `main` (push runs)

| Workflow | Result | Duration |
| --- | --- | --- |
| CI (typecheck/lint/test/build + 4 guards + audit:privacy) | ✅ success | 46s |
| Privacy regression | ✅ success | 20s |
| CodeQL (JavaScript/TypeScript, security-extended) | ✅ success | 1m11s |

## Validation PR check results (PR #11)

| Check | Result |
| --- | --- |
| Typecheck, lint, test, build | ✅ pass |
| Static privacy guards | ✅ pass |
| Analyze (JavaScript/TypeScript) — CodeQL | ✅ pass |
| Review dependency changes | ✅ pass |
| GitGuardian Security Checks *(account-level integration)* | ✅ pass |

## Dependabot

Active immediately: opened version-bump PRs for GitHub Actions (setup-node 4→6, pnpm/action-setup 4→6, dependency-review-action 4→5) and npm dev-dependencies on first scan. Per [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md), these still require human review — automation proposes, humans verify.

## Failing checks / fixes applied

**None.** No workflow failed; no fixes were needed during live validation.

## Security settings verified via API

`security_and_analysis` on the repository reports: **secret scanning: enabled**, **push protection: enabled**, **Dependabot security updates: enabled**. Vulnerability alerts and **private vulnerability reporting** were enabled via API (HTTP 204). Full checklist: [GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md).

## Branch protection status

Applied to `main` after this report was committed (so the report itself could land): require PR with 1 approval, required status checks (CI, privacy guards, CodeQL analyze, dependency review) with strict up-to-date, conversation resolution required, force pushes and deletions blocked, `enforce_admins` **off** as the documented solo-development trade-off ([GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md)). Verified state is recorded in [GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md) — if it says TODO there, it is not enabled.

## Post-validation closure: Dependabot review (per DEPENDENCY_POLICY.md)

All ten day-one Dependabot PRs were reviewed. **No PR was merged by automation**: `main` requires review, and merge decisions are left to the maintainer — the agent-assisted pass deliberately did not bypass the protection it had just enabled. Dispositions:

| PR | Change | CI | Review outcome |
| --- | --- | --- | --- |
| #1 | actions/checkout 4→7 | ✅ green | Adopt — superseded by the SHA-pinning PR, which pins v7 by commit SHA |
| #2 | codeql-action 3→4 | ✅ green | Adopt — superseded by the SHA-pinning PR (v4 pinned) |
| #3 | dependency-review-action 4→5 | ✅ green | Adopt — superseded by the SHA-pinning PR (v5 pinned) |
| #4 | pnpm/action-setup 4→6 | ✅ green | Adopt — superseded by the SHA-pinning PR (v6 pinned) |
| #5 | actions/setup-node 4→6 | ✅ green | Adopt — superseded by the SHA-pinning PR (v6 pinned) |
| #6 | TypeScript ^7 + vitest ^4 (grouped) | ❌ 1 failing | **Defer TypeScript 7** (breaking major; needs a real migration evaluation). Vitest 4 evaluated separately in the combined npm PR |
| #7 | @vitejs/plugin-react 4→6 | ❌ 1 failing | Fails against Vite 6 — must land together with the Vite major; included in the combined npm PR |
| #8 | react + @types/react → 19 | ✅ green | Adopt — included in the combined npm PR |
| #9 | react-dom + @types/react-dom → 19 | ✅ green | Adopt — included in the combined npm PR |
| #10 | vite 6→8 | ✅ green | Adopt — included in the combined npm PR (with plugin-react 6) |

After the two superseding PRs merge, the corresponding Dependabot PRs can be closed; Dependabot treats closure as "ignore this version" and will propose the next one.

## Next recommended step

**Prompt 05 — Storage Policy + Write Barrier Hardening.**
