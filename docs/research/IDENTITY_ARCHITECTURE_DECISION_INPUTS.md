# Identity Architecture — Decision Inputs (RESEARCH-ID-01)

_Branch: `research/identity-competitor-threat-model`. Date: 2026-07-13._

> [!IMPORTANT]
> **This is research only. No implementation, no crypto algorithm selection, no wire format.** Every classification, lean, and preliminary constraint in this document is an *input* to the future **TECH-ID-02 Identity Architecture ADR** and is **not a decision**. Where this document says "recommended" it means "recommended as an input for TECH-ID-02 to evaluate", never "adopted". Real identity remains **Gate G / Gate F crypto** work per [IMPLEMENTATION_GATES.md](../IMPLEMENTATION_GATES.md) and the [Identity Firewall](../IDENTITY_FIREWALL.md) invariants.

> [!NOTE]
> **Source verification pending: internet unavailable in this environment.** Competitor evidence draws on the existing [Landscape Comparison](../COMPETITOR_COMPARISON.md) (itself marked *TODO research* per row) and stable, widely-documented knowledge (author cutoff 2026-01). Every competitor claim below must be re-confirmed against each project's current primary documentation before external citation. Claims are labelled **[evidence]** (documented/observed) or **[inference]** (reasoned design judgement) throughout.

## Reading this document

- **Evidence vs inference are separated.** `[evidence]` = something documented in FreeLayer docs, a competitor's published design, or a cited standard. `[inference]` = a design judgement derived from those, not an established fact.
- **No crypto is selected.** Where a question turns on cryptographic capability (unlinkability, key transparency, threshold recovery), it is routed to **requires crypto research** and left open for Gate F.
- **Nothing here overrides the Identity Firewall invariants.** They are treated as fixed premises, not open questions.

### Fixed premises (Identity Firewall invariants — NOT re-litigated here)

These come from [IDENTITY_FIREWALL.md](../IDENTITY_FIREWALL.md) and the RoomOS research notes and are treated as settled ground rules:

- **DevicePosture is NOT identity.** A posture assessment (`unverified`…`managed_bunker`/`at_risk`) is an environment attribute; it never proves who a member is and never grants membership or capability. **[evidence]**
- **Membership (`RoomMemberRef` / `RoomMembershipRecordV1`) is NOT identity.** Membership is a local, unverified relationship placeholder that authorizes nothing by itself. **[evidence]**
- **A profile name is NOT identity.** A display/profile name is user-controlled presentation, not an authenticated claim. **[inference]**
- **A key is not necessarily a real-world identity.** A key binds messages to a keyholder, not to a legal person. Verification ceremonies verify *key continuity*, not personhood. **[evidence]**

### FreeLayer identity targets (fixed goals)

no phone/email requirement · no public searchable directory by default · no globally visible identity root · no administrator/master recovery key · no server-owned identity key.

### Preliminary hypothesis to TEST (not accept)

> private local identity root → multiple optional personas → per-contact relationship identifiers → per-room aliases → subordinate device keys → local trust notebook → one-time capability-limited invites → offline recovery kit.

This document's job is to *stress-test* that chain, not to ratify it.

---

# PART 1 — 38 design questions (spec §16)

Each question gets one classification from **{recommended, rejected, deferred, requires prototype, requires crypto research, requires UX research}** plus a 1–3 sentence rationale. "recommended"/"rejected" mean *recommended/rejected as a TECH-ID-02 input*, still subject to the ADR.

### Identity roots and visibility

**Q1 — Global root identity?** · **rejected**
A single global root that the same person presents everywhere is a correlation primitive: every contact and room can be joined on it, defeating the Identity Firewall. **[inference]** SimpleX and Ricochet demonstrate usable messaging with *no* global identifier. **[evidence]**

**Q2 — Root ever publicly visible?** · **rejected**
A publicly visible root violates the "no globally visible identity root" target directly and enables enumeration/graph-building by observers. **[evidence]** If a root exists at all it must remain private and local (see Q1, Q9).

**Q3 — Global usernames?** · **rejected**
Global usernames require a namespace authority (central infra) and produce a searchable handle that becomes a de-facto phone-number equivalent — the exact coupling FreeLayer rejects. **[inference]** Signal's added username layer still resolves through central servers. **[evidence]**

**Q4 — Usernames searchable?** · **rejected**
A searchable directory is explicitly out of scope ("no public searchable directory by default"); searchability enables mass discovery, scraping, and targeted abuse. **[evidence]**

**Q5 — Aliases unique?** · **rejected** (global uniqueness) / local uniqueness **recommended**
Global uniqueness reintroduces a directory and a namespace authority. **[inference]** Aliases should be unique only *within a scope* (per-contact, per-room) so display collisions are avoidable without any global registry — routed to prototype for the scoping rules.

**Q6 — Aliases changeable?** · **recommended**
An alias is presentation, not identity; letting it change supports unlinkability and life changes without breaking the underlying relationship. **[inference]** Requires that continuity is anchored to the relationship key, not the alias string (see Q28 blocking, Q34 export).

**Q7 — Aliases per-contact / per-room / both?** · **recommended** (both)
Both scopes are central to the hypothesis: pairwise aliases give per-contact unlinkability, per-room aliases give context separation. **[inference]** This is the core of the Model B+C lean in Part 2.

### Personas and unlinkability

**Q8 — One root owns multiple personas?** · **recommended**
Optional personas let one person keep separated contexts (work/family/activism) without separate installs. **[inference]** This is Model C folded into the hypothesis; must remain *optional* so simple users never see it.

