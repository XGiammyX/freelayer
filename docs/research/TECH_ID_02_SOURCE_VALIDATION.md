# TECH-ID-02 — Source Validation (Identity Architecture ADR)

**Task:** TECH-ID-02 — Identity Architecture ADR — validation pass.
**Scope:** Re-check the most consequential identity decisions against authoritative sources **before the ADR is finalized.** NO implementation. NO cryptography selection.
**Branch:** `architecture/identity-firewall-adr`
**Continuity inputs (must not be contradicted):** [IDENTITY_STANDARDS_RESEARCH.md](IDENTITY_STANDARDS_RESEARCH.md), [IDENTITY_COMPETITOR_MATRIX.md](IDENTITY_COMPETITOR_MATRIX.md), [RESEARCH_ID_01_CONCLUSIONS.md](RESEARCH_ID_01_CONCLUSIONS.md), [IDENTITY_TERMINOLOGY_MODEL.md](IDENTITY_TERMINOLOGY_MODEL.md).

---

## 0. Offline-access & sourcing statement (READ FIRST)

> [!IMPORTANT]
> **Primary sources for this validation were consulted OFFLINE, from the author's established prior knowledge (knowledge cutoff 2026-01). No live web fetch, specification, RFC, product documentation page, source repository, or audit report was retrieved while writing this document.** Internet access was unavailable in this environment.
>
> **Every claim below is a re-verification candidate, not a settled citation.** Section identifiers, clause numbers, exact assurance-level names, publication dates, and revision statuses are given with explicit uncertainty and **must be re-checked against the named primary source before any external citation and before the ADR relies on them.** No exact quotes or clause numbers are asserted; where a spec would normally be cited, the concept is paraphrased.
>
> This is a **validation pass**: its purpose is to confirm (or refine) the RESEARCH-ID-01 conclusions, not to introduce new architecture. Where a conclusion is confirmed, it is marked **unchanged**; where wording or scope is tightened, it is marked **refined**. **No conclusion below is reversed, and no cryptography or standard is selected.**

### 0.1 Evidence-type tags (used inline throughout)

Tags describe *the kind of source a claim rests on in general public knowledge*, not a specific document retrieved today. Marketing framing is **never** treated as fact.

| Tag | Meaning |
|-----|---------|
| `[standard]` | A published formal standard / guideline (e.g. NIST SP, W3C Recommendation). |
| `[protocol-spec]` | A published protocol specification or RFC (e.g. IETF RFC 9420, Signal/Matrix protocol docs). |
| `[product-docs]` | Official product/user documentation or support pages (weaker, volatile, product-level). |
| `[source]` | Behaviour visible in open-source implementation. |
| `[audit]` | Third-party formal security/cryptographic audit or review. |
| `[inference]` | FreeLayer's own reasoning — **not** a fact about any external source. |

Two carry-over tags from the RESEARCH-ID-01 competitor matrix also appear where a claim's real basis is weaker than the six tags above: **`[independent-analysis]`** (reputable third-party research / community teardown — corroborating but not a formal audit) and **`[marketing]`** (a vendor's own promotional framing — **never treated as fact**, cited only to flag a claim that must be re-verified). These are retained for fidelity with the source documents; the six tags above remain primary.

> **Volatility note.** `[product-docs]` claims (Signal usernames, Matrix cross-signing UX, Session recovery UX, SimpleX routing) change fast and are the **highest-priority** items to re-verify. `[standard]` / `[protocol-spec]` structural facts are more stable but still require date/status confirmation. `[marketing]` claims — especially metadata/anonymity claims — are the single most important thing to re-verify.

### 0.2 What this pass does and does not decide

- **Does:** confirm that the load-bearing separations (key ≠ person, membership ≠ identity, DevicePosture ≠ identity, network anonymity ≠ identity assurance) are supported by authoritative sources; record precise **claim boundaries** (what FreeLayer may / may not say); flag any conclusion needing refinement.
- **Does NOT:** choose an identifier scheme, a DID method, a credential format, a recovery algorithm, a group-messaging protocol, or any cryptographic primitive. All selection remains **deferred to the ADR body and Gate F/G**.

