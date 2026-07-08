# Contributing to FreeLayer

[Docs Index](docs/README.md) · [Contributor Tasks](docs/CONTRIBUTOR_TASKS.md) · [Security-sensitive rules](docs/CONTRIBUTING_SECURITY.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

> [!TIP]
> Design review, threat-model critique, and comparison verification are as valuable as code right now — see [ready-made tasks](docs/CONTRIBUTOR_TASKS.md).

Thank you for your interest in FreeLayer. The project is in the **research and foundation stage**, which means design review, threat-model critique, and documentation improvements are currently as valuable as code.

## Ways to contribute

- **Review design documents** in [`docs/`](docs/) and open issues challenging assumptions.
- **Research** — fill in `TODO research` items, especially in [COMPETITOR_COMPARISON.md](docs/COMPETITOR_COMPARISON.md) and [CRYPTO_DESIGN.md](docs/CRYPTO_DESIGN.md).
- **Documentation** — clarity fixes, threat-model gaps, missing risks.
- **Code** — once implementation phases begin (see [ROADMAP.md](docs/ROADMAP.md)).

## Local setup

> Placeholder — there is no runnable application yet.

```bash
# Prerequisites: Node.js >= 20, pnpm >= 9
git clone https://github.com/XGiammyX/freelayer.git
cd freelayer
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm audit:privacy   # boundary + external-asset + telemetry + storage guards
```

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for details.

## Coding standards

- **TypeScript strict** — the base config in `tsconfig.base.json` is non-negotiable; do not weaken compiler options in package configs.
- **Small, focused modules** — prefer many small files over few large ones (~200–400 lines typical, 800 max).
- **Immutability by default** — return new objects; do not mutate inputs.
- **Explicit error handling** — no silently swallowed errors; user-facing messages must not leak sensitive data.
- **Validate at boundaries** — never trust transport payloads, file contents, or user input. Capsules are hostile input until proven otherwise.
- **No hardcoded values** — use constants or configuration.

## Security-first and privacy-first rules (mandatory)

Every contribution must respect the project's hard constraints. A PR that violates any of these will be rejected regardless of its other merits:

1. **No telemetry.** No analytics, crash reporters, usage pings, or "anonymous statistics" — not even opt-out ones.
2. **No external assets.** No CDN scripts, external fonts, remote stylesheets, or hotlinked images in any app by default.
3. **No plaintext logging of sensitive data.** Message content, keys, identities, contact data, room content, and AI prompts must never appear in logs, error messages, or crash output.
4. **No backend dependency.** Nothing may require a FreeLayer-owned server, a central account, or a server-side user database.
5. **No private key handling without review.** Any code that touches key material requires a security-focused review and sign-off from a code owner of `packages/crypto/` (see [.github/CODEOWNERS](.github/CODEOWNERS)).
6. **No weakening of Privacy Modes.** Features must consult the active privacy policy in core; bypassing it — even "temporarily" — is a rejected pattern.
7. **No custom cryptography.** Cryptographic changes follow the process in [docs/CONTRIBUTING_SECURITY.md](docs/CONTRIBUTING_SECURITY.md).

## Testing requirements

- New behavior requires tests (unit at minimum; integration where behavior crosses package boundaries).
- Privacy-relevant behavior requires a privacy-regression test under `tests/privacy-regression/` (e.g. "Ghost mode persists nothing to disk").
- Security-relevant behavior requires a security-regression test under `tests/security-regression/`.
- Target coverage: 80%+ for new packages once implementation begins.

## Documentation requirements

- Behavior changes must update the relevant design doc in `docs/`.
- Changes affecting the threat surface must update [THREAT_MODEL.md](docs/THREAT_MODEL.md).
- Changes affecting data collection, storage, network endpoints, or permissions must update [PBOM.md](docs/PBOM.md).

## Pull request process

1. Open or find an issue describing the change first — significant PRs without prior discussion may be closed.
2. Fork/branch, keep PRs small and focused.
3. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` locally.
4. Complete every item in the PR template checklist honestly — it is reviewed, not decorative.
5. Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `ci:`).
6. Security-sensitive paths require code-owner approval (see [GOVERNANCE.md](GOVERNANCE.md)).
7. **All changes to `main` go through pull requests once branch protection is active** — no direct pushes.
8. **Do not bypass or disable checks.** A failing CI check — especially `check:boundaries`, `check:no-external-assets`, `check:no-telemetry`, `check:no-forbidden-storage`, or `audit:privacy` — must be **fixed at its cause, never hidden**, skipped, or worked around to merge faster. Weakening a guardrail is itself a security-sensitive change requiring elevated review.

## Reporting security issues

**Never** open a public issue for an exploitable vulnerability. Follow [SECURITY.md](SECURITY.md).
