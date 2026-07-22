# TECH-ID-02 — Identity Architecture ADR — Audit Report

- **Date:** 2026-07-22
- **Branch:** `architecture/identity-firewall-adr` (stacked on `research/identity-competitor-threat-model` → `tech/sensitive-room-secure-device-contract` → `main`)
- **Base commit:** `0948995` (tip of RESEARCH-ID-01)
- **Task type:** architecture decision (ADR) — documentation only
- **Verdict:** ✅ **Complete** (ADR-0013 **Accepted**)

## RESEARCH-ID-01 status

**Complete** and verified (PR #49 open, unmerged): standards research, competitor matrix, identity threat model, terminology model, decision inputs, conclusions all present. See [TECH_ID_02_PRECHECK.md](TECH_ID_02_PRECHECK.md).

## Sources revalidated

[TECH_ID_02_SOURCE_VALIDATION.md](../research/TECH_ID_02_SOURCE_VALIDATION.md) — NIST SP 800-63-4 (IAL/AAL/FAL; FreeLayer must not use IAL/AAL labels it doesn't meet); W3C DID/identifier privacy (pairwise principles without a DID method); Signal (verification ≠ real-world proof); Matrix (multi-device architectural lessons only); SimpleX/Briar (pairwise + offline validate the direction); Session (recovery-root coupling ⇒ recovery compromise = identity compromise); MLS/RFC 9420 (application identity stays an application responsibility). Conducted offline; re-verification flagged. **No RESEARCH-ID-01 conclusion was overturned.**

## ADR

**[ADR-0013 — Identity Firewall Architecture](../adr/ADR-0013-identity-firewall-architecture.md), status Accepted.** Companion: [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) (entity graph + 8 Mermaid diagrams + state tables + storage/metadata classification).

## Selected architecture

Private local identity root → optional personas → pairwise per-contact relationships → room-scoped aliases (RoomIdentityBinding) → subordinate revocable device authorizations → local Trust Notebook → one-time capability-limited invites → offline recovery kit → no public directory (v1). Multiple **independent identity roots** per installation.

## Key decisions

- **Identity root:** private local controller; never a public/peer-facing identifier; not exposed in discovery. No universal public account identifier; no reused global root key across unrelated relationships by default.
- **Multiple independent roots:** supported; the real basis for context separation (separate recovery + device state; cross-root linking requires explicit user action).
- **Personas:** presentation/policy contexts under one root; names are not authority; **NOT guaranteed cryptographically unlinkable** (disclosed to avoid false confidence).
- **Pairwise relationships:** per-contact identifier, not reused, not searchable, no directory; display alias may change without changing the relationship record; **block state survives alias changes**.
- **Room identity binding:** root/persona ↔ room ↔ room-scoped alias ↔ RoomOS membership; RoomOS membership stays separate from identity verification; room export never exposes unrelated relationship identifiers.
- **Devices:** subordinate revocable `DeviceAuthorization`, each with independent future key material; explicit approval; stale/removed devices fail closed; **DevicePosture may tighten but never authorizes** a device. Device Passport = future signed authorization only (no attestation, not implemented).
- **Verification:** claim-specific states (`unverified`/`continuity_observed`/`out_of_band_verified`/`introduced_unverified`/`key_change_warning`/`device_change_warning`/`recovered_reverification_required`/`compromised_suspected`/`revoked`) — **no generic `verified` boolean**; verification never silently survives incompatible key/root changes.
- **Recovery:** offline kit + optional existing-device approval; **no server, no admin, no master key**; yields `recovered_reverification_required`; recovery-material compromise = identity compromise; Ghost identities may choose no recovery.
- **Invites:** one-time, capability-limited, expiring, revocable; no wildcard authority; no public invite directory; forwarding risk modeled.
- **Trust Notebook:** local; distinguishes facts/peer-claims/notes; no reputation, no upload, no telemetry, no plaintext persistence; imported records untrusted.
- **Contact discovery (v1):** no public searchable directory, no mandatory global username, no address-book upload, no phone/email discovery.
- **DID:** rejected (v1). **VC:** out of scope. **Passkeys/WebAuthn:** not the identity root. **Key transparency:** deferred.

## Metadata / storage classification

Present ([IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) + [metadata review](TECH_ID_02_IDENTITY_METADATA_REVIEW.md)): secrets never plaintext/logs/telemetry (encrypted only after Gate F; Ghost/Bunker restricted); relationship/trust metadata local + minimized; recovery material never in ordinary UI cache/clipboard/cloud.

## Threat-to-decision mapping

Present ([threat review](TECH_ID_02_IDENTITY_ARCHITECTURE_THREAT_REVIEW.md)): each RESEARCH-ID-01 threat mapped to an ADR-0013 mitigation + residual limit + finishing gate. No complete mitigation claimed.

## Boundary audit

Present ([boundary audit](TECH_ID_02_IDENTITY_BOUNDARY_AUDIT.md)): Identity Firewall ↔ RoomOS / DevicePosture-Secure-Device / Crypto (Gate F) / CapsuleNet (Gate E) / StoragePolicy / Sync (Gate H) / Apps. Today only `RoomMemberRef` (local unverified placeholder) is identity-adjacent code; most boundaries are architecture-rules/future-gates, stated honestly.

## Rejected alternatives

Phone/email identity; global public key to all peers; mandatory global username; public directory; unprotected root on every device; server/admin recovery; project master key; profile name / `RoomMemberRef` / DevicePosture as identity; automatic trust after recovery; single verification boolean; DID method initially; central reputation. Recorded with benefit/cost/reason.

## Deferred crypto / sync decisions

Gate F (all key material, signatures, derivation, verification codes, recovery encryption, device-passport format, MLS mapping, Capsule identity serialization); Gate E (invite/QR/Capsule wire formats); Gate H (all identity synchronization — local vault authoritative only for itself; no CRDT designed).

## Documentation changes

New: ADR-0013, IDENTITY_ARCHITECTURE.md, source validation, threat review, metadata review, boundary audit, precheck, this audit. Updated (honest status): IDENTITY_FIREWALL, ARCHITECTURE, ROADMAP, IMPLEMENTATION_GATES (Identity Architecture Gate — decisions checked, code still gated on F/E/H), THREAT_MODEL, PRIVACY_MODEL, METADATA_MODEL, STORAGE_MODEL, PBOM (status table), TRUST_CENTER, GLOSSARY, SOVEREIGN_ROOMS. New guard `check:identity-docs` + CI wiring.

## Repository checks

typecheck · lint · test (555) · build · all `check:*` guards (incl. new `check:identity-docs`) · policy-matrix (195/1365) · policy-conflicts · policy-docs · doc-links · audits — expected green (documentation-only change; final verification recorded on the PR).

## Scope compliance

No identity/key/recovery/invite/device-passport/DID/VC/login/directory implementation; **no cryptographic algorithm selected**; no central identity/recovery service; no runtime dependency; no production behavior change (docs + one honesty-guard script). DevicePosture stays separate from identity; Secure Device externalized.

## Verdict

**Complete.** All §37 acceptance criteria met. Next: **TECH-ID-03 — Local Identity Scaffolding** (local, type-safe, crypto-free; not started).

## Known limitations

Personas are not cryptographically unlinkable; recovery-material compromise = identity compromise; distributed revocation deferred (Gate H); endpoint compromise external (Secure Device); unlinkability↔Sybil tension unsolved; assurance self-asserted; not safe for real secrets.