**Q9 — Personas cryptographically unlinkable?** · **requires crypto research**
Whether personas can be *cryptographically* unlinkable (not merely UI-separated) depends on key derivation/blinding choices reserved for Gate F. **[inference]** Do not promise cryptographic unlinkability until crypto research confirms it is achievable offline without a central mixer.

**Q10 — Can a contact know two aliases share one root?** · **rejected** (exposing linkage)
A contact must **not** be able to prove two aliases share a root; exposing that linkage collapses persona separation. **[inference]** The strength of the guarantee (metadata-level vs cryptographic) is a Gate F crypto-research question tied to Q9.

**Q11 — Ephemeral identities support recovery?** · **rejected**
Ephemeral identities are non-recoverable *by definition*; adding recovery would make them persistent and defeat their purpose. **[inference]** Users must be told an ephemeral identity is gone when the device/session is gone (assurance disclosure, Part 3).

**Q12 — Ghost identities recoverable?** · **deferred**
Ghost mode keeps identity keys on an offline device (Ghost Vault concept). **[evidence]** Whether a Ghost identity is recoverable depends on the offline-kit design and on what may persist in Ghost (Q31) — deferred to TECH-ID-02 pending the recovery and storage research.

### Devices

**Q13 — Identity roots device-bound or portable?** · **requires prototype**
Device-binding improves compromise containment; portability improves multi-device and recovery. **[inference]** The trade-off (portable root vs offline-held root with subordinate device keys) needs a prototype to feel the real UX and threat impact.

**Q14 — How are additional devices approved?** · **requires prototype**
The lean is existing-device approval plus device keys signed by the root, but the exact ceremony (QR, PAKE code, capsule handshake) affects usability and abuse resistance. **[inference]** Magic Wormhole's PAKE short codes are strong prior art for the approval UX. **[evidence]**

**Q15 — What is a device passport?** · **deferred** (define concept only)
A "device passport" is a *concept* to be defined, not built: a local, non-authoritative descriptor of a subordinate device (name, key fingerprint placeholder, approval provenance). **[inference]** Per task constraints, **no device passport is implemented**; only the concept is named. Defined in Part 4.

**Q16 — Device lost?** · **recommended** (local revoke + rotate)
A lost device should be removable via local revocation and its device key rotated, mirroring the existing local-revocation fence pattern in RoomOS. **[evidence]** Distributed revocation of copies already propagated is Gate H, not solvable locally.

**Q17 — Last device lost?** · **requires prototype**
The last-device case is the hard recovery case and the whole reason the offline recovery kit exists; it needs a prototype to validate that recovery works with **no** server and **no** admin key. **[inference]**

### Recovery

**Q18 — Central recovery?** · **rejected**
Central recovery requires a server-held or admin-held key — forbidden by the "no administrator/master recovery key" and "no server-owned identity key" targets. **[evidence]** This is the single hardest line in Part 3.

**Q19 — Recovery rotate identity?** · **recommended**
Recovery should rotate/re-key so a compromised or coerced recovery does not silently continue as the old trusted identity. **[inference]** Rotation is also what lets contacts see a key-change event and re-verify (Q21).

**Q20 — Recovered identity show reduced assurance?** · **recommended**
After recovery, contacts should see a reduced-assurance signal until re-verified, because recovery inherently weakens the continuity guarantee. **[inference]** Part 3 states this as a required disclosure principle.

**Q21 — Key changes require manual approval?** · **recommended**
Key changes should require explicit user acknowledgement rather than silent trust-on-change, following Signal's safety-number and Briar's manual-trust discipline. **[evidence]** Silent key acceptance is a known MITM vector.

**Q22 — Key transparency appropriate without central infra?** · **requires crypto research**
Classic key-transparency (append-only verifiable logs, e.g. CONIKS/KT) assumes central log infrastructure FreeLayer does not have. **[evidence]** Whether a local-first / gossip transparency scheme is feasible is an open Gate F crypto question — do not assume it.

### Verification and introductions

**Q23 — Support introductions?** · **deferred**
Introductions (a trusted contact vouching for a third party) are useful for bootstrapping trust without a directory, but carry transitive-trust risk. **[inference]** Deferred pending UX research (Q24) and the trust-notebook design (Part 5).

**Q24 — Introductions confer verification?** · **rejected**
An introduction is a *hint*, not a verification event; treating "my friend vouched" as verified manufactures false confidence. **[inference]** The trust notebook must record introductions as introductions, never as verifications (Part 5).

**Q25 — What does a QR verification actually verify?** · **requires UX research**
A QR/safety-number ceremony verifies *key-fingerprint continuity at a moment in time in a shared physical context* — **not** real-world personhood. **[evidence]** The risk is entirely in what the user *believes* it proved; requires UX research so the ceremony's wording never overclaims identity.

### Invites, abuse, blocking

**Q26 — How are one-time invites scoped and revoked?** · **requires prototype**
Invites must be narrow, expiring, single-use, capability-limited, and revocable without revealing room identity prematurely (Part 6), but the concrete scoping/revocation mechanics need a prototype. **[inference]** PAKE-style short codes are candidate prior art. **[evidence]**

**Q27 — Spam limits without phone/email?** · **requires prototype**
Removing phone/email removes the cheapest Sybil cost, so abuse resistance must come from invite scarcity, capability limits, and local blocking instead — an acknowledged hard cost of identifier-free design. **[evidence]** Needs prototyping against realistic abuse.

