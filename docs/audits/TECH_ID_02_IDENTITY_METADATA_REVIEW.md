# TECH-ID-02 — Identity Metadata & Correlation Review

_Scope: the metadata surfaces the Identity Firewall architecture ([ADR-0013](../adr/ADR-0013-identity-firewall-architecture.md)) creates, what each could leak, and the minimization discipline each must follow. This is a **metadata / correlation / minimization** review only — **no cryptography** is analyzed here (that is Gate F). It reads the storage & metadata classification in [ADR-0013 §16](../adr/ADR-0013-identity-firewall-architecture.md) and the [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) classification table, applies the house style of [METADATA_MODEL.md](../METADATA_MODEL.md), and is the metadata companion to the [RESEARCH-ID-01 Identity Threat Model](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md) (§1 correlation, §8 local storage) and the top-level [THREAT_MODEL.md](../THREAT_MODEL.md)._

> [!IMPORTANT]
> **No identity is implemented (Gate G).** No identity root, persona, pairwise identifier, alias, device authorization, Trust Notebook, verification record, recovery kit, invite, block, or tombstone exists in code. Every classification below is a **design-time estimate of an architecture surface**, to be re-validated against real implementations at each gate — not a measurement of shipped behavior. Identity cryptography is **Gate F**, invite/QR wire formats **Gate E**, synchronization **Gate H**, protected recovery rendering the **Secure Device** gate. This review claims **no perfect unlinkability**; it describes what the architecture minimizes and states plainly what it does not.

## Observer model

The whole review classifies each surface against three observers. FreeLayer has **no project server** ([ADR-0001](../adr/ADR-0001-no-project-owned-infrastructure.md)), but **transports exist** and are assumed hostile, so "server/relay" means *whatever courier eventually carries a payload* (relay, LAN, email/external app, QR/file/USB), labeled per [METADATA_MODEL.md](../METADATA_MODEL.md) network table.

| Observer | What it is | Governing rule |
| --- | --- | --- |
| **Peer** | A contact in a relationship, a co-member of a room, or an invite recipient | Sees only what a scoped identifier/alias/profile deliberately presents; never the private root |
| **Server / relay (transport)** | The courier operator that moves invites/capsules; no project-owned server exists | Sees ciphertext + minimal routing hint; who↔whom remains correlatable by traffic analysis (out of identity scope) |
| **Local** | The user's own vault on the user's own device | Holds the crown-jewel mapping; protected by StoragePolicy, encryption-at-rest (Gate F), and strict-mode minimization; endpoint compromise is external (Secure Device) |

---

## 1. Metadata surfaces the architecture creates

Each surface below names the ADR/IDENTITY_ARCHITECTURE data class, what a **peer** can observe, what a **transport** could observe, what stays **local**, and the specific leak the surface risks.

### 1.1 Identity root — `identity_root_secret_future`, `identity_root_public_reference_future`

- **Peer:** nothing. The root is a **private local controller**, never a peer-facing username or account ID, and **not exposed in contact/room/discovery flows** ([ADR-0013 §7](../adr/ADR-0013-identity-firewall-architecture.md)). This is an invariant, not a default.
- **Transport:** nothing. The root is never placed in an invite, room binding, or capsule.
- **Local:** the root reference (and future secret) live only in the local `IdentityVault`; the public reference is secret-adjacent (private; not a discovery identifier).
- **Leak risk:** if the root ever reached a peer or transport it would become the **global correlator** that re-links every persona, contact, and room — precisely the anti-goal. The surface's whole value is that this never happens.

### 1.2 Persona profiles — `persona_profile`

- **Peer:** the **display profile** (local label / avatar) a persona presents to a given relationship or room. A peer does **not** learn that two personas share a root ([ADR-0013 §8](../adr/ADR-0013-identity-firewall-architecture.md)). **Caveat:** a reused avatar, bio, or display name across personas is a self-inflicted content signal a peer can cluster — the architecture does not prevent this.
- **Transport:** display assets travel as **capsule content, never remote fetches** ([METADATA_MODEL.md §4](../METADATA_MODEL.md)), so a relay sees ciphertext, not the profile. Traffic correlation still applies.
- **Local:** persona grouping, default policy, `roomAliasDefaults`, and which relationships belong to which persona.
- **Leak risk:** cross-persona linkage through asset reuse. **Personas under one root are `unlinkable: false`** — organizational separation only (see §2).

