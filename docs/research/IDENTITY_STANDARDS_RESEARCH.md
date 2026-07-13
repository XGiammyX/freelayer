# Identity Standards — Research Note (RESEARCH-ID-01)

_Date: 2026-07-13. Branch: `research/identity-competitor-threat-model`. Informs a future identity design pass (Gate F/G); no code, no crypto selection here._

> [!IMPORTANT]
> **Primary sources were consulted from prior knowledge because live internet access was unavailable in this environment.** Everything below is written from the author's established knowledge of these standards (knowledge cutoff 2026-01). Publication/update dates, revision statuses, assurance-level names, and structural facts are given with explicit uncertainty flags where the author is not fully certain. **No exact quotes, clause numbers, or section identifiers are asserted** — where a clause or figure would normally be cited, the concept is paraphrased and the reader is told to re-confirm against the named primary source before any external citation. Nothing here should be treated as verified until checked against the live specification.

> [!NOTE]
> **Evidence vs. inference.** Throughout this note, paragraphs labelled **Standard-level** describe what a specification actually defines (drawn from prior knowledge, re-confirm before citing). Paragraphs labelled **Product-level** describe how a shipping product implements or markets something — these are weaker facts, more volatile, and must not be presented as protocol guarantees. Paragraphs labelled **FreeLayer inference** are our own reasoning, not facts about any standard.

---

## 0. Scope and framing

This is **RESEARCH-ID-01: identity research only.** It surveys five identity-relevant standards families and evaluates each against FreeLayer's constraints. It does **not** choose any standard, does **not** select cryptography, and does **not** propose an implementation. All selection is explicitly **deferred to TECH-ID-02** and gated behind Gate F/G.

### 0.1 FreeLayer identity separations (invariants to respect throughout)

FreeLayer is a private, decentralized, accountless, local-first messenger. The following separations are load-bearing and are restated wherever a standard blurs them:

- **DevicePosture is NOT identity.** A hardened, attested, or "healthy" device says something about a *device*, not about *who is using it*. Device posture is an input to trust decisions, never a substitute for identity.
- **A hardened device is not a verified person.** Attestation of a secure enclave or a locked bootloader does not bind to a human.
- **A verified contact is not proof of a safe device.** You can have verified the *key relationship* with a contact whose device is compromised.
- **Membership is NOT identity.** Being in a room/group is an authorization/relationship fact, not an identity fact.
- **A profile name is NOT identity.** Display names are per-contact/per-room aliases, freely chosen, non-unique, non-authoritative.
- **A cryptographic key is not necessarily a real-world identity.** Key continuity proves "same keyholder as before," not "this legal person."

### 0.2 FreeLayer identity intentions (design constraints, not yet built)

- No phone/email login; no central identity database; no universal public account identifier; no admin recovery backdoor.
- Local + ephemeral identities; per-contact and per-room aliases; device keys; trust notebooks (local record of verified relationships); one-time invites; QR verification; offline recovery; Ghost/Cold identities.
- Identity cryptography is deferred (Gate F/G). **This document selects nothing.**

---

## 1. NIST SP 800-63-4 — Digital Identity Guidelines suite

**Reviewed (from prior knowledge; re-confirm before citing):** The NIST SP 800-63 family and its component volumes covering identity proofing/enrollment, authentication and authenticator lifecycle, and federation/assertions; and its three orthogonal assurance-level scales.

> [!NOTE]
> **Date/status uncertainty.** SP 800-63 Rev. 3 (SP 800-63-3) is the long-standing baseline (published circa 2017, with later errata). Revision 4 (SP 800-63-4) went through multiple public drafts; the author believes a final Rev. 4 was published around 2024–2025 but is **not certain of the exact final-publication date or whether all sub-volumes finalized together.** Treat "800-63-4" here as "the Rev. 4 line of the guideline"; verify the precise document status and effective date before external use.

### 1.1 Structure — separate the pieces

**Standard-level.** The suite is deliberately decomposed. Historically the sub-volumes are:

- **63 (base):** overall model, terminology, risk-based selection of assurance levels.
- **63A — Identity proofing & enrollment:** collecting and validating real-world identity evidence and binding it to a subscriber account. This is the "is this a real, specific person?" volume.
- **63B — Authentication & authenticator lifecycle management:** authenticators (something you have/know/are), binding, renewal, **recovery**, revocation, replacement, session management. This is the "is the same enrolled party back?" volume.
- **63C — Federation & assertions:** identity provider (IdP) ↔ relying party (RP) trust, assertion formats, and the privacy properties of passing identity between parties.

The key conceptual move is that these are **independent axes** — you can have strong authentication over a weak/self-asserted identity, and vice versa.

**Standard-level.** Three orthogonal assurance scales:

- **IAL (Identity Assurance Level):** confidence that the claimed real-world identity is real and belongs to the subject. Roughly: IAL1 self-asserted / minimal, IAL2 remote or in-person evidence validation, IAL3 in-person / supervised high-evidence. (In common usage people also say "IAL0" for *no* identity proofing at all; the author is **unsure whether Rev. 4 formally names an IAL0** — verify. The concept "no proofing" is what matters for us.)
- **AAL (Authentication Assurance Level):** confidence that the authenticating party is the same one previously enrolled. AAL1 single-factor, AAL2 multi-factor, AAL3 hardware-based, phishing-resistant, verifier-impersonation-resistant.
- **FAL (Federation Assurance Level):** strength/privacy of a federated assertion between IdP and RP.

**FreeLayer inference.** The single most useful thing NIST gives FreeLayer is **vocabulary and separation**, not a compliance target. The IAL/AAL split maps almost exactly onto our "a cryptographic key is not a real-world identity" invariant: **key continuity is an AAL-flavored property (same keyholder), never an IAL property (real person).**

### 1.2 What applies to an accountless decentralized messenger

**FreeLayer inference (applies):**

- **The IAL vs AAL separation** is directly relevant framing. FreeLayer does **no** real-world identity proofing by default, so it is effectively **IAL0 / self-asserted**. We should say this explicitly rather than implying our verification means "verified person."
- **Local cryptographic continuity is NOT identity proofing.** In NIST terms, QR verification + trust-notebook continuity is closer to *binding an authenticator and confirming key continuity* (AAL-flavored) than to *proofing an identity* (IAL). A "verified key relationship" is not proof of a legal identity.
- **Recovery affects assurance.** 63B's treatment of recovery and authenticator replacement is conceptually on-point: any recovery path (including our intended offline recovery) is a **trust-downgrade event** and must be modeled as such. An admin recovery backdoor would be the classic assurance/privacy hole — which FreeLayer explicitly forbids.
- **Authenticator replacement / device migration affects trust.** Adding or replacing a device key is exactly the "authenticator lifecycle" concern; a migrated device should not silently inherit full trust.
- **Privacy and usability must be evaluated together.** NIST 63 (esp. the privacy and usability considerations that accompany each volume) insists these are co-equal with security. FreeLayer's per-contact aliases and no-central-DB stance are privacy design choices that this framing supports.

### 1.3 What is inappropriate to import

**FreeLayer inference (does NOT apply / anti-goals):**

- **Federation / IdP–RP models (63C, FAL).** FreeLayer has **no identity provider and no relying-party account server.** Federation assumes a third party asserts identity to another party. Importing FAL/IdP concepts would reintroduce exactly the central identity authority we reject.
- **IAL2 / IAL3 evidence collection (63A).** These require collecting government evidence, biometrics, or in-person proofing — antithetical to accountless, no-phone/no-email, no-central-DB design. FreeLayer must **not** perform IAL2/3 proofing by default; doing so would create a real-world identity database that is a stated non-goal.
- **The subscriber-account / CSP (credential service provider) model.** NIST presumes an enrolling authority that holds subscriber records. FreeLayer has no such authority by design.

**FreeLayer inference — bottom line for §1.** Use NIST 800-63 as a **shared vocabulary and a separation discipline** (IAL≠AAL≠FAL; proofing≠authentication≠recovery≠federation). Do **not** adopt it as a conformance target, and specifically **reject** its federation and higher-IAL proofing models as architecturally incompatible.