**Q28 — Blocking survive alias changes?** · **requires prototype**
If aliases are changeable (Q6) and personas unlinkable (Q9/Q10), blocking must bind to the relationship/key the user actually blocked, or a blocked party rejoins under a new alias. **[inference]** This tension (unlinkability vs durable blocking) is a genuine design conflict — prototype required.

### Trust records, metadata, persistence

**Q29 — How are trust records represented?** · **recommended** (local Trust Notebook)
Trust records should live in a **local** Trust Notebook (Part 5): first-contact, verification events, key/device changes, notes. **[inference]** Representation details (immutability, redaction) are refined in Part 5; the *local-only* stance is the recommendation.

**Q30 — Which identity metadata can be synchronized?** · **deferred**
What identity metadata (if any) may sync across a user's own devices depends on RoomOS synchronization (Gate H) and CapsuleNet, which do not exist yet. **[evidence]** Default posture: minimize; sync nothing that increases linkage. Deferred to TECH-ID-02.

**Q31 — Which identity data may persist in Ghost/Bunker?** · **deferred**
Ghost/Bunker are the strictest storage modes (memory-only / cold-identity intent); what identity data may persist there flows through the Storage Firewall and its `PolicyDecision` gate. **[evidence]** Deferred pending the storage-model interaction, not decided here.

### Cross-subsystem interaction

**Q32 — Identity Firewall × DevicePosture interaction?** · **recommended** (keep independent)
They must remain **independent authorization inputs** — posture never asserts identity, identity never grants posture-based trust (NIST SP 800-207 separation). **[evidence]** This is a settled invariant; the recommendation is to preserve it explicitly in TECH-ID-02.

**Q33 — Identity × Sovereign Room membership?** · **recommended** (identity additive, never authority-granting alone)
Verified identity, when it exists, must be *additive* to membership and never become authority on its own — mirroring the TECH-20 rule that membership authorizes nothing by itself. **[evidence]**

**Q34 — Room aliases surviving room export/import?** · **requires prototype**
Whether a per-room alias survives a room export/import (Sovereign Room portability) affects continuity and linkage; exporting alias-to-root mappings could leak persona linkage. **[inference]** Needs a prototype against the room export format (Gate H).

### Dependency mapping

**Q35 — Which decisions depend on Gate F crypto?** · **requires crypto research**
Unlinkability (Q9/Q10), key transparency (Q22), threshold/social and hardware-backed recovery (Part 3), and signed device keys (Part 4) all bottleneck on Gate F. **[inference]** The mapping itself is a crypto-research deliverable, not settleable now.

**Q36 — Which depend on CapsuleNet?** · **deferred**
Invite delivery, device-approval handshakes, and any cross-device identity metadata ride on the capsule envelope/transport layer (CapsuleNet, Gate E). **[evidence]** Deferred until the capsule wire format exists.

**Q37 — Which depend on RoomOS synchronization?** · **deferred**
Multi-device identity metadata sync, room-alias propagation, and distributed revocation depend on RoomOS sync / CRDT (Gate H). **[evidence]** Deferred.

**Q38 — Which must remain local-only?** · **recommended** (local-only set)
The private root, persona-to-root linkage, and the Trust Notebook should remain **local-only** and never leave the device by default. **[inference]** Local-only is the safe default; any relaxation is an explicit later decision, not a silent one.

### Part 1 summary tally

| Classification | Questions |
| --- | --- |
| recommended | 6, 7, 8, 16, 19, 20, 21, 29, 32, 33, 38 |
| rejected | 1, 2, 3, 4, 5*, 10, 11, 18, 24 |
| deferred | 12, 15, 23, 30, 31, 36, 37 |
| requires prototype | 13, 14, 17, 26, 27, 28, 34 |
| requires crypto research | 9, 22, 35 |
| requires UX research | 25 |

\*Q5 rejects *global* uniqueness; *local-scope* uniqueness is recommended.

---

# PART 2 — Candidate architecture comparison (spec §17)

Five candidate models. Scores are **qualitative (High / Med / Low) with a one-word justification**, never bare numbers. The verdict is narrative and does **not** follow the score count mechanically.

## The models

- **Model A — One global identity key.** A single long-lived key is the user's identity everywhere.
- **Model B — Root identity with pairwise aliases.** A private root derives a distinct relationship identifier per contact.
- **Model C — Independent personas / multiple roots.** Several unlinked roots, one per context, each self-contained.
- **Model D — Fully ephemeral relationship identities / no persistent root.** Each relationship is its own throwaway identity; nothing persistent underneath.
- **Model E — DID-based (W3C Decentralized Identifiers).** Identities are DIDs with DID documents and (optionally) verifiable credentials. **Included only to test whether it adds concrete benefit.**

## Scoring matrix

Legend: **H** High / **M** Med / **L** Low. In each cell the word is the *justification*, not a grade label.

