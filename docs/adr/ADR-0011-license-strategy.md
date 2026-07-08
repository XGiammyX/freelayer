# ADR-0011: License strategy

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

The repository launched with a license placeholder listing strong-copyleft candidates (AGPL-3.0, GPL-3.0, MPL-2.0) and three selection criteria: (1) discourage closed, unauditable forks that could weaken privacy guarantees while trading on FreeLayer's design; (2) keep the protocol and ecosystem usable; (3) remain compatible with the dependency stack (Tauri, React, Vite, future cryptographic libraries — all under permissive or compatible licenses).

For a privacy project, license choice is a security-adjacent decision. The realistic failure mode is not hostile intent — it is a convenient fork: a repackaged client or hosted relay with telemetry added, hidden infrastructure introduced, or privacy modes quietly weakened, distributed without source so nobody can verify what changed. Although FreeLayer itself is serverless, its ecosystem includes network-facing components (self-hosted relays, hosted web bundles) where a plain GPL would leave a network-service loophole: modified versions offered over a network without conveying copies would owe nobody their source. The AGPL's network-interaction provision (Section 13) closes that gap. Finally, documentation (threat models, privacy models, ADRs) is a first-class product of this project and deserves its own explicit license rather than inheriting the code license by accident.

## Decision

1. **Code is licensed AGPL-3.0-or-later.** The canonical license text lives in the root [LICENSE](../../LICENSE) file. The SPDX identifier `AGPL-3.0-or-later` is used in package manifests.
2. **Documentation is licensed CC BY-SA 4.0 unless otherwise stated**, as specified in [docs/LICENSE-DOCS.md](../LICENSE-DOCS.md). Code snippets embedded in documentation may be used under either license.
3. **Contributions are accepted inbound = outbound**: contributors license their contributions under the same terms as the project (AGPL-3.0-or-later for code, CC BY-SA 4.0 for documentation) and retain their copyright. There is no CLA and no copyright assignment at this time.
4. **TODO (future decision, own ADR):** evaluate releasing protocol test vectors and normative spec fragments under **CC0 1.0** so independent implementations — including permissively-licensed ones — can embed them without copyleft obligations. Due before test vectors are first published (Gate E / Phase 4).
5. This decision records intent and rationale; **it is not legal advice**, and the license texts are authoritative.

## Consequences

- Anyone distributing modified FreeLayer builds, or offering modified network-facing components (relays, hosted web bundles) to users over a network, must make their modified source available under the same terms. Closed forks are license violations, not just norm violations.
- Some organizations categorically avoid AGPL code; this will cost FreeLayer certain adopters and embedders. Accepted deliberately — those adoption patterns (closed embedding) are the ones the project chose to discourage.
- All future dependencies must be AGPL-compatible (permissive licenses are; reciprocal terms need case-by-case checking). This becomes a dependency-review criterion, and the license allowlist TODO in `dependency-review.yml` can now be specified.
- "Or-later" delegates future license evolution to FSF-published successor versions; users may follow AGPL v3 or any later version.
- If the ecosystem later needs a permissively-licensed SDK or spec for interoperability, that is possible only for code the project holds rights to relicense — a reason to keep the inbound = outbound model simple and to decide the CC0 test-vector question early.
- Enforcement burden falls on copyright holders (maintainers and contributors); the license deters but cannot prevent violations.

## Security impact

- Derivatives that reach users must ship corresponding source, preserving public auditability — the security property this project depends on most.
- The license cannot guarantee compliance; unauditable violating forks may still exist. FreeLayer's defense remains verifiable official builds (signed releases, Phase 11), not the license alone.

## Privacy impact

- The share-source obligation makes it materially harder to distribute a privacy-weakened fork (added telemetry, hidden endpoints) without detection, since the modified source must be published to comply.
- Honest limitation: the license does not stop a bad actor from violating it, and it does not protect users who choose to run non-compliant forks. Naming/trademark protection against misleading forks is a separate, unresolved question — **TODO** for a future governance decision.

## Contributor impact

- Contributors retain copyright and license inbound = outbound; no CLA, no assignment paperwork.
- Contributed code is permanently copyleft: contributors should not expect their FreeLayer contributions to be reusable in closed products, including their own.
- Documentation contributors accept CC BY-SA 4.0's attribution and share-alike terms.
- A future decision to adopt a DCO (sign-off) for provenance tracking is left open — **TODO**, GOVERNANCE-level review.

## What would require a new ADR

- Any relicensing or dual-licensing of code, in whole or in part (including a permissive SDK carve-out).
- The CC0 decision for protocol test vectors and spec fragments (mandatory future ADR, before first publication).
- Adopting a CLA, copyright assignment, or DCO requirement.
- Changing the documentation license or its scope.
- Granting any party a license exception.