### 1.3 Pairwise relationship identifiers — `pairwise_relationship`, `relationship_secret_future`

- **Peer:** the single contact on the other side sees the **peer-facing pairwise identifier scoped to exactly that relationship** ([ADR-0013 §9](../adr/ADR-0013-identity-firewall-architecture.md)). It is unique to one relationship, not reused across contacts, not reused as a room alias by default, and **not globally searchable**. Two contacts comparing notes find **no shared identifier** by default.
- **Transport:** a courier carrying the pairwise channel sees an **opaque destination + routing hint** (relay blinding is deferred to CapsuleNet); identifier construction is **Gate F** and must **not create avoidable cross-relationship correlation** nor use display aliases as cryptographic identifiers ([ADR-0013 §7](../adr/ADR-0013-identity-firewall-architecture.md)). Honest limit: who↔whom stays correlatable by traffic analysis.
- **Local:** contact record, presentation, trust history, block state, `keyContinuityState_future`.
- **Leak risk:** if pairwise identifiers were derived from shared root material they would re-correlate — Gate F must forbid that.

### 1.4 Room-identity bindings + room aliases — `room_identity_binding`

- **Peer (room participants):** the **room-scoped alias only**. Participants **do not receive the private root** ([ADR-0013 §10](../adr/ADR-0013-identity-firewall-architecture.md)); two room aliases are **not linkable through reusable root material by default**; one persona may use different aliases in different rooms. RoomOS membership (`RoomMembershipRecordV1`) stays **separate from identity verification**.
- **Transport:** routing metadata for room traffic; the binding itself is local. **Room export must not expose unrelated relationship identifiers** (export/bundle semantics deferred to RoomOS/CapsuleNet).
- **Local:** the `rootOrPersonaRef ↔ roomLocalId ↔ roomAlias ↔ membershipRef` binding and `roomKeyState_future`.
- **Leak risk:** alias reuse across rooms; an export that carries unrelated identifiers (forbidden).

### 1.5 Device authorizations — `device_authorization` (device naming / count metadata)

- **Peer:** none by default — **no single device identifier is shared across unrelated contexts** ([ADR-0013 §11](../adr/ADR-0013-identity-firewall-architecture.md)). Residual concern: if a future flow ever surfaces a **device list** (count, human labels like "laptop") for verification, that count/naming metadata becomes peer-observable and can de-anonymize; the **Device Passport** term denotes only a future signed root↔device authorization and must be **scoped and non-correlatable** so it does not become a tracking identifier.
- **Transport:** none today — device authorization is local; multi-device **synchronization is Gate H** (`no distributed consistency or revocation is claimed`).
- **Local:** `deviceRefLocal`, scope, `authState`, **minimal device metadata**; revocable; `deviceKeyState_future`.
- **Leak risk:** device **count/naming** metadata and any stable, observable device credential (§2 residual).

### 1.6 Trust-notebook entries — `trust_notebook` / `TrustRecord`

- **Peer:** nothing. The Trust Notebook is a **local, privacy-sensitive** record of observations ([ADR-0013 §15](../adr/ADR-0013-identity-firewall-architecture.md)).
- **Transport:** nothing — **no server upload, no telemetry, no plaintext persistence**.
- **Local:** first contact, connection method, verification events + channel, introductions, key/device changes, warnings, blocks, local notes; entries **distinguish facts vs. peer claims vs. local notes**; **no** universal trust score or reputation.
- **Leak risk:** local exfiltration exposes **who the user trusts and how** — a rich social-graph artifact (correlation crown jewel; see [threat model §8](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md)).

### 1.7 Verification records — `verification_record`