| Dimension | A — Global key | B — Root + pairwise aliases | C — Personas / multi-root | D — Fully ephemeral | E — DID-based |
| --- | --- | --- | --- | --- | --- |
| Privacy | **L** exposed | **H** compartmentalised | **H** separated | **H** minimal-footprint | **L** document-heavy |
| Unlinkability | **L** correlatable | **H** per-contact | **H** per-context | **H** per-relationship | **L** resolvable |
| Usability | **H** simple | **M** hidden-complexity | **M** context-juggling | **L** confusing | **L** jargon |
| Offline operation | **H** self-contained | **H** local-derivation | **H** local | **M** re-bootstrapping | **L** resolver-reliant |
| Multi-device | **M** copy-key | **H** signed-subkeys | **L** per-root-setup | **L** no-anchor | **M** method-dependent |
| Recovery | **M** single-secret | **M** root-backup | **L** many-secrets | **L** nothing-to-recover | **M** method-dependent |
| Implementation complexity | **H** trivial | **M** derivation-work | **M** multiplicity | **M** churn-handling | **L** spec-surface |
| Metadata | **L** one-fingerprint | **H** low-linkage | **H** low-linkage | **H** lowest | **L** DID-doc-leakage |
| Centralization | **M** directory-pull | **H** none-needed | **H** none-needed | **H** none-needed | **L** registry-pull |
| CapsuleNet compatibility | **H** fits-envelope | **H** fits-envelope | **H** fits-envelope | **H** fits-envelope | **M** extra-payload |
| RoomOS compatibility | **M** correlates-rooms | **H** per-room-alias | **H** persona-per-room | **M** membership-churn | **M** doc-mapping |
| Ghost/Bunker suitability | **L** always-hot-key | **H** offline-root-fit | **H** offline-root-fit | **M** ephemeral-fit | **L** resolver-need |
| Abuse resistance | **M** blockable | **M** durable-block-hard | **L** cheap-Sybil | **L** cheapest-Sybil | **M** credential-gated |
| Crypto dependency | **L** basic-keys | **H** derivation/blinding | **M** many-keys | **M** ratchet-churn | **H** DID+VC-stack |

**How to read "Crypto dependency":** H there means *heavily depends on unresolved Gate F crypto* (a cost/risk), not "good".

## Per-model narrative

**Model A — One global identity key.** **[evidence]** Simplicity and recovery are its only real wins; a single secret is easy to explain and easy to back up. But it is a correlation magnet — one fingerprint links every contact, room, and persona, and to be useful for discovery it drags in a directory. It cannot hold personas apart and is a poor fit for Ghost/Bunker because the identity key is always hot. Impersonation resistance is fine (you hold the key) but *unlinkability* is structurally impossible. **[inference]** Fails the core privacy targets.

**Model B — Root identity with pairwise aliases.** **[inference]** A private root derives a distinct per-contact relationship identifier, so no two contacts see the same handle and no observer joins the graph on a shared value — SimpleX-style pairwise thinking generalised. **[evidence]** Contact continuity is anchored to the relationship, not the alias, so aliases can change (Q6) without losing the thread. It supports subordinate signed device keys (good multi-device) and lets the root live offline (good Ghost/Bunker). Costs: real complexity is hidden in derivation, **root compromise is catastrophic** (mitigated only by keeping the root offline + rotation), and durable blocking under changeable aliases is hard (Q28). Verification still verifies key continuity, not personhood (Q25).

**Model C — Independent personas / multiple roots.** **[inference]** Strongest *context separation*: each root is self-contained, so a leak of one persona reveals nothing about another. But usability suffers (which persona am I in?), recovery multiplies (a secret per root), key management balloons, and **contact confusion** is real — the same person may appear as strangers. Cross-persona linking should be *impossible by design*, which is exactly the guarantee Q9/Q10 route to crypto research. Best as an *optional* layer, not the default.

**Model D — Fully ephemeral relationship identities / no persistent root.** **[inference]** Maximum privacy and minimum metadata — nothing persistent to steal, subpoena, or correlate; closest in spirit to Ricochet/OnionShare session thinking. **[evidence]** But with no anchor there is *nothing to recover*, multi-device is near-impossible, introductions and durable room membership fray as identities churn, and abuse resistance is the weakest (cheapest Sybil). Excellent as a *mode* (ephemeral / Ghost sessions), unworkable as the *only* model for a persistent-rooms product.

**Model E — DID-based.** **[evidence]** DIDs promise decentralised, self-owned identifiers and a credential ecosystem. **[inference]** But for FreeLayer they mostly add surface without a concrete benefit the other models lack: most DID methods lean on a ledger, registry, or resolver (centralization/metadata cost), DID documents are additional linkable, often-public artefacts, and verifiable credentials presuppose issuers FreeLayer deliberately does not have. Everything DIDs would give here (self-owned, no phone/email) Models B+C already give *without* the resolver dependency. **Preliminary lean: reject Model E as unnecessary infrastructure and metadata** — reconsider only if a specific interop requirement later demands it. This mirrors the RoomOS decision to reject DID/UCAN-style external dependencies. **[evidence]**

## Verdict (narrative — NOT decided by score)

The scores favour B, C, and D on privacy and A on simplicity, but the decision is not a vote. A is disqualified by the correlation and directory it forces, regardless of its usability win. D is disqualified as a *base* model because a persistent-rooms product needs *something* to anchor continuity, recovery, and multi-device — though D is valuable as an **ephemeral mode**. E adds infrastructure and metadata for no benefit B+C don't already deliver.

**Preliminary lean: a hybrid of B (pairwise aliases) + C (optional personas), over a private, non-globally-exposed root, with subordinate device keys** — the root held offline where possible (Ghost/Bunker fit), personas optional so simple users never meet the complexity, and Model-D-style ephemeral identities available as a *mode* rather than the foundation.

