# Contributor Workflow

[← Docs Index](README.md) · [Policy Developer Guide](POLICY_DEVELOPER_GUIDE.md) · [Commands](COMMANDS.md) · [Contributing](../CONTRIBUTING.md)

> [!NOTE]
> The goal of this workflow: **security/privacy work must be easy to do correctly and hard to do silently wrong.** FreeLayer is not ready for real secrets; honesty about that is part of the workflow.

## 1. Local setup

- **Node 24** (Active LTS — `.nvmrc`; `nvm use`), **pnpm 9** (`corepack enable` or install per `packageManager`).
- `pnpm install` → `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- All privacy/security checks: `pnpm check:all` (or the individual commands in [COMMANDS.md](COMMANDS.md)).
- Coverage: `pnpm test:coverage`.

## 2. Standard PR workflow

1. Create a branch (`feat/…`, `fix/…`, `docs/…`, `tech/…`).
2. Make a **minimal, scoped** change.
3. Run the required checks (section 7).
4. Update tests for any behavior change.
5. Update docs — `docs/` is canonical ([DOCS_CANONICAL_WORKFLOW.md](DOCS_CANONICAL_WORKFLOW.md)).
6. Update [PBOM](PBOM.md) / [Trust Center](TRUST_CENTER.md) if behavior or guarantees changed.
7. Open the PR and complete the checklist honestly.
8. **Never merge with failing checks; never disable a guardrail to get green.**

## 3. Policy change workflow

Changing any policy (Storage/Network/Metadata/LinkPreview/ExternalAsset/Notification/matrix)? Follow the [Policy Developer Guide](POLICY_DEVELOPER_GUIDE.md) — in one PR: matrix spec + mirrored `policy-matrix.v1.json` + policy module + conflict regression tests + model doc + PBOM (behavior) + Trust Center (guarantees), then `pnpm check:policy-matrix && pnpm check:policy-docs && pnpm check:policy-conflicts`.

## 4. New feature gate workflow

Before implementing ANY gated feature (crypto, encrypted storage, transports, identity, room sync, capsules, push, AI): research note → ADR ([ADR_WORKFLOW.md](ADR_WORKFLOW.md)) → threat-model update → [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md) update → PBOM planned-behavior entry → tests-first where possible. **No implementation until the gate is accepted.** `future_gate` is not executable.

## 5. Anti-spyware integration workflow

> Endpoint Defense / Anti-spyware is currently **externalized into a standalone project**. FreeLayer core keeps **policy hooks and compatibility contracts only**. **No active anti-spyware protection is implemented in the current core.** Future integration requires a dedicated ADR/gate, native-permission audit, PBOM update, Trust Center update, tests and review.

Before touching endpoint-defense implementation: **stop.** Open the dedicated integration ADR (Gate R, [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)) referencing the standalone project; define the integration boundary, native permissions, threat model, and per-platform limits; update PBOM/Trust Center; add compatibility tests. **Do not add endpoint-defense dependencies without gate approval** — `check:policy-conflicts` bans monitoring packages (`iohook`, `robotjs`, `screenshot-desktop`, key listeners, …) and CI fails on them. Use the [anti-spyware integration proposal template](../.github/ISSUE_TEMPLATE/antispyware_integration_proposal.yml).

## 6. Common mistakes (all caught by CI, don't make reviewers find them)

Adding `fetch` for convenience · a remote image/font/CDN link · a link-preview fetch · a notification permission prompt · a persistent-storage fallback ("just cache it") · weakening Ghost/Bunker "temporarily" · treating `future_gate`/`not_implemented` as allow · claiming anti-spyware protection is active · adding an undocumented dependency ([DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md)).

## 7. Required commands before every PR

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:boundaries
pnpm check:no-external-assets
pnpm check:no-telemetry
pnpm check:no-forbidden-storage
pnpm check:no-forbidden-network
pnpm check:build-zero-egress
pnpm check:no-network-deps
pnpm check:no-metadata-bypass
pnpm check:no-notification-bypass
pnpm check:policy-matrix
pnpm check:policy-docs
pnpm check:policy-conflicts
pnpm check:contributor-workflow
pnpm audit:privacy
pnpm audit:security
pnpm audit:supply-chain
```

Shortcut: `pnpm check:all` runs the full sequence. Troubleshooting: [COMMANDS.md](COMMANDS.md).
