# ADR-0013 — Identity Firewall Architecture

## 1. Status

**Accepted** (architecture decided). Local, non-cryptographic **scaffolding began in TECH-ID-03** (`@freelayer/identity`); keys/aliases/devices/invites/recovery/sync remain unimplemented (Gates F/E/H). Supersedes nothing; establishes the identity architecture that TECH-ID-03 and all later Identity Firewall tasks must follow. Cryptography, wire formats, and synchronization remain deferred to Gates F, E, and H respectively. This ADR decides *structure and invariants*, not algorithms.

Evidence base: [RESEARCH-ID-01](../research/RESEARCH_ID_01_CONCLUSIONS.md) (standards, competitor matrix, threat model, terminology, decision inputs) and [TECH-ID-02 source validation](../research/TECH_ID_02_SOURCE_VALIDATION.md). Companion documents: [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) (diagrams + entities), and the TECH-ID-02 [threat review](../audits/TECH_ID_02_IDENTITY_ARCHITECTURE_THREAT_REVIEW.md), [metadata review](../audits/TECH_ID_02_IDENTITY_METADATA_REVIEW.md), and [boundary audit](../audits/TECH_ID_02_IDENTITY_BOUNDARY_AUDIT.md).

## 2. Context

FreeLayer is a private, decentralized, **accountless** messenger. It requires an identity model with **no phone/email**, **no central identity database**, **no universal public account identifier**, and **no administrator recovery backdoor**, while still supporting contacts, rooms, multiple devices, verification, and recovery. RESEARCH-ID-01 showed that the strongest evidence for accountless operation comes from **SimpleX** (no global user ID; pairwise connection identities) and **Briar** (local identity; offline exchange), and that the sharpest hazards are **correlation** (global identifiers), **recovery-as-backdoor**, **multi-device assurance loss**, and **term collapse** (treating a key/profile/device/membership/DevicePosture as identity). This ADR converts those findings into one coherent architecture.

## 3. Decision drivers

- Privacy & unlinkability first; correlation is the primary threat.
- Accountless, local-first, serverless; no project-owned infrastructure ([ADR-0001](ADR-0001-no-project-owned-infrastructure.md)).
- Fail-closed on unknown identity state.
- Honesty: no assurance is claimed that is not met (no NIST IAL/AAL labels; self-asserted by default).
- Separation of concerns: identity ≠ membership ≠ device ≠ DevicePosture ≠ profile ≠ personhood.
- Crypto deferred until reviewed ([ADR-0004](ADR-0004-no-crypto-implementation-before-review.md)); this ADR must not invent crypto.
- Implementability: precise enough for TECH-ID-03 type-safe *local* scaffolding without re-deciding architecture.

## 4. Terminology

This ADR uses the [Identity Terminology Model](../research/IDENTITY_TERMINOLOGY_MODEL.md) verbatim. Key terms: **Local Identity Root** (private local authority), **Persona** (presentation/policy context under one root), **Pairwise Relationship** (per-contact relationship + peer-facing pairwise identifier), **Room Identity Binding** (root/persona ↔ room ↔ room alias ↔ RoomOS membership), **Device Authorization** (subordinate, revocable device grant), **Trust Notebook / Trust Record** (local observations), **Recovery Configuration** (offline-first restoration), **Invite Authority** (scoped one-time invite), **verification** (proof of a *specific claim* such as key control, **not** personhood). **Real-world identity proofing is not implemented by default.**

## 5. Selected architecture

```
Private Local Identity Root
 → optional Personas
 → Pairwise Contact Relationships
 → Room-scoped Aliases (Room Identity Bindings)
 → subordinate Device Authorizations
 → local Trust Notebook
 → scoped one-time Invites
 → offline Recovery Kit
 → no public directory by default
```

An installation may hold **multiple independent identity roots** (`IdentityVault`). This is the accepted default; deviations are recorded in §18/§29. It matches the SimpleX/Briar evidence (pairwise, local, offline) while adding a private root for continuity, optional personas for organization, and independent roots for strong context separation.

## 6. Logical components

Architecture-level entities (no production interfaces created by this ADR; see the non-implementational type appendix in [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md)):

`IdentityVault` · `LocalIdentityRoot` · `Persona` · `PairwiseRelationship` · `RoomIdentityBinding` · `DeviceAuthorization` · `TrustNotebook` · `TrustRecord` · `RecoveryConfiguration` · `InviteAuthority` · `IdentityPolicy`.

```
IdentityVault
├── LocalIdentityRoot
│   ├── Persona
│   │   ├── PairwiseRelationship
│   │   └── RoomIdentityBinding
│   ├── DeviceAuthorization
│   ├── RecoveryConfiguration
│   └── TrustNotebook
└── IndependentIdentityRoot
    └── isolated personas, relationships, devices, recovery
```