> [!IMPORTANT]
> **This lean is explicitly subject to the TECH-ID-02 Identity Architecture ADR.** It is an input, not a decision. It is contingent on Gate F crypto research resolving unlinkability (Q9/Q10), durable blocking (Q28), and offline recovery (Part 3) — any of which could force a revision. Nothing here authorizes implementation.

---

# PART 3 — Recovery research (spec §19)

> [!IMPORTANT]
> **REQUIRED PRINCIPLE: No recovery design may introduce an administrator or project-owned master key.** Any option that requires FreeLayer, a server, or an operator to hold a key capable of recovering, reading, or impersonating a user's identity is **rejected outright**, regardless of convenience. This is non-negotiable and constrains every row below.

> [!NOTE]
> **Recovery generally reduces assurance.** Any recovery path is, by construction, an alternate route to the identity — which is also an alternate attack/coercion surface. TECH-ID-02 must ensure that a recovered identity **discloses reduced assurance** to contacts until re-verified (Q19/Q20). **No algorithms are selected here.**

Each option is evaluated across: confidentiality · brute-force resistance · metadata · availability · user error · coercion · rollback · administrator access · device loss · offline support · Ghost/Bunker compatibility.

### No recovery
- **Confidentiality:** highest (no alternate route). **Brute-force:** N/A (nothing to attack). **Metadata:** none. **Availability:** worst — permanent loss on device loss. **User error:** low surface but unforgiving. **Coercion:** best (nothing to compel). **Rollback:** N/A. **Admin access:** none (compliant). **Device loss:** catastrophic. **Offline:** N/A. **Ghost/Bunker:** ideal.
- **[inference]** The safest and the most brutal. Correct default for *ephemeral* and possibly *Ghost* identities (Q11/Q12); unacceptable as the *only* option for a persistent product.

### Recovery phrase (mnemonic)
- **Confidentiality:** high if user-held. **Brute-force:** depends on entropy (crypto research, not selected). **Metadata:** none if never transmitted. **Availability:** good if retained. **User error:** high — phrases are lost, photographed, mistyped. **Coercion:** compellable ("say the words"). **Rollback:** low risk. **Admin access:** none (compliant). **Device loss:** recoverable. **Offline:** fully offline. **Ghost/Bunker:** compatible (offline artefact).
- **[evidence]** Well-trodden in wallets. **[inference]** Strong on the no-admin-key line; weak on human factors and coercion.

### Recovery file
- **Confidentiality:** depends entirely on at-rest encryption (not selected). **Brute-force:** depends on passphrase. **Metadata:** filename/location may leak. **Availability:** good if stored safely. **User error:** high — files get synced to clouds, lost, left on shared disks. **Coercion:** compellable. **Rollback:** medium (stale file). **Admin access:** none (compliant). **Device loss:** recoverable. **Offline:** offline. **Ghost/Bunker:** risky — a persistent file contradicts memory-only intent.
- **[inference]** Convenient but the accidental-cloud-sync failure mode is severe.

### Printed recovery kit
- **Confidentiality:** high (air-gapped paper). **Brute-force:** depends on encoded secret. **Metadata:** none digital. **Availability:** good if physically safe; fragile (fire/loss). **User error:** medium (transcription). **Coercion:** compellable if located. **Rollback:** low. **Admin access:** none (compliant). **Device loss:** recoverable. **Offline:** fully offline. **Ghost/Bunker:** best fit — no persistent digital artefact.
- **[inference]** Strong candidate for the "offline recovery kit" in the hypothesis; physical security becomes the user's job (disclose honestly).

### Trusted existing device
- **Confidentiality:** high (device-to-device). **Brute-force:** N/A if authenticated channel. **Metadata:** local pairing only. **Availability:** requires a surviving trusted device. **User error:** low. **Coercion:** device seizure risk. **Rollback:** low. **Admin access:** none (compliant). **Device loss:** solves *some* loss, not *last-device* loss. **Offline:** local/offline capable. **Ghost/Bunker:** compatible.
- **[evidence]** Signal/Matrix multi-device patterns. **[inference]** Best UX, but does nothing for the last-device case (Q17) — must pair with an offline kit.

### Threshold / social recovery
- **Confidentiality:** high (no single holder). **Brute-force:** high bar (needs quorum). **Metadata:** reveals a *social graph* — a real privacy cost. **Availability:** depends on guardians being reachable. **User error:** medium (guardian churn). **Coercion:** distributed — must coerce a quorum (a strength). **Rollback:** medium. **Admin access:** none if guardians are peers, not operators (compliant). **Device loss:** recoverable. **Offline:** hard offline (needs guardian contact). **Ghost/Bunker:** poor (contact required).
- **[evidence]** Shamir/threshold schemes are established. **[inference]** Strongest coercion resistance, but the social-graph metadata leak conflicts with the unlinkability goal — **requires crypto research** before any commitment; no scheme selected here.

### Local encrypted backup
- **Confidentiality:** depends on passphrase/KDF (not selected). **Brute-force:** passphrase-bound. **Metadata:** minimal if local. **Availability:** good on the same device; N/A across device loss unless exported. **User error:** medium. **Coercion:** compellable. **Rollback:** medium (stale backup). **Admin access:** none (compliant). **Device loss:** only helps if backup left the device. **Offline:** offline. **Ghost/Bunker:** conflicts with memory-only.
- **[inference]** Useful adjunct, not a standalone answer to device loss.