- **Peer:** out-of-band verification is **mutual for that one pair** (both parties know they compared a claim), but the stored record is local; a peer learns nothing of the user's other verifications.
- **Transport:** none. Verification is **out-of-band by design** (removing the trusted key server), and **v1 has no key-transparency / lookup surface** — that would itself be a *who-queried-whose-keys* metadata channel and is explicitly deferred/out of scope for a directory-less design ([IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md)).
- **Local:** claim-specific state (`out_of_band_verified`, `key_change_warning`, …); **invalidated on incompatible key/root change**.
- **Leak risk:** local exfiltration reveals which contacts are high-assurance.

### 1.8 Recovery configuration — `recovery_configuration`

- **Peer:** none by default. Recovery is **offline-first, no server, no admin, no master key** ([ADR-0013 §13](../adr/ADR-0013-identity-firewall-architecture.md)); the optional approval path uses an **existing authorized device** the user already holds. The config **discloses its assurance trade-offs to the user**, not to peers.
- **Transport:** none by default — **no cloud upload, no email/SMS dependency, no silent server recovery**. (An encrypted optional backup *transport* was evaluated and **not chosen**; if ever added it would be a correlation oracle and needs its own gate.)
- **Local:** recovery `mode (offline_kit | existing_device | none)`, policy, and `assuranceOnRecovery: recovered_reverification_required`.
- **Leak risk:** the (future) encrypted **relationship manifest** inside a Recovery Kit is the correlation crown jewel; its compromise re-links everything.

### 1.9 Recovery material — `recovery_material_future`

- **Peer / transport:** none by default. Recovery material is a **secret**, subject to the strictest handling.
- **Local:** **never cached in ordinary UI state; no default clipboard** (future protected flow only); **no notifications; no cloud upload by default**; protected presentation is a future **Secure Device** integration. **No storage implementation in TECH-ID-02.**
- **Leak risk:** **compromised recovery material = identity compromise** ([ADR-0013 §13](../adr/ADR-0013-identity-firewall-architecture.md)).

### 1.10 Invite authorities — `invite_authority`, `invite_secret_future`

- **Peer (recipient):** whatever the payload reveals — which must be the **minimum**. **Room invites do not expose the private root; contact invites do not reveal unrelated aliases**; **forwarding risk is explicitly modeled** ([ADR-0013 §14](../adr/ADR-0013-identity-firewall-architecture.md)). A forwarded/leaked invite reveals a relationship to whoever handles it.
- **Transport / courier:** invites travel over untrusted couriers (QR / file / capsule / relay); the courier sees an **opaque token (format is Gate E/F)** and that an invite passed. **No public invite directory.**
- **Local:** issuer context, target persona/room, `maxAuthority`, expiry, `singleUseState`, `revocationState`, optional recipient binding.
- **Leak risk:** **invite-link leakage** is a residual correlation vector; mitigated (not eliminated) by one-time, expiring, minimal-authority invites — replay of used/expired/revoked invites **denies**.

### 1.11 Block relationships — `block_relationship`

- **Peer:** blocking **binds to the local relationship, not the visible alias** — a blocked relationship **cannot bypass via alias rename**, and **block state survives display-alias changes** ([ADR-0013 §9](../adr/ADR-0013-identity-firewall-architecture.md)). Whether a peer can *detect* being blocked is a transport/UX side channel, not carried by the identity record.
- **Transport:** none — **block lists stay local; no central reputation database, no global person ban** ([IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md)).
- **Local:** block state on the relationship record.
- **Leak risk:** the unavoidable flip side — **a new independent identity is a new relationship and cannot be globally identified without undermining privacy** (the unlinkability ↔ Sybil-resistance tension, documented not solved).

### 1.12 Tombstones — `identity_tombstone`

- **Peer:** deletion/tombstone makes **no remote or forensic-erasure claim**; a peer already holding a relationship identifier is unaffected, and a removed device/identity **may persist on unreachable peers** (distributed revocation is **Gate H**).
- **Transport:** none — local and versioned.
- **Local:** tombstone existence, versioned, terminal locally (`revoked_tombstone`, `removed_tombstone`).
- **Leak risk:** tombstone **existence is itself metadata** (something was deleted); no forensic-erasure is claimed.

