# Security Review Checklist

## Purpose

The working checklist for reviewers of any non-trivial PR — mandatory for PRs touching security-sensitive paths ([ADR-0009](adr/ADR-0009-security-sensitive-pr-review-rules.md)). The completed checklist is part of the review record: answer each applicable question in the review, don't just skim the list.

A "yes" to any question in sections 1–3 is not automatically disqualifying — it means the PR must satisfy the corresponding rule, and the reviewer must verify that it does.

## 1. Side effects and policy

- [ ] **Does this PR introduce a new side effect?** (persist, notify, connect, transmit, fetch, sync, run AI) → If yes: does it flow through the core pipeline with a `PolicyDecision`? ([ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md))
- [ ] **Does it bypass core policy anywhere** — including debug paths, fast paths, error paths, or tests that leak into production code?
- [ ] **Does it write to persistent storage or disk at all?** → If yes: through the StoragePolicy write barrier only, with a resolved `StoragePolicy` and an exact-scope `PolicyDecision`? ([ADR-0005](adr/ADR-0005-storage-selected-only-by-policy.md)) Check for direct localStorage / sessionStorage / IndexedDB / SQLite / filesystem (`fs.writeFile*`, Deno, Bun, Tauri fs) / cache API / cookie usage — the CI guard catches the mechanical cases; review catches aliasing.
- [ ] **Does it create a cache, thumbnail, or preview?** → Correct cache data class? Denied in strict modes per the matrix? Inherits the strictest source policy?
- [ ] **Does it persist derived AI artifacts?** → Denied in v0 (Gate I); any change here is an ADR-0007-adjacent policy change.
- [ ] **Does it store ScreenShield / reveal / capture state?** → Correct endpoint data class? No plaintext content in audit events? Denied at high device risk?
- [ ] **Does every new storage call site update PBOM and add privacy-regression tests?**
- [ ] **Does it open network access?** → If yes: through `packages/transports` as capsules only? ([ADR-0003](adr/ADR-0003-capsules-as-only-cross-device-format.md)) No new endpoints outside PBOM?
- [ ] **Does it load remote assets?** → Must be no. No exceptions. ([ADR-0008](adr/ADR-0008-no-external-assets-or-telemetry.md))
- [ ] **Does it log sensitive data?** Check log lines, error messages, thrown exceptions, and debug serialization for message content, keys, identities, prompts, contact data.

## 2. Sensitive surfaces

- [ ] **Does it parse hostile input?** (capsules, bundles, imported files, QR payloads, room operations) → Strict schema? Size limits? Quarantine on failure? Fuzz target added? ([CAPSULENET.md](CAPSULENET.md))
- [ ] **Does it touch crypto?** → Design-doc first? Cited prior art? Behind the `packages/crypto` facade? Test vectors? ([ADR-0004](adr/ADR-0004-no-crypto-implementation-before-review.md))
- [ ] **Does it touch identity?** (identity keys, aliases, invites, verification, recovery) → Key lifecycle stated? Nothing uploaded anywhere?
- [ ] **Does it touch room membership?** (join, leave, removal, key rotation) → Consistent with SOVEREIGN_ROOMS.md security concerns?
- [ ] **Does it touch AI prompts/cache?** → AIPolicy respected? Storage-policy inheritance? No prompt logging? Human confirmation for writes? ([ADR-0007](adr/ADR-0007-local-ai-disabled-by-default.md))
- [ ] **Does it touch Tauri permissions or capabilities?** → Minimal capability set preserved? PBOM permissions section updated?

## 3. Coupling and completeness

- [ ] **Does it affect PBOM?** Required update for any change to network behavior, storage, permissions, dependencies, caches, logs, or AI behavior. ([PBOM.md](PBOM.md))
- [ ] **Does it add tests?** Unit for new behavior; privacy-regression for privacy-relevant behavior; security-regression for security-relevant behavior; fuzz for parsers.
- [ ] **Are machine-checkable claims tested?** Any testable privacy/security claim in this PR's docs needs a corresponding test, or a tracked TODO with a gate reference.
- [ ] **Does it update threat/privacy/storage/network docs** per the coupling table in [CONTRIBUTING_SECURITY.md](CONTRIBUTING_SECURITY.md)? If not, does the PR description explain why? ([ADR-0010](adr/ADR-0010-documentation-updated-with-code.md))
- [ ] **Does it weaken any hard constraint?** (backend dependency, telemetry, external assets, key upload, policy loosening…) → If yes: reject, or route through GOVERNANCE + superseding ADR.
- [ ] **Does it need an ADR?** Check the trigger list in [docs/adr/README.md](adr/README.md) — infrastructure, privacy modes, storage guarantees, network behavior, crypto, identity, rooms, AI policy, telemetry/external services, license, release/security process.

## 4. Process checks

- [ ] Sensitive path? → Two maintainer approvals incl. code owner; no self-merge. ([ADR-0009](adr/ADR-0009-security-sensitive-pr-review-rules.md))
- [ ] Does it introduce a dependency? → [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md) case present (purpose, license, maintenance, transitive risk)?
- [ ] Does the dependency have install scripts? → Elevated review; justification required.
- [ ] Does it change release or security workflow? → GOVERNANCE-level review; [TRUST_CENTER.md](TRUST_CENTER.md) updated.
- [ ] Privacy-regression CI check green — not skipped, not disabled?
- [ ] Does any doc/claim in this PR overpromise? (forbidden: perfect anonymity, unbreakable encryption, forensic erasure, impossible to stop, "zero risk")

## TODO

- [ ] Automate the mechanical items (direct storage-API usage, external assets, telemetry deps) via lint/CI so reviewer attention stays on judgment calls (Phase 10)