---

## 2. W3C Decentralized Identifiers (DID Core)

**Reviewed (from prior knowledge; re-confirm before citing):** W3C DID Core as a Recommendation, its data model (DID → DID document), controllers, verification methods, service endpoints, DID resolution, the DID method concept, and the associated privacy/correlation guidance.

> [!NOTE]
> **Date/status uncertainty.** DID Core **1.0** reached W3C Recommendation status (the author recalls **circa July 2022**). A **1.1** revision has been in progress; the author is **unsure whether DID Core 1.1 has reached Recommendation or is still a Working/Candidate draft** as of the 2026-01 cutoff. Treat 1.1 as "in-flight, status unverified." Verify both dates before citing.

### 2.1 Structure — what DID Core defines

**Standard-level.** A **DID** is a URI of the shape `did:<method>:<method-specific-id>`. Resolving it yields a **DID document** containing:

- **Controller(s):** the entity/entities authorized to change the document.
- **Verification methods:** public keys / verification material and their intended relationships (authentication, assertion, key agreement, capability invocation/delegation).
- **Service endpoints:** URLs/URIs advertising services associated with the DID subject (e.g., a messaging or credential endpoint).
- **DID methods:** pluggable schemes (`did:key`, `did:web`, `did:peer`, ledger-based methods, etc.) that define how DIDs are created, resolved, updated, and deactivated. **Persistence and key rotation** semantics are method-specific.

**Standard-level.** DID Core is explicit that **service endpoints and reusable identifiers create correlation/privacy risk**, and it discusses pairwise/peer DIDs as a mitigation (a distinct DID per relationship to avoid a universal correlator). `did:peer`-style methods exist precisely to keep identifiers off any global registry and scoped to a relationship.

### 2.2 Evaluation for FreeLayer

**FreeLayer inference — does FreeLayer *need* DIDs?** Not obviously. FreeLayer's identity needs (local/ephemeral identities, per-contact keys, device keys, trust notebook, QR verification) can be met with **raw key material plus local records** without adopting the DID document abstraction, its resolution machinery, or its URI scheme.

Point-by-point:

- **Would a custom DID method add unnecessary complexity?** Almost certainly yes. Inventing a `did:freelayer` method means owning creation/resolution/rotation/deactivation semantics, interop expectations, and a spec surface — a large cost for an accountless P2P app that controls both ends of every relationship.
- **Do service endpoints create metadata?** Yes. Advertising service endpoints in a resolvable document is a **metadata leak** (who to contact, where, via what service) and cuts against FreeLayer's metadata-minimization posture. This is a strike against DID documents as our model.
- **Does resolution create infrastructure dependencies?** Frequently yes. Ledger-based and `did:web` methods introduce network/registry/hosting dependencies. That conflicts with local-first, zero-egress-by-default design. `did:key` (self-contained) and `did:peer` (relationship-scoped, no global registry) avoid most of this — but at that point the DID wrapper adds little over plain keys.
- **Are pairwise/peer identifiers more appropriate?** Conceptually **yes** — the *pattern* behind `did:peer` (a fresh, relationship-scoped identifier per contact, no universal public identifier, no global resolver) is exactly aligned with FreeLayer's per-contact aliases and "no universal public account identifier" invariant. The **pattern** is worth borrowing even if the DID encoding is not.
- **Would DID terminology confuse users?** Likely yes. "Decentralized Identifier / DID document / verification method" is jargon that conflicts with our plain-language "identity / device key / verified contact / trust notebook." Exposing DID vocabulary risks implying a global, resolvable, real-world identity — the opposite of what we mean.

**FreeLayer inference — mapping.** DID's *conceptual separations* are useful: controller ≠ key, verification-method-per-purpose, pairwise identifiers to avoid correlation. These reinforce our invariants (a key is not an identity; membership is not identity; no universal identifier). But the *machinery* (documents, methods, resolution, service endpoints) trends toward infrastructure and metadata we deliberately avoid.

