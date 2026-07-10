# Docs Canonical Workflow

[← Docs Index](README.md) · [Contributor Workflow](CONTRIBUTOR_WORKFLOW.md)

## The rule

**`docs/` in this repository is canonical.** Every user-facing guarantee, policy statement, limitation, and status lives here first, versioned and reviewed.

- The **wiki** is authored in the repo-controlled `wiki/` directory and published with `pnpm wiki:publish`. **No manual wiki-only edits** — especially never a security/privacy claim that exists only on the wiki.
- Any user-facing guarantee must land in repo docs (and pass `check:policy-docs` / `check:policy-conflicts`, including the Trust Center overclaim scan) **before** it may appear anywhere else.
- [PBOM](PBOM.md) and [Trust Center](TRUST_CENTER.md) must never diverge from each other or from the [Policy Matrix](POLICY_MATRIX.md) — machine-checked.
- The **anti-spyware externalization** (implementation in a standalone project; core keeps hooks only; no active protection in core) must be reflected consistently in docs AND wiki whenever the wiki is republished.

## Practical flow

1. Change `docs/` in the PR that changes behavior (ADR-0010 coupling).
2. Run `pnpm check:doc-links && pnpm check:policy-docs && pnpm check:policy-conflicts`.
3. If the wiki covers the topic, update `wiki/` in the same PR (or a follow-up) and `pnpm wiki:publish` after merge.
