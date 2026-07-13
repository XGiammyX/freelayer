# RESEARCH-ID-01 — Identity Threat Model

_Scope: the future Identity Firewall — local + ephemeral identities, per-contact and per-room aliases, a private local identity root with optional personas, subordinate revocable device keys, a local Trust Notebook, one-time capability-limited invites, offline recovery, Ghost/Cold identities. This is **research/threat-modeling only** (RESEARCH-ID-01): it models threats **conceptually** and designs no cryptography. It extends [../THREAT_MODEL.md](../THREAT_MODEL.md) and mirrors the honest-limitations posture of [TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md)._

> [!IMPORTANT]
> Read the [Honest limitations & deferred](#honest-limitations--deferred) section first. **No identity is implemented.** The Identity Firewall is design-only (Gate G); identity cryptography and keys are deferred (Gate F); multi-device sync is deferred (Gate H). Assurance is **self-asserted** — there is no real-world proofing, no attestation, and no trusted authority. Nothing described here is a guarantee, and until a reviewed identity/crypto integration ships, FreeLayer identities **must not be treated as safe for information whose exposure would cause real harm**. This document exists so the design does not overclaim before it is built.

## What identity is (and is not)

FreeLayer's intended identity model is **local-first, accountless, and directory-less by default**: no phone number, no email, no public directory, no globally visible identity root, and no admin/master recovery key. Because those familiar anchors are deliberately absent, the most dangerous failures are **category confusions** — treating something that is *not* identity as if it were. Each confusion below is itself a threat, and every section that follows assumes these separations hold:

- **DevicePosture is NOT identity.** A posture assessment (TECH-22/23) describes a device's claimed state; it names no person and confers no authority. Treating `hardened`/`managed_bunker` as "who someone is" is a threat.
- **Membership (`RoomMemberRef`) is NOT identity.** A membership reference (TECH-20) records that some local record participates in a room; it is unverified scaffolding that authorizes nothing by itself. Treating a member ref as a verified identity is a threat.
- **A profile name is NOT identity.** A display name/alias is attacker-chosen, non-unique, and unauthenticated. Treating it as verification is a threat (this is the core of impersonation).
- **A key is not necessarily a real-world identity.** Even once keys exist (Gate F), a key proves continuity of *some* keyholder — not that the keyholder is a specific human. Assurance beyond "same key as last time" is self-asserted.

These four separations are invariants. Their violation is called out explicitly throughout as a distinct attack class.

---

## 1. Correlation & privacy

The default privacy goal is **unlinkability**: contexts (rooms, contacts, personas) should not be correlatable into one global identity without the user's intent. Correlation attacks defeat that goal by finding a shared signal across contexts.

### Global identifier links rooms and contacts
**Attack:** any stable value reused across rooms/contacts (a global user ID, a persistent public key shown everywhere, a fixed avatar hash) lets an observer join contexts into one identity. **Why dangerous:** it silently rebuilds the very global identifier the model set out to avoid, collapsing every alias into one graph. **Mitigation direction:** no globally visible identity root; identity material scoped per-context by construction. *Deferred — the actual key/identifier scoping is Gate F/G.*

### Stable usernames enable tracking
**Attack:** an optional stable username becomes a long-lived handle that any peer can log and cross-reference over time. **Why dangerous:** stability is exactly what enables longitudinal tracking and re-identification. **Mitigation direction:** treat stable handles as opt-in, per-context, and clearly labeled as linkable; prefer ephemeral by default. *Open question: can any stable handle exist without becoming a tracking anchor? — Gate G ADR.*

### Shared avatars/names correlate contexts
**Attack:** the same avatar image, bio, or display name is reused across personas/aliases; an observer clusters them by content. **Why dangerous:** users leak the link themselves through convenience, defeating persona separation. **Mitigation direction:** per-alias/per-persona profile assets with UI that warns on reuse; no automatic profile propagation across personas. *Open question: how aggressively should the UI discourage reuse without becoming unusable?*

### Per-contact aliases leaking through reuse
**Attack:** a per-contact alias intended for one relationship is presented to a second contact (accidentally, or via a shared room). **Why dangerous:** two contacts who compare notes can link the two relationships to one person. **Mitigation direction:** bind each alias to its contact scope and refuse to present it outside that scope. *Deferred — scope binding needs the Gate G identity model.*

### Per-room aliases leaking through recovery or device sync
**Attack:** per-room aliases that were unlinkable at creation become correlatable when recovery material or a device-sync bundle carries the full alias→root mapping. **Why dangerous:** the mapping is the crown jewel; one leaked backup re-links everything. **Mitigation direction:** minimize what recovery/sync must carry; consider that the alias→root map may be the single most sensitive local asset. *Deferred — recovery format is Gate F/G; sync is Gate H.*

### Invite links leaking relationships
**Attack:** an invite payload embeds identifiers, room identity, or the inviter's stable key, so possessing/forwarding it reveals a relationship. **Why dangerous:** invites travel over untrusted couriers; a relationship graph leaks to whoever handles the link. **Mitigation direction:** one-time, capability-limited invites that reveal the minimum; no stable identifier baked into the payload. *(See §6.)*

### Recovery services correlating identities
**Attack:** an (optional) recovery or social-recovery service sees which identities/aliases request recovery and links them. **Why dangerous:** a recovery helper becomes a correlation oracle for the social graph. **Mitigation direction:** prefer fully local/offline recovery; if any helper exists, it must learn no cross-identity linkage. *Open question: is any online recovery helper compatible with unlinkability? — Gate F/G ADR.*

### Device keys correlating personas
**Attack:** one subordinate device key signs actions across multiple personas, so a peer sees the same device key under two personas and links them. **Why dangerous:** the device layer silently defeats persona separation the user believed was intact. **Mitigation direction:** device keys must not be presented across persona boundaries; persona isolation extends down to the device-key layer. *Deferred — device/persona key relationship is Gate F/G.*

### Key-transparency queries exposing social graph
**Attack:** a (future) key-transparency/lookup mechanism logs *who queries whose keys*, exposing the query graph even if answers are correct. **Why dangerous:** metadata about lookups reconstructs the social graph without ever breaking a key. **Mitigation direction:** any transparency mechanism must not require identifying, loggable, per-contact queries. *Deferred — key transparency is Gate F/G; it may be out of scope entirely for a directory-less design.*

### Contact discovery exposing address books
**Attack:** a contact-discovery feature uploads or hashes the address book to find peers. **Why dangerous:** address-book upload is one of the most privacy-corrosive patterns in messengers; it leaks non-users and the full contact graph. **Mitigation direction:** no server-side contact discovery; no address-book access by default — consistent with "no phone/email, no public directory." *Open question: can any privacy-preserving discovery exist, or is out-of-band exchange the only acceptable path?*

---

## 2. Impersonation & key substitution

Impersonation exploits the gap between *what a user sees* (a name, an avatar, a device label) and *what is actually authenticated* (nothing yet — keys are Gate F).

### Similar-alias attacker
**Attack:** an attacker registers/presents an alias visually or semantically close to a trusted contact's. **Why dangerous:** the user acts on the name, not on any verified key (a **profile-name-as-identity** confusion). **Mitigation direction:** never treat an alias as authentication; require explicit verification state bound to a key before trust is shown. *Deferred — the binding target (the key) is Gate F.*

### Malicious server substitutes keys
**Attack:** a server/relay in the path returns an attacker's key for a requested contact. **Why dangerous:** classic MitM; without out-of-band verification the substitution is invisible. **Mitigation direction:** directory-less design removes the trusted key server; rely on out-of-band verification (QR/safety code). *Deferred — verification cryptography is Gate F.*

### Compromised relay changes an invite
**Attack:** a relay that carries an invite rewrites the embedded key/room reference. **Why dangerous:** transports are assumed hostile; a tampered invite binds the victim to the attacker. **Mitigation direction:** invites must be integrity-protected end-to-end so a courier cannot alter them undetectably. *Deferred — invite integrity is Gate F.*

### QR payload replaced
**Attack:** the QR shown for in-person verification is swapped (malicious display, overlay, or relayed screen). **Why dangerous:** in-person verification is a primary trust root; a swapped payload poisons it at the source. **Mitigation direction:** short authenticated safety codes compared mutually; reveal-minimization on the verification screen (mirrors [../THREAT_MODEL.md](../THREAT_MODEL.md) capture threats). *Deferred — code construction is Gate F; capture is endpoint (§11).*

### Ignored key-change warning
**Attack:** a contact's key changes; the user clicks through the warning. **Why dangerous:** the one moment designed to catch substitution is dismissed by habit. **Mitigation direction:** make key-change consequences legible; require re-verification rather than a dismissible banner for sensitive contexts. *Open question: what UX makes a key change un-ignorable without training users to click through? — Gate G.*

### Profile name mistaken for verification
**Attack:** the UI presents a display name prominently and verification state faintly (or not at all). **Why dangerous:** it institutionalizes the **name-is-identity** confusion. **Mitigation direction:** verification state must be the load-bearing UI element; names are advisory decoration. *Open question: verification-first UX design — Gate G.*

### Device ID mistaken for identity
**Attack:** a device label/ID ("Gianmarco's laptop") is read as the person. **Why dangerous:** a **device-is-identity** confusion; a stolen/relabeled device inherits unearned trust. **Mitigation direction:** device is a subordinate, revocable key under an identity — never the identity itself; UI must keep the levels distinct. *Deferred — device/identity key relation is Gate F/G.*

### Member reference mistaken for identity
**Attack:** a `RoomMemberRef` is treated as proof of who someone is. **Why dangerous:** membership is unverified local scaffolding (TECH-20) and authorizes nothing; conflating it grants unearned trust (**membership-is-identity** confusion). **Mitigation direction:** keep membership and identity as separate types with no implicit coercion; verification is a distinct, explicit act. *Deferred — verified identity is Gate G.*

### Recovery restores attacker-controlled key
**Attack:** a recovery flow reinstates or accepts a key the attacker planted. **Why dangerous:** recovery becomes a key-substitution channel that bypasses verification. **Mitigation direction:** recovery must re-establish assurance explicitly, never silently promote a restored key to "verified." *Deferred — recovery + assurance semantics are Gate F/G. (See §4.)*

### Stale device keeps acting
**Attack:** a removed/rotated device continues to sign or send because revocation did not propagate. **Why dangerous:** without distributed revocation, a stale key can impersonate the user to peers who never saw the removal. **Mitigation direction:** local revocation fences (mirroring TECH-21) plus, eventually, key rotation on removal. *Deferred — distributed revocation is Gate H; rotation is Gate F.*

---

## 3. Multi-device

Multi-device support multiplies the number of keys that can speak for one identity. Every added device is added attack surface, and sync (Gate H) does not yet exist to mediate it.

### Unverified device linked
**Attack:** a new device is linked without the existing device verifying it. **Why dangerous:** an attacker who reaches the linking flow adds themselves as "you." **Mitigation direction:** device linking must require an authenticated approval from an already-trusted device. *Deferred — linking protocol is Gate F/H.*

### Lost device stays trusted
**Attack:** a lost/stolen device remains an authorized signer. **Why dangerous:** the finder inherits full identity authority. **Mitigation direction:** revocable subordinate device keys with prompt local revocation and eventual rotation. *Deferred — revocation propagation is Gate H.*

### Compromised device links another
**Attack:** a compromised device uses its authority to link a further attacker device. **Why dangerous:** compromise becomes self-propagating and outlives cleanup of the first device. **Mitigation direction:** linking events must be visible/auditable across devices and ideally require fresh human approval. *Deferred — Gate F/H.*

### Device removal doesn't rotate keys
**Attack:** a device is removed from the list but shared/room keys are not rotated. **Why dangerous:** the removed device still decrypts using retained key material. **Mitigation direction:** removal must trigger rotation of anything the device could access. *Deferred — key rotation is Gate F; room-key sync is Gate H.*

### Old history copied to new device
**Attack:** linking a new device bulk-copies history (and the alias→root map). **Why dangerous:** it widens exposure of the most sensitive local state to every new device and its backups. **Mitigation direction:** minimize what a new device receives; make history transfer explicit and scoped, not automatic. *Open question: default history-transfer scope — Gate G/H.*

### Incomplete device list
**Attack:** the set of a contact's devices shown to the user is missing an attacker device (or a device the user forgot). **Why dangerous:** the user cannot verify what they cannot see; a hidden device signs undetected. **Mitigation direction:** device lists must be authenticated and complete, or the model must not depend on their completeness. *Deferred — device-list authentication is Gate F/H.*

### Device passport becomes a tracking identifier
**Attack:** a per-device credential/"passport" is stable and observable, so peers use it to track the device (and thus the person) across contexts. **Why dangerous:** it reintroduces a global identifier at the device layer (§1). **Mitigation direction:** device credentials must be scoped and non-correlatable across contexts. *Deferred — Gate F/G.*

### Identity root living on every device
**Attack:** the private identity root is copied to every device for convenience. **Why dangerous:** every device becomes a single point of total compromise; losing one loses the root (mirrors the Ghost Vault rationale in [../THREAT_MODEL.md](../THREAT_MODEL.md)). **Mitigation direction:** keep the identity root off online/less-trusted devices where possible; devices hold subordinate keys, not the root. *Deferred — root/subordinate split is Gate F/G; connects to Ghost/Cold identities (§below).*

---

## 4. Recovery

Recovery is the deliberate re-granting of identity authority. Every recovery mechanism is also an attacker's preferred entry point, and the design explicitly rejects an admin/master recovery key.

### Weak recovery phrase
**Attack:** a low-entropy recovery phrase/PIN is guessed or brute-forced. **Why dangerous:** recovery weakness caps the strength of the entire identity, regardless of key quality. **Mitigation direction:** enforce sufficient entropy; treat the phrase as the identity's true root secret. *Deferred — parameters are Gate F.*

### Cloud-backup compromise
**Attack:** recovery material synced to a cloud backup is exfiltrated from that provider. **Why dangerous:** it moves the crown-jewel secret to a third party outside FreeLayer's control (mirrors the OS-backup risk in [../DATA_LEAKAGE_MODEL.md](../DATA_LEAKAGE_MODEL.md)). **Mitigation direction:** never place usable recovery secrets in cloud backups; prefer offline recovery material. *Open question: how to make offline recovery usable enough that users don't route around it into the cloud?*

### PIN brute force
**Attack:** an unlock/recovery PIN is attacked offline or online. **Why dangerous:** short PINs are trivially brute-forced without rate limiting or hardware backing. **Mitigation direction:** rate limiting/lockout where a trusted element exists; do not rely on PINs alone for high-value roots. *Deferred — depends on Gate F and endpoint (§11).*

### Recovery-server abuse
**Attack:** an optional recovery server is malicious or coerced into serving/altering recovery data. **Why dangerous:** it becomes a central point to attack in an otherwise decentralized design. **Mitigation direction:** avoid an authoritative recovery server; if any helper exists it must hold no usable secret and grant no authority. *Open question: whether any server-assisted recovery is acceptable — Gate G ADR.*

### Recovery rollback
**Attack:** an old recovery snapshot is replayed to reinstate revoked keys or stale trust. **Why dangerous:** rollback silently undoes revocation and re-enables a removed device/persona. **Mitigation direction:** recovery must reject rollback (a revision/epoch notion, mirroring TECH-21/23 rollback rejection). *Deferred — freshness has no trusted clock/epoch yet (Gate F).*

### Social-recovery collusion
**Attack:** a threshold of "trusted" recovery contacts colludes (or is compromised/coerced) to recover an identity. **Why dangerous:** the recovery quorum becomes an attack target and a coercion vector. **Mitigation direction:** if social recovery exists, thresholds and guardian selection must resist collusion and disclose the trust being placed. *Open question: is social recovery worth its correlation cost (§1)? — Gate G ADR.*

### Recovery metadata
**Attack:** the act/timing/participants of recovery leak even when the payload is protected. **Why dangerous:** recovery metadata links identities and signals a high-value moment to an observer. **Mitigation direction:** minimize and localize recovery so there is little metadata to leak. *Deferred — Gate F/G.*

### Total loss of identity authority
**Attack:** the user loses all recovery material and every device. **Why dangerous:** with **no admin/master recovery key by design**, the identity is unrecoverable — an intentional trade-off that is nonetheless a real availability threat. **Mitigation direction:** make the trade-off explicit to users; encourage redundant offline recovery. *Stated limitation, not a bug: there is no backdoor to restore lost authority.*

### Recovery silently changing assurance
**Attack:** after recovery, previously "verified" contacts/devices are shown as still verified without re-checking. **Why dangerous:** recovery becomes a laundering path for trust and for substituted keys (§2). **Mitigation direction:** recovery must reset/re-derive assurance explicitly, never carry it forward silently. *Deferred — assurance semantics are Gate G.*

### Administrator recovery becoming a backdoor
**Attack:** an "admin recovery" or "master key" feature is added for convenience. **Why dangerous:** any master recovery key is, by definition, a backdoor and a single point of catastrophic compromise. **Mitigation direction:** **explicitly forbidden by design** — no admin/master recovery key exists; treat any proposal to add one as a top-severity regression. *Design invariant.*

---

## 5. Alias

Aliases give users per-context names without a global handle. The threats are that aliases collide, deceive, enumerate, or get mapped back to the root.

### Collision
**Attack:** two identities present the same alias in a context. **Why dangerous:** the user cannot tell them apart and may trust the wrong one. **Mitigation direction:** aliases are display hints, never unique keys; disambiguate by verified key, not by name. *Deferred — the disambiguating key is Gate F.*

### Homograph / spoofing
**Attack:** Unicode look-alikes or confusable scripts produce a visually identical alias. **Why dangerous:** defeats visual comparison, the user's main defense. **Mitigation direction:** confusable/script normalization and skeleton checks in display; warn on mixed-script aliases. *Open question: normalization policy — Gate G.*

### Enumeration
**Attack:** an attacker probes to discover which aliases exist. **Why dangerous:** enumeration rebuilds a directory the design intentionally omits. **Mitigation direction:** no lookup surface that confirms alias existence; directory-less by default. *Deferred — depends on there being no server directory (§9).*

### Reuse
**Attack:** the same alias is reused across contexts by the user. **Why dangerous:** enables correlation (§1) and undercuts persona separation. **Mitigation direction:** encourage per-context aliases; warn on cross-context reuse. *Open question: UX friction vs. safety balance.*

### Migration
**Attack:** a user migrates an alias between identities/personas and observers link old to new. **Why dangerous:** the migration itself is a correlation event. **Mitigation direction:** treat alias migration as a linkability disclosure and surface it. *Deferred — Gate G.*

### Stale alias
**Attack:** an alias keeps resolving/displaying after it should have been retired. **Why dangerous:** stale mappings mislead the user about who they are talking to. **Mitigation direction:** aliases carry lifecycle; retired aliases stop resolving. *Deferred — Gate G.*

### Per-room alias mapped back to global root
**Attack:** a per-room alias is correlated back to the identity root via shared keys, device passports, recovery, or sync (§§1–4). **Why dangerous:** it defeats the entire point of per-room aliases (the **alias→root** confusion inverted). **Mitigation direction:** ensure no lower layer (key/device/recovery/sync) re-links an alias to the root. *Deferred — cross-layer scoping is Gate F/G/H.*

### UI shows wrong identity scope
**Attack:** the UI displays the wrong alias/persona for the current room or composes a message under the wrong identity. **Why dangerous:** a single mis-scoped send can unmask a persona irreversibly. **Mitigation direction:** the active identity scope must be unambiguous and confirmed before context-crossing actions. *Open question: scope-indication UX — Gate G.*

### Screenshots leak multiple aliases
**Attack:** a screenshot (or task-switcher thumbnail) captures a view showing several of the user's aliases together. **Why dangerous:** one image links personas the user kept separate. **Mitigation direction:** avoid rendering multiple personas in one view; apply capture-minimization (mirrors [../THREAT_MODEL.md](../THREAT_MODEL.md)). *Endpoint-bounded — see §11.*

---

## 6. Invite

Invites are the accountless substitute for "add by phone number." They must grant just enough to join, once, without leaking relationships.

### Replay
**Attack:** a captured invite is used more than once. **Why dangerous:** a single leaked invite admits many attackers. **Mitigation direction:** one-time invites that are consumed on first use. *Deferred — single-use enforcement needs Gate F/H state.*

### Forwarding
**Attack:** the intended recipient forwards the invite to someone else. **Why dangerous:** the inviter loses control of who joins. **Mitigation direction:** bind invites to a capability scope and, where possible, to the accepting party; keep authority minimal. *Open question: bind-to-recipient without a directory — Gate G.*

### Theft
**Attack:** an invite is stolen in transit over an untrusted courier. **Why dangerous:** transports are hostile; a stolen invite is a valid credential. **Mitigation direction:** short lifetime + single use + minimal authority limit the blast radius of theft. *Deferred — Gate F.*

### Unlimited lifetime
**Attack:** an invite never expires. **Why dangerous:** an old link resurfaces and admits an attacker long after the context is gone. **Mitigation direction:** mandatory expiry; no perpetual invites. *Deferred — Gate G.*

### Grants too much authority
**Attack:** accepting an invite confers broad room/identity authority. **Why dangerous:** it violates least privilege; a joiner gets more than "present in room." **Mitigation direction:** capability-limited invites granting the minimum; membership authorizes nothing by itself (TECH-20). *Deferred — capability binding is Gate G.*

### Reveals room identity
**Attack:** the invite payload discloses the room's identity/topic/members. **Why dangerous:** merely holding the link exposes a private relationship (§1). **Mitigation direction:** reveal the minimum needed to join; no room identity baked into the link. *Deferred — Gate F/G.*

### Accepted by wrong persona
**Attack:** the user accepts an invite under the wrong persona/identity. **Why dangerous:** it links that persona to the room, potentially unmasking it. **Mitigation direction:** require explicit persona selection and confirmation at accept time. *Open question: accept-time scope UX — Gate G.*

### Binds wrong device
**Attack:** acceptance binds the invite to an unintended/attacker device. **Why dangerous:** the wrong device inherits the granted capability. **Mitigation direction:** device selection must be explicit and verifiable at accept time (ties to §3). *Deferred — Gate F/H.*

### Used after revocation
**Attack:** an invite is used after the inviter revoked it. **Why dangerous:** without propagation, revocation may not reach the acceptance point. **Mitigation direction:** local revocation fence at acceptance (mirroring TECH-21); eventual distributed revocation. *Deferred — distributed revocation is Gate H.*

---

## 7. Trust & verification

Verification is how "same key as last time" becomes "I confirmed who this is." The threats are false confidence and trust that outlives the thing it was about.

### TOFU accepted without warning
**Attack:** trust-on-first-use silently accepts a first key with no prompt. **Why dangerous:** the user never consciously roots their trust and can't notice a first-contact MitM. **Mitigation direction:** make first-use state explicit and upgradeable to verified; don't present TOFU as verified. *Deferred — Gate F/G.*

### Verification state not bound to key
**Attack:** "verified" is stored against an alias/contact record but not cryptographically bound to the specific key. **Why dangerous:** the key can change while the badge stays (enabling §2 substitution). **Mitigation direction:** verification must attach to the key, not to the name/record. *Deferred — the binding is Gate F.*

### Trust surviving key replacement
**Attack:** a key is replaced (rotation, recovery, new device) and prior verification carries over. **Why dangerous:** trust laundering — a substituted key inherits a badge it never earned. **Mitigation direction:** key change invalidates verification pending re-check. *Deferred — Gate F/G. (Connects to §2, §4.)*

### Verification wrongly copied between aliases
**Attack:** verifying one alias marks another alias/persona of the same contact as verified. **Why dangerous:** it links personas (§1) and asserts assurance that was never performed for that context. **Mitigation direction:** verification is per-alias/per-key scope; no cross-alias propagation. *Deferred — Gate G.*

### Overstated introduction chain
**Attack:** a transitive introduction ("a contact vouches for a contact") is presented as strong verification. **Why dangerous:** chained/transitive trust is weaker than direct verification but can look identical in the UI. **Mitigation direction:** the Trust Notebook must record *how* trust was established and render its strength honestly. *Open question: how to display trust provenance without overstating — Gate G.*

### Safety code compared over a compromised channel
**Attack:** the safety-code comparison happens over a channel an attacker controls/relays. **Why dangerous:** a MitM can relay both sides and forge agreement. **Mitigation direction:** compare over an out-of-band or in-person channel; educate that in-band comparison is weaker. *Deferred — code design is Gate F; channel choice is user-operational.*

### Verification UX creating false confidence
**Attack:** the UI overstates assurance (checkmarks, "secure" labels) beyond what was actually verified. **Why dangerous:** false confidence causes users to share secrets they shouldn't. **Mitigation direction:** conservative, honest assurance labeling; distinguish self-asserted from verified. *Open question: assurance vocabulary — Gate G. (Overclaim discipline mirrors repo-wide practice.)*

### Key transparency unavailable/inconsistent
**Attack:** a (future) transparency mechanism is offline or serves inconsistent views, and the UI degrades to "trust anyway." **Why dangerous:** an availability failure becomes a silent security downgrade. **Mitigation direction:** fail closed on transparency gaps rather than silently proceeding. *Deferred — key transparency may be out of scope for a directory-less design; Gate F/G. (See §9 split-view.)*

---

## 8. Local storage

Identity is local-first, so the device's disk holds the most sensitive assets: the identity root, the alias/relationship graph, and the Trust Notebook. These threats mirror the storage-layer threats in [../THREAT_MODEL.md](../THREAT_MODEL.md) and [STORAGE_BOUNDARY_AUDIT.md](STORAGE_BOUNDARY_AUDIT.md).

### Identity roots in plaintext
**Attack:** the identity root is written unencrypted to disk. **Why dangerous:** device-at-rest access yields total identity compromise. **Mitigation direction:** encryption at rest per storage policy; keep the root out of low-trust storage (ties to Ghost/Cold identities). *Deferred — key-at-rest encryption is Gate F.*

### Alias/relationship graph leaked
**Attack:** the alias→contact→room graph is read from local storage. **Why dangerous:** it is the correlation crown jewel (§1); one read re-links every persona. **Mitigation direction:** encrypt and minimize the stored graph; treat it as top-sensitivity. *Deferred — Gate F/G.*

### Trust Notebook leaked
**Attack:** the local Trust Notebook (verification records, provenance) is exfiltrated. **Why dangerous:** it reveals who the user trusts and how — a rich social-graph artifact. **Mitigation direction:** encrypt at rest; store the minimum needed to render honest trust state. *Deferred — Gate F.*

### Recovery material cached
**Attack:** recovery secrets are cached in memory or on disk longer than needed. **Why dangerous:** widens the window for §4 recovery-material theft. **Mitigation direction:** ephemeral handling; zeroize/clear promptly; never persist usable recovery secrets. *Deferred — Gate F; honest limit: memory is not protected from a compromised process.*

### Deleted identity still recoverable
**Attack:** a "deleted" identity remains recoverable via journaling, undelete, or backups. **Why dangerous:** deletion is not forensic erasure (mirrors Ghost/Bunker's "harm reduction, not guarantee"). **Mitigation direction:** best-effort secure deletion + key destruction; state the forensic-residue limitation honestly. *Deferred — Gate F; OS/hardware residue is out of app control.*

### Logs containing keys/identifiers
**Attack:** keys, aliases, or identifiers land in logs/audit/crash reports. **Why dangerous:** logs are a common, overlooked exfiltration channel. **Mitigation direction:** redacted, content-free identity logging (mirrors the content-free audit pattern in TECH-16..23). *Design invariant — never log identity material.*

### App backups including secrets
**Attack:** OS/app backup mechanisms sweep up identity roots or recovery material. **Why dangerous:** secrets escape to backup storage the user never chose (mirrors [../DATA_LEAKAGE_MODEL.md](../DATA_LEAKAGE_MODEL.md)). **Mitigation direction:** mark identity secrets as backup-excluded where the platform allows; never rely on backups for recovery of usable secrets. *Deferred — platform backup behavior varies; Gate F.*

---

## 9. Server & directory

FreeLayer is directory-less by default, which removes a whole class of server-side attacks — but any optional server surface (or a future federation) reintroduces them.

### Username enumeration
**Attack:** a server endpoint confirms whether a username/alias exists. **Why dangerous:** rebuilds a directory and enables targeted attacks (§5). **Mitigation direction:** no enumerable lookup; directory-less by default. *Design posture — avoid any endpoint that answers "does X exist."*

### Malicious directory
**Attack:** an (optional/federated) directory returns attacker-controlled mappings. **Why dangerous:** it becomes a key-substitution and correlation oracle (§2). **Mitigation direction:** do not depend on a trusted directory; verification stays out-of-band. *Deferred — any directory is Gate G and disfavored.*

### Split-view key transparency
**Attack:** a transparency/directory server shows different views to different users. **Why dangerous:** split view defeats transparency and hides a substituted key from the victim only. **Mitigation direction:** if transparency ever exists, it needs cross-user consistency (gossip/witnessing); otherwise fail closed. *Deferred — Gate F/G; likely out of scope for directory-less design.*

### Server links aliases
**Attack:** a server that touches multiple aliases correlates them by timing, IP, or account. **Why dangerous:** reintroduces the global identity the design removed (§1). **Mitigation direction:** no server holds cross-alias state; prefer no server at all. *Design posture.*

### Account-recovery takeover
**Attack:** a server-side account-recovery flow is abused to seize an identity. **Why dangerous:** it is the classic centralized-messenger takeover vector — and it presumes an account that FreeLayer does not have. **Mitigation direction:** no server-side accounts and no server-mediated recovery; recovery is local/offline. *Design invariant — no accounts, no admin recovery.*

### Federation leaking identifier/domain
**Attack:** a future federated transport attaches a home-server domain or federated identifier to messages. **Why dangerous:** a domain is a stable, correlatable identifier that partially de-anonymizes the user. **Mitigation direction:** if federation is ever considered, it must not bind a stable domain-identifier to identity. *Open question: is federation compatible with the accountless model at all? — Gate G/H ADR.*

### Server deletion breaking continuity
**Attack:** a relied-upon server disappears, breaking identity continuity/verification. **Why dangerous:** it turns availability into an identity-integrity problem. **Mitigation direction:** identity continuity must not depend on any single server surviving (local-first continuity). *Design posture — "no central place to shut down" ([../THREAT_MODEL.md](../THREAT_MODEL.md)).*

---

## 10. Abuse & Sybil

Accountless, disposable identities are a privacy feature and an abuse vector. This section states the core tension honestly: **unlinkability and abuse-resistance pull in opposite directions**, and there is no central moderator by design.

### Unlimited disposable identities
**Attack:** an attacker mints identities without limit. **Why dangerous:** Sybil attacks, ban evasion, and spam scale for free. **Mitigation direction:** per-room/inviter-side cost or rate controls — not global identity registration. *Open question: abuse controls that do not create correlation (§1) — Gate G ADR.*

### Invite spam
**Attack:** invites are mass-generated to flood or infiltrate. **Why dangerous:** overwhelms recipients and rooms. **Mitigation direction:** invite rate limits and single-use/expiry (§6) scoped to the inviter. *Deferred — Gate G.*

### Block-evasion via new identities
**Attack:** a blocked user returns under a fresh identity. **Why dangerous:** blocking is only as strong as identity stability, which the design intentionally minimizes. **Mitigation direction:** room-scoped admission controls and inviter accountability rather than global identity blocking. *Open question — inherent tension; Gate G.*

### Impersonation (abuse context)
**Attack:** disposable identities impersonate a known user to a room. **Why dangerous:** cheap identities make social impersonation cheap (§2). **Mitigation direction:** verification-first trust display; membership is not identity (TECH-20). *Deferred — Gate F/G.*

### Room infiltration
**Attack:** a Sybil joins a room via a leaked/forwarded invite (§6) to surveil or disrupt. **Why dangerous:** insiders have full plaintext access (out of scope for confidentiality per [../THREAT_MODEL.md](../THREAT_MODEL.md)). **Mitigation direction:** tight invite scope + inviter accountability + local revocation. *Deferred — Gate G/H.*

### No central moderation
**Attack:** there is no central authority to remove abusers globally. **Why dangerous:** abuse response is per-room and manual. **Mitigation direction:** empower room owners with local moderation/revocation; accept the absence of global moderation as a design consequence. *Stated limitation — decentralization trade-off.*

### Anti-spam controls creating correlation
**Attack:** an anti-abuse mechanism (proof-of-work tied to a stable key, reputation, phone/email gating) introduces a correlatable signal. **Why dangerous:** the cure reintroduces the global identifier the model removed — this is **the central tension of the whole model**. **Mitigation direction:** favor per-room, non-global, non-correlating controls; treat any anti-abuse proposal that adds a stable global identifier as a privacy regression. *Open question — the unlinkability-vs-abuse-resistance trade-off is an explicit Gate G research item, not solved here.*

---

## 11. Endpoint boundary

> **Stated plainly:** endpoint protection is **EXTERNAL** to the Identity Firewall. It belongs to the separate Secure Device / Endpoint Defense project ([TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md), [../ENDPOINT_DEFENSE_MODEL.md](../ENDPOINT_DEFENSE_MODEL.md)). **The Identity Firewall alone cannot solve these**, and it must not be presented as if it could. Admission gates *reveal*; identity keys *authenticate* — neither hardens the endpoint.

### Compromised device steals identity root
**Attack:** malware on an unlocked device reads the identity root from memory or storage. **Why dangerous:** total identity compromise; future messages and trust are forfeit. **Mitigation direction (external):** keep the root off online devices (Ghost/Cold identities reduce, not eliminate, exposure); the endpoint fix is the Secure Device project. *Out of scope for the Identity Firewall — external.*

### Malicious keyboard reads recovery secret
**Attack:** a hostile IME/keyboard captures the recovery phrase as it is typed. **Why dangerous:** it exfiltrates the identity's root secret through a legitimate OS channel. **Mitigation direction (external):** indistinguishable from assistive tech the OS must support; belongs to the endpoint project. *External.*

### Screen capture observes verification code
**Attack:** a screen recorder/Recall-class tool captures the safety code or QR. **Why dangerous:** it poisons verification (§2, §7) from the endpoint. **Mitigation direction (external):** reveal-minimization helps marginally, but capture is an endpoint problem. *External.*

### Clipboard leaks invite/recovery data
**Attack:** invite links or recovery material placed on the clipboard are read by other apps. **Why dangerous:** the clipboard is a shared, widely-readable surface. **Mitigation direction:** minimize clipboard use for sensitive material and clear it quickly — but other-app clipboard access is an endpoint boundary. *Partially in-app (minimize/clear), fundamentally external.*

### Secure Device unavailable
**Attack:** no Secure Device provider is integrated, so no endpoint assurance exists. **Why dangerous:** users may assume endpoint protection that is not present. **Mitigation direction:** state honestly that posture is advisory/`unverified` and that endpoint hardening is a separate, not-yet-shipped project (mirrors TECH-23). *External — accepted limitation.*

---

## Honest limitations & deferred

**Stated plainly, without hedging:**

- **No identity is implemented.** The Identity Firewall is design-only (Gate G). Everything above models threats *conceptually*; no identity code, key, or protocol exists in the repository today.
- **Assurance is self-asserted.** There is no real-world proofing, no attestation, no trusted authority, and no directory. "Verified" can only ever mean "I checked this key out-of-band," never "this is provably a specific human."
- **Crypto is deferred to Gate F.** No identity cryptography is designed here. Key generation, rotation, binding, signatures, freshness/epochs, and transparency are all Gate F work; this document deliberately designs none of it.
- **The identity model is Gate G.** Aliases, personas, the identity root/subordinate-device split, invites, the Trust Notebook, and recovery semantics are Gate G design work pending ADRs.
- **Sync is deferred to Gate H.** Multi-device propagation, distributed revocation, and cross-device history are Gate H; local revocation fences (à la TECH-21) are the only near-term analog.
- **The four separations are load-bearing.** DevicePosture ≠ identity, membership ≠ identity, profile name ≠ identity, key ≠ real-world person. Violating any of them is treated as a distinct threat, not an implementation detail.
- **The unlinkability-vs-abuse tension is unresolved.** §10 states it honestly: strong disposable-identity privacy and strong abuse resistance conflict, and no central moderator exists by design. Resolving this is an explicit Gate G research question, not a solved problem.
- **Endpoint protection is external.** §11 belongs to the separate Secure Device / Endpoint Defense project. The Identity Firewall cannot harden a compromised endpoint.
- **Not safe for real secrets.** Until a reviewed identity/crypto (Gate F/G) and, where relevant, endpoint integration ships, FreeLayer identities must not be treated as a safe home for information whose exposure would cause real harm.

### Top threats — indicative severity/likelihood and resolving gate

Severity and likelihood are **indicative pre-implementation judgments**, not measurements — nothing is built yet, so these rank where design attention is most needed. "Resolves via" names the gate/ADR that must close each item.

| # | Threat | Severity | Likelihood | Resolves via |
|---|--------|----------|------------|--------------|
| 1 | Alias/relationship graph re-linked to identity root (correlation crown jewel) — §1/§5/§8 | Critical | Medium | Gate F (key scoping) + Gate G (identity model ADR) |
| 2 | Key substitution / MitM presented as verified — §2/§7 | Critical | Medium | Gate F (key binding, verification) |
| 3 | Identity root stolen from a compromised endpoint — §11 | Critical | Medium | External (Secure Device project); Gate F (Ghost/Cold root split) |
| 4 | Recovery reinstates attacker key or launders assurance — §2/§4 | Critical | Low–Med | Gate F/G (recovery + assurance semantics ADR) |
| 5 | Admin/master recovery key added as a backdoor — §4 | Critical | Low | Design invariant (forbidden); Gate G ADR to keep it out |
| 6 | Verification survives key replacement (trust laundering) — §7 | High | Medium | Gate F (bind verification to key) |
| 7 | Stale/removed device keeps acting; removal doesn't rotate keys — §3 | High | Medium | Gate F (rotation) + Gate H (distributed revocation) |
| 8 | Unlimited disposable identities / Sybil / block-evasion — §10 | High | High | Gate G ADR (non-correlating abuse controls) |
| 9 | Anti-spam control reintroduces a global correlatable identifier — §10/§1 | High | Medium | Gate G ADR (unlinkability-vs-abuse trade-off) |
| 10 | Invite leaks relationship / grants too much / reused after revocation — §6 | High | Medium | Gate G (capability invites) + Gate H (revocation) |
| 11 | Homograph/similar-alias impersonation via name-as-identity — §2/§5 | High | High | Gate G (verification-first UX, confusable normalization) |
| 12 | Identity secrets escape via logs, backups, or plaintext at rest — §8 | High | Medium | Gate F (encryption at rest) + logging invariants |

## References

- [../THREAT_MODEL.md](../THREAT_MODEL.md) — top-level threat model, attacker classes, honest limitations
- [TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md) — endpoint/posture boundary (external Secure Device project)
- [TECH_20_MEMBERSHIP_CAPABILITY_THREAT_MODEL.md](TECH_20_MEMBERSHIP_CAPABILITY_THREAT_MODEL.md) — membership is not identity
- [TECH_21_REVOCATION_AUTHORIZATION_THREAT_MODEL.md](TECH_21_REVOCATION_AUTHORIZATION_THREAT_MODEL.md) — local revocation fences (sync is Gate H)
- [../ENDPOINT_DEFENSE_MODEL.md](../ENDPOINT_DEFENSE_MODEL.md), [../DATA_LEAKAGE_MODEL.md](../DATA_LEAKAGE_MODEL.md), [STORAGE_BOUNDARY_AUDIT.md](STORAGE_BOUNDARY_AUDIT.md)