> [!IMPORTANT]
> **CONCLUSION for §2: evaluate only — do NOT choose DIDs in this task.** Borrow the *pairwise/peer pattern* as design inspiration; defer any decision on adopting the DID data model, a DID method, or DID terminology to TECH-ID-02.

---

## 3. W3C Verifiable Credentials (VC Data Model)

**Reviewed (from prior knowledge; re-confirm before citing):** W3C Verifiable Credentials Data Model — the issuer / holder / verifier triangle, verifiable credentials vs. verifiable presentations, credential status/revocation mechanisms, and selective-disclosure approaches.

> [!NOTE]
> **Date/status uncertainty.** VC Data Model **1.0** was a W3C Recommendation (author recalls **circa 2019**); a **2.0** line has been progressing (status as of cutoff **unverified** — possibly Recommendation or Candidate). Selective-disclosure mechanisms (e.g., BBS-style signatures, SD-JWT in adjacent IETF work) are **evolving and not part of the core data model itself.** Verify all of this before citing.

### 3.1 Structure — what VCs are for

**Standard-level.** VCs model **issuer-attested real-world claims**: an **issuer** signs a credential about a **subject**; a **holder** stores it; a **verifier** checks the issuer's signature and (optionally) revocation status. Core concerns include:

- **Issuer dependence:** a credential is only as meaningful as trust in its issuer. VCs presuppose authorities worth trusting (governments, universities, employers, etc.).
- **Selective disclosure:** revealing a subset of attributes (or predicates like "over 18") without revealing the whole credential — an add-on cryptographic capability, not universal.
- **Revocation / status services:** verifiers often must check a status list/endpoint, which reintroduces an online dependency and a **correlation/metadata** vector.
- **Correlation risk & infrastructure burden:** issuers, status lists, and reused credential identifiers can all correlate a subject across verifiers.

### 3.2 Relevance to FreeLayer

**FreeLayer inference.** VCs solve a problem FreeLayer **does not have**: proving issuer-attested real-world claims (age, citizenship, membership-in-an-org, professional license). Accountless P2P messaging needs *"is this the same keyholder I verified before?"* — a **continuity/relationship** question — not *"has an authority attested a fact about this person?"*

- **Issuer dependence is a non-starter by default.** FreeLayer intentionally has no issuing authority and no central identity DB. Adopting VCs would either require inventing issuers or importing external ones — both reintroduce authorities we reject.
- **Revocation/status services** are online, correlating infrastructure — against zero-egress/local-first.
- **Correlation risk** cuts against per-contact aliases and "no universal identifier."
- **Membership is NOT identity** (invariant): even if we ever wanted to express "member of room X," a heavyweight issuer-signed credential is the wrong tool for what is a local authorization/relationship fact in FreeLayer's room model.

**FreeLayer inference — bottom line for §3.** **Recommend NOT adopting VCs** unless a concrete, real-world-attestation requirement emerges (none is on the roadmap). If such a requirement ever appears (e.g., optional, user-driven proof-of-something to a contact), re-open as a *separate* investigation — it should never become a default or a hidden dependency. Selective-disclosure primitives may be independently interesting far in the future, but that is a crypto-primitive question, not a reason to adopt the VC data model.

---

## 4. WebAuthn / passkeys (FIDO2)

**Reviewed (from prior knowledge; re-confirm before citing):** W3C Web Authentication (WebAuthn) API and the FIDO2 stack (CTAP + WebAuthn); the relying-party (RP) model; platform vs. roaming authenticators; device-bound vs. synced (cloud) credentials; attestation; and provider sync fabrics.

> [!NOTE]
> **Date/status uncertainty.** WebAuthn **Level 1** was a Recommendation (author recalls **circa 2019**); **Level 2** followed, and a **Level 3** has been in progress (status **unverified** at cutoff). "Passkey" is largely a **product/marketing term** (Apple/Google/Microsoft/FIDO Alliance) for **discoverable, often synced** WebAuthn credentials — treat passkey claims as product-level, not protocol guarantees. Verify.

### 4.1 Structure — what WebAuthn actually authenticates