### Server-assisted encrypted recovery
- **Confidentiality:** only as good as client-side encryption *and* the guarantee the server never holds the key. **Brute-force:** enables *online* and *offline* guessing against stored blobs. **Metadata:** server sees existence, timing, frequency. **Availability:** high. **User error:** low. **Coercion:** server is a compulsion target. **Rollback:** server-controlled (risk). **Admin access:** **danger zone** — trivially becomes an operator-held recovery path. **Device loss:** recoverable. **Offline:** requires network. **Ghost/Bunker:** incompatible.
- **[inference]** **Closest to violating the required principle.** Admissible *only* if it is provably a blind store the operator cannot decrypt or use to impersonate — and even then it reintroduces a server dependency FreeLayer avoids. **Preliminary lean: reject** unless a future design proves zero operator capability; not selected here.

### Hardware-backed recovery
- **Confidentiality:** high (key in secure element). **Brute-force:** hardware-rate-limited. **Metadata:** minimal. **Availability:** tied to specific hardware. **User error:** low. **Coercion:** device seizure + compelled biometrics risk. **Rollback:** low. **Admin access:** none (compliant). **Device loss:** the hardware token *is* the recovery. **Offline:** offline. **Ghost/Bunker:** good fit (cold key).
- **[evidence]** Secure enclaves/keys are mature. **[inference]** Strong, but hardware availability/portability limits it to an *option*, not a baseline (interacts with DevicePosture, which is still *not identity*).

### Identity rotation after recovery
- Not an alternative to the above but a **required overlay on all of them.** **Confidentiality:** improves (old key retired). **Coercion:** limits silent continuation of a coerced identity. **Rollback:** rotation *is* forward-only protection. **Admin access:** none (compliant). **Ghost/Bunker:** compatible.
- **[inference]** After any recovery, rotate the identity and surface a **reduced-assurance** signal to contacts (Q19/Q20). This is a principle, not an algorithm.

### Part 3 synthesis

- **Compliant with the no-admin-key principle:** no recovery, recovery phrase, recovery file, printed kit, trusted device, threshold/social (if guardians are peers), local encrypted backup, hardware-backed, rotation overlay.
- **On the line / preliminary reject:** server-assisted encrypted recovery.
- **[inference] Preliminary lean (subject to TECH-ID-02):** a **layered** offering — trusted-existing-device for the common case + a **printed offline recovery kit** for the last-device case + mandatory **identity rotation with reduced-assurance disclosure** after any recovery. Ephemeral/Ghost identities may deliberately offer *no* recovery. Threshold/social and hardware-backed remain **crypto-research options**, not commitments. **No algorithms selected.**

---

# PART 4 — Multi-device research (spec §20)

> [!IMPORTANT]
> **Device passports are NOT implemented in this task.** This part *defines the concept only* (per Q15) and evaluates models. All of it is input to TECH-ID-02 / Gate F.

**Device passport (concept only):** a **local, non-authoritative descriptor** of a subordinate device — device name, key-fingerprint placeholder, approval provenance (who approved it, when, by what method), and status. Like the RoomOS capability *descriptor*, it **authorizes nothing by itself**; it is a record, not a credential. **[inference]** No format, no signing scheme, no persistence is defined here.

Models evaluated across: compromised-device impact · removal & rotation · history access · device-naming metadata · device-list consistency · offline linking · stale devices · DevicePosture interaction · Bunker-room interaction.

### Single-device identity
- **Compromised-device impact:** total (one device = everything). **Removal/rotation:** N/A (only device). **History access:** all-local. **Naming metadata:** none. **Device-list consistency:** trivial (list of one). **Offline linking:** N/A. **Stale devices:** none. **DevicePosture:** one posture. **Bunker:** clean fit.
- **[inference]** Simplest and most private; poor availability (mirrors "no recovery"). Good baseline, insufficient alone.

### Root copied to every device
- **Compromised-device impact:** catastrophic (root leaks from any device). **Removal/rotation:** impossible without re-keying everything. **History:** full everywhere. **Naming metadata:** low. **Consistency:** easy. **Offline linking:** easy (copy). **Stale devices:** dangerous (each holds the root). **DevicePosture:** every device equally trusted regardless of posture — bad. **Bunker:** violates cold-identity intent.
- **[inference]** **Reject.** Turns every device into a root-compromise point; incompatible with Ghost/Bunker.

### Root kept offline
- **Compromised-device impact:** limited (online devices lack the root). **Removal/rotation:** root can re-issue/rotate device keys. **History:** per-device. **Naming metadata:** low. **Consistency:** needs a publish path. **Offline linking:** natural. **Stale devices:** containable (revoke device key). **DevicePosture:** compatible (posture per device, root uninvolved). **Bunker:** **best fit** (Ghost Vault intent).
- **[evidence]** Aligns with the documented Ghost Vault cold-identity direction. **[inference]** Strong anchor for the B+C lean.

### Device keys signed by root
- **Compromised-device impact:** contained to that device key. **Removal/rotation:** revoke + re-sign. **History:** per-device scope. **Naming metadata:** the signing record may leak device names/count. **Consistency:** a signed device list helps. **Offline linking:** feasible. **Stale devices:** revocable. **DevicePosture:** independent (signing ≠ posture). **Bunker:** compatible if root offline.
- **[inference]** The mechanism that makes "root kept offline" usable. **Depends on Gate F crypto** (signing scheme not selected).

