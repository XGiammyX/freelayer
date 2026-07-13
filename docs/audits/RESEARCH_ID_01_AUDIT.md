# RESEARCH-ID-01 — Research Audit Report

- **Date:** 2026-07-13
- **Branch:** `research/identity-competitor-threat-model` (stacked on `tech/sensitive-room-secure-device-contract` / TECH-23)
- **Base commit:** `ed3eb4d`
- **Task type:** research + threat modeling + roadmap reconciliation (documentation only)
- **Verdict:** ✅ **Complete**

## TECH-23 status

Present; PR **#48** OPEN (all CI checks green, not merged). RESEARCH-ID-01 is stacked on the TECH-23 branch and isolates documentation commits. See [RESEARCH_ID_01_PRECHECK.md](RESEARCH_ID_01_PRECHECK.md).

## Commands run

`git status` / `branch` / `rev-parse` / `log`; identity code + doc greps (no identity implementation found). Documentation-affecting checks re-run at final verification: `check:policy-docs`, `check:policy-conflicts` (incl. Trust Center overclaim scan), `check:doc-links`, plus `typecheck` / `lint` / `test` / `build` (a script comment/allowlist was touched). Full guard suite was green on the TECH-23 base.

## Research sources & methodology

Offline (no internet); authoritative standards/competitor knowledge, evidence-tagged (marketing / product-docs / protocol-spec / source / audit / independent) with re-verification flagged. Documents:

- Standards: [IDENTITY_STANDARDS_RESEARCH.md](../research/IDENTITY_STANDARDS_RESEARCH.md) — NIST SP 800-63-4, W3C DID Core, W3C VC, WebAuthn/FIDO2, MLS (RFC 9420).
- Competitors: [IDENTITY_COMPETITOR_MATRIX.md](../research/IDENTITY_COMPETITOR_MATRIX.md) — Signal, Matrix/Element, SimpleX, Session, Briar (+ one peer/local-first system); full field matrix + per-competitor deep analyses.
- Terminology: [IDENTITY_TERMINOLOGY_MODEL.md](../research/IDENTITY_TERMINOLOGY_MODEL.md).
- Threats: [RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md).
- Decision inputs & candidate models: [IDENTITY_ARCHITECTURE_DECISION_INPUTS.md](../research/IDENTITY_ARCHITECTURE_DECISION_INPUTS.md).
- Conclusions: [RESEARCH_ID_01_CONCLUSIONS.md](../research/RESEARCH_ID_01_CONCLUSIONS.md).

## Standards covered

NIST SP 800-63-4 (IAL/AAL/FAL separation; FreeLayer is self-asserted IAL0 by default); W3C DID Core 1.0 (+1.1 status) — evaluate only, do not adopt; W3C VC — reference-only/reject absent a concrete need; WebAuthn/passkeys — local authenticator reference, not an identity root; MLS — future group-crypto input only. No standard was selected.

## Competitors covered

Signal, Matrix/Element, SimpleX, Session, Briar (+ one peer/local-first). Marketing vs. protocol vs. source vs. audit evidence distinguished; dates and uncertainty flagged.

## Terminology decisions

Person / local identity / identity root / profile / alias (per-contact, per-room) / member reference / device / device key / device passport / DevicePosture / contact / trust record / verification / recovery / authentication / real-world identity proofing kept **distinct**. Verification = key-control assurance, not personhood.

## Threat categories

Correlation & privacy; impersonation & key substitution; multi-device; recovery; alias; invite; trust & verification; local storage; server & directory; abuse & Sybil; endpoint boundary (external — Secure Device). Severity/likelihood table + gate mapping included in the threat model.

## Candidate models

A (global key), B (root + pairwise aliases), C (independent personas), D (fully ephemeral), optional E (DID — rejected). Multi-axis qualitative scoring + narrative verdict; no decision by score alone.

## Preliminary recommendation

Non-binding: **private local root → optional personas → per-contact/per-room aliases → subordinate revocable device keys → local Trust Notebook → narrow one-time invites → offline recovery**; no phone/email, no directory, no globally visible root, no administrator/master recovery key; DevicePosture separate from identity. Subject to TECH-ID-02.

## Unresolved questions

Root visibility & persona unlinkability; multi-device approval & device passports; recovery model & assurance disclosure; key-transparency appropriateness without central infra; introduction/verification semantics; invite format; identity-metadata sync; Ghost/Bunker persistence; abuse control without phone/email. Classified in the decision-inputs doc.

## Documentation corrections

Added explicit research/not-implemented status to `docs/IDENTITY_FIREWALL.md` (expanded), `docs/PBOM.md`, `docs/TRUST_CENTER.md`, `docs/THREAT_MODEL.md`, `docs/PRIVACY_MODEL.md`, `docs/METADATA_MODEL.md`, `docs/STORAGE_MODEL.md`, `docs/GLOSSARY.md`; roadmap marks RESEARCH-ID-01 (next: TECH-ID-02); an **Identity Architecture Gate** was added to `docs/IMPLEMENTATION_GATES.md`; a minimal docs-honesty check (`check:policy-docs`) now asserts the Identity Firewall stays honest and keeps DevicePosture separate from identity. No dangerous overclaim was found or introduced.

## PBOM / Trust Center status

Honest: no verified identity, device passport, key transparency, QR verification, recovery, or secure identity storage claimed; no phone/email/central account; `RoomMemberRef` explicitly not identity; overclaim scanner passes.

## Secure Device separation

Preserved. DevicePosture remains an external environment attribute, never identity.

## Scope compliance

No identity/crypto/recovery/invite/device-passport/DID/VC/login/directory implementation; no algorithm selected; no runtime dependency added; no production behavior changed (only documentation + one allowlist/comment in a doc-consistency script). DevicePosture not treated as identity; Secure Device externalized.

## Verdict

**Complete.** All §31 acceptance criteria met. Next: **TECH-ID-02 — Identity Architecture ADR** (not started).
