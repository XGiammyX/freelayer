# Identity Firewall

> **Status: local scaffolding implemented ([TECH-ID-03](adr/ADR-0013-identity-firewall-architecture.md)); NO cryptographic identity.** TECH-ID-03 adds `@freelayer/identity` — **local, non-cryptographic, metadata-only** scaffolding: private local identity roots (never peer-facing), optional personas (NOT guaranteed unlinkable), pairwise relationship + room identity-binding **placeholders**, exhaustive lifecycle validators, policy-gated commands (each requiring an authentic exact-scope `PolicyDecision`), a pure deterministic reducer, and **memory/null repositories**. There is still **no** identity key, signature, recovery, invite, per-contact/per-room alias, device key, device passport, key transparency, QR verification, or verified-identity claim. Cryptography remains **Gate F**, wire formats **Gate E**, sync **Gate H**. See [IDENTITY_ARCHITECTURE.md](IDENTITY_ARCHITECTURE.md). Next: **TECH-ID-04 — Ephemeral Identity**. **DevicePosture is not identity**; a `RoomMemberRef` is not identity proof. **Not safe for real secrets.**

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

## Ephemeral identity (TECH-ID-04)

`@freelayer/identity` now includes an **independent, current-process, non-recoverable, non-cryptographic** ephemeral identity root context (`packages/identity/src/ephemeral/`). It is NOT a persona, alias, guest name, a normal root with a hidden flag, a recoverable short-lived account, an anonymity guarantee, or a remote-deletion mechanism. It binds to an injected **process epoch** (invalid across restarts), has a **bounded local lifetime** (injected clock; lifetime can only be shortened), **fail-closes on expiry** (epoch mismatch / passed deadline / backward clock), and is **atomically destroyed** locally — destruction claims **no media sanitization, no remote deletion, and no forensic erasure**. No recovery, no promotion to long-lived, no parent link, no export, no synchronization, no persistence, no peer-facing alias. **DevicePosture is not identity. Not safe for real secrets.**

## Per-contact aliases (TECH-ID-05)

`@freelayer/identity` now includes **local, relationship-scoped, non-cryptographic, metadata-only** per-contact alias foundations (`packages/identity/src/aliases/`) in two distinct classes. An alias is **NOT identity, NOT verification, NOT authentication, NOT a public username, and NOT a cryptographic identifier**; it does **not** prove a person controls a key.

- **Pairwise presentation alias** (`PairwisePresentationAliasV1`): a relationship-scoped, local-only display name for how the LOCAL user presents within ONE pairwise relationship. In TECH-ID-05 it is **not shared over any network** (`sharingState:"not_shared_tech_id_05"`), **not authenticated** (`authenticatedBinding:"not_implemented_gate_f"`), and not remotely updatable (Gate E/F). Lifecycle `draft_local → active_local_unshared → retired_tombstone` (terminal); ≤1 active per relationship. Rotation retires the old alias and creates a new active-local-unshared one, preserving the relationship id / block state / trust state; there is **no remote deletion and no authenticated update**.
- **Local peer label** (`LocalPeerLabelV1`): a PRIVATE note the local user attaches to a contact — `visibility:"local_only"`, `peerShared:false`, no authority, no verification evidence. **A local peer label is NEVER sent to the peer.** Lifecycle `active_local_private → cleared_tombstone` (record removed, no retained text); ≤1 active per relationship.