**Standard-level.** WebAuthn authenticates a user to a **relying party (RP)** — a server/origin that holds an *account* to which a public key was registered. The authenticator (platform TPM/secure enclave, or roaming security key) holds the private key and produces assertions; the RP verifies them against the registered public key. It is fundamentally an **account-authentication** protocol: it answers "is the holder of the registered authenticator present for *this RP account*?"

**Standard-level.** **Device-bound vs. synced credentials:**

- **Device-bound** credentials never leave the authenticator (classic hardware-key model).
- **Synced credentials ("passkeys")** are backed up and **synced across a provider's fabric** (iCloud Keychain, Google Password Manager, Microsoft, etc.) so the key survives device loss.

**Product-level.** Recovery and cross-device availability for passkeys are typically delivered by the **platform provider's sync fabric**, not by WebAuthn itself. This creates a **platform-provider dependence** (Apple/Google/MS) and moves the recovery trust root into that provider.

### 4.2 Suitability for accountless / local-first

**FreeLayer inference.** The core mismatch is structural: **WebAuthn authenticates to a relying-party account, and FreeLayer has no account server.** There is no RP, no server-side account, no origin to register against in the classic sense. Therefore:

- WebAuthn/passkeys are, **at most, a local unlock / local authenticator reference** for FreeLayer — e.g., "use the platform authenticator to unlock the local app or gate access to a local key." They are **not an identity root** and cannot serve as the cross-party identity or the verified-contact relationship.
- **Device-bound vs. synced matters a lot to our invariants.** A synced passkey imports a **provider sync fabric** as a de-facto recovery backdoor and central-ish dependency — in tension with "no admin recovery backdoor" and "no central identity DB." Device-bound authenticators are more aligned with device keys but then carry hardware-loss/recovery concerns we'd have to design around.
- **Recovery implications:** relying on passkey sync for recovery means the provider's account is the recovery root — exactly the kind of external authority FreeLayer avoids. Our intended **offline recovery** and **Ghost/Cold identities** point the opposite way.
- **DevicePosture is NOT identity / hardened device ≠ verified person** (invariants): even a hardware-backed WebAuthn authenticator attests a *device/authenticator*, not a person — using it as "identity" would violate our separation.

**FreeLayer inference — bottom line for §4.** WebAuthn/passkeys are potentially reusable **only** as a **local unlock/authenticator convenience**, never as FreeLayer's identity root. Synced passkeys specifically drag in platform-provider dependence and an implicit recovery authority that conflict with FreeLayer's non-goals. **Do NOT add passkeys to the roadmap automatically**; if ever considered, scope strictly to local unlock and evaluate the sync-fabric dependency explicitly. Deferred to TECH-ID-02.

---

## 5. MLS — Messaging Layer Security (RFC 9420) — identity boundaries

**Reviewed (from prior knowledge; re-confirm before citing):** IETF MLS (RFC 9420) — its group key management (ratchet tree / TreeKEM), the **Credential** abstraction, the assumed external **Authentication Service (AS)** and Delivery Service (DS), and how MLS deliberately **delegates identity to the application**.

> [!NOTE]
> **Date/status uncertainty.** MLS protocol is **RFC 9420** (author recalls publication **circa 2023**). The author is reasonably confident of the RFC number but recommends verifying the number, date, and the exact AS/DS framing before citing.

### 5.1 Structure — where identity sits in MLS

**Standard-level.** MLS provides **group** continuity and efficient group key agreement with forward secrecy and post-compromise security. Crucially, MLS **does not define an identity system.** Instead:

- **Credentials:** each group member presents a **Credential** binding their signature key to some identity representation. MLS defines credential *types* (e.g., a basic credential, and X.509-based credentials) but treats the **meaning/validation of identity as out of scope**.
- **Authentication Service (AS) assumption:** MLS assumes an **external AS** that the application supplies, responsible for vouching that a credential legitimately corresponds to an identity. **MLS does not build the AS**; it *requires the application to define one.*
- **Delivery Service (DS):** an (untrusted-for-content) external service for message/keypackage delivery. Again external, application-provided.
- **Group membership** is managed cryptographically (add/remove/update via proposals & commits), but membership is a **group** fact, not an identity fact.

