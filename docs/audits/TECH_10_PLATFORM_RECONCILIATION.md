# TECH-10 — Platform State Reconciliation

_Branch: `tech/metadata-firewall-implementation` (stacked on `99d0c4a`). Compares the actual repository against the Platform State Analysis before implementing TECH-10._

## Purpose

TECH-10 v2 requires verifying that the repo matches the stated baseline (`edb3654` + stabilize/harden pass) and that already-resolved work is **not** redone. This is the reconciliation. Statuses: `matches baseline` · `present but different` · `missing on this branch` · `deferred as documented` · `accepted limitation` · `not applicable`.

## Reconciliation table

| Item | Claimed state | Actual (this branch) | Status |
| --- | --- | --- | --- |
| Current commit | `edb3654` + stabilize/harden | `99d0c4a` = `edb3654` + the stabilize/harden commit ("chore: stabilize, harden, and define maintenance strategy") | matches baseline |
| Test count | 173 | 173 at `99d0c4a`; **220** after TECH-10 adds 47 metadata tests | matches baseline (pre-TECH-10) |
| AST-backed ESLint (globals/imports) | resolved | `eslint.config.mjs` present: `no-restricted-globals` + `no-restricted-imports` over `apps/**`+`packages/**` src | matches baseline |
| Regex CI scanners (belt-and-suspenders) | present | all `scripts/check-*.mjs` present and wired | matches baseline |
| `PolicyDecision` WeakSet provenance | resolved | `packages/privacy/src/index.ts` — module-private `issuedDecisions` WeakSet; `isPolicyDecision` checks membership | matches baseline |
| `policy-decision-authenticity.test.ts` | present | `tests/security-regression/policy-decision-authenticity.test.ts` present (5 tests) | matches baseline |
| `MAINTENANCE.md` | present | `docs/MAINTENANCE.md` present | matches baseline |
| `.nvmrc` | Node 24 | `.nvmrc` = `24` | matches baseline |
| CI Node version | 24 | `.github/workflows/ci.yml` + `privacy-regression.yml` use Node 24 | matches baseline |
| `@types/node` | `^24` | `package.json` → `^24.0.0` | matches baseline |
| `engines.node` | `>=20` | `package.json` → `>=20.0.0` | matches baseline |
| Dependabot grouping | defined | `.github/dependabot.yml` (github-actions + npm dev-tooling/react groups) | matches baseline |
| GitHub Actions SHA pinning | resolved | verified in `docs/audits/GITHUB_ACTIONS_EGRESS_AUDIT.md`; unchanged | matches baseline |
| Coverage tooling | present, no threshold | `@vitest/coverage-v8` + `test:coverage`; no hard threshold | matches baseline |
| Storage hardening (TECH-05/06/07) | present | `packages/storage/*` + storage regression suites present | matches baseline |
| NetworkPolicy foundation (TECH-08) | present | `packages/transports/*` + network regression suites present | matches baseline |
| Zero-egress scanners (TECH-09) | present | `check-build-zero-egress`, `check-no-network-deps`, egress audits present | matches baseline |
| `docs/` canonical / `wiki/` workflow | resolved | `docs/` canonical; `wiki/` + `pnpm wiki:publish` present | matches baseline |
| PBOM / Trust Center | current | present; extended by TECH-10 (metadata section) | present but different (extended, not contradicted) |

## Mismatches found

**None blocking.** The only difference from the stated baseline is the commit id: the Platform State Analysis names `edb3654` "+ the stabilize/harden pass"; on this branch that pass is the concrete commit `99d0c4a`. That commit is currently on the open PR **#27** (green, awaiting merge). TECH-10 is stacked on top of it, so the metadata work builds on the hardened foundation exactly as intended. When #27 merges to `main`, this branch rebases cleanly.

No resolved item was reimplemented. No accepted limitation was reopened. No deferred/gated item (crypto/Gate F, room sync/Gate H, identity/Gate G, capsule wire format/Gate E, SBOM/Phase 10, Playwright E2E/AUDIT-HARD) was pulled forward.

## Reconciliation actions taken

- None required beyond noting the PR-#27-pending state. TECH-10 proceeds on the verified baseline.

See [PLATFORM_STATE_ANALYSIS.md](../PLATFORM_STATE_ANALYSIS.md) for the full problem register and [TECH_10_PRECHECK.md](TECH_10_PRECHECK.md) for the technical-baseline verification.