---

## 2. Correlation analysis (the primary threat)

Correlation — joining a user's rooms, contacts, and personas into one global identity without their intent — is the **primary threat** the architecture is shaped against ([ADR-0013 §3](../adr/ADR-0013-identity-firewall-architecture.md); [threat model §1](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md)).

### 2.1 What the architecture reduces cross-contact / cross-room correlation with

- **Pairwise relationship identifiers** — one identifier per relationship, not reused across contacts; two contacts comparing notes share no default identifier (§1.3).
- **Room-scoped aliases** — one alias per room, not global, not linkable through reusable root material by default; a persona may present different aliases in different rooms (§1.4).
- **No globally exposed root** — the identity root is a private local controller, never peer-facing or in discovery; **no universal public account identifier** and **no global root public key reused across relationships** by default (§1.1).
- **No directory** — **no public searchable identity directory, no mandatory global username, no phone/email discovery, no address-book upload** ([IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md)); connection is by one-time invite / QR / out-of-band / introduction, so there is no enumerable surface to rebuild a directory from.
- **Independent identity roots** — the architectural basis for **strong, recovery- and device-isolated** context separation.

### 2.2 Residual correlation vectors the architecture does NOT solve

Stated plainly, so the design does not overclaim:

- **Local root compromise reveals the user's own mapping.** The vault necessarily holds the alias→relationship→room graph so the *user* can use it; an attacker with local access reads that mapping. This is inherent to local-first, mitigated by encryption-at-rest (Gate F) and strict-mode minimization — endpoint compromise is **external** (Secure Device).
- **Timing / content / transport metadata.** Message timing, frequency, size, and who↔whom are visible to transports and strong network observers regardless of identifier scoping. This is **outside identity scope** — it belongs to [METADATA_MODEL.md](../METADATA_MODEL.md) / CapsuleNet, and correlation attacks there **remain possible**.
- **Personas are NOT unlinkable.** Personas under one root are **`unlinkable: false`** — **organizational / presentation separation only**, not a cryptographic guarantee. Asset reuse, a shared device credential, recovery material, or a mis-scoped send can link them. **Independent identity roots — not personas — are the real separation** and are recommended for ephemeral/Ghost use ([ADR-0013 §8, §21](../adr/ADR-0013-identity-firewall-architecture.md)). This is disclosed to avoid false confidence.
- **Invite-link leakage.** A forwarded or intercepted invite reveals a relationship to its handler (§1.10); one-time/expiring/minimal invites reduce blast radius, they do not prevent disclosure by a recipient.
- **Recovery metadata.** The existence/timing of recovery and the encrypted relationship manifest are high-value linkage material; localizing and minimizing recovery reduces, does not remove, this (§1.8–1.9).
- **Device-list metadata.** Device count and human labels, and any stable observable device credential, can correlate contexts if ever surfaced (§1.5); scoping is a **Gate F** requirement, not yet built.

**Bottom line:** identifier scoping and directory-lessness give a strong *default* against cross-contact and cross-room linkage. They do **not** deliver unlinkability against a local-endpoint attacker, a global traffic observer, or a user who reuses assets across personas. **Personas ≠ unlinkable; independent roots are the separation that holds.**

---

## 3. Minimization requirements per data class

Mapped to the [ADR-0013 §16](../adr/ADR-0013-identity-firewall-architecture.md) / [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) classification table. **No telemetry anywhere** ([ADR-0008](../adr/ADR-0008-no-external-assets-or-telemetry.md)) is the invariant over all three classes.

### 3.1 Secrets — `identity_root_secret_future`, `relationship_secret_future`, `device_secret_future`, `recovery_material_future`, `invite_secret_future`

- **Never plaintext, never in logs, never in telemetry, never in external assets.**
- **Encrypted persistence only after Gate F** — until then no secret is persisted at all.
- **Ghost / Bunker restrictions apply** (§4).
- The `identity_root_public_reference_future` is **secret-adjacent**: private, not a peer-facing identifier, not exposed in discovery.

