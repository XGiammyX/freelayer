# Contributing to Security-Sensitive Areas

## Purpose

Extra rules — beyond [CONTRIBUTING.md](../CONTRIBUTING.md) — for contributions touching cryptography, key material, identity, privacy policy semantics, storage guarantees, or the capsule protocol. These paths are listed in [.github/CODEOWNERS](../.github/CODEOWNERS) and governed by [GOVERNANCE.md](../GOVERNANCE.md).

## What counts as security-sensitive

- `packages/crypto`, `packages/security`, `packages/privacy`, `packages/storage`, `packages/capsules`, `packages/rooms`
- `docs/CRYPTO_DESIGN.md`, `docs/THREAT_MODEL.md`, `docs/PRIVACY_MODEL.md`
- `.github/workflows/` (CI is supply chain)
- Anything handling key material, identity data, capsule parsing, or policy enforcement — wherever it lives

## Process

1. **Design before code.** Open an issue; for crypto/protocol changes, update the relevant design doc first and get that PR reviewed before implementation.
2. **Cite prior art.** Security PRs should reference the construction, paper, RFC, or precedent they follow. "I invented this" is a rejection reason for cryptography (see [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md) rule 1).
3. **Elevated review.** Two maintainer approvals including a code owner; no self-merge; no merge on a red or skipped privacy-regression check.
4. **Tests are mandatory**: regression tests for the property you claim (in `tests/security-regression/` or `tests/privacy-regression/`), plus test vectors for anything cryptographic.
5. **Update the models.** THREAT_MODEL / PRIVACY_MODEL / PBOM updates ship in the same PR, not "later".

## Mandatory documentation coupling

*(Locked — [ADR-0010](adr/ADR-0010-documentation-updated-with-code.md).)*

Any PR touching the following areas must update documentation **in the same PR**:

- `packages/core`
- `packages/crypto`
- `packages/protocol`
- `packages/capsules`
- `packages/rooms`
- `packages/storage`
- `packages/transports`
- `packages/privacy`
- `packages/security`
- `packages/ai`
- `apps/web` — if it adds side effects
- `apps/desktop` — if it adds permissions, storage, notifications, filesystem access, network access, or Tauri capabilities
- `apps/relay`
- GitHub workflows
- dependencies (additions, removals, and version changes in sensitive packages — [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md))
- release scripts

Required documents by area:

| Area touched | Documents to update |
| --- | --- |
| crypto | [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md), [THREAT_MODEL.md](THREAT_MODEL.md), [TRUST_CENTER.md](TRUST_CENTER.md), relevant ADR |
| protocol / capsules | [CAPSULENET.md](CAPSULENET.md), [THREAT_MODEL.md](THREAT_MODEL.md), [METADATA_MODEL.md](METADATA_MODEL.md) |
| rooms | [SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md), [THREAT_MODEL.md](THREAT_MODEL.md), [PRIVACY_MODEL.md](PRIVACY_MODEL.md) |
| storage | [STORAGE_MODEL.md](STORAGE_MODEL.md), [PBOM.md](PBOM.md), [PRIVACY_MODEL.md](PRIVACY_MODEL.md) |
| transports | [NETWORK_MODEL.md](NETWORK_MODEL.md), [METADATA_MODEL.md](METADATA_MODEL.md), [PBOM.md](PBOM.md), [THREAT_MODEL.md](THREAT_MODEL.md) |
| privacy / security | [PRIVACY_MODEL.md](PRIVACY_MODEL.md), [THREAT_MODEL.md](THREAT_MODEL.md), relevant ADR |
| ai | [LOCAL_AI.md](LOCAL_AI.md), [PBOM.md](PBOM.md), [THREAT_MODEL.md](THREAT_MODEL.md) |
| core | [ARCHITECTURE.md](ARCHITECTURE.md), [PRIVACY_MODEL.md](PRIVACY_MODEL.md), [THREAT_MODEL.md](THREAT_MODEL.md) |
| app side effects / permissions | [PBOM.md](PBOM.md), plus [STORAGE_MODEL.md](STORAGE_MODEL.md) or [NETWORK_MODEL.md](NETWORK_MODEL.md) as applicable |
| relay | [NETWORK_MODEL.md](NETWORK_MODEL.md), [THREAT_MODEL.md](THREAT_MODEL.md), [PBOM.md](PBOM.md) |
| dependencies | [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md) case in the PR; [PBOM.md](PBOM.md) section 10 |
| workflows / release scripts | [TRUST_CENTER.md](TRUST_CENTER.md); [GOVERNANCE.md](../GOVERNANCE.md) if review rules change |

**If documentation is not updated, the PR description must explain why.** Silence on this point is a review-blocking omission ([SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md)).

## No silent privacy change rule

**A PR that changes privacy behavior without updating documentation and tests must not be merged.** No exceptions for size ("it's a one-liner"), urgency ("we'll document it after"), or direction ("it only makes things stricter" — tightening still changes documented behavior). This is the enforcement edge of [ADR-0010](adr/ADR-0010-documentation-updated-with-code.md): if the privacy delta isn't visible in the diff's docs and tests, reviewers reject the PR.

## Specific rules

### Cryptography
- No new primitives; no primitive swaps without a design-doc change and review.
- Constant-time concerns, nonce handling, and key zeroization must be addressed in the PR description explicitly.
- Anything unreviewed externally is marked experimental in code and docs.

### Key material
- Keys never appear in logs, error messages, serialized debug output, or test fixtures (use dedicated test keys, clearly labeled).
- Key handling code paths need a stated lifecycle: generation → storage → use → destruction.

### Privacy policy semantics
- A PR may tighten a mode's behavior freely; **any loosening** requires explicit justification, GOVERNANCE-level review, and a PRIVACY_MODEL.md update.

### Dependencies in sensitive packages
- New dependency = justification required: why not zero-dependency, maintenance health, transitive tree, install scripts, license.
- Prefer vendoring tiny utilities over adding dependency surface to `crypto`/`security`.

### Protocol / capsule parsing
- All parsing is hostile-input parsing: strict schema validation, explicit size limits, fuzz targets added to `tests/fuzz/` for new parsers.

## CI and branch discipline

- Once branch protection is active on `main`, **every change lands via pull request** with the required checks green ([GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md)).
- **CI failures are fixed, not hidden.** Never disable, skip, or soften a privacy/security guardrail (`check:boundaries`, `check:no-external-assets`, `check:no-telemetry`, `check:no-forbidden-storage`, `audit:privacy`, CodeQL, dependency review) to get a merge through. Changing a guardrail is a security-sensitive change with elevated review and same-PR doc/test coupling.
- Security-sensitive changes continue to require documentation and tests **in the same PR** — a green CI run does not substitute for the coupling rule (ADR-0010).

## Disclosure interaction

If while contributing you discover an actual vulnerability in existing code or design, stop and follow [SECURITY.md](../SECURITY.md) — do not describe it in a public PR, even to fix it, until coordinated.

## TODO

- [x] Security review checklist for PR reviewers — [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md)
- [ ] Fuzzing harness conventions (Phase 10)
- [ ] External review engagement checklist (pre-Phase 5 exit)