**FreeLayer inference — this is the cleanest fit to our invariants of any standard here.** MLS *itself* embodies "membership is NOT identity" and "a key is not a real-world identity": it manages keys and membership and explicitly hands **identity** back to the application's AS. That separation is exactly ours.

### 5.2 Relevance to FreeLayer

**FreeLayer inference.**

- MLS is relevant **only as FUTURE group-crypto input**, if/when FreeLayer needs efficient multi-party group messaging with strong forward secrecy / post-compromise security. It is **not** an identity standard and does not answer FreeLayer's identity questions.
- The **AS gap is the point of interest**: MLS would require FreeLayer to define what plays the role of the Authentication Service. In a FreeLayer world that AS is **not** a central server — it would be something like the **trust notebook + QR verification + per-contact key continuity** acting as a *local, decentralized* credential-validation policy. That mapping is a genuinely interesting future design question — and it lives on the **group-crypto** track, not this identity-research track.
- The **DS** (delivery) assumption must be reconciled with zero-egress/local-first transport choices — again a future transport/crypto question.

**FreeLayer inference — bottom line for §5.** MLS is a strong **reference** for how to keep group key management separate from identity, and its AS-delegation model validates FreeLayer's separations. **Do NOT select or implement MLS** here. Revisit only on the future group-crypto track (Gate F/G), and only after the identity model (TECH-ID-02) has defined what a decentralized "AS-equivalent" means for us.

---

## 6. Summary table

Relevance labels: **adopt-candidate** = worth seriously evaluating for adoption later; **reference-only** = useful as vocabulary/pattern/model, not for adoption; **reject** = architecturally incompatible with FreeLayer's stated non-goals.

