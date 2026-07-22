# TECH-ID-02 — Identity Architecture Threat Review

_Scope: maps the threats catalogued in [RESEARCH-ID-01 — Identity Threat Model](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md) onto the **decided** architecture in [ADR-0013 — Identity Firewall Architecture](../adr/ADR-0013-identity-firewall-architecture.md) and its companion [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md). This is the threat-to-decision review named in ADR-0013 §20 and §25. It is **documentation only**: no identity, key, alias, persona, device, invite, or recovery code is added, and this review invents no cryptography. It records which structural decisions blunt each threat, what each decision cannot reach, and which downstream gate must finish the job._

> [!IMPORTANT]
> Read the [Threats not mitigated by architecture alone](#2-threats-not-mitigated-by-architecture-alone) and [Closing statement](#3-closing-statement) sections first. ADR-0013 decides **structure and invariants, not algorithms**. Cryptography is **Gate F**, wire formats are **Gate E**, synchronization and distributed revocation are **Gate H**, and endpoint protection is **external** (the separate Secure Device / Endpoint Defense project). Assurance is **self-asserted** — there is no real-world proofing, no attestation, and no trusted authority. Until a reviewed identity/crypto integration ships, FreeLayer identities **must not be treated as safe for information whose exposure would cause real harm**. This review exists so the architecture does not overclaim before it is built. **No complete mitigation is claimed for any threat below.**

## How to read this review

Architecture can only do three things to a threat: **remove** the structural precondition (e.g. delete the global identifier a correlation attack needs), **contain** the blast radius (e.g. scope a device key so its loss is bounded), or **refuse to hide** the danger (e.g. fail closed on unknown state instead of silently trusting). It cannot supply the cryptography that authenticates a key, the sync layer that propagates a revocation, or the endpoint that protects a secret in memory. Every row therefore separates the structural decision from the residual risk it leaves behind.

**Columns.** _Threat_ cites the RESEARCH-ID-01 section. _ADR-0013 mitigation_ is the structural decision (with ADR section refs) — never a cryptographic or runtime claim. _Remaining limit / residual risk_ is what the structure cannot reach. _Gate that must finish it_ names what remains open.

**Gate legend.**

| Token | Meaning |
| --- | --- |
| **Gate F** | Cryptography: key generation, derivation, rotation, signatures, verification codes, invite/recovery encryption. Nothing is authenticated until Gate F. |
| **Gate E** | Wire formats: invite/QR payloads, Capsule identity serialization. |
| **Gate H** | Synchronization: multi-device propagation, distributed revocation, cross-device history/state. **No distributed consistency or revocation is claimed by ADR-0013** (§19). |
| **External** | Secure Device / Endpoint Defense — a separate project. The Identity Firewall cannot harden a compromised endpoint. |
| **Recovery review** | Dedicated recovery threat review required before any recovery implementation (ADR-0013 §24, TECH-ID-12 prerequisite). |
| **UX (TECH-ID-11/13)** | Later verification-flow / recovery-UX tasks. ADR-0013 fixes semantics, not screens (§22). |
| **Inherent** | A disclosed trade-off no gate closes (e.g. unlinkability ↔ Sybil-resistance). Documented, not pretended solved. |
| **Decided** | The structural precondition is closed by ADR-0013 itself; remaining work is faithful implementation (TECH-ID-03+), not a re-decision. |

> ADR-0013 **is** the identity-model ADR that RESEARCH-ID-01 repeatedly deferred to as "Gate G." Where RESEARCH-ID-01 says "Gate G ADR," the structural half of that answer now lives in ADR-0013; the columns below therefore name only what is *still* open (Gate F/E/H, external, review, or UX).

## 1. Threat-to-decision mapping

The mapping is one logical table, split by RESEARCH-ID-01 chapter for readability. Every sub-table shares the same four columns.

### 1.A Correlation & privacy (RESEARCH-ID-01 §1)

Correlation is ADR-0013's **primary** threat (§3, §21). The architecture attacks it by construction — there is no shared signal to cluster on by default.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Global-identifier tracking** — a stable value (global user ID, always-shown public key, fixed avatar hash) reused across contexts rebuilds one graph | No universal public account identifier and no global root public key reused across unrelated relationships by default; the root is a **private local controller**, never peer-facing (§7). Identifiers are pairwise/room-scoped by construction (§7, §9, §10) | Structure forbids the identifier; it does not yet *derive* the scoped identifiers. Faulty derivation could reintroduce a shared value | **Gate F** (identifier construction must not create avoidable cross-relationship correlation, §7) |
| **Cross-room correlation** — two room aliases linked into one identity | Room aliases are room-scoped, not global, and "not linkable through reusable root material by default"; participants never receive the private root (§10). One persona may use different aliases per room | Two aliases under the **same persona** are organizational, not cryptographically unlinkable; independent roots are the real boundary (§8) | **Gate F** (room-scoped credential derivation); **Decided** (scope rules) |
| **Cross-contact correlation** — two contacts compare notes and link one person | Each `PairwiseRelationship` carries a distinct peer-facing pairwise identifier, **not reused across contacts**, not globally searchable (§9) | Same-persona relationships are not guaranteed unlinkable at the crypto layer; a peer who obtains the root correlates the user's own map | **Gate F** (relationship-key derivation) |
| **Shared-profile correlation** — same avatar/name/bio reused across personas clusters them | Persona defaults are per-persona; a persona must not hold a global searchable username or public root identifier (§8). Cross-persona linking requires explicit user action | User-chosen content reuse (same avatar image) still self-links; architecture cannot forbid a user picking the same picture | **UX (TECH-ID-11/13)** reuse warnings; **Inherent** (user convenience) |
| **Per-room alias mapped back to root** — a lower layer (shared key, device passport, recovery, sync) re-links an alias to the root | No layer may reuse root material as a cross-context identifier; device passport implies no stable public device ID (§11); room export must not expose unrelated relationship identifiers (§10) | The *guarantee* that no lower layer re-links depends on key scoping (Gate F), device-key isolation (Gate F), and what sync carries (Gate H) | **Gate F** + **Gate H** |
| **Device keys correlating personas** — one device key signs across personas, linking them | Each device has independent future key material; no single device identifier shared across unrelated contexts by default; scope may be persona-limited (§11) | Cross-persona device-key isolation is a crypto property not yet built; posture/device metadata must stay minimal | **Gate F** (device-key/persona relationship) |
| **Invite-link relationship leakage** — an invite payload embeds identifiers/room identity/inviter key, so holding or forwarding it exposes a relationship | Invites are one-time, capability-limited, revocable; room invites do not expose the private root; contact invites do not reveal unrelated aliases; forwarding risk is explicitly modeled; no public invite directory (§14) | The payload's actual minimality and integrity are wire-format + crypto properties; a courier still sees *that* an invite exists | **Gate E** (payload) + **Gate F** (integrity) |
| **Recovery-service correlation** — an online recovery helper sees which identities request recovery and links them | Recovery is **offline-first, no server, no admin**; the correlation oracle is removed by having no helper (§13) | Any *future* optional online helper reintroduces the oracle; deferred alternatives (social/threshold/backup transport) explicitly not chosen | **Recovery review** (before any helper); **Inherent** if an online helper is ever added |
| **Key-transparency social-graph exposure** — a transparency/lookup mechanism logs who queries whose keys | **Not applicable by design.** No public username/account/key directory is selected, so there is no query surface to log; key transparency is **deferred/rejected for v1** (§18, §19; IDENTITY_ARCHITECTURE DID/VC table) | Re-evaluation trigger only: if public usernames, server key directories, large-scale discovery, or federation are ever introduced | **Deferred** — out of scope unless a directory is introduced |
| **Contact discovery exposing address books** — discovery uploads/hashes the address book | No server-side contact discovery, no address-book upload, no phone/email; connection is out-of-band/invite/QR/introduction only (§19; IDENTITY_ARCHITECTURE "Contact discovery") | Any future optional discovery reopens this; must pass a separate privacy gate | **Deferred** (future discovery needs its own research + privacy gate) |

### 1.B Impersonation & key substitution (RESEARCH-ID-01 §2)

Impersonation exploits the gap between what the user *sees* and what is *authenticated* (nothing until Gate F). The architecture keeps the display layer from ever standing in for the (future) key layer.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Display-name impersonation** — attacker presents a name/alias close to a trusted contact's; UI shows the name, not a verified key | An alias is never authority (§8); verification binds to relationship-specific key state, and there is **no generic `verified: true`** — trust is a claim-specific state (§9, §12). Names are advisory, verification is load-bearing | The actual key binding and the confusable/homograph normalization are not built; a user can still act on a name before verifying | **Gate F** (key binding) + **UX (TECH-ID-11/13)** (verification-first display, confusable checks) |
| **Malicious server/relay substitutes keys** — a relay returns an attacker key for a contact | Directory-less design removes the trusted key server; there is no server to substitute through; trust roots in out-of-band verification (§7, §12; IDENTITY_ARCHITECTURE §9) | Out-of-band verification cryptography does not exist yet; without it a first-contact substitution is invisible | **Gate F** (verification codes/fingerprints) |
| **QR / invite payload replacement** — the QR or invite is swapped or rewritten by a hostile display/relay | Invites are integrity-scoped concepts with explicit forwarding/tamper modeling (§14); verification is mutual and claim-specific (§12) | Payload integrity and short authenticated safety codes are Gate E/F; a swapped on-screen QR is also an endpoint-capture problem | **Gate E** (payload) + **Gate F** (integrity/codes); **External** (screen capture) |
| **Ignored key-change warning** — user clicks through a key-change banner | Key/device change **must** update the Trust Notebook, invalidate incompatible prior verification, require an explicit warning, and may block sensitive communication until reviewed; verification never silently survives incompatible change (§12, §17) | Whether the warning is un-ignorable is a UX property; architecture mandates the state transition, not the screen | **UX (TECH-ID-11/13)** (make key change legible; re-verification for sensitive contexts) |
| **Recovery restores an attacker-controlled key** — recovery reinstates or accepts a planted key | Recovery yields `recovered_reverification_required`; it does **not** silently restore verification; old device authorizations are reviewed/invalidated; no automatic trust after recovery (§13, §17) | The re-establishment of assurance and rejection of a planted key ultimately need crypto + a recovery-specific review | **Gate F** + **Recovery review** |
| **Stale device keeps acting** — a removed/rotated device still signs because revocation did not propagate | Device authorization is revocable; removal changes local authorization state; lost/removed devices must not remain silently trusted (§11); local revocation fence at failure-closed points (§17) | **Distributed** revocation is not claimed — a stale device may persist on peers that never saw the removal (§20) | **Gate H** (distributed revocation) + **Gate F** (rotation) |

### 1.C Category confusions — the four separations (RESEARCH-ID-01 "What identity is and is not")

RESEARCH-ID-01 treats each confusion as a distinct attack class. ADR-0013 encodes all four as invariants (IDENTITY_ARCHITECTURE "Invariants").

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Profile / display name mistaken for identity** | Persona/profile is presentation only; profile names/avatars are never verification; an alias is not authority (§8; Invariants). Rejected alternative: "profile name as verification" (§18) | A user may still trust a name before any verification state exists | **Decided** (type separation); **UX (TECH-ID-11/13)** |
| **`RoomMemberRef` / membership mistaken for identity** | RoomOS membership stays separate from identity verification; a RoomOS role does not prove identity ownership (§10). Rejected alternative: "`RoomMemberRef` as identity" (§18) | Membership is unverified local scaffolding (TECH-20); separation must be preserved in every downstream type | **Decided** (separate types) |
| **Device ID / Device Passport mistaken for identity** | A device is subordinate, revocable key material, never the identity; "Device Passport" implies no hardware attestation, no stable public device ID, no implementation today (§11). Rejected: "device model as identity" (§18) | A stolen/relabeled device must not inherit trust — depends on device-key crypto not yet built | **Gate F** (root↔device authorization); **Decided** (subordination) |
| **DevicePosture mistaken for identity / authority** | DevicePosture **may tighten** an authorized device's permissions but **cannot authorize or verify**; missing posture cannot change identity status; endpoint risk may restrict but not alter identity history (§11, §17). Rejected: "DevicePosture as identity" (§18) | Posture remains an external, advisory input (Secure Device); core never parses evidence or derives identity from it | **External** (Secure Device) — boundary is **Decided** |

### 1.D Multi-device (RESEARCH-ID-01 §3)

Every device is added attack surface, and sync (Gate H) does not exist to mediate it.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Unverified device linked** — a new device is added without an existing device approving it | Adding a device requires explicit approval; a device cannot authorize another unless explicitly allowed (§11) | The authenticated approval handshake is a crypto/sync protocol not yet designed | **Gate F** (linking) + **Gate H** |
| **Lost/stolen device stays trusted** — the finder inherits authority | Authorization is revocable; lost/removed devices must not remain silently trusted; scope may be read-only/persona-/relationship-limited (§11) | Prompt revocation is local; the finder can still act toward peers who never learn of removal | **Gate H** (revocation propagation) + **Gate F** (rotation) |
| **Compromised device links another** — compromise self-propagates | A device cannot authorize another unless explicitly allowed; history access and device authorization are separate decisions (§11) | Making link events auditable across devices and requiring fresh approval is Gate F/H | **Gate F** + **Gate H** |
| **Device removal doesn't rotate keys** — removed device retains usable room/shared key material | Removal changes local authorization state and old authorizations are reviewed/invalidated on recovery (§11, §13) | Rotation of anything the device could access is a crypto operation; room-key rotation crosses into sync | **Gate F** (rotation) + **Gate H** (room-key sync) |
| **Incomplete / hidden device list** — a contact's device set shown to the user omits an attacker device | Model does not depend on an authenticated global device list; authority is subordinate and revocable per device (§11) | An authenticated, complete device list is not provided; a hidden device could sign undetected once keys exist | **Gate F** (device-list authentication) + **Gate H** |
| **Device passport becomes a tracking identifier** — a stable per-device credential is observed across contexts | No single device identifier shared across unrelated contexts by default; Device Passport implies no public stable device ID (§11) | Non-correlatable device credentials are a crypto property not yet built | **Gate F** (scoped device credentials) |
| **Identity root copied to every device** — one device compromise = total compromise | Devices hold subordinate authorizations, **not** the root; root is a private local controller; rejected alternative: "one identity root copied unprotected to every device" (§7, §18). Independent roots recommended for Ghost/ephemeral use (§21) | The root/subordinate split is enforced by crypto that does not exist yet; a root on a compromised endpoint is still lost | **Gate F** (root/subordinate split); **External** (endpoint) |

### 1.E Recovery (RESEARCH-ID-01 §4)

Recovery is the deliberate re-granting of identity authority — every mechanism is also the attacker's preferred entry. ADR-0013 removes the server/admin/master-key class outright.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Recovery-as-backdoor** — an admin-recovery or master-key feature is added "for convenience" | **Mandatory rule:** no FreeLayer-controlled master key, no silent server recovery, no admin override (§13). Rejected alternatives: server/administrator recovery, project-owned master key (§18) | This is a **design invariant**, not a runtime control; the guard is refusing any proposal that adds one — treat such a proposal as a top-severity regression | **Decided** (invariant); **Recovery review** to keep it out |
| **Weak / compromised recovery material** — low-entropy phrase/PIN, or cloud-backup exfiltration of recovery secrets | Recovery material is a secret: never plaintext, never clipboard by default, never cloud upload by default, never notifications (§16). "Compromised recovery material = identity compromise" is stated (§13) | Entropy parameters, rate-limiting, and at-rest encryption are Gate F; **compromised recovery material equals identity compromise** is an accepted, disclosed limit, not something structure removes | **Gate F** (entropy, encryption) + **External** (endpoint capture); **Inherent** (material = authority) |
| **Recovery rollback** — an old recovery snapshot replays revoked keys / stale trust | Recovery must not silently restore verification; old device authorizations are reviewed or invalidated; state resets to `recovered_reverification_required` (§13, §17) | Rollback rejection needs a freshness/epoch notion with no trusted clock yet; ADR does not invent one | **Gate F** (freshness/epoch) + **Recovery review** |
| **Social-recovery collusion** — a threshold of "guardians" colludes or is coerced | Threshold/social recovery is **evaluated and deferred, not chosen**; default is offline kit + existing-device approval (§13) | If social recovery is ever added, the quorum becomes an attack + coercion + correlation target (§1) | **Recovery review** (before any social recovery); **Deferred** |
| **Recovery silently changing assurance** — post-recovery, contacts/devices still shown "verified" | Recovery yields `recovered_reverification_required`; verification is not auto-restored; high-assurance contacts are warned; verification never silently survives incompatible change (§12, §13, §17) | The re-derivation of assurance and warning of peers depend on crypto + UX; distributed warning crosses into sync | **Gate F** + **UX (TECH-ID-11/13)** |
| **Total loss of identity authority** — user loses all material and every device | Explicitly accepted: with no admin/master key, the identity is unrecoverable; Ghost/ephemeral identities may choose **no recovery** (§13). Trade-off disclosed (§21, §22) | This is an intentional **availability** trade-off, not a bug; no backdoor restores lost authority | **Inherent** (disclosed trade-off) |

### 1.F Alias (RESEARCH-ID-01 §5)

Aliases give per-context names without a global handle. The threats are collision, deception, enumeration, and mapping back to the root.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Alias collision** — two identities show the same alias in a context | Aliases are display hints, never authority or unique keys; disambiguation is by verification state, not name (§8, §9, §12) | The disambiguating key does not exist yet; until then collisions can only be resolved by claim-specific state | **Gate F** (disambiguating key) |
| **Homograph / spoofing** — Unicode look-alikes defeat visual comparison | Alias is never authentication; verification is the load-bearing signal (§12) | Confusable/script normalization and skeleton checks are a display policy not decided here | **UX (TECH-ID-11/13)** (normalization policy) |
| **Alias enumeration** — probing to discover which aliases exist | No public searchable directory, no enumerable lookup, no phone/email (§7, §19; IDENTITY_ARCHITECTURE §9) | Holds only while no server directory exists; any future discovery reopens it | **Deferred** (future discovery needs a privacy gate) |
| **Alias reuse across contexts** — user reuses one alias, enabling correlation | Per-context aliases by construction; cross-persona linking requires explicit user action (§8) | Architecture cannot force per-context discipline; same-persona aliases are not guaranteed unlinkable | **UX (TECH-ID-11/13)** (reuse warnings); **Inherent** |
| **Alias migration** — moving an alias between identities links old to new | Display alias may change without changing the relationship record; block state survives alias change (§9) | Migration itself is a linkability disclosure to observers; surfacing it is a UX concern | **UX (TECH-ID-11/13)** |
| **Stale alias** — an alias resolves/displays after retirement | Alias lifecycle is separate from the relationship record; failure behavior fails closed on stale alias (§9, §17) | Lifecycle enforcement (retired aliases stop resolving) is implementation-level | **Decided** (fail-closed on stale) → **TECH-ID-05/06** |
| **UI shows wrong identity scope** — a message composed under the wrong persona/alias | The active scope is a first-class binding (`RoomIdentityBinding`); room-alias mismatch denies membership-sensitive actions (§10, §17) | A single mis-scoped send can unmask a persona irreversibly; scope confirmation is UX | **UX (TECH-ID-11/13)** (unambiguous scope indication) |

### 1.G Invite (RESEARCH-ID-01 §6)

Invites are the accountless substitute for "add by phone number." They must grant just enough, once, without leaking relationships.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Invite replay** — a captured invite is used more than once | One-time, single-use state modeled; expired/revoked/used invites **deny**; replay of consumed/expired/revoked = deny (§14; IDENTITY_ARCHITECTURE Diagram 7) | Single-use enforcement needs authenticated state (crypto) and, across devices, sync | **Gate F** + **Gate H** (state) |
| **Invite forwarding** — recipient forwards to someone else | Optional recipient binding; forwarding risk is **explicitly modeled**; authority is minimal/capability-limited (§14) | Bind-to-recipient without a directory is unsolved; a forwarded invite within its scope still admits the wrong party | **Gate E/F** (recipient binding) |
| **Invite theft** — stolen in transit over a hostile courier | Short expiry + single use + minimal authority limit the blast radius (§14) | A stolen invite inside its lifetime is a valid credential until crypto integrity + expiry enforcement exist | **Gate F** (integrity) |
| **Unlimited-lifetime invite** — an old link resurfaces and admits an attacker | Expiration policy is a required field on `InviteAuthority`; expired invites deny (§14) | Expiry enforcement is runtime state; a missing/mis-set expiry must fail closed | **Decided** (expiry required) → **Gate F** enforcement |
| **Invite grants too much authority** — accepting confers broad room/identity authority | **No wildcard authority**; `maxAuthority` bounds every invite; membership authorizes nothing by itself (§14; TECH-20) | Capability binding must be enforced at accept time; acceptance still requires current policy + user action | **Gate E/F** (capability binding) |
| **Invite reveals room identity** — payload discloses room topic/members | Room invites do not expose the private root; contact invites do not reveal unrelated aliases; reveal-minimization intended (§14) | Actual payload minimality is a wire-format property | **Gate E** (payload) |
| **Invite accepted by wrong persona / binds wrong device** | Acceptance requires explicit current policy + user action; class-specific invites (`device_link_request` etc.) separate concerns (§14) | Accept-time persona/device selection and confirmation are UX; device binding ties to §3 | **UX (TECH-ID-11/13)** + **Gate F/H** (device binding) |
| **Invite used after revocation** — revocation didn't reach the acceptance point | Revocation state modeled; revoked invites deny at acceptance (local revocation fence) (§14, §17) | Without propagation, revocation may not reach a remote acceptance point | **Gate H** (distributed revocation) |

### 1.H Trust & verification (RESEARCH-ID-01 §7)

Verification is how "same key as last time" becomes "I confirmed who this is." The threats are false confidence and trust that outlives its subject.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **TOFU accepted without warning** — first key silently accepted and shown as verified | First-use is a distinct, explicit state (`unverified` / `continuity_observed`), **not** presented as verified; no generic `verified` boolean (§12) | Continuity does not prove a specific human; first-contact MitM is invisible without out-of-band verification | **Gate F** (verification) |
| **Verification not bound to key / surviving key replacement** — "verified" persists while the key changes (trust laundering) | Verification binds to relationship-specific key state; key/device change **invalidates incompatible prior verification** and requires a warning; verification never silently survives incompatible change (§9, §12) | The cryptographic binding of a verification state to a specific key is Gate F; the ADR mandates the state machine, not the binding | **Gate F** (bind verification to key) |
| **Verification wrongly copied between aliases** — verifying one alias marks another as verified | Verification is scoped to relationship-specific key state; no cross-alias propagation; room aliases not linkable through root material by default (§9, §10, §12) | Per-alias scoping is a crypto property; same-persona aliases are not guaranteed unlinkable | **Gate F** |
| **Overstated introduction chain** — a transitive vouch shown as strong verification | `introduced_unverified` is a **distinct** state; introduction is explicitly **not** equivalent to direct verification (§12) | Rendering provenance honestly (how trust was established) without overstating is a UX task; the Trust Notebook distinguishes facts vs. peer claims vs. notes (§15) | **UX (TECH-ID-11/13)** |
| **Verification UX creating false confidence** — checkmarks/"secure" labels beyond what was verified | No generic `verified: true`; nine claim-specific states carry honest, narrow meaning (§12); no NIST IAL/AAL labels (§3) | Conservative labeling must be carried into screens; assurance stays self-asserted | **UX (TECH-ID-11/13)** |
| **Safety code compared over a compromised channel** — MitM relays both sides | Out-of-band verification is the intended trust root (§12) | Channel choice is user-operational; in-band comparison is weaker, and code construction is Gate F | **Gate F** (codes) + user-operational |

### 1.I Local storage (RESEARCH-ID-01 §8)

Identity is local-first, so the device disk holds the most sensitive assets. ADR-0013 classifies them; encryption itself is Gate F.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Identity root in plaintext** — device-at-rest access yields total compromise | Root secrets are classified secret: never plaintext, never logs, never telemetry; **encrypted persistence only after Gate F**; Ghost/Bunker restrictions apply (§16) | No encryption exists yet; there is **no storage implementation in TECH-ID-02** — this is a classification, not a control | **Gate F** (encryption at rest) |
| **Alias/relationship graph leaked** — the correlation crown jewel is read from disk | The graph is privacy-sensitive metadata: local, not searchable, no directory, strict-mode minimized (§16) | Encryption + minimization are Gate F; a leaked graph re-links personas | **Gate F** |
| **Trust Notebook leaked** — reveals who the user trusts and how | Local, privacy-sensitive, no server upload, no telemetry, no plaintext persistence; strict modes may use memory/null behavior (§15, §16) | At-rest protection is Gate F; the Notebook is a rich social-graph artifact | **Gate F** |
| **Recovery material cached** — secrets linger in memory/disk | Never cached in ordinary UI state; no default clipboard; no notifications; no cloud upload by default (§16) | Memory is not protected from a compromised process (endpoint); zeroization is Gate F | **Gate F** + **External** (endpoint memory) |
| **Deleted identity still recoverable** — journaling/undelete/backups | Identity tombstones are local and versioned; deletion/tombstone makes **no** remote/forensic-erasure claim (§9, §23; IDENTITY_ARCHITECTURE storage table) | Deletion is best-effort; OS/hardware residue is out of app control; no forensic-erasure claim is made | **Gate F** + **External** (OS/hardware residue) |
| **Logs containing keys/identifiers** — secrets escape via logs/crash reports | Identity secrets are **never logged**; content-free classification across all identity data (§16; Invariants) | A design invariant that must be preserved in every downstream component | **Decided** (logging invariant) |
| **App backups sweeping up secrets** — OS/app backup exfiltrates roots/recovery material | No cloud upload by default; recovery material never cached in ordinary state (§16) | Platform backup behavior varies; backup-exclusion is a platform integration | **Gate F** + platform integration |

### 1.J Server & directory (RESEARCH-ID-01 §9)

Directory-less by default removes a whole server-side class; any optional server surface would reintroduce it.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Username enumeration / malicious directory** — a server confirms existence or returns attacker mappings | No public searchable directory, no mandatory global username, no trusted key server; verification stays out-of-band (§7, §19; IDENTITY_ARCHITECTURE §9) | Holds only while no directory exists; any future directory is disfavored and gated | **Deferred** (future directory needs its own gate) |
| **Split-view key transparency** — a transparency server shows different views to different users | Key transparency is deferred; no directory is selected, so there is no split-view surface (§18, §19) | Re-evaluate only if usernames/server key directories/federation are introduced | **Deferred** |
| **Server links aliases** — a server touching multiple aliases correlates them | No project-owned infrastructure (ADR-0001); no server holds cross-alias state; local-first continuity (§3, §16) | Any optional server surface reintroduces this | **Deferred** / **Decided** (no server) |
| **Account-recovery takeover** — server-side recovery is abused to seize an identity | No server-side accounts and no server-mediated recovery; recovery is local/offline (§13, §19) | Presumes an account FreeLayer does not have; invariant must be kept | **Decided** (no accounts) + **Recovery review** |
| **Federation leaking identifier/domain** — a federated transport binds a stable domain-identifier | No federation in v1; no universal identifier; local-first continuity does not depend on any single server (§7, §19) | Open question whether federation is compatible with the accountless model at all | **Deferred** (federation needs its own gate) |

### 1.K Abuse & Sybil (RESEARCH-ID-01 §10)

Accountless, disposable identities are a privacy feature **and** an abuse vector. ADR-0013 states the tension honestly rather than pretending to resolve it.

| Threat | ADR-0013 mitigation | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Abuse / Sybil via disposable identities** — an attacker mints identities without limit | Abuse controls are pushed to per-room admission and inviter accountability, **not** a global identity registry; central reputation is a rejected alternative (§18; IDENTITY_ARCHITECTURE "Blocking & abuse") | No global cost/limit exists by design; per-room controls are local and manual | **Inherent** (unlinkability ↔ Sybil tension) |
| **Block evasion via new identity** — a blocked user returns under a fresh identity | Blocking binds to the **local relationship record**, not the visible alias, so alias rename cannot bypass a block; block state survives alias change (§9; IDENTITY_ARCHITECTURE "Blocking & abuse") | A genuinely new independent identity is a new relationship and **cannot be globally identified without undermining privacy** — an accepted trade-off | **Inherent** |
| **Anti-spam control reintroduces a global identifier** — the cure adds a correlatable signal | The unlinkability ↔ Sybil-resistance tension is **documented, not pretended solved**; any control adding a stable global identifier is treated as a privacy regression (§21) | No non-correlating global abuse control is known; this is an explicit open research item | **Inherent** / **Deferred** (non-correlating abuse controls) |
| **No central moderation** — no authority to remove abusers globally | Room owners hold local moderation/revocation; no central reputation database and no global person ban (§18; IDENTITY_ARCHITECTURE) | Abuse response is per-room and manual — a stated decentralization consequence | **Inherent** |

### 1.L Endpoint boundary (RESEARCH-ID-01 §11) — external to the Identity Firewall

> **Stated plainly:** endpoint protection is **EXTERNAL**. It belongs to the separate Secure Device / Endpoint Defense project. The Identity Firewall alone cannot solve these, and must not be presented as if it could.

| Threat | ADR-0013 mitigation (bounding only) | Remaining limit / residual risk | Gate that must finish it |
| --- | --- | --- | --- |
| **Endpoint compromise steals the root** — malware reads the root from memory/storage on an unlocked device | Root off less-trusted devices where possible; independent roots recommended for Ghost/ephemeral use (§11, §21); posture may restrict but never alter identity (§17) | Ghost/Cold roots **reduce, not eliminate** exposure; a compromised endpoint defeats app-level protection — total identity compromise | **External** (Secure Device) + **Gate F** (root/subordinate split) |
| **Keyboard / IME captures recovery secret** — a hostile keyboard reads the phrase as typed | No default clipboard; future protected presentation flow is a Secure Device integration (§16) | Indistinguishable from assistive tech the OS must support; capture is an endpoint problem | **External** |
| **Screen capture observes verification code/QR** — a recorder/Recall-class tool captures it | Reveal-minimization intent (§16); admission gates reveal, they do not protect pixels | Reveal-minimization helps marginally; core cannot prevent screen capture or a camera aimed at the display | **External** |
| **Clipboard leaks invite/recovery data** — other apps read the clipboard | No default clipboard for recovery material; minimize/clear for sensitive data (§16) | Other-app clipboard access is an endpoint boundary; only partially in-app | **External** (fundamentally) |
| **Secure Device unavailable** — no endpoint assurance is integrated | Posture is advisory and can never exceed `unverified` in core; missing posture cannot change identity status (§11, §17) | Users may assume endpoint protection that is not present; stated honestly that endpoint hardening is a separate, not-yet-shipped project | **External** (accepted limitation) |

## 2. Threats NOT mitigated by architecture alone

These classes survive the architecture. Each is labelled **External** (belongs to the Secure Device / Endpoint Defense project), **Deferred** (a named gate must close it), or **Inherent** (a disclosed trade-off no gate closes). None is a bug; all are stated so the architecture does not overclaim (mirrors ADR-0013 §20).

- **Endpoint compromise — External.** A compromised device, OS, or kernel defeats every app-level identity control. Malware can read the root from memory, a hostile keyboard can read a typed recovery phrase, and a recorder can capture a verification code. Ghost/Cold roots and independent roots *reduce* exposure; they do not remove it. The fix is the separate Secure Device project, not the Identity Firewall.
- **Root-compromise correlation — Inherent.** Pairwise and room-scoped identifiers stop *third parties* from correlating contexts, but the user's own vault necessarily holds the map from every alias/relationship back to its root. Whoever compromises the root (via the endpoint) can read that map. Scoping protects against outside observers, not against capture of the local authority itself.
- **Distributed revocation — Deferred (Gate H).** Local identity state is authoritative **only for the current local vault**; ADR-0013 claims no distributed consistency or revocation (§19). A removed device, a revoked invite, or an invalidated verification may persist on peers that never received the change until Gate H designs synchronization. Local revocation fences (à la TECH-21) are the only near-term analog.
- **Recovery-material compromise — Inherent / External.** Recovery material *is* identity authority: "compromised recovery material = identity compromise" (§13). No structure can make a stolen root secret safe. Entropy and at-rest encryption (Gate F) raise the cost; endpoint capture of the material (External) and the fundamental equivalence of material-to-authority (Inherent) remain.
- **User ignoring warnings — External / UX.** The architecture mandates that key/device changes raise an explicit warning and invalidate incompatible verification (§12), but it cannot force a human to read it. Making a warning un-ignorable without training users to click through is a UX task (TECH-ID-11/13), and the endpoint on which the warning renders is external.
- **Unlinkability ↔ Sybil-resistance tension — Inherent.** Strong disposable-identity privacy and strong abuse resistance pull in opposite directions. Any global, stable abuse control reintroduces the correlatable identifier the model exists to remove. ADR-0013 chooses per-room, inviter-scoped, non-global controls and **documents the tension rather than pretending it is solved** (§21). No gate closes this; it is an explicit trade-off.

## 3. Closing statement

The Identity Firewall architecture in ADR-0013 **reduces** these threat classes: pairwise and room-scoped identifiers shrink correlation; subordinate, revocable device authorizations bound the blast radius of a lost device; claim-specific verification states with mandatory key-change warnings resist silent key substitution; offline, user-held recovery removes the server/admin/master-key backdoor class; and the four category separations (profile, membership, device, DevicePosture ≠ identity) are encoded as invariants that fail closed.

It does **not eliminate** them. **No complete mitigation is claimed for any threat in this review.** Correlation of a user's own relationship map survives root compromise; revocation is not distributed; recovery material remains equivalent to identity authority; the endpoint is outside scope; and the unlinkability-versus-abuse tension is an unresolved, disclosed trade-off. Cryptography (Gate F), wire formats (Gate E), and synchronization (Gate H) must all land before any of the crypto- or sync-dependent rows above are actually closed, and endpoint protection depends on the separate Secure Device project.

Assurance is **self-asserted**: there is no real-world proofing, no attestation, no trusted authority, and no directory. "Verified" can only ever mean "this specific key was checked out-of-band," never "this is provably a particular human." Until a reviewed identity/crypto integration — and, where relevant, an endpoint integration — ships, **FreeLayer identities are not safe for information whose exposure would cause real harm.** This review is a map of what remains to be built, not a claim that the danger has been removed.

## References

- [ADR-0013 — Identity Firewall Architecture](../adr/ADR-0013-identity-firewall-architecture.md) — the decided architecture mapped against here
- [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) — normative companion (invariants, diagrams, entity sketches, storage classification)
- [RESEARCH-ID-01 — Identity Threat Model](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md) — the threat catalogue this review maps from
- [TECH-23 — Secure Device Contract Threat Model](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md) — the external endpoint/posture boundary
- [TECH-20 Membership](TECH_20_MEMBERSHIP_CAPABILITY_THREAT_MODEL.md) · [TECH-21 Revocation](TECH_21_REVOCATION_AUTHORIZATION_THREAT_MODEL.md) — membership ≠ identity; local revocation fences (sync is Gate H)
