# Identity Firewall

> **Status: architecture decided ([ADR-0013](adr/ADR-0013-identity-firewall-architecture.md)); implementation NOT started.** No identity is implemented. There is **no** identity key, recovery, invite, alias, persona, device key, device passport, key transparency, QR verification, or verified-identity claim in FreeLayer today. TECH-ID-02 decided the architecture (private local root → optional personas → pairwise relationships → room-scoped aliases → subordinate device authorization → local Trust Notebook → one-time invites → offline recovery; no public directory, no phone/email, no admin/master recovery key; DevicePosture kept separate from identity). Cryptography remains **Gate F**, wire formats **Gate E**, sync **Gate H**. See [IDENTITY_ARCHITECTURE.md](IDENTITY_ARCHITECTURE.md). The next step is **TECH-ID-03 — Local Identity Scaffolding** (not started). This page records vocabulary, goals, and status — not a shipped system.

The **Identity Firewall** is FreeLayer's boundary between *who a member is* (identity, verification, contact linkage) and *what a local relationship or environment signal is allowed to imply*. Today, member/device references are **local, unverified placeholders**; a room membership authorizes nothing by itself; DevicePosture is an external environment attribute. This page fixes the invariants other subsystems must respect so no non-identity signal is ever mistaken for identity.

## Invariants (never violated)

```
A key is not a person.
A profile name is not a verified identity.
A device is not a person.
Membership (RoomMemberRef) is not identity.
DevicePosture is not identity — a hardened device is not a verified person.
A verified key relationship is not proof of a legal identity.
Network anonymity is not identity verification.
```

## Terminology

Identifiers, profiles, aliases, member references, devices, authenticators, trust records, recovery, and real-world identity proofing are **distinct** concepts. See the full [Identity Terminology Model](research/IDENTITY_TERMINOLOGY_MODEL.md). Every identity feature must carry a status tag: `research` / `planned` / `future gate` / `not implemented` / `placeholder`.

## Intended privacy goals (future, not implemented)

- No phone number, no email, no central identity database, no universal public account identifier.
- No administrator recovery backdoor and **no project-owned master key**.
- Local and ephemeral identities; optional independent personas.
- Per-contact and per-room aliases; the identity root is never globally exposed.
- Profile presentation is separate from cryptographic identity.
- Subordinate, revocable device keys; explicit key/device-change warnings.
- Local trust records (Trust Notebook); narrowly scoped, expiring, single-use invites.
- Fail-closed on unknown identity state; identity secrets never logged.
- Recovery clearly discloses any reduction in assurance.
- Ghost/Bunker persistence restrictions on identity data.

## Current status (honest)

| Capability | Status |
| --- | --- |
| Verified identities | **not implemented** (Gate G) |
| Identity keys / cryptographic aliases / unlinkable personas | **not implemented** (Gate F/G) |
| Device keys / device passport | **not implemented** (future design) |
| Key transparency | **not implemented / research** (may be inappropriate without central infra) |
| QR verification | **not implemented** (design contract only) |
| Recovery (any form) | **not implemented** (research; no admin/master key ever) |
| Secure identity storage | **not implemented** (Gate F) |
| Anti-impersonation guarantees | **none** |
| Multi-device trust | **not implemented** (research) |
| Local unverified membership (`RoomMemberRef`) | **present** — placeholder, authorizes nothing |

## Unresolved architecture questions (for TECH-ID-02)

Root visibility, global vs. pairwise identifiers, alias uniqueness/scope, persona unlinkability, device approval & passports, device/last-device loss, recovery model & assurance disclosure, key-change approval, key-transparency appropriateness, introductions & verification semantics, invite scoping/revocation, spam control without phone/email, blocking across alias changes, trust-record representation, which identity metadata may sync, Ghost/Bunker persistence, Identity Firewall × DevicePosture, identity × Sovereign Room membership, room-alias survival across export/import. Each is classified in [IDENTITY_ARCHITECTURE_DECISION_INPUTS.md](research/IDENTITY_ARCHITECTURE_DECISION_INPUTS.md).

## Research package

- [Terminology model](research/IDENTITY_TERMINOLOGY_MODEL.md)
- [Standards research (NIST SP 800-63-4, DID, VC, WebAuthn, MLS)](research/IDENTITY_STANDARDS_RESEARCH.md)
- [Competitor matrix (Signal, Matrix, SimpleX, Session, Briar)](research/IDENTITY_COMPETITOR_MATRIX.md)
- [Identity threat model](audits/RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md)
- [Architecture decision inputs (38 questions + candidate models + recovery/multi-device/Trust Notebook)](research/IDENTITY_ARCHITECTURE_DECISION_INPUTS.md)
- [Research conclusions](research/RESEARCH_ID_01_CONCLUSIONS.md)