---

## 1. Identity assurance — NIST SP 800-63-4

**Source under validation:** NIST SP 800-63 Digital Identity Guidelines suite (Rev. 4 line). `[standard]`
**Approx. last-updated / status:** SP 800-63-3 baseline circa **2017** (with errata). The Rev. 4 line went through multiple public drafts; author believes a **final Rev. 4 published circa 2024–2025**, but is **not certain of the exact final date or whether all sub-volumes finalized together.** **UNCERTAIN — re-verify document status and effective date.**

### 1.1 What the source says

`[standard]` The suite deliberately **decomposes digital identity into independent axes** and treats them separately:

- **Identity proofing / enrollment** (historically the "63A" volume): collecting and validating real-world identity evidence and binding it to a subscriber account — the "is this a real, specific person?" question.
- **Authentication & authenticator lifecycle management** ("63B"): authenticators, binding, renewal, **recovery**, revocation, replacement, session management — the "is the same enrolled party back?" question.
- **Federation & assertions** ("63C"): identity-provider ↔ relying-party trust and the privacy of passing identity between parties.

`[standard]` Three **orthogonal assurance scales**, selected by risk:

- **IAL (Identity Assurance Level)** — confidence the claimed real-world identity is real and belongs to the subject (roughly: IAL1 self-asserted/minimal, IAL2 remote/in-person evidence validation, IAL3 supervised high-evidence). Whether Rev. 4 **formally names an "IAL0"** for *no proofing* is **UNCERTAIN** — the *concept* "no proofing" is what matters here.
- **AAL (Authentication Assurance Level)** — confidence the authenticating party is the same one previously enrolled (AAL1 single-factor → AAL3 hardware-backed, phishing-resistant).
- **FAL (Federation Assurance Level)** — strength/privacy of a federated assertion.

`[standard]` The key structural move: these axes are **independent** — strong authentication can sit over a weak/self-asserted identity, and vice versa. Recovery and authenticator replacement are explicitly treated as **lifecycle events with assurance consequences**.

### 1.2 What FreeLayer MAY / MAY NOT claim

- **MAY** use the NIST *separation discipline* as vocabulary: proofing ≠ authentication ≠ recovery ≠ federation; and IAL (real person) ≠ AAL (same keyholder). `[inference]` This maps precisely onto the FreeLayer invariant "a key is not a real-world identity."
- **MAY** state that FreeLayer performs **no identity proofing by default** and is therefore **self-asserted** (conceptually IAL0 / "IAL1-and-below" territory). `[inference]`
- **MUST NOT** apply NIST **IAL/AAL/FAL labels or numbers** to FreeLayer trust states **unless FreeLayer actually meets those requirements** — which, by design, it does not (no CSP, no subscriber account, no evidence collection, no federation). Using "IAL2", "AAL2", etc. as marketing or UI labels would be an **overclaim**. `[inference]`
- **MUST NOT** describe local cryptographic continuity or QR verification as an *identity-assurance* (IAL) property. In NIST terms it is at most an **authentication-assurance-flavoured** property (same keyholder), never proof of a legal person. `[inference]`
- **MUST NOT** import the CSP / subscriber-account model, IAL2/3 evidence collection, or the federation/IdP model — each reintroduces a central authority or a real-world identity database that FreeLayer explicitly rejects. `[inference]`

