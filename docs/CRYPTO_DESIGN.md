# FreeLayer Cryptographic Design

## Purpose

Define the direction, constraints, and review process for FreeLayer's cryptography — **before any of it is implemented**. This document is deliberately design-only.

## Current status

**Not implemented — by policy.** No cryptographic code exists in this repository, and none will be written until this design has matured and been reviewed. Placeholder text in other docs describing "encrypted capsules" refers to this future design.

## Non-negotiable rules

1. **No custom cryptography.** No novel primitives, no hand-rolled protocols where an established, analyzed construction exists.
2. **Established primitives only**, via well-maintained, widely reviewed libraries (candidates: libsodium via WASM/native bindings, or WebCrypto where sufficient — *TODO evaluation*).
3. **External review required** before any cryptographic component is labeled trusted or shipped in a release.
4. **Crypto agility**: every capsule and stored blob carries algorithm/version identifiers; the design must support migration from day one.
5. **Test vectors required**: every primitive facade and every protocol construction ships with known-answer tests; interop vectors are published so independent implementations can verify.
6. **No overclaiming**: FreeLayer never describes its encryption as unbreakable. Security degrades with implementation bugs, key handling errors, and endpoint compromise — the docs say so.

## Planned areas (placeholders, not decisions)

### Message/content encryption
Direction: authenticated encryption (AEAD) for capsule payloads; forward secrecy for interactive messaging sessions via an established ratchet construction (Signal-style double ratchet is prior art — *TODO research*: applicability to high-latency, out-of-order, multi-transport delivery, where ratchet state synchronization is hard. Alternatives to study: SimpleX queues' approach, sealed-sender-like constructions, per-capsule keys with header encryption).

### Capsule signing / authenticity
Direction: sender authenticity within rooms (members can't forge each other) while preserving deniability options for chat vs. explicit signatures for decisions ("proof-of-agreement" — see [SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md)). Tension between deniability and accountability is a design decision to make per object type, not globally.

### Key derivation
Direction: hierarchical derivation from identity roots → per-room / per-device / per-data-class keys, enabling crypto-shredding (see [STORAGE_MODEL.md](STORAGE_MODEL.md)) and scoped compromise. Passphrase-based derivation uses memory-hard KDFs.

### File/document encryption
Direction: chunked AEAD for large blobs (streaming, resumable, random access), content-addressed by ciphertext hash for dedup within a room without cross-room correlation leaks *(TODO research: dedup vs. privacy trade-off)*.

### Group/room encryption (future)
Options to research: sender keys (Signal groups), MLS (RFC 9420) — attractive for scalable group agreement but assumes delivery-service properties that a serverless, multi-transport system may not provide; pairwise fan-out as the naive safe baseline. **No decision yet.**

### Post-quantum roadmap (placeholder)
Track hybrid KEM adoption (e.g. X25519+ML-KEM hybrids as deployed by Signal/PQXDH and TLS ecosystems). Crypto agility (rule 4) is the concrete preparation; no PQ commitment is made beyond designing for replaceability. *(TODO research, revisit yearly.)*

## Review process for cryptographic changes

1. Design written/updated in this document with rationale and cited prior art.
2. Public issue for discussion; elevated review per [GOVERNANCE.md](../GOVERNANCE.md) (two maintainer approvals, code-owner sign-off).
3. Implementation behind the `packages/crypto` facade only, with test vectors.
4. External review before the component is trusted in a release.
5. [TRUST_CENTER.md](TRUST_CENTER.md) updated with review status.

## Risks

- **Ratchet vs. transport mismatch**: forward-secrecy protocols assume ordered-ish delivery; FreeLayer's transports are high-latency and lossy. Getting this wrong silently weakens FS — the central open problem of this design.
- **WASM/JS side channels**: constant-time guarantees are fragile in JS engines; prefer audited native/WASM implementations.
- **Multi-device key sprawl**: more devices, more key material, more recovery complexity.
- **Review bottleneck**: external review costs time/money; the roadmap must not pressure crypto into shipping unreviewed.

## Open questions

- libsodium-wasm vs. WebCrypto vs. Rust-side crypto in Tauri (different answers per platform?)
- One protocol for both interactive chat and offline capsule exchange, or two profiles sharing primitives?
- Identity key algorithm choice and upgrade story?

## Future research required

- Double ratchet behavior under multi-transport, out-of-order, high-latency delivery
- MLS applicability without a central delivery service
- Metadata-protecting constructions (sealed sender analogues) for capsule headers
- KDF parameters for target devices (mobile-class hardware)

## TODO

- [ ] Library evaluation matrix (libsodium/WebCrypto/Rust) — Phase 2 research
- [ ] Protocol profile draft: offline capsule exchange — Phase 4 gate
- [ ] Protocol profile draft: interactive messaging — Phase 5 gate
- [ ] Test-vector format and interop-vector publication plan
- [ ] External review budget/plan before Phase 5 exit
