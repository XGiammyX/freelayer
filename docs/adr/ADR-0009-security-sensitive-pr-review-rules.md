# ADR-0009: Security-sensitive PR review rules

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

A privacy project's guarantees are only as strong as its weakest merged PR. Well-intentioned contributions can weaken guarantees subtly — a loosened policy check, a new dependency with install scripts, a log line with plaintext content. Review rigor must be proportional to blast radius, and it must be procedural, not dependent on any individual reviewer's vigilance.

## Decision

1. **Security-sensitive paths** are: `packages/crypto`, `packages/security`, `packages/privacy`, `packages/storage`, `packages/capsules`, `packages/rooms`, `packages/protocol`, `packages/transports`, `packages/ai` (policy surface), `docs/CRYPTO_DESIGN.md`, `docs/THREAT_MODEL.md`, `docs/PRIVACY_MODEL.md`, `.github/workflows/`, and any code handling key material, identity data, capsule parsing, or policy enforcement wherever it lives.
2. PRs touching these paths require **two maintainer approvals, one from a code owner** of the affected path ([CODEOWNERS](../../.github/CODEOWNERS)), and **may not be self-merged** by their author.
3. **Design before code** for crypto and protocol changes: the design-doc PR is reviewed and merged before the implementation PR opens.
4. **Cited prior art required** for security constructions; "I invented this" is a rejection reason for cryptography (ADR-0004).
5. **Tests in the same PR**: security-relevant behavior requires security-regression tests; privacy-relevant behavior requires privacy-regression tests; new parsers require fuzz targets.
6. Reviewers work through [SECURITY_REVIEW_CHECKLIST.md](../SECURITY_REVIEW_CHECKLIST.md) — the checklist is part of the review record, not decoration.
7. **New dependencies in sensitive packages** require written justification: necessity, maintenance health, transitive footprint, install scripts, license. Vendoring tiny utilities is preferred over dependency surface in `crypto`/`security`.
8. No merge on a red or skipped privacy-regression check. CI checks may not be disabled to unblock a PR.

## Consequences

- Sensitive changes move slower. Accepted: this friction is the mechanism.
- Small maintainer teams bear real review load; the checklist and doc-coupling rule (ADR-0010) make reviews tractable.
- Drive-by contributions to sensitive paths need shepherding; CONTRIBUTING_SECURITY.md sets expectations early.

## Security impact

- Single-reviewer fatigue, author self-merge, and CI-bypass — three classic paths for defective sensitive changes — are procedurally closed.
- Supply-chain review (dependencies, workflows) is elevated to the same tier as code.

## Privacy impact

- Policy-loosening changes cannot land quietly: they are surfaced by the checklist ("does it bypass core policy?") and require governance-level visibility (ADR-0002).

## Contributor impact

- Contributions to sensitive paths take longer to merge and require more from the author: stated security reasoning, tests in the same PR, and responsiveness to checklist-driven review. This is set out up front in [CONTRIBUTING_SECURITY.md](../CONTRIBUTING_SECURITY.md) so nobody is surprised mid-review.
- First-time contributors are welcome on sensitive paths — the process protects the code, it does not gatekeep people. Maintainers shepherd; the checklist tells authors in advance exactly what reviewers will ask.

## What would require a new ADR

- Removing any path from the sensitive list.
- Reducing approval requirements or permitting self-merge on sensitive paths.
- Any standing exception for a person, bot, or emergency process.