## 7. Identifier model

- The **identity root is a private local controller**, never a public username or globally shared account ID, and **not exposed** in routine contact/room/discovery flows.
- **No universal public account identifier** exists by default. **No global root public key** is reused across unrelated relationships by default.
- **Pairwise relationship identifiers** are scoped to exactly one relationship; **room aliases** are scoped to exactly one room. Neither is globally searchable.
- Exact identifier construction and key derivation are **Gate F**; the ADR requires only that derivation must **not** create avoidable cross-relationship correlation and must **not** use display aliases as cryptographic identifiers.

## 8. Persona & alias model

A **Persona** is *a local presentation and policy context controlled by one local identity root*. It may hold: local label, local avatar reference, default display profile, default privacy policy, relationship grouping, room-alias defaults. It must **not** hold: phone/email requirement, global searchable username, public root identifier, implicit real-world identity claim, or DevicePosture evidence.

Rules: persona names need not be unique and are **not authority**; **personas under one root are NOT guaranteed cryptographically unlinkable** (they are organizational/presentation separation); cross-persona linking requires **explicit user action**; peers do not learn shared-root relationships by default; sensitive local UI may disclose shared-root contexts where relevant. **Independent identity roots** (not personas) are the architectural basis for stronger, recovery- and device-isolated context separation.

## 9. Relationship model (pairwise)

Each contact relationship is a `PairwiseRelationship` = local contact record + peer-facing pairwise identifier + scoped presentation + trust history + block state + key-continuity state. It is unique to one relationship; **not reused across contacts**, not reused as a room alias by default, not globally searchable, and there is **no public directory**. The display alias may change **without** changing the relationship record; **block state survives display-alias changes**. Verification binds to relationship-specific key state. A relationship identifier alone does **not** prove real identity; deletion/tombstone makes **no** remote/forensic-erasure claim.

## 10. RoomOS membership binding

A `RoomIdentityBinding` binds one root/persona ↔ one Sovereign Room ↔ one room-scoped alias ↔ one RoomOS membership (`RoomMembershipRecordV1`) ↔ future room-specific key state. Rules: room aliases are **not global**; room participants do **not** receive the private root identifier; two room aliases are **not linkable through reusable root material by default**; one persona may use different aliases in different rooms; **RoomOS membership remains separate from identity verification** and a RoomOS role does **not** prove identity ownership. Room export must **not** expose unrelated relationship identifiers (export/bundle semantics stay deferred to RoomOS/CapsuleNet).

## 11. Multi-device model

Hierarchy: `LocalIdentityRoot` **authorizes** independent `DeviceAuthorization` records; **each future device has independent key material** (Gate F). Properties: no single device identifier shared across unrelated contexts by default; authorization is **revocable**; device removal changes local authorization state; **a device cannot authorize another device unless explicitly allowed**; adding a device requires **explicit approval**; device scope may later be identity-wide / persona-limited / relationship-limited / room-limited / read-only; **lost/removed devices must not remain silently trusted**; history access and device authorization are **separate** decisions. **DevicePosture may tighten** an authorized device's permissions but **cannot authorize** a device. The term **Device Passport** denotes a *future signed root↔device authorization relationship* only — it implies **no** hardware attestation, no real-world passport, no endpoint safety, no public stable device ID, and **no implementation today**.

## 12. Verification semantics

**No generic `verified: true` boolean.** Architecture-level trust states (FreeLayer-specific labels, **not** NIST IAL/AAL): `unverified`, `continuity_observed`, `out_of_band_verified`, `introduced_unverified`, `key_change_warning`, `device_change_warning`, `recovered_reverification_required`, `compromised_suspected`, `revoked`.

- **Out-of-band verification** may later confirm control of relationship-specific key material and continuity with a party contacted via a separate channel. It does **not** prove legal name, government identity, a safe device, absence of coercion, or future key security.
- **Introduction** = a known contact claims another relationship belongs to a party; it is **not** equivalent to direct verification (`introduced_unverified`).
- **Key/device change** must update the Trust Notebook, **invalidate incompatible prior verification**, require an explicit warning, and may block sensitive communication until reviewed. Verification never silently survives incompatible key/root changes.

## 13. Recovery model

**Offline-first, no server, no admin, no master key.** Default: **Offline Recovery Kit** + optional approval from an existing authorized device. The Recovery Kit is an architecture concept only (may later hold encrypted identity authority material, version/checksum metadata, recovery policy, an encrypted relationship manifest, human-readable warnings — **no formats/algorithms decided**).

