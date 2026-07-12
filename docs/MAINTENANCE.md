# Maintenance & Update Strategy

[← Docs Index](README.md) · [Dependency Policy](DEPENDENCY_POLICY.md) · [Platform State Analysis](PLATFORM_STATE_ANALYSIS.md)

> [!NOTE]
> The definitive answer to "how do we keep the platform current, safely, forever?" — a sustainable policy that respects the constitution and needs no heroics.

## The core idea: the test suite is the safety net

FreeLayer can adopt dependency updates confidently because **updates that break behavior fail CI loudly**:

- **173 tests** — including privacy-regression (Ghost/Bunker zero-persistence, network zero-egress, strictest-wins) and security-regression (redaction, forgery rejection, guardrail behavior).
- **13 checks** — typecheck, ESLint (AST-backed constitution rules), Prettier, boundaries, no-external-assets, no-telemetry, no-forbidden-storage, no-forbidden-network, no-network-deps, build-zero-egress, doc-links, plus `audit:privacy` and `audit:supply-chain`.

**A dependency update whose PR is fully green has not changed any behavior the platform cares about.** That is the mechanism — not vigilance, not luck.

## Update cadence

| Change type | Mechanism | Adoption rule |
| --- | --- | --- |
| Patch / minor (tooling: turbo, prettier, vitest, eslint, vite, types) | Dependabot **grouped** weekly PR (`dev-tooling-minor`) | Merge when **all checks green**. Safe by the safety-net principle. |
| Patch / minor (react/react-dom + types) | Dependabot **react** group | Merge when green; smoke-check the built landing renders. |
| GitHub Actions | Dependabot **github-actions** group | Adopt after green; **re-pin to the new commit SHA** (see [GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md)). |
| **Major** (TypeScript 7, React majors, Vite majors, Node type majors) | Dependabot **individual** PR | Run the **major-migration checklist** below. Never auto-merge. |
| Security advisory | `pnpm audit` / Dependabot alert | Prioritize; patch or document mitigation immediately. |

## Major-migration checklist

For any major version bump:

1. Read the upstream migration guide; note breaking changes.
2. On the PR branch: `pnpm install` → `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm audit:privacy`.
3. If green, smoke-check the built app (`pnpm build` → open `apps/web/dist/index.html`) and run `pnpm test:coverage` (coverage must not regress meaningfully).
4. Update any code the major requires; keep the diff minimal.
5. Update this file / [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md) if the toolchain baseline changed.
6. Security-sensitive packages (`crypto`, `security`, `privacy`, `storage`, `transports`, `protocol`) additionally need CODEOWNERS review ([GOVERNANCE.md](../GOVERNANCE.md)).

**Currently deferred majors (tracked):** TypeScript 7 (native compiler — evaluate when typescript-eslint and the ecosystem support it); `@types/node` follows the pinned Node runtime, not "latest."

## Runtime pinning

- **Node: 24 (Active LTS, EOL April 2028).** Pinned in `.nvmrc` and CI; `engines.node` floor `>=20` for contributor flexibility. `@types/node` tracks the runtime (`^24`), not the newest published.
- **pnpm: 9.x** (`packageManager` + `engines`), Corepack-friendly.
- **Contributors:** `nvm use` (reads `.nvmrc`) → Node 24. Note: modern Node ships `localStorage`/`sessionStorage` globals even outside browsers ([research](research/STORAGE_HARDENING_RESEARCH.md)) — the storage layer never touches them and the zero-persistence trap verifies it, so this is behavior-neutral.

## Supply-chain discipline

**Anti-spyware dependency rule (TECH-15):** the Endpoint Defense / anti-spyware implementation is externalized; **no endpoint-monitoring dependencies** (screenshot/clipboard/keystroke/overlay/process monitoring — e.g. `iohook`, `robotjs`, `screenshot-desktop`, key listeners) may enter core without the Gate R integration ADR. `check:policy-conflicts` fails CI on them. Update the [Policy Matrix](POLICY_MATRIX.md), [PBOM](PBOM.md), and [Trust Center](TRUST_CENTER.md) whenever a dependency changes network/storage/metadata/notification behavior.

- New dependencies follow [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md): stated case, license (AGPL-compatible), maintenance health, transitive footprint, install-script review. Sensitive packages default to zero dependencies.
- `check:no-network-deps` fails on any network-client/analytics/AI SDK (TECH-09). Adding one is a review-blocking event.
- Actions pinned by commit SHA; `pnpm-lock.yaml` committed; CI uses `--frozen-lockfile`.
- Dependabot proposes; **humans review diffs** (a green run is not a review for majors or sensitive packages).

## What "keeping updated" does NOT mean

- It does not mean adopting `latest` blindly — it means adopting **green** updates on a cadence, and majors deliberately.
- It does not add runtime dependencies to the shipped app for their own sake — the app's dependency surface stays minimal (react/react-dom only at runtime).
- It does not weaken any guardrail to make an update pass — a red privacy/security check on an update is a reason to **not** adopt it, or to fix the cause.

## Review triggers

Re-read this file and [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md) when: the Node LTS line changes, a major is adopted, a new tool is added to CI, or a security advisory affects a direct dependency.