**Ruling (records the task's key requirement).** FreeLayer must define and use its **own FreeLayer-specific trust-state vocabulary**, not NIST IAL/AAL labels. Illustrative candidate states — *for the ADR to name and finalize, not selected here* — might read like `unverified` → `key-continuity-observed` → `key-control-verified (channel-scoped)`, each explicitly **channel/relationship-scoped** and explicitly **not** a personhood claim. `[inference]` The vocabulary must never imply real-world proofing, and any recovery event must be expressible as an **assurance-reducing** transition within it. This is consistent with the existing terminology model's rule that a "verified" contact means *authentication assurance of key control over a channel*, not identity proofing.

### 1.3 Does any RESEARCH-ID-01 conclusion change?

**Unchanged (confirmed), with one refinement.** RESEARCH-ID-01 already concluded NIST is **reference-only** (vocabulary + separation), rejecting federation and IAL2/3 proofing. This pass **confirms** that and **refines** it by making explicit the *negative* rule the ADR should record verbatim: **do not attach NIST IAL/AAL numbers to FreeLayer states; brand FreeLayer's own trust-state names.** No reversal.

---

## 2. Pairwise identifiers — W3C DID Core / identifier-privacy guidance

**Source under validation:** W3C Decentralized Identifiers (DID Core) and its correlation/privacy guidance. `[standard]`
**Approx. last-updated / status:** DID Core **1.0 reached W3C Recommendation circa July 2022**. A **1.1** revision has been in progress; whether it reached Recommendation by the 2026-01 cutoff is **UNCERTAIN — treat 1.1 as in-flight, status unverified.**

### 2.1 What the source says

`[standard]` A DID is a URI `did:<method>:<id>` resolving to a **DID document** containing **controller(s)**, **verification methods** (keys bound to purposes: authentication, assertion, key agreement, etc.), and **service endpoints**. **DID methods** are pluggable schemes (`did:key`, `did:web`, `did:peer`, ledger-based) that define create/resolve/update/deactivate and **key-rotation** semantics.

`[standard]` DID Core is **explicit that globally stable, reusable identifiers and advertised service endpoints create correlation and metadata risk.** It discusses **pairwise / peer DIDs** (a distinct DID per relationship) as the mitigation, and `did:peer`-style methods exist precisely to keep identifiers **off any global registry** and **scoped to a single relationship**. `[standard]` Controller correlation (one controller reused across documents) and registry dependence (ledger / `did:web` resolution) are named privacy/infrastructure hazards.

### 2.2 What FreeLayer MAY / MAY NOT claim

- **MAY** adopt the **pairwise-identifier principle** — a fresh, relationship-scoped identifier per contact, no universal correlator — as a design principle, citing DID Core's own correlation guidance as authoritative support for it. `[inference]`
- **MAY** treat a **globally stable, peer-visible identifier as an explicit anti-goal**, and cite the standard's correlation/service-endpoint warnings in support. `[inference]`
- **MUST NOT** claim FreeLayer "implements DIDs," "is DID-compliant," or ships a `did:freelayer` method — none of that is being done, and doing so would import DID-document machinery, resolution infrastructure, service-endpoint metadata, and jargon that FreeLayer deliberately avoids. `[inference]`
- **MUST NOT** advertise service endpoints in a resolvable document (a metadata leak) or depend on a global resolver/registry — both conflict with local-first / metadata-minimization. `[inference]`

**Ruling.** FreeLayer **adopts pairwise-identifier *principles* without implementing a DID method or the DID data model.** A globally stable, peer-visible identifier is an **anti-goal.** The *pattern* is borrowed; the *encoding, resolution, and terminology* are not. `[inference]`

### 2.3 Does any RESEARCH-ID-01 conclusion change?

**Unchanged (confirmed).** RESEARCH-ID-01 §2 already ruled "evaluate only — do NOT choose DIDs; borrow the pairwise/peer pattern." This pass confirms the borrow is *supported by the standard's own privacy guidance*, strengthening — not changing — the conclusion. The candidate "Model E (DID-based)" remains rejected as unnecessary infrastructure/metadata.

---

## 3. Verification semantics — Signal documentation

**Source under validation:** Signal product/protocol documentation — safety numbers, usernames, phone-number privacy, linked devices, account recovery. `[product-docs]` `[protocol-spec]`
**Approx. last-updated / status:** Safety numbers are long-standing `[protocol-spec]`. **Usernames added circa 2024**; **phone-number-hidden-by-default circa 2023–2024** `[product-docs]`. Key-transparency direction is **UNCERTAIN on rollout state.** Product-level items are **volatile — re-verify.**

### 3.1 What the source says

`[protocol-spec]` A **safety number** verifies the **cryptographic key relationship between two parties/devices** (detecting MITM or key change). It does **not** attest who the human is. `[product-docs]` A **username** (added ~2024) is an **optional, changeable, deletable discovery handle** resolved by exact match — **not** a browsable directory and **not** a permanent public identity; deleting it breaks that discovery path. `[product-docs]` Since ~2023–24 the **phone number is hidden from other users by default** (registration ≠ visibility). `[product-docs]` **Linked devices** are authorized by a primary via QR, historically with limited history backfill. `[product-docs]` `[audit]` Recovery uses **PIN + Registration Lock** and **Secure Value Recovery (SVR)**, an SGX-enclave-backed service holding PIN-encrypted secrets — a **debated central trust anchor** given SGX side-channel history. `[audit]` `[inference]`

### 3.2 What FreeLayer MAY / MAY NOT claim

- **MAY** provide a **safety-number-equivalent** continuity/key-control check and present it honestly as *"this key relationship has not changed / key control confirmed over this channel."* `[inference]`
- **MUST NOT** describe a safety-number-equivalent (or any key/QR verification) as **real-world identity proof.** It verifies a *cryptographic relationship*, not personhood — this is exactly what Signal's own docs say. `[protocol-spec]` `[inference]`
- **MAY** offer a **connection handle** analogous to a Signal username, but **MUST** treat it as a *rotatable, per-context connection pointer*, **not** a verified public identity, and — per FreeLayer's no-global-identifier stance — **MUST NOT** make it a single global handle. `[inference]`
- **MUST NOT** adopt Signal's **central recovery** (SVR/SGX) or phone-number registration — both are the centralization FreeLayer rejects. `[inference]`

**Ruling.** Verification of a cryptographic relationship (safety-number equivalent) **must not be described as real-world identity proof**; a username/handle is a **connection handle, not a verified public identity.** `[inference]`

### 3.3 Does any RESEARCH-ID-01 conclusion change?

**Unchanged (confirmed).** Matches RESEARCH-ID-01's "say 'key continuity,' not 'identity'" and "rotatable discovery handle over permanent public ID." No change.

---

## 4. Multi-device trust — Matrix documentation

**Source under validation:** Matrix spec / Element docs — device identity, cross-signing, interactive verification (SAS/QR), key backup, SSSS. `[protocol-spec]` `[product-docs]`
**Approx. last-updated / status:** Cross-signing / SSSS / key-backup model circa **2020 onward**; spec evolves. **No standardized key transparency as of ~2024 is UNCERTAIN — re-verify current MSC status.**

### 4.1 What the source says

`[protocol-spec]` Each login is a **device** with its own device keys. **Cross-signing** introduces a **master (root) key** plus **self-signing** and **user-signing** keys, so verifying one device propagates trust across a user's devices and to other users — instead of pairwise-verifying every device. This is a **root-of-trust with device sub-keys** design (master = personal root; device keys = leaves). `[protocol-spec]` **SSSS + key backup** store cross-signing keys and encrypted room keys **on the homeserver**, unlocked by a user-held **recovery key / passphrase**; losing the recovery key can mean losing encrypted history / cross-signing trust. `[protocol-spec]` The user ID is **bound to a homeserver domain** (a metadata holder + migration trap). `[independent-analysis]` `[product-docs]` **Stale/unverified-device warnings** and "unable to decrypt" errors are a historical **UX pain point and key-confusion source**.

### 4.2 What FreeLayer MAY / MAY NOT claim (architectural lessons ONLY)

Extract **architecture lessons**, not infrastructure:

- **Root-of-trust shape (MAY borrow the shape):** a **local personal root that signs subordinate, revocable device keys** is a sound structure. `[inference]` **MUST keep the root local** — never in server-side SSSS / a homeserver.
- **Device sub-keys under the root (MAY borrow):** device keys as revocable leaves, not identities. `[inference]`
- **Recovery-key UX honesty (MAY borrow the lesson):** users who lose the recovery secret lose access; the flow must make this legible up front. `[inference]`
- **Stale-device handling (MAY borrow the lesson):** make device state **legible and quiet**, avoid "unable to decrypt" cliffs, prefer a small well-understood device set (fail-closed on stale/unverified). `[inference]`
- **MUST NOT** adopt Matrix **homeserver, server-side SSSS/key-backup, the `@user:homeserver` account model, or the cross-signing *infrastructure* automatically.** Only the conceptual shape (root → device sub-keys, verification, recovery-key UX, stale-device discipline) is imported. `[inference]`

**Ruling.** Extract **architectural lessons only** (root-of-trust, device sub-keys, recovery-key UX, stale-device handling); **do not adopt Matrix homeserver/cross-signing infrastructure** or server-coupled identity. `[inference]`

### 4.3 Does any RESEARCH-ID-01 conclusion change?

**Unchanged (confirmed).** Matches RESEARCH-ID-01 §14 (root-signs-device-keys, existing-device/recovery-kit approval, conservative stale-device handling, root off online-only devices) and the "borrow cross-signing's shape not its server-coupling" lesson. No change.

---

## 5. Pairwise & offline systems — SimpleX and Briar documentation

**Source under validation:** SimpleX Chat and Briar product docs / whitepapers — pairwise relationship identifiers, incognito/contextual profiles, QR contact verification, introductions, offline relationship establishment. `[product-docs]` `[independent-analysis]`
**Approx. last-updated / status:** SimpleX docs circa **2022–2024** (routing/multi-device iterate fast; some claims `[marketing]` until audited). Briar model mature, circa **2018 onward**. Multi-device maturity for both is **UNCERTAIN — re-verify.**

### 5.1 What the source says

**SimpleX** `[product-docs]`: **no global user identifier** — identity is **pairwise**, each connection a separate set of messaging queues addressed by per-connection identifiers; you connect via an out-of-band **connection link / QR** that can be **one-time or long-term**; **incognito mode** generates a random profile per connection; links/addresses are rotatable. The "servers cannot build the social graph" claim is `[marketing]` / `[independent-analysis — partially corroborated]` and **must be re-verified against the protocol whitepaper.**

**Briar** `[product-docs]`: **local public-key identity** on-device, **no account, no server**; preferred contact exchange is **in-person QR** (strong human-anchored TOFU); **remote introductions** let a verified contact introduce two others (web-of-introductions); **verified vs unverified** contacts are surfaced; transports include **Bluetooth / Wi-Fi / Tor**, enabling **offline / infrastructure-less** establishment. The honest cost: **device loss without backup = identity + history loss** (no server to recover from).

### 5.2 What FreeLayer MAY / MAY NOT claim

- **MAY** state that **pairwise-by-default** (relationship, not person, as the addressable unit) and **per-context / incognito profiles** are **proven in shipping systems** (SimpleX) and align with FreeLayer's per-contact / per-room aliases. `[inference]`
- **MAY** treat **one-time invite links** and **in-person QR verification** as validated bootstrap/verification patterns (SimpleX one-time links; Briar QR). `[inference]`
- **MAY** cite **offline relationship establishment** (Briar Bluetooth/Wi-Fi/QR) as a validated direction for FreeLayer's offline-invite / offline-recovery goals. `[inference]`
- **MAY** consider **introduction chains** as a directory-free growth path (Briar), **gated on mutual consent**, while **noting the correlation/consent implications**. `[inference]`
- **MUST NOT** repeat SimpleX/Briar **metadata / "server knows nothing"** claims as fact — tag as `[marketing]` / `[independent-analysis]` pending re-verification. `[inference]`
- **MUST** carry forward the honest cost these systems demonstrate: **no-global-id + local-only ⇒ recovery/continuity is hard**; FreeLayer's offline-recovery design must confront device-loss directly, not paper over it. `[inference]`

**Ruling.** SimpleX + Briar **confirm** FreeLayer's **per-contact pairwise + offline-invite** direction, including per-context profiles, one-time invites, QR verification, and introductions — with the recovery/continuity cost stated honestly. `[inference]`

### 5.3 Does any RESEARCH-ID-01 conclusion change?

**Unchanged (confirmed).** Directly supports RESEARCH-ID-01 §9 (hybrid B+C: root → personas → per-contact/per-room aliases → one-time invites → offline recovery) and the SimpleX/Briar lessons. No change.

---

## 6. Recovery-root consequences — Session documentation

**Source under validation:** Session product docs — Session ID / recovery-phrase (seed) coupling, restoration, multi-device, loss/compromise consequences. `[product-docs]` `[independent-analysis]`
**Approx. last-updated / status:** Session model circa **2020–2024** `[product-docs]`; onion-routing / swarm-storage metadata posture is `[marketing]` / `[independent-analysis]` and **UNCERTAIN — re-verify.**

### 6.1 What the source says

`[product-docs]` A **Session ID** is a public key derived from a keypair generated from a **recovery seed (phrase).** The **seed is the root**: it deterministically regenerates the keypair, so **whoever holds the seed is the identity.** Multi-device works by **restoring the same seed** on another device. There is **no server-side recovery** (hence no recovery metadata) and **no revocation authority**. `[independent-analysis]` Therefore **leaking the seed = full, irrevocable identity takeover.** Separately: `[independent-analysis]` Session's **onion routing is a network-anonymity property, NOT an identity-verification property** — hiding where a message came from says nothing about whether a key belongs to who you think.

### 6.2 What FreeLayer MAY / MAY NOT claim

- **MAY** state, citing Session as evidence, that **compromise of recovery material ≈ identity compromise**: if a seed/recovery secret is the root, whoever holds it *is* the identity. `[inference]`
- **MAY** adopt **user-held, offline recovery with no recovery-service metadata** as an attractive property (Session's seed model) — **but MUST NOT** pair it with a **single global permanent identifier** (Session's correlation failure); derive **per-context identities** from a locally-held root instead. `[inference]`
- **MUST** design recovery as an **assurance-reducing** event (per NIST 63B framing and the terminology model), and **MUST NOT** introduce any **administrator/master key or central recovery authority.** `[inference]`
- **MUST** address Session's **no-revocation** gap by keeping **key rotation / relationship re-keying** open, so a compromise is **not terminal.** `[inference]`
- **MUST NOT** let **network-anonymity** framing (onion routing, Tor) stand in for **identity assurance** — they are orthogonal axes, mirroring FreeLayer's "DevicePosture is not identity" separation. `[inference]`

**Ruling.** Supports: **recovery-material compromise ≈ identity compromise**; recovery **must reduce assurance** and **must never introduce an admin/master key**; and rotation/re-keying must exist so compromise is recoverable-from rather than permanent. `[inference]`

### 6.3 Does any RESEARCH-ID-01 conclusion change?

**Unchanged (confirmed), with one refinement.** Matches RESEARCH-ID-01 §13 (offline user-held recovery; recovery is assurance-reducing; never a master key) and §12/§4 Session lessons. **Refinement:** this pass elevates **"support key rotation / re-keying so compromise isn't terminal"** from a Session-specific lesson to an explicit **ADR requirement**, pairing the seed model's recovery benefit with per-context (non-global) derivation. No reversal.

---

## 7. Messaging-protocol credentials — MLS / RFC 9420

**Source under validation:** IETF Messaging Layer Security (MLS), RFC 9420 — Credential abstraction, external Authentication Service (AS), Delivery Service (DS), group membership. `[protocol-spec]`
**Approx. last-updated / status:** **RFC 9420, published circa July 2023.** Author reasonably confident of the number; **re-verify number, date, and exact AS/DS framing.**

### 7.1 What the source says

`[protocol-spec]` MLS provides **group** key management (TreeKEM / ratchet tree) with forward secrecy and post-compromise security. Crucially, **MLS does not define an identity system.** Each member presents a **Credential** binding a signature key to some identity representation; MLS defines credential *types* (e.g. basic, X.509) but treats **the meaning and validation of identity as out of scope**, delegating it to an **external Authentication Service (AS)** that *the application must supply.* MLS also assumes an external, content-untrusted **Delivery Service (DS).** **Group membership is a group fact, managed cryptographically — not an identity fact.**

### 7.2 What FreeLayer MAY / MAY NOT claim

- **MAY** cite MLS as authoritative confirmation that **application/identity semantics are delegated to an external AS the application defines** — i.e., **identity remains a FreeLayer architecture responsibility**, not something a group-messaging protocol solves. `[inference]`
- **MAY** note that MLS *itself embodies* "membership ≠ identity" and "key ≠ identity," validating FreeLayer's separations. `[inference]`
- **MUST NOT** **select, adopt, or implement MLS** here — this is an identity validation pass, not a group-crypto decision. If group messaging is ever pursued, MLS is a **future group-crypto-track** input (Gate F/G), and FreeLayer's **decentralized AS-equivalent** (trust notebook + QR verification + per-contact key continuity) would need definition first. `[inference]`
- **MUST NOT** treat the MLS AS as a central server — a FreeLayer AS-equivalent must be **local/decentralized.** `[inference]`

**Ruling.** MLS **delegates identity/credential semantics to an external Authentication Service / application** — therefore **application identity stays a FreeLayer architecture responsibility.** **Do NOT select MLS.** `[inference]`

### 7.3 Does any RESEARCH-ID-01 conclusion change?

**Unchanged (confirmed).** Matches RESEARCH-ID-01 §5 (MLS reference-only now; AS-delegation validates our separations; do not select/implement; revisit only on the future group-crypto track). No change.

---

## 8. Validation summary table

| Decision | Source(s) | Evidence type | RESEARCH-ID-01 conclusion unchanged? | Open question |
|---|---|---|---|---|
| Use FreeLayer-specific trust-state vocabulary; **do not** apply NIST IAL/AAL labels; self-asserted (no proofing) by default | NIST SP 800-63-4 | `[standard]` + `[inference]` | **Refined** (adds explicit "don't use IAL/AAL numbers; brand own states" rule) | What are the final FreeLayer trust-state names, and how is "recovery reduces assurance" expressed as a transition? (ADR) |
| Adopt pairwise-identifier **principles** without a DID method; globally stable peer-visible identifier is an anti-goal | W3C DID Core + correlation guidance | `[standard]` + `[inference]` | **Unchanged** (confirmed; standard's own privacy guidance supports it) | How to prevent accidental cross-context correlation of pairwise identifiers in practice? (ADR / Gate F) |
| Safety-number-equivalent = key-relationship verification, **not** real-world identity proof; username = connection handle, not verified public identity | Signal docs | `[protocol-spec]` `[product-docs]` + `[inference]` | **Unchanged** | Exact UI wording that conveys "key control over this channel" without implying personhood? (ADR) |
| Borrow root-of-trust + device-sub-key **shape**, recovery-key UX, stale-device discipline; **reject** homeserver / server-side SSSS / cross-signing infrastructure | Matrix docs | `[protocol-spec]` `[product-docs]` + `[inference]` | **Unchanged** | How to keep multi-device state "legible and quiet" without a server-side key store? (ADR / Gate F/H) |
| Per-contact **pairwise + offline invite** direction (incognito profiles, one-time links, QR verify, introductions) is validated; recovery cost stated honestly | SimpleX + Briar docs | `[product-docs]` `[independent-analysis]` + `[inference]` | **Unchanged** | Introduction-chain consent/correlation model; offline-invite revocation semantics? (ADR) |
| Recovery-material compromise ≈ identity compromise; recovery must **reduce assurance**; **no admin/master key**; support rotation/re-keying so compromise isn't terminal | Session docs | `[product-docs]` `[independent-analysis]` + `[inference]` | **Refined** (rotation/re-keying elevated to explicit requirement) | Rotation/re-keying model that preserves relationship continuity without a global correlator? (Gate F) |
| MLS delegates identity to an external AS/application → identity stays a FreeLayer architecture responsibility; **do NOT select MLS** | MLS / RFC 9420 | `[protocol-spec]` + `[inference]` | **Unchanged** | What is FreeLayer's decentralized "AS-equivalent" (trust notebook + QR + key continuity), and can it operate offline? (future group-crypto track) |
| Network anonymity (onion routing / Tor / DevicePosture) is **not** identity assurance — orthogonal axis | Session docs; NIST separation | `[independent-analysis]` `[standard]` + `[inference]` | **Unchanged** | (none new — reaffirms existing invariant) |

---

## 9. Unresolved questions (carry into the ADR body)

1. **Trust-state naming.** Final FreeLayer-specific trust-state vocabulary and how each state maps to observable facts (key-continuity observed vs. key-control verified vs. unverified). Must not reuse NIST IAL/AAL numbers. **[NIST §1]**
2. **Recovery-as-downgrade.** How a recovery event is represented as an **assurance-reducing transition** in that vocabulary, and how it is disclosed in UX — with **no** admin/master key and no central recovery service. **[NIST §1 / Session §6]**
3. **Cross-context correlation defense.** Concrete mechanism to keep pairwise/per-context identifiers uncorrelated (derivation, storage, and UI scope), so a per-room alias cannot be mapped back to the root. **[DID §2 / SimpleX §5 — deferred to Gate F]**
4. **Rotation / re-keying continuity.** A rotation/re-keying model that recovers from key compromise **without** creating a global permanent correlator and **without** breaking relationship continuity. **[Session §6 — Gate F]**
5. **Multi-device legibility without a server.** How to achieve Matrix's root→device-sub-key benefits and quiet stale-device handling while keeping the root **local** and off online-only devices. **[Matrix §4 — Gate F/H]**
6. **Introduction-chain consent model.** Whether directory-free introduction chains are in scope, and the mutual-consent + correlation controls if so. **[Briar §5]**
7. **Decentralized AS-equivalent.** If group messaging is ever pursued, what plays MLS's Authentication-Service role locally (trust notebook + QR + key continuity), and can it validate credentials **offline**. **[MLS §7 — future group-crypto track, Gate F/G]**
8. **Metadata-claim re-verification.** SimpleX "server can't build the graph," Session swarm/onion posture, and Signal KT/SVR trust model must be re-checked against `[protocol-spec]` / `[source]` / `[audit]` before any FreeLayer claim leans on them. **[§3/§5/§6]**

---

## 10. Source-verification checklist (all items UNVERIFIED — internet unavailable)

Re-confirm before the ADR relies on any of these and before any external citation:

- [ ] **NIST SP 800-63-4:** final publication status/date; exact IAL/AAL/FAL definitions; whether "IAL0" is formally named; sub-volume finalization. `[standard]`
- [ ] **W3C DID Core:** 1.0 Recommendation date (~July 2022); 1.1 current status; exact wording on service-endpoint correlation and peer/pairwise DIDs. `[standard]`
- [ ] **Signal:** current username / key-transparency rollout state; safety-number semantics; phone-hidden-by-default behaviour; SVR/SGX recovery trust model; multi-device/linked-device current state. `[protocol-spec]` `[product-docs]` `[audit]`
- [ ] **Matrix:** whether standardized key transparency has landed; current cross-signing / SSSS / key-backup UX; homeserver-coupling and migration behaviour. `[protocol-spec]`
- [ ] **SimpleX / Briar:** whether "server cannot build social graph" is protocol-guaranteed vs. deployment property; one-time-link + rotation mechanics; introductions; multi-device and recovery maturity. `[product-docs]` `[independent-analysis]` `[source]`
- [ ] **Session:** seed→Session-ID derivation; multi-device-by-seed; swarm-storage + onion-routing metadata posture; no-revocation consequence. `[product-docs]` `[independent-analysis]`
- [ ] **MLS:** confirm RFC 9420 number/date (~July 2023); exact AS/DS framing; Credential types; that identity validation is out of scope. `[protocol-spec]`

---

> [!IMPORTANT]
> **No standard is selected. No cryptography is chosen. No roadmap item is added.** This validation confirms (and in two places refines) RESEARCH-ID-01; it does not reverse any conclusion. All selection remains **deferred to the TECH-ID-02 ADR body and Gate F/G.** Every source claim above is offline-sourced from prior knowledge and **must be re-verified against the named primary source before implementation.**
