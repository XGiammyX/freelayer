# Identity Terminology Model (RESEARCH-ID-01)

> Status: **research**. Nothing here is implemented. This document fixes vocabulary so that identifiers, profiles, aliases, devices, authenticators, relationships, trust, and real-world identity are never used interchangeably. It is an input to **TECH-ID-02 — Identity Architecture ADR**; the ADR may rename or refine any term.

The single most common identity design failure is **term collapse** — treating a key as a person, a profile as a verified identity, a device as an actor, membership as identity, or a network property (like DevicePosture) as identity assurance. FreeLayer treats each of the following as a distinct concept with a distinct trust meaning.

## Core distinctions (the invariants)

```
A key is not a person.
A profile name is not a verified identity.
A device is not a person.
Membership is not identity.
DevicePosture is not identity.
A verified key relationship is not proof of a legal identity.
Network anonymity (e.g. onion routing) is not identity verification.
```

## Terms

| Term | Definition | What it is NOT | Status |
| --- | --- | --- | --- |
| **Person** | A human being. | FreeLayer does **not** prove personhood by default (no real-world identity proofing). | research |
| **Local identity** | A locally controlled identity root or identity profile. Not yet cryptographically specified. | Not an account, not server-registered, not globally visible. | research (Gate G) |
| **Identity root** | The future authority from which continuity may be derived. | Not a public identifier; not chosen crypto; not necessarily on every device. | deferred (Gate F/G) |
| **Profile** | Display information presented in a context (name, avatar, about). | Not unique, not verified, not an identity proof. | research |
| **Alias** | A context-specific name or identifier. | Not a global username; not verification. | research |
| **Per-contact alias** | An identifier/presentation scoped to one relationship. | Not shared across contacts; not a global handle. | research |
| **Per-room alias** | An identifier/presentation scoped to one Sovereign Room. | Not the identity root; not cross-room. | research |
| **Ephemeral identity** | An intentionally short-lived identity with limited continuity. | Not recoverable by default; not a durable account. | research |
| **Cold identity** | A protected/offline identity authority (considered later under **Ghost Vault**). | Not held by the online client; not online-recoverable. | deferred |
| **Member reference (`RoomMemberRef`)** | A **local RoomOS relationship placeholder** (TECH-16/20). | **Not identity proof**, not verified, not a key. | present (placeholder) |
| **Device** | A client instance or installation. | Not a person; not an identity. | research |
| **Device key** | A future cryptographic key associated with one device. | Not the identity root; subordinate & revocable. | deferred (Gate F) |
| **Device passport** | A future **signed relationship** between an identity root and a device. | Not implemented; not a tracking identifier by design intent. | deferred (Gate F/G) |
| **DevicePosture** | An **external environmental** security attribute (Secure Device project). | **Not identity**; a hardened device is not a verified person. | contract only (TECH-22/23) |
| **Contact** | A local relationship record. | Not a directory entry; not server-known. | research |
| **Trust record / Trust Notebook** | A **local** record of verification events, warnings, and changes. | Not a global reputation; not synced by default; not proof. | research |
| **Verification** | Confirmation of a **specific claim** (e.g. control of a key) over a specific channel. | Not universal proof of identity; not automatically transferable between aliases. | research |
| **Recovery** | Restoration or replacement of identity authority. **Recovery can reduce assurance.** | Not an admin backdoor; never a project-owned master key. | deferred |
| **Authentication** | Proof that an actor controls an authenticator. | Not identity proofing; not personhood. | research |
| **Real-world identity proofing** | Evidence linking a digital subject to a person/legal identity (NIST IAL2/3 territory). | **Not implemented by default** — FreeLayer is effectively self-asserted (IAL0). | rejected-by-default |

## Assurance separation (from NIST SP 800-63-4)

FreeLayer separates three axes that are frequently conflated:

- **Identity assurance** (is this a real, proofed person?) — **none by default**; self-asserted.
- **Authentication assurance** (does the actor control the authenticator/key?) — the only thing local cryptographic continuity can ever speak to (future).
- **Federation/assertion assurance** — **not applicable**; FreeLayer has no identity provider or federation.

A "verified" contact in FreeLayer will mean *authentication-assurance of key control over a specific channel*, **not** identity proofing.

## Usage rules for all FreeLayer docs & code

1. Never write "verified identity" when you mean "verified key control."
2. Never treat `RoomMemberRef`, a profile name, or a device as identity.
3. Never describe DevicePosture as identity or as raising identity assurance.
4. Always tag identity features with a status: `research` / `planned` / `future gate` / `not implemented` / `placeholder`.
5. Recovery text must always disclose that recovery **may reduce assurance** and never introduces an administrator/master key.

See also: [IDENTITY_STANDARDS_RESEARCH.md](IDENTITY_STANDARDS_RESEARCH.md), [IDENTITY_COMPETITOR_MATRIX.md](IDENTITY_COMPETITOR_MATRIX.md), [../audits/RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md](../audits/RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md), [IDENTITY_ARCHITECTURE_DECISION_INPUTS.md](IDENTITY_ARCHITECTURE_DECISION_INPUTS.md).
