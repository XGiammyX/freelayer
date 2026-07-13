# RESEARCH-ID-01 — Conclusions

> Status: **research**. This synthesizes the RESEARCH-ID-01 package. Every recommendation is a **non-binding input** to **TECH-ID-02 — Identity Architecture ADR**. No identity, cryptography, recovery, invite, device-passport, DID/VC, login, or directory was implemented. Evidence is distinguished from inference throughout; competitor/standard claims should be re-verified against primary sources before the ADR (the research was conducted offline — see the sourcing notes in each source document).

## 1. Executive summary

FreeLayer can be accountless and local-first without a global public identifier. The strongest evidence for this comes from **SimpleX** (no global user ID; pairwise connection identities) and **Briar** (local identity, offline contact exchange, no central server). The strongest cautionary evidence comes from **Signal** (phone-number registration coupling and centralized recovery) and **Matrix** (multi-device root-of-trust and cross-signing complexity, server/account coupling). The preliminary direction — a **private local identity root → optional personas → per-contact/per-room aliases → subordinate revocable device keys → local Trust Notebook → narrow one-time invites → offline recovery** — is consistent with the evidence, but the multi-device and recovery sub-problems are where every competitor pays a real cost, and they are the decisions most in need of the ADR.

## 2. Sources & methodology

Standards ([IDENTITY_STANDARDS_RESEARCH.md](IDENTITY_STANDARDS_RESEARCH.md)): NIST SP 800-63-4 (IAL/AAL/FAL), W3C DID Core, W3C VC, WebAuthn/FIDO2, MLS (RFC 9420). Competitors ([IDENTITY_COMPETITOR_MATRIX.md](IDENTITY_COMPETITOR_MATRIX.md)): Signal, Matrix/Element, SimpleX, Session, Briar (+ one peer/local-first system). Threats ([../audits/RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md](../audits/RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md)). Terminology ([IDENTITY_TERMINOLOGY_MODEL.md](IDENTITY_TERMINOLOGY_MODEL.md)). Decision inputs & candidate models ([IDENTITY_ARCHITECTURE_DECISION_INPUTS.md](IDENTITY_ARCHITECTURE_DECISION_INPUTS.md)). Internet access was unavailable; sources were consulted from established knowledge and are tagged by evidence type (marketing / product-docs / protocol-spec / source / audit / independent). **Re-verify before TECH-ID-02.**

## 3. Identity terminology

Person ≠ local identity ≠ identity root ≠ profile ≠ alias ≠ member reference ≠ device ≠ device key ≠ DevicePosture ≠ verification ≠ recovery ≠ real-world identity proofing. Verification in FreeLayer will mean **authentication assurance of key control over a channel**, not identity proofing. Full definitions in the terminology model.

## 4. Competitor findings (condensed)

- **Signal** — identity root = **phone number** (registration); usernames added as a *connection* handle, not a public account; safety numbers + a key-transparency direction; linked devices; PIN + Secure Value Recovery. Lesson: phone coupling and central recovery are exactly what FreeLayer must avoid; message-requests and blocking are useful abuse patterns.
- **Matrix/Element** — user ID bound to a **homeserver domain**; device keys + **cross-signing** root of trust; interactive (emoji/SAS) verification; key backup + recovery key + secret storage. Lesson: multi-device is powerful but the cross-signing root-of-trust and recovery UX are where users get confused and where historical key-confusion bugs lived; server/account coupling limits portability.
- **SimpleX** — **no global user identifier**; pairwise connection identities via connection links; incognito profiles; rotating addresses. Lesson: pairwise relationship identifiers give strong unlinkability and map well to FreeLayer per-contact aliases; the cost is contact/continuity management and multi-device state.
- **Session** — Session ID derived from a key pair; **recovery phrase** (seed) is the root; onion-routed. Lesson: a seed-phrase root gives portability/recovery but is a single high-value secret; **network anonymity is not identity assurance** and must not be conflated.
- **Briar** — **local identity**, offline (Bluetooth/Wi-Fi/Tor) contact exchange, QR/in-person verification, remote introductions, unverified vs. verified contacts, local encrypted DB. Lesson: the closest philosophical match — informs offline contact establishment, the Trust Notebook, and introduction chains; device-loss recovery is intentionally limited (no central server).

## 5. Common design patterns

Pairwise/peer identifiers for unlinkability (SimpleX, Briar); a durable root secret for portability/recovery (Session seed, Matrix recovery key); a device sub-key layer under a root of trust (Matrix cross-signing); out-of-band verification of **key control** (safety numbers, SAS, QR, fingerprints); message-requests + blocking + invite-gating for abuse control.

## 6. Common failures & trade-offs

Global identifiers enable correlation (Signal phone, Matrix MXID); central recovery becomes a high-value target/backdoor risk; multi-device weakens assurance and creates stale-device danger; TOFU + ignored key-change warnings enable substitution; anti-spam controls (directories, phone cost) reintroduce correlation; **unlinkability vs. abuse resistance** is a fundamental tension with no free solution.