Normalization applies Unicode NFC + whitespace trim and rejects dangerous control / bidi-override / bidi-isolate / selected zero-width / NUL code points (1–64 scalars, ≤256 UTF-8 bytes); it **retains** ZWJ (U+200D) / ZWNJ (U+200C) for Persian/Devanagari/emoji and does **not** case-fold, transliterate, block whole scripts, or detect confusables (not UTS #39). Normalization is **not** proof an alias is safe. Local reuse assessment emits a privacy **warning only** when the same normalized value is reused across relationships — it never denies, merges, exposes other relationship ids/counts, or emits telemetry; a unique value is not proof of unlinkability and a reused value is not proof identities are linked. Policy is strictest-wins with memory/null retention: Bunker/Emergency deny expansive alias writes; Ghost/Bunker/Emergency deny local peer labels; retire/clear/display stay available (Emergency allows only retire/clear/display_context.read). Remote sharing, public directory, global username, authentication, cryptographic binding, notifications, telemetry, and AI are **structurally unavailable** (7 `identity.alias.*` exact-scope PolicyDecision scopes; guardrail `check:no-contact-alias-bypass`). Deferred: crypto (Gate F), wire formats/exchange (Gate E), the full Identity Firewall (Gate G), sync (Gate H). Secure Device / ScreenShield / anti-spyware stays **externalized** — core keeps only contracts, policy inputs, and honest disclosures. Room membership is not identity proof. **DevicePosture is not identity. Not safe for real secrets.**

## Per-room aliases (TECH-ID-06)

`@freelayer/identity` now includes **local, room-scoped, non-cryptographic, metadata-only** per-room alias foundations (`packages/identity/src/room-aliases/`). A room alias is **NOT identity, NOT membership, NOT a role, NOT verification, NOT a `RoomMemberRef`, and NOT a global username**; a room role is not proof of identity, a name collision is not proof of impersonation, and disambiguation is not verification. Five concepts are kept strictly separate:

- **Room presentation alias** (`RoomPresentationAliasV1`): the local presentation chosen for ONE identity room binding in ONE room. In TECH-ID-06 it is **not shared over any network** (`sharingState:"not_shared_tech_id_06"`), **not authenticated** (`authenticatedBinding:"not_implemented_gate_f"`), and not remotely updatable (Gate E/F). Lifecycle `draft_local → active_local_unshared → retired_tombstone` (terminal); ≤1 active per binding. Rotation retires the old alias and creates a new active-local-unshared one, preserving the room identity binding / room membership / role / assurance; there is **no remote deletion, no authenticated update, and no historical-message relabelling**.
- **Room identity binding** (root/persona ↔ room): binds a root or persona to a room — **not a role and not personhood proof**. `RoomIdentityBindingV1.roomAliasState` migrates from the `"not_implemented_tech_id_06"` placeholder to `RoomAliasBindingStateV1` (`"none" | "local_alias_v1" | "retired"`); the alias record is authoritative and there is **no direct RoomOS membership mutation**.
- **Room membership** (RoomOS authorization): a SEPARATE concern owned by RoomOS; an alias never grants, mutates, or implies membership.
- **Room member display context**: role / state / assurance carried as SEPARATE fields from the alias text — never derived from, or folded into, the chosen name.
- **Trust / verification**: NEVER derived from alias text.

Normalization **reuses the TECH-ID-05 Unicode pipeline unchanged** (NFC + whitespace trim; rejects dangerous control / bidi-override / bidi-isolate / selected zero-width / NUL code points; retains ZWJ (U+200D) / ZWNJ (U+200C); not UTS #39, no confusable detection) — baseline Unicode validation is **not** full spoofing prevention. There is **no automatic reuse** from a contact alias, persona label, another room, a root id, or a `RoomMemberRef`. Room-local duplicate-name detection forces **safe disambiguation** — never `alias_only` on a duplicate, and never exposing a root / global / phone / email / raw-membership id. Cross-room reuse emits a **local redacted warning only** (no room ids or counts); it never denies, merges, or exposes other rooms. Policy is strictest-wins with memory/null retention: Bunker/Emergency deny expansive room-alias writes. Network sharing, authenticated binding, public directory, global username, persistence, notification, telemetry, and AI are **structurally unavailable** (6 `identity.room_alias.*` exact-scope PolicyDecision scopes; +12 Policy Matrix rows, 253 specs → 1771 rules; guardrail `check:no-room-alias-bypass`; 37 new tests, 711 total). Deferred: wire formats/exchange (Gate E), crypto (Gate F), the full Identity Firewall (Gate G), sync (Gate H). Secure Device / ScreenShield / anti-spyware stays **externalized** — core keeps only contracts, policy inputs, and honest disclosures. Room membership is not identity proof. **DevicePosture is not identity. Not safe for real secrets.**
