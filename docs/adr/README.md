# Architecture Decision Records

## Purpose

This directory is FreeLayer's **project constitution**. Each ADR records a binding architectural decision: its context, the decision itself, its consequences, and — because this is a privacy/security project — its explicit security and privacy impact.

ADRs exist to prevent drift. A future contributor (or maintainer) who wants to "just add a quick server-side cache" or "temporarily bypass the policy engine" must first confront the ADR that forbids it, and either comply or open a new ADR through governance review.

## Authority

- Accepted ADRs are **binding** on all code, documentation, and review decisions in this repository.
- Where an ADR and any other document conflict, **the ADR wins** until superseded.
- PRs that violate an accepted ADR are rejected regardless of other merits.
- Changing or superseding an ADR requires GOVERNANCE-level review ([GOVERNANCE.md](../../GOVERNANCE.md)): public discussion, two maintainer approvals, and an explicit successor ADR. ADRs are never edited to quietly mean something else; they are superseded.

## When a new ADR is required

A new ADR is required for any change affecting:

- **Infrastructure assumptions** — anything touching the no-project-owned-infrastructure principle (ADR-0001)
- **Privacy modes** — adding, removing, or changing the semantics of a mode or its capabilities
- **Storage guarantees** — backend types, write-barrier semantics, wipe behavior, cache inheritance
- **Network behavior** — the network side-effect barrier, default egress, transport trust assumptions
- **Crypto design** — constructions, libraries, protocol profiles, primitive migrations
- **Identity model** — identity/device keys, invites, verification, aliases, recovery
- **Room model** — the synchronization model (CRDT/operation-log decision), membership semantics, history rules
- **AI policy** — any AI capability, gate change, or context-scoping change
- **Telemetry / external service policy** — there is none; introducing any would require an ADR (and would face ADR-0008)
- **License strategy** — relicensing, dual licensing, CLA/DCO adoption, the CC0 test-vector decision
- **Release / security process** — signing, review requirements, gate criteria weakening

Plus: any "What would require a new ADR" trigger listed in an existing ADR, and any loosening of a privacy or security guarantee anywhere.

## How to propose changes

1. Open an issue describing the problem and the decision you believe is needed; reference the affected ADR(s).
2. Submit the new ADR as a PR (`Status: Proposed`), following the format below. A superseding ADR names what it supersedes; the old ADR is marked `Superseded by ADR-XXXX` in the same PR — never silently edited.
3. Discussion happens publicly on the PR.
4. Acceptance requires **GOVERNANCE-level review** ([GOVERNANCE.md](../../GOVERNANCE.md)): two maintainer approvals including a code owner of the affected area, no self-merge. All ADR changes are governance-level by definition — every topic in the list above maps to a hard constraint, a security guarantee, or a locked decision.
5. On acceptance: status flips to `Accepted`, the index below is updated, and affected documents are updated in the same PR ([ADR-0010](ADR-0010-documentation-updated-with-code.md)).

## Format

Every ADR contains: **Status** (Proposed / Accepted / Superseded by ADR-XXXX), **Context**, **Decision**, **Consequences**, **Security impact**, **Privacy impact**, **What would require a new ADR**.

Numbering is sequential and permanent. Superseded ADRs stay in place, marked as superseded.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [ADR-0001](ADR-0001-no-project-owned-infrastructure.md) | No project-owned infrastructure | Accepted |
| [ADR-0002](ADR-0002-core-enforced-policy-engine.md) | Core-enforced policy engine | Accepted |
| [ADR-0003](ADR-0003-capsules-as-only-cross-device-format.md) | Capsules as the only cross-device format | Accepted |
| [ADR-0004](ADR-0004-no-crypto-implementation-before-review.md) | No crypto implementation before review | Accepted |
| [ADR-0005](ADR-0005-storage-selected-only-by-policy.md) | Storage selected only by policy | Accepted |
| [ADR-0006](ADR-0006-sovereign-rooms-as-primary-product-model.md) | Sovereign Rooms as the primary product model | Accepted |
| [ADR-0007](ADR-0007-local-ai-disabled-by-default.md) | Local AI disabled by default | Accepted |
| [ADR-0008](ADR-0008-no-external-assets-or-telemetry.md) | No external assets or telemetry | Accepted |
| [ADR-0009](ADR-0009-security-sensitive-pr-review-rules.md) | Security-sensitive PR review rules | Accepted |
| [ADR-0010](ADR-0010-documentation-updated-with-code.md) | Documentation updated with code | Accepted |
| [ADR-0011](ADR-0011-license-strategy.md) | License strategy: AGPL-3.0-or-later code, CC BY-SA 4.0 docs | Accepted |
| [ADR-0012](ADR-0012-endpoint-defense-layer.md) | Endpoint Defense Layer / ScreenShield as an official pillar | Accepted |