| Standard (approx. status) | Relevance to FreeLayer | Why | Dependency / metadata risk | Decision status |
|---|---|---|---|---|
| **NIST SP 800-63-4** suite — IAL/AAL/FAL, proofing/auth/federation/recovery (Rev. 4 line; final date unverified) | **reference-only** (vocabulary & separation discipline) | Gives precise language for our core split: key continuity ≈ AAL (same keyholder), never IAL (real person). Recovery/authenticator-lifecycle framing is useful. But it presumes a CSP/subscriber-account model FreeLayer lacks. | Low as *vocabulary*. **High if imported literally**: 63A IAL2/3 proofing = real-world identity DB (a non-goal); 63C federation = central IdP authority (a non-goal). | Deferred to TECH-ID-02. Adopt terminology only; **reject** federation + IAL2/3 proofing models. |
| **W3C DID Core** (1.0 Rec ~2022; 1.1 status unverified) | **reference-only** (borrow the pairwise/peer *pattern*) | Pairwise/`did:peer`-style per-relationship identifiers align with per-contact aliases + "no universal identifier." But documents/methods/resolution add machinery over plain keys. | **Medium–High**: service endpoints leak metadata; ledger/`did:web` resolution = infrastructure dependency; custom method = spec+interop burden; DID jargon may imply a global real-world identity. | **Evaluate only — do NOT choose DIDs in this task.** Deferred to TECH-ID-02. |
| **W3C Verifiable Credentials** (1.0 Rec ~2019; 2.0 status unverified) | **reject** (for default P2P messaging) | Solves issuer-attested real-world claims — a problem FreeLayer does not have. Presupposes issuing authorities; membership-as-identity is an anti-pattern for us. | **High**: issuer dependence, revocation/status endpoints (online + correlating), reused credential IDs correlate subjects. | **Recommend NOT adopting** unless a concrete real-world-attestation requirement emerges; then re-open separately. Deferred/parked. |
| **WebAuthn / passkeys (FIDO2)** (WebAuthn L1 Rec ~2019, L2 later, L3 status unverified; "passkey" is product-level) | **reference-only** (at most a *local unlock*, not identity) | Authenticates to a relying-party account; FreeLayer has **no account server**, so it cannot be an identity root — only a local authenticator/unlock reference. | **Medium–High**: synced passkeys import Apple/Google/MS **sync fabric** = implicit recovery authority + central-ish dependency (conflicts with "no admin recovery backdoor"). Device-bound is safer but has loss/recovery cost. | **Do NOT add to roadmap automatically.** If ever used, scope to local unlock only. Deferred to TECH-ID-02. |
| **MLS (RFC 9420)** (~2023) | **reference-only** now → possible **adopt-candidate** on the *group-crypto* track | Best structural fit to our invariants: MLS manages group keys/membership and **delegates identity to an external AS the app must define** — mirrors "membership ≠ identity," "key ≠ identity." Not an identity system itself. | **Medium**: assumes an external **AS** (we'd have to define a decentralized equivalent: trust notebook + QR + key continuity) and a **DS** (reconcile with zero-egress). Not an identity dependency per se. | **Do NOT select or implement.** Revisit only as FUTURE group-crypto input at Gate F/G, after TECH-ID-02 defines our AS-equivalent. |

---

## 7. Cross-cutting conclusions (non-binding; no selection made)

**FreeLayer inference.** Reading across all five:

1. **Every one of these standards separates "key/authenticator/membership/credential" from "real-world identity."** That is not a coincidence — it is the mature consensus and it validates FreeLayer's invariants. The design lesson is the *separation*, adoptable independently of any specific standard.
2. **The recurring hazard is the implicit central authority / online dependency**: NIST's CSP+IdP, DID resolution/service endpoints, VC issuers+status lists, passkey sync fabric, MLS's AS/DS. FreeLayer's differentiator is refusing those authorities — so each standard is interesting mainly for the *seam* where it externalizes identity, which is exactly the seam FreeLayer must fill *locally and decentrally*.
3. **The most reusable idea is the pairwise/relationship-scoped identifier pattern** (DID peer-style), because it directly implements "no universal public account identifier" and per-contact aliases — but as a *pattern*, not as a mandated encoding.
4. **Nothing here should touch DevicePosture as identity.** Attestation/posture (WebAuthn hardware backing, device keys) stays an input to trust, never a person-identity claim.

> [!IMPORTANT]
> **No standard is selected. No cryptography is chosen. No roadmap item is added.** All adoption/selection decisions are explicitly **deferred to TECH-ID-02** and gated at Gate F/G. This note is input to that decision, not the decision.

---

## 8. Open questions to carry into TECH-ID-02

- What is FreeLayer's **decentralized AS-equivalent** (the thing that validates "this key ↔ this contact"): trust notebook + QR verification + key continuity? How is it expressed, stored, and reasoned about locally?
- How do **offline recovery** and **Ghost/Cold identities** interact with authenticator-lifecycle/recovery concerns (NIST 63B framing) *without* any central or provider recovery root?
- Do we want the **pairwise-identifier pattern** (per-contact/per-room keys with no correlator) as a hard invariant, and if so, how do we prevent accidental cross-context correlation?
- Where, if anywhere, does a **local unlock** (WebAuthn/platform authenticator) fit *without* importing a sync fabric?
- If group messaging is later needed, what identity inputs does an **MLS-style** design require, and can our AS-equivalent supply them offline?

---

### Source-verification checklist (all items UNVERIFIED — live internet unavailable)

Re-confirm before any external citation:

- [ ] NIST SP 800-63-4: final publication status/date; exact IAL/AAL/FAL definitions; whether "IAL0" is formally named; sub-volume finalization.
- [ ] W3C DID Core: 1.0 Recommendation date; 1.1 current status; exact wording on service-endpoint correlation and peer/pairwise DIDs.
- [ ] W3C Verifiable Credentials: 1.0/2.0 status and dates; current status-list/revocation and selective-disclosure mechanisms.
- [ ] WebAuthn/FIDO2: WebAuthn level statuses/dates; precise device-bound vs. synced-credential ("passkey") semantics; provider sync-fabric behavior (product-level).
- [ ] MLS: confirm RFC 9420 number/date; exact AS/DS framing and Credential types.