### Existing-device approval
- **Compromised-device impact:** a compromised device could approve rogue devices — needs care. **Removal/rotation:** normal. **History:** grant-time forward or full (a decision). **Naming metadata:** approval records leak device graph. **Consistency:** good. **Offline linking:** feasible (local pairing). **Stale devices:** revocable. **DevicePosture:** could *inform* (not gate) approval UX. **Bunker:** compatible.
- **[evidence]** Standard pattern (Signal/Matrix). **[inference]** Best everyday UX; must not let one compromised device silently expand the fleet.

### Recovery-kit approval
- **Compromised-device impact:** low (kit is offline). **Removal/rotation:** kit can re-establish. **History:** policy choice. **Naming metadata:** minimal. **Consistency:** manual. **Offline linking:** fully offline. **Stale devices:** revocable. **DevicePosture:** independent. **Bunker:** good fit.
- **[inference]** The last-device path (ties to Part 3 printed kit); slower, safest.

### Temporary linked device
- **Compromised-device impact:** time-boxed. **Removal/rotation:** auto-expire. **History:** should be limited/none. **Naming metadata:** low. **Consistency:** transient entry. **Offline linking:** feasible. **Stale devices:** self-clearing (expiry). **DevicePosture:** can require higher posture. **Bunker:** compatible.
- **[inference]** Valuable for borrowed/public devices; expiry is the key safety property.

### Read-only device
- **Compromised-device impact:** reduced (cannot send/approve). **Removal/rotation:** normal. **History:** read scope. **Naming metadata:** low. **Consistency:** normal. **Offline linking:** feasible. **Stale devices:** revocable. **DevicePosture:** can gate the UX. **Bunker:** compatible.
- **[inference]** Attenuation-by-capability — matches FreeLayer's least-authority ethos.

### Room-limited device
- **Compromised-device impact:** blast radius = the allowed rooms. **Removal/rotation:** normal. **History:** scoped to rooms. **Naming metadata:** low. **Consistency:** per-room. **Offline linking:** feasible. **Stale devices:** revocable. **DevicePosture:** gateable. **Bunker:** aligns with per-room Bunker isolation.
- **[inference]** Natural fit with Sovereign Room boundaries; strong containment.

### Part 4 synthesis

- **Reject:** root copied to every device (root-compromise multiplier; breaks Ghost/Bunker).
- **[inference] Preliminary lean (subject to TECH-ID-02):** **root kept offline + device keys signed by root**, with **existing-device approval** as the everyday path and **recovery-kit approval** for the last-device case; **temporary / read-only / room-limited** devices as *attenuations* echoing least-authority. All device records are **local, non-authoritative "device passports" (concept only)**. Device-naming/approval records are a **metadata leak surface** to minimize. **DevicePosture may inform device UX but never grants device trust or identity** (fixed invariant). **No signing scheme selected (Gate F).**

---

# PART 5 — Trust Notebook requirements (spec §21)

**Definition.** The **Trust Notebook** is a **local record** on the user's device of how a relationship was formed and how its trust signals have evolved. It is a *notebook*, not an authority: entries **inform the user**, they never authorize anything and never assert verified identity. **[inference]** It is the human-readable companion to whatever key material exists, and it must remain **local-only** by default (Q29/Q38).

### Possible entries (enumeration)

| Entry | What it records |
| --- | --- |
| First-contact time | When this relationship was first established |
| Connection method | How contact began (invite, QR, introduction, room) |
| Alias scope | Whether the alias is per-contact, per-room, or both |
| Key-fingerprint **placeholder** | A slot for a fingerprint — placeholder only; real key material is Gate F |
| Verification events | When/whether a verification ceremony occurred |
| Verification channel | The channel used (in-person QR, video, out-of-band) — affects trust weight |
| Key / device changes | Observed changes in the contact's key or device set |
| Warnings | System-raised anomalies (unexpected key change, replay, downgrade) |
| Introductions | Who (if anyone) introduced this contact — recorded **as an introduction, never a verification** |
| Manual notes | Free-text user annotations |
| Revocation / removal history | Blocks, removals, and their timing |

### Research questions

**Auto-recorded vs user-confirmed.** **[inference]** *Auto-record* objective, observable facts (first-contact time, connection method, key/device changes, system warnings). *Require explicit user confirmation* for anything that implies a trust judgement — **verification events must never be auto-asserted**; the user affirms "I verified this." Introductions are auto-recorded as *facts of introduction* but never auto-upgraded to verification (Q24).

**Which entries are sensitive.** **[inference]** The whole notebook is sensitive (it is a relationship graph + trust map). Highest sensitivity: introductions (reveal social graph), verification channel (reveals real-world contact), manual notes (may contain plaintext personal info), and key-change history (reveals device/behaviour patterns).

**Immutability.** **[inference]** *Security-relevant events* (verification events, key/device changes, warnings, revocations) should be **append-only** so history cannot be silently rewritten to fabricate confidence. *User conveniences* (manual notes, alias labels) should remain **editable**. Immutability is a property to design toward, not an algorithm to select — no crypto chosen.

