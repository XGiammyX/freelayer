# ADR-0004: No crypto implementation before review

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

Cryptographic code written early, casually, or by enthusiasm rather than review is the classic failure mode of privacy projects. Once shipped, weak crypto is nearly impossible to retract: users rely on it, data is encrypted under it, and migration is painful. FreeLayer's credibility depends on getting this sequence right the first time.

## Decision

1. **No cryptographic implementation code exists in this repository until [CRYPTO_DESIGN.md](../CRYPTO_DESIGN.md) specifies the construction and that design has passed review** (elevated review per ADR-0009; external review before any component is labeled trusted).
2. **No custom cryptography, ever.** No novel primitives, no hand-rolled protocol where an established, analyzed construction exists. "I designed this myself" is a rejection reason.
3. All cryptographic operations go through the **`packages/crypto` facade**. No other package may call a crypto library directly; apps never import `packages/crypto` at all.
4. Every primitive facade and protocol construction ships with **test vectors** (known-answer tests, plus published interop vectors).
5. Everything carries **algorithm identifiers** so primitives can be migrated (crypto agility).
6. Until externally reviewed, any crypto component is marked **experimental** in code, docs, and Trust Center — and no release may describe it otherwise.

## Consequences

- Implementation Gates E and F ([IMPLEMENTATION_GATES.md](../IMPLEMENTATION_GATES.md)) block messaging features until design review completes. The roadmap accepts this delay explicitly.
- External review may cost time and money; the schedule bends, the gate does not.
- The forward-secrecy-over-lossy-transports problem (the design's central open question) must be resolved on paper, not discovered in production.

## Security impact

- Prevents the worst failure class available to this project: shipping subtly broken crypto with confident documentation.
- Concentrates all cryptographic attack surface behind one reviewed facade with test vectors.

## Privacy impact

- Every privacy property downstream (capsule confidentiality, room encryption, storage-at-rest) inherits its actual strength from this discipline; overclaiming is structurally discouraged because unreviewed components are labeled experimental.

## Contributor impact

- Crypto *implementation* PRs are rejected until the design gate opens — regardless of code quality. Contributors who want to work on cryptography contribute to [CRYPTO_DESIGN.md](../CRYPTO_DESIGN.md): research memos, prior-art analysis, and design review are the valuable crypto contributions right now.
- "I wrote a fast/clever implementation of X" is not a shortcut through the gate; cited prior art and design-first process apply to everyone, including maintainers.

## What would require a new ADR

- Selecting the cryptographic library set (its own ADR when evaluation concludes).
- Selecting protocol profiles (offline capsule exchange; interactive messaging; group/room encryption).
- Any exception to the facade rule, any direct crypto-library usage outside `packages/crypto`.
- The post-quantum migration plan when adopted.