### 3.2 Relationship / trust metadata — `persona_profile`, `pairwise_relationship`, `room_identity_binding`, `device_authorization`, `trust_notebook`, `verification_record`, `block_relationship`, `recovery_configuration`, `identity_tombstone`

- **Local only** — **no project server, no public directory, no analytics, no automatic export**.
- **Strict-mode minimization** applies (§4).
- Class-specific rules from the table: pairwise records **not searchable / no directory**; room bindings **room-scoped, not globally linkable**; device authorization keeps **minimal device metadata** and is revocable; Trust Notebook keeps **facts vs. claims vs. notes**, **no reputation, no upload**; verification is **claim-specific, invalidated on incompatible change**; block **binds to relationship, survives alias change**; tombstone carries **no forensic-erasure claim**.

### 3.3 Recovery material — `recovery_material_future`

- **Never cached in ordinary UI state.**
- **No default clipboard** (a future *protected* flow only), **no notifications**, **no cloud upload by default**.
- Protected presentation is a **future Secure Device integration**. **No storage implementation in TECH-ID-02.**

---

## 4. Strict-mode (Ghost / Bunker) behavior

Strict modes tighten identity-metadata handling toward **minimization, memory-only, and null direction**, consistent with `IdentityPolicy { strictModeMinimization; ghostBunkerRestrictions }` and the repo-wide strict-mode posture ([POLICY_MATRIX.md](../POLICY_MATRIX.md), [METADATA_MODEL.md](../METADATA_MODEL.md) TECH-07/TECH-10). Composition is **tighten-only**: a permissive context can never loosen a stricter device mode.

| Concern | Ghost / Bunker direction |
| --- | --- |
| Relationship / trust metadata | **Minimized**; prefer memory-only working state; suppress non-essential fields |
| Trust Notebook | **Memory / null behavior permitted** — entries need not persist ([ADR-0013 §15](../adr/ADR-0013-identity-firewall-architecture.md)) |
| Persistence ceiling | Nothing identity-metadata-shaped that is not essential should persist; **no plaintext persistence** of trust records |
| Notifications / clipboard | Denied for identity/recovery content (aligns with [TECH-12 notification model](../METADATA_MODEL.md)) |
| Recovery | **May be absent for Ghost identities** — `RecoveryConfiguration.mode = none` is a valid choice ([ADR-0013 §13](../adr/ADR-0013-identity-firewall-architecture.md)) |
| Telemetry / upload | **None, in every mode** — strict modes add no exception |

**What may persist:** only the minimum local state a mode needs to function, encrypted at rest once Gate F exists. **What must not:** plaintext identity secrets, unminimized Trust-Notebook entries in memory-only modes, recovery material in ordinary caches, any identity metadata routed to a transport, notification, clipboard, or telemetry sink. **Ghost identities may forgo recovery entirely**, accepting non-recoverability as a deliberate trade-off.

---

## 5. Summary table

Design-time estimates (Gate G — nothing built). "Transport-observable?" assumes a hostile courier; who↔whom traffic correlation is out of identity scope and applies to every row.