**Redaction.** **[inference]** The notebook must support redaction/erasure for privacy and duress (a user must be able to remove a contact's traces), while preserving enough integrity that redaction does not silently forge a cleaner-than-real trust picture. Redaction and append-only integrity are in tension — a genuine TECH-ID-02 design problem, flagged not solved.

**Ghost/Bunker persistence.** **[evidence]** Persistence flows through the Storage Firewall's `PolicyDecision` gate. **[inference]** In Ghost/Bunker (memory-only / cold intent) the notebook may be **memory-only or absent**; TECH-ID-02 must define what, if anything, survives — default to minimum. This ties to Q31 (deferred).

**Dangerous false confidence.** **[inference]** **Yes — this is the notebook's central risk.** A "note: this is really Alice" or a green checkmark from a mere introduction can manufacture confidence a key never earned. Mitigations: separate *facts* from *judgements* in the UI, never render an introduction or a manual note as verification, and always state what a verification actually proved (key continuity, not personhood — Q25).

**Imported trust data must be treated as untrusted.** **[inference]** Any trust data arriving from outside this device (imported with a room, synced from another device, shared by a contact) is **untrusted input** and must be quarantined/labelled as such — it may be stale, forged, or self-serving. This mirrors the RoomOS rule that imported/remote state confers no authority. Imported entries never auto-populate as verifications or warnings the local user did not observe.

> [!NOTE]
> **No implementation.** This part defines *requirements and tensions* for the Trust Notebook, not a schema, storage format, or crypto. All of it is input to TECH-ID-02.

---

# PART 6 — One-time invites + preliminary constraints (spec §24)

## One-time invite requirements

An invite is the bootstrap primitive for identifier-free contact (no directory, no phone/email). Required properties — **all subject to TECH-ID-02, none implemented here**:

- **Narrow** — grants the minimum needed to start one relationship, nothing ambient. **[inference]**
- **Expiring** — has a short, explicit lifetime; stale invites die. **[inference]**
- **Capability-limited** — confers a specific, attenuable scope (mirroring RoomOS attenuable descriptors), never broad authority. **[evidence]** (pattern) / **[inference]** (application)
- **Single-use** — consumed on first successful use; not replayable. **[inference]**
- **Revocable** — the issuer can invalidate it before use. **[inference]**
- **Does not reveal room identity prematurely** — an invite must not disclose which room/persona it leads to until the invitee is accepted, so an intercepted invite leaks minimal context. **[inference]**
- **Binds intended persona / device** — the invite is scoped to the persona the user chose to expose and, where relevant, the intended device, so it cannot be redirected to correlate a different persona. **[inference]**

**[evidence]** PAKE-style short codes (Magic Wormhole) are direct prior art for the *UX* of one-time authenticated invites; the *mechanism* is Gate F crypto and is not selected here. Abuse resistance (Q27) leans heavily on invite scarcity since there is no phone/email cost.

## Preliminary constraints list (TECH-ID-02 inputs)

Each constraint is a proposed boundary for the future ADR. **Every item is marked `NOT-implemented-in-this-task`.**

1. **No global root identity; the root (if any) stays private and local.** `NOT-implemented-in-this-task`
2. **No public searchable directory; no global usernames.** `NOT-implemented-in-this-task`
3. **No phone/email requirement anywhere in the identity path.** `NOT-implemented-in-this-task`
4. **No administrator or project-owned master recovery key; no server-owned identity key.** `NOT-implemented-in-this-task`
5. **DevicePosture, membership, profile name, and keys are each NOT identity** — no signal may be promoted to identity implicitly. `NOT-implemented-in-this-task`
6. **Verification verifies key continuity, not personhood** — UI must never overclaim. `NOT-implemented-in-this-task`
7. **Recovery reduces assurance and must disclose it; identity rotates after recovery.** `NOT-implemented-in-this-task`
8. **Personas are optional and default-hidden; cross-persona linkage must not be exposable to a contact** (strength = Gate F crypto research). `NOT-implemented-in-this-task`
9. **Aliases are presentation, changeable, scoped (per-contact/per-room); global uniqueness is rejected.** `NOT-implemented-in-this-task`
10. **Device keys are subordinate to the root, individually revocable; no root is copied to every device.** `NOT-implemented-in-this-task`
11. **Key changes require explicit user acknowledgement; no silent trust-on-change.** `NOT-implemented-in-this-task`
12. **Invites are narrow, expiring, single-use, capability-limited, revocable, persona/device-bound, and do not reveal room identity prematurely.** `NOT-implemented-in-this-task`
13. **The Trust Notebook is local-only, separates facts from judgements, treats imported trust data as untrusted, and never manufactures verification.** `NOT-implemented-in-this-task`
14. **Identity metadata sync and distributed revocation are minimized and deferred to CapsuleNet/RoomOS/Gate H.** `NOT-implemented-in-this-task`
15. **No DID/registry/ledger dependency is adopted** unless a concrete interop need is later proven. `NOT-implemented-in-this-task`
16. **No cryptographic algorithm is selected in RESEARCH-ID-01; all crypto-dependent choices route to Gate F.** `NOT-implemented-in-this-task`

---

## Provenance and status

- **Grounded in:** [IDENTITY_FIREWALL.md](../IDENTITY_FIREWALL.md), [GLOSSARY.md](../GLOSSARY.md), [COMPETITOR_COMPARISON.md](../COMPETITOR_COMPARISON.md), [SOVEREIGN_ROOMS.md](../SOVEREIGN_ROOMS.md), [THREAT_MODEL.md](../THREAT_MODEL.md), [STORAGE_MODEL.md](../STORAGE_MODEL.md), and the RoomOS research notes (TECH-16…22).
- **Status:** RESEARCH-ID-01 research artefact. **No implementation, no crypto selection, no wire format.** All leans and classifications are **inputs to TECH-ID-02** and are not decisions.
- **Next step:** TECH-ID-02 Identity Architecture ADR consumes this document, resolves the *requires prototype* / *requires crypto research* / *requires UX research* items, and makes the actual (still Gate F/G-gated) decisions.