Mandatory rules: **no FreeLayer-controlled master key**; **no silent server recovery**; no email/SMS dependency; no recovery without explicit user-held material or an authorized device; recovery yields **`recovered_reverification_required`**; high-assurance contacts are warned; old device authorizations are reviewed or invalidated; recovery does **not** silently restore verification; **compromised recovery material = identity compromise**; recovery availability/privacy trade-offs are disclosed; Ghost/ephemeral identities may choose **no recovery**. Deferred (evaluated, not chosen): threshold/social recovery, hardware-backed recovery, cold-root approval, recovery-kit splitting, encrypted optional backup transport.

## 14. Invite model

**One-time, capability-limited, revocable invites** are the default connection mechanism. An `InviteAuthority` binds: intended action, issuer identity context, intended persona/room, **maximum authority**, expiration policy, single-use state, revocation state, optional recipient binding, and a transport-independent payload reference. Classes (future): `contact_request`, `room_join_request`, `room_viewer_invite`, `room_member_invite`, `device_link_request`, `identity_verification_request`. Rules: **no wildcard authority**; room invites do **not** expose the private root; contact invites do **not** reveal unrelated aliases; **forwarding risk is explicitly modeled**; expired/revoked/used invites **deny**; acceptance still requires current policy + user action; token format is **Gate E/F**; **no public invite directory**.

## 15. Trust Notebook model

A **local, privacy-sensitive** record of observations: first contact, connection method, identity/persona scope, relationship identifier, verification event + channel, introduction, key change, device change, recovery event, warning, block/revocation, local user note. Rules: entries **distinguish facts vs. peer claims vs. local notes**; notes are **not** security evidence; **no** universal trust score, **no** automatic reputation, **no** server upload, **no** telemetry, **no** plaintext persistence; strict modes may use memory/null behavior; **imported records are untrusted until reviewed**; it claims **no** legal proof. Immutable-history vs. deletion trade-offs remain unresolved (deferred).

## 16. Storage & metadata requirements

Data classification (architecture-level) with policy direction — see the full table in [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) and the [metadata review](../audits/TECH_ID_02_IDENTITY_METADATA_REVIEW.md):

- **Secrets** (`identity_root_secret_future`, `relationship_secret_future`, `device_secret_future`, `recovery_material_future`, `invite_secret_future`): never plaintext, never logs, never telemetry, never external assets; **encrypted persistence only after Gate F**; Ghost/Bunker restrictions apply.
- **Relationship/trust metadata** (`persona_profile`, `pairwise_relationship`, `room_identity_binding`, `device_authorization`, `trust_notebook`, `verification_record`, `block_relationship`, `recovery_configuration`, `identity_tombstone`): privacy-sensitive; no project server, no public directory, no analytics, no automatic export; strict-mode minimization.
- **Recovery material**: never cached in ordinary UI state; no default clipboard (future protected flow); no notifications; no cloud upload by default; Secure Device protected presentation is a future integration. **No storage implementation in TECH-ID-02.**

## 17. Failure behavior

Fail-closed for: missing root, unknown identity version, missing persona, unknown relationship, stale alias, unrecognized device, key-change warning, recovery state, compromised-suspected, missing verification, invite replay, room-binding mismatch, DevicePosture unavailable. Invariants: unknown identity cannot silently become trusted; a **recovered identity cannot retain high-assurance verification automatically**; an unrecognized device cannot inherit full authority; a room-alias mismatch denies membership-sensitive actions; **missing DevicePosture cannot change identity status**; endpoint risk may *restrict* operations but cannot alter identity history.

## 18. Rejected alternatives

Explicitly evaluated and rejected/deferred (benefit / cost / reason in [IDENTITY_ARCHITECTURE.md §Rejected](../IDENTITY_ARCHITECTURE.md) and the [audit](../audits/TECH_ID_02_IDENTITY_ARCHITECTURE_AUDIT.md)): phone/email as primary identity; a global public key shown to all peers; one mandatory global username; a public searchable directory; one identity root copied unprotected to every device; server-controlled / administrator recovery; a project-owned master key; profile name as verification; `RoomMemberRef` as identity; DevicePosture/device-model as identity; automatic trust after recovery; a single verification boolean; a **DID method as an initial requirement**; **Verifiable Credentials** in the initial architecture; **passkeys/WebAuthn as the identity root**; **key transparency** now; central reputation as the abuse solution.

## 19. Deferred decisions