## 7. FreeLayer-specific threats

See the [threat model](../audits/RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md). Highest-priority: identity-root correlation across personas; key substitution via a malicious relay/invite; stale/unverified device trust; recovery becoming an administrator backdoor; per-room alias mapped back to a global root; endpoint compromise (external — Secure Device).

## 8. Candidate architecture comparison

Four models compared in [IDENTITY_ARCHITECTURE_DECISION_INPUTS.md](IDENTITY_ARCHITECTURE_DECISION_INPUTS.md): **A** one global identity key (simple, but maximal correlation); **B** root + pairwise aliases (strong unlinkability, contact continuity cost); **C** independent personas / multiple roots (strong separation, usability + recovery cost); **D** fully ephemeral relationship identities (max privacy, weak continuity/recovery/abuse control); optional **E** DID-based (rejected as unnecessary infrastructure/metadata). No model wins on every axis.

## 9. Preliminary recommendation (non-binding)

A **hybrid of B + C**: a **private, non-globally-exposed identity root** that can own **one or more optional personas**, each expressed through **per-contact and per-room aliases**, with **subordinate revocable device keys** under the root, a **local Trust Notebook**, **narrow one-time capability-limited invites**, and an **offline recovery kit** — with **no phone/email, no public directory, no globally visible root, and no administrator/master recovery key**. This remains **subject to TECH-ID-02**.

## 10. Rejected approaches

Phone/email registration; a global searchable directory; a globally visible identity root; central/administrator recovery or a project master key; server-owned identity keys; treating a profile name / `RoomMemberRef` / DevicePosture as identity; adopting DIDs/VCs without a concrete requirement; auto-adding passkeys or MLS.

## 11. Deferred crypto decisions (Gate F)

Key types and algorithms; root↔device-key signing; alias derivation/unlinkability; invite token construction; verification proof format; recovery-secret derivation; any key-transparency mechanism. **No algorithm was selected.**

## 12. Deferred sync decisions (Gate H)

Whether/what identity metadata may synchronize across devices; device-list consistency; trust-record synchronization; interaction with RoomOS sync and CapsuleNet. Default posture: **local-only** unless the ADR justifies otherwise.

## 13. Recovery recommendations

Prefer **offline, user-held** recovery (recovery phrase or printed kit) and/or **trusted-existing-device** approval; treat recovery as **assurance-reducing** and disclose it; keep the door open to threshold/social recovery as an option; **never** ship central/administrator recovery or a master key. Algorithm selection deferred (Gate F).

## 14. Multi-device recommendations

Prefer a **root-signs-device-keys** model with **existing-device or recovery-kit approval**; support device **removal + key rotation**; handle **stale devices** conservatively (fail closed); keep the **root off online-only devices** where possible (Ghost Vault direction); define **device passport** as a signed root↔device relationship but **do not implement** it here; keep device metadata minimal.

## 15. Alias recommendations

Support **per-contact and per-room aliases**; the identity root is never globally exposed; aliases are context-scoped and changeable; avoid global uniqueness/directories (enumeration/correlation); guard against homograph/collision and against a per-room alias being mapped back to the root; UI must always show the correct identity scope.

## 16. Trust Notebook recommendations

A **local** record of first-contact time, connection method, alias scope, key-fingerprint placeholder, verification events + channel, key/device changes, warnings, introductions, manual notes, and revocation history. Auto-record observable facts; require user confirmation for verification claims; treat entries as **sensitive**; consider append-mostly semantics with explicit redaction; apply Ghost/Bunker persistence restrictions; treat **imported** trust data as untrusted; avoid UX that manufactures false confidence.

## 17. One-time invite requirements

Invites must be **single-use, expiring, capability-limited, revocable**, must **not** prematurely reveal room identity, and must **bind the intended persona/device**. No invite token format is chosen here.

## 18. DevicePosture separation

DevicePosture is an **external** environment attribute (Secure Device project). It may **tighten** access but **never** raises identity assurance, grants membership, or proves personhood. Identity and posture are independent authorization inputs (NIST SP 800-207). This separation is enforced conceptually and in the terminology/threat docs.

## 19. PBOM / Trust Center corrections

No dangerous overclaim existed. This phase **added explicit research/not-implemented status** language to `docs/IDENTITY_FIREWALL.md`, `docs/PBOM.md`, `docs/TRUST_CENTER.md`, and the privacy/metadata/storage/threat docs, and a docs-honesty check ensuring the Identity Firewall keeps saying identity is research/not-implemented and DevicePosture is not identity.

## 20. Required TECH-ID-02 ADR decisions

Root/persona/alias model; multi-device & device-passport model; recovery model + assurance disclosure; verification semantics; invite scoping/revocation; which identity metadata (if any) may sync; storage/persistence policy (incl. Ghost/Bunker); crypto dependencies (Gate F); abuse/Sybil strategy without phone/email; and confirmation that no endpoint/identity conflation occurs. See the [Identity Architecture Gate](../IMPLEMENTATION_GATES.md).
