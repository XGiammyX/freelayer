# ADR-0010: Documentation updated with code

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

Security documentation that lags its code is worse than none: it makes confident claims about behavior that no longer exists. The threat model, privacy model, and PBOM are only trustworthy if they are updated in the same change that alters what they describe. "We'll update the docs later" is how a Privacy Bill of Materials becomes fiction.

## Decision

1. **Every security- or privacy-sensitive PR must update the affected documentation and tests in the same PR.** Not a follow-up issue, not a TODO — the same PR.
2. The binding area→documentation mapping lives in [CONTRIBUTING_SECURITY.md — Mandatory documentation coupling](../CONTRIBUTING_SECURITY.md). In summary: changes to `crypto`, `protocol`, `capsules`, `rooms`, `storage`, `transports`, `privacy`, `security`, `ai`, side-effect-adding app code, or workflows must update the corresponding model documents (THREAT_MODEL, PRIVACY_MODEL, METADATA_MODEL, STORAGE_MODEL, NETWORK_MODEL, CRYPTO_DESIGN, CAPSULENET, SOVEREIGN_ROOMS, LOCAL_AI), [PBOM.md](../PBOM.md), [TRUST_CENTER.md](../TRUST_CENTER.md), and the relevant ADR as applicable.
3. If a PR author believes no documentation update is needed, **the PR description must say so and explain why**. Silence is a review rejection.
4. PBOM-relevant changes (network behavior, storage locations, permissions, dependencies, caches, logs, AI behavior) always update [PBOM.md](../PBOM.md) — no exceptions.
5. Reviewers verify coupling via [SECURITY_REVIEW_CHECKLIST.md](../SECURITY_REVIEW_CHECKLIST.md) and the PR template checklist; an unchecked coupling item without explanation blocks merge.

## Consequences

- PRs are slightly larger and slower to write. Accepted: the alternative is documentation rot in exactly the documents users must be able to trust.
- Docs stay review-current, making external audits and design reviews cheaper and more accurate.
- Phase 10 automation (PBOM auto-diff) gets a meaningful baseline to diff against.

## Security impact

- The threat model cannot silently diverge from implemented behavior; reviewers always see the claimed security delta alongside the code delta.

## Privacy impact

- The PBOM remains an honest, auditable inventory rather than a launch-day marketing artifact; users and auditors can trust its change history.

## Contributor impact

- PR authors own the documentation delta of their change: the coupling table in [CONTRIBUTING_SECURITY.md](../CONTRIBUTING_SECURITY.md) tells them which documents, and "no update needed because…" in the PR description is always an acceptable answer where true.
- Docs-and-tests-in-the-same-PR makes changes larger but reviewable in one sitting; contributors should scope PRs smaller rather than defer the documentation.

## What would require a new ADR

- Any standing exemption from documentation coupling for a package, team, or change type.
- Replacing same-PR coupling with a deferred/batched documentation process.