| Metadata item | Peer-visible? | Transport-observable? | Local-only? | Minimization rule | Strict-mode (Ghost/Bunker) |
| --- | --- | --- | --- | --- | --- |
| `identity_root` (secret + public ref) | **No** (invariant — never peer-facing / no discovery) | No (never transmitted) | **Yes** | Secret: never plaintext/logs/telemetry; encrypted only after Gate F | Restricted; not persisted pre-Gate F |
| `persona_profile` | Presented profile only; shared-root not disclosed | No (avatars = capsule content, not remote fetch) | Grouping/defaults yes; presented profile leaves as content | Local; no server/directory/analytics | Minimized |
| `pairwise_relationship` (+ secret) | The one peer sees a scoped identifier | Opaque destination + routing hint | Record yes; pairwise id is peer-facing | Local; not searchable; no directory; Gate F must avoid cross-rel correlation | Minimized |
| `room_identity_binding` / room alias | Room participants see the room-scoped alias | Room routing metadata | Binding yes; alias is room-facing | Local; room-scoped; not globally linkable; export must not carry unrelated ids | Minimized |
| `device_authorization` (naming/count) | No by default (list not peer-facing) | No (sync is Gate H) | **Yes** (today) | Local; revocable; **minimal** device metadata; credential must not become a tracking id | Minimized |
| `trust_notebook` / `TrustRecord` | **No** | No (no upload) | **Yes** | Local; facts vs claims vs notes; no reputation; no upload; no plaintext persistence | **Memory / null permitted** |
| `verification_record` | Mutual for that pair only | No (out-of-band; no transparency queries) | **Yes** | Local; claim-specific; invalidated on incompatible change | Minimized |
| `recovery_configuration` | **No** | No by default (no cloud/server) | **Yes** | Local; discloses assurance trade-offs | May be `none` for Ghost |
| `recovery_material_future` | **No** | No by default | **Yes** | Never ordinary UI cache; no clipboard/notifications/cloud by default | Restricted; protected presentation is future Secure Device |
| `invite_authority` (+ secret) | Recipient sees minimum; forwarding modeled | Yes (opaque token; that an invite passed) | Authority state yes; token leaves device | Minimum reveal; one-time/expiring/revocable; no invite directory | Minimized |
| `block_relationship` | **No** (binds to relationship, survives alias rename) | No (lists local) | **Yes** | Local; no central reputation; no global ban | Minimized |
| `identity_tombstone` | **No** (no forensic/remote-erasure claim) | No (local, versioned) | **Yes** | Local; no forensic-erasure claim | Minimized |

---

## 6. Honest limitations

Stated plainly, without hedging:

- **Transport / timing metadata is outside identity scope.** Message timing, frequency, size, and who↔whom belong to [METADATA_MODEL.md](../METADATA_MODEL.md) and CapsuleNet; identifier scoping does not hide them, and a determined observer of both endpoints can correlate. Identity minimization reduces *identifier* linkage, not *traffic* linkage.
- **Distributed state is deferred (Gate H).** Local identity state is authoritative only for the current local vault; **no distributed consistency or revocation is claimed**. A removed device/identity may persist on unreachable peers; sync of personas/relationships/Trust-Notebook/block-lists/tombstones is Gate H, recorded not solved.
- **The endpoint is external (Secure Device).** The Identity Firewall cannot harden a compromised device; local root/manifest/Trust-Notebook compromise is an **endpoint** problem owned by the separate Secure Device / Endpoint Defense project ([TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md), [ENDPOINT_DEFENSE_MODEL.md](../ENDPOINT_DEFENSE_MODEL.md)). DevicePosture may *tighten* handling but never *authorizes* and never proves identity.
- **Personas are organizational, not unlinkable.** Repeated because it is the most likely false-confidence trap: **independent roots are the separation that holds; personas are not.**
- **No perfect unlinkability is claimed.** The architecture minimizes cross-contact and cross-room *identifier* correlation and removes the directory/global-root classes; it does not, and this review does not, claim unlinkability against a local-endpoint attacker, a global traffic observer, or user-driven asset reuse. Classifications are design-time and must be re-validated at each gate.

## References

- [ADR-0013 — Identity Firewall Architecture](../adr/ADR-0013-identity-firewall-architecture.md) (§7 identifiers, §8 persona/alias, §13 recovery, §15 Trust Notebook, §16 storage/metadata, §21 privacy consequences)
- [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) — storage & metadata classification table, contact-discovery decision, blocking & abuse
- [METADATA_MODEL.md](../METADATA_MODEL.md) — house style; communication/network/local metadata categories; identity-metadata note (RESEARCH-ID-01)
- [RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md) — §1 correlation & privacy, §8 local storage, §11 endpoint boundary
- [THREAT_MODEL.md](../THREAT_MODEL.md), [TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md), [ENDPOINT_DEFENSE_MODEL.md](../ENDPOINT_DEFENSE_MODEL.md), [STORAGE_BOUNDARY_AUDIT.md](STORAGE_BOUNDARY_AUDIT.md)