- **Gate F (crypto):** root-key type; relationship-key derivation; persona isolation; room-scoped credential derivation; device-key authorization; device-passport signature format; key rotation/revocation; verification fingerprints/codes; invite authentication; recovery encryption; forward-secrecy interaction; MLS/application-credential mapping; Capsule identity serialization.
- **Gate E:** invite/QR wire formats; Capsule identity format.
- **Gate H:** synchronization of personas/relationships/Trust-Notebook/device-auth/block-lists/alias-changes/recovery-state/invite-state/revocations/room-bindings. **Local identity state is authoritative only for the current local vault; no distributed consistency or revocation is claimed.** No CRDT designed here.
- **Contact discovery:** any future optional username/discovery system requires a separate research + privacy gate; **v1 has no public searchable directory** (§ IDENTITY_ARCHITECTURE).

## 20. Security consequences

Pairwise + room-scoped identifiers reduce correlation; subordinate revocable device authorization limits lost-device blast radius; claim-specific verification + key-change warnings resist silent key substitution; offline user-held recovery removes the server/admin backdoor class. **Residual (honest):** root compromise can reveal a user's own relationship mapping; recovery-material compromise ≈ identity compromise; distributed revocation is deferred (a removed device may persist on unreachable peers); endpoint compromise is outside Identity Firewall scope (Secure Device, external). No spyware-proof/capture-proof/anti-impersonation guarantee.

## 21. Privacy consequences

No phone/email, no public directory, no globally visible root, no universal identifier → strong default unlinkability. Personas are organizational only (not guaranteed unlinkable) — this is disclosed to avoid false confidence. Independent roots provide the real separation and are recommended for ephemeral/Ghost use. Trust/relationship metadata stays local and minimized; strict modes minimize further. The unavoidable **unlinkability ↔ Sybil-resistance tension** is documented, not pretended solved.

## 22. Usability consequences

Costs: users must manage invites/verification (no directory shortcut); multi-device linking needs explicit approval; recovery is user-held (loss is possible; Ghost identities may forgo recovery); persona-vs-root distinction must be surfaced clearly so users don't assume unlinkability. Mitigations belong to later UX tasks (TECH-ID-11/13); this ADR fixes semantics, not screens.

## 23. Migration & versioning

Every architecture entity carries a schema version; unknown versions **fail closed**. There is no legacy identity data to migrate (none exists). Future changes to identifier/verification/recovery semantics require a superseding ADR ([ADR-0010](ADR-0010-documentation-updated-with-code.md) applies: docs update with code). Identity tombstones are local and versioned.

## 24. Implementation sequence

```
TECH-ID-03 — Local Identity Scaffolding   (local, type-safe, no crypto)
TECH-ID-04 — Ephemeral Identity
TECH-ID-05 — Per-Contact Aliases
TECH-ID-06 — Per-Room Aliases
TECH-ID-07 — Device Key Model             (needs Gate F)
TECH-ID-08 — Device Passport              (needs Gate F)
TECH-ID-09 — Trust Notebook
TECH-ID-10 — One-Time Invites             (needs Gate E/F)
TECH-ID-11 — QR Verification Flow         (needs Gate E/F)
TECH-ID-12 — Recovery Kit Design          (needs Gate F + recovery threat review)
TECH-ID-13 — Recovery UX
AUDIT-ID-14 — Identity Regression Tests
```

Prerequisite gates: **Gate F** before any real key generation/signatures; **Gate E** before invite/QR wire formats; **Gate H** before multi-device identity synchronization; **Secure Device gate** before protected recovery rendering; a **dedicated recovery threat review** before recovery implementation.

## 25. Acceptance criteria

This ADR is complete when: a private local identity-root model is selected (§5, §7); globally exposed root identifiers are forbidden by default (§7, §8); multiple independent roots are supported (§5, §8); personas are separated from independent roots and **not** described as guaranteed unlinkable (§8); pairwise relationships (§9) and room-scoped aliases (§10) are defined; RoomOS membership stays separate from identity proof (§10); device authorization is subordinate to identity authority and DevicePosture stays separate (§11); verification is claim-specific with **no** generic boolean (§12); recovery has no admin backdoor/master key and reduces assurance (§13); invites are narrow/one-time (§14); the Trust Notebook is local and non-authoritative (§15); no phone/email and no v1 public directory (§7, §19); DID/VC/passkey/key-transparency decisions are explicit (§18, §19); crypto and sync remain deferred (§19); storage/metadata classifications exist (§16); threat-to-decision mapping exists ([threat review](../audits/TECH_ID_02_IDENTITY_ARCHITECTURE_THREAT_REVIEW.md)); rejected alternatives are recorded (§18); documentation/PBOM are honest; and **no identity/key/recovery/invite implementation or central service was added**. All are satisfied → **Accepted**.
