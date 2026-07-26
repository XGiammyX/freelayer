# Device Passport — Implementation Research (TECH-ID-08)

> **Sourcing note (read first).** Live internet access **was** available while preparing this document. The external standards below were **verified against their primary sources on 2026-07-23**, with version/date recorded per source: **RFC 9334** (RATS Architecture, January 2023) verified live; **NIST SP 800-63B Revision 4** (2025-08-26) §4 "Events" verified live (the loss/theft/compromise invalidation clause was retrieved verbatim; the subscriber-notification sub-clause was truncated in one fetch — flagged `[UNCERTAIN]`); **W3C Verifiable Credentials Data Model v2.0** (W3C Recommendation, 2025-05-15) verified live; **Signal linked-device** provisioning/behaviour verified live against Signal's blog + support material (product UI, `[VENDOR]`); **Matrix cross-signing** (master / self-signing / user-signing key roles) verified live against matrix.org's cross-signing documentation and MSC1756 — the single-page Client-Server API spec was **truncated** by the fetcher, so the exact normative wording of master-key reset, `m.device_list_update`, and re-verification clauses is flagged `[UNCERTAIN]`; **Macaroons** (Birgisson, Politz, Erlingsson, Taly, Vrable, Lentczner — NDSS 2014, Google) verified live; **RFC 9420** (MLS Protocol, July 2023) and **RFC 9750** (MLS Architecture, April 2025) are **carried forward from the live verification recorded in `docs/research/DEVICE_KEY_MODEL_IMPLEMENTATION_RESEARCH.md` (same date, 2026-07-23)** plus prior knowledge — re-verify before external citation. Specifications move: **re-verify any claim used for a security decision** against the primary source before relying on it. Throughout, **evidence** (what a standard actually says, or what the code in this repo actually does) is kept separate from **inference** (how we choose to apply it). This document informs the **local, root-authorization-scoped, NON-CRYPTOGRAPHIC** TECH-ID-08 Device-Passport work only; it decides nothing that ADR-0013 defers to **Gate F** (cryptography, key material, signatures, verification, device-key authorization, **device-passport signature format**), **Gate E** (invite/QR wire formats), or **Gate H** (multi-device identity synchronization + distributed revocation). It builds on the **shipped-but-unmerged** TECH-ID-07 device surface (`packages/identity/src/devices/`); the passport module itself does **not** exist yet — `packages/identity/src/device-passports/` is absent (`docs/audits/TECH_ID_08_PRECHECK.md` §4). Design decisions here are cross-checked against `docs/audits/TECH_ID_08_PRECHECK.md`.

**Evidence-type tags used below**

| Tag | Meaning |
| --- | --- |
| `[STANDARD]` | A published specification (RFC 9334; NIST SP 800-63B Rev. 4; W3C VC Data Model 2.0; IETF RFC 9420; IETF RFC 9750). Verified live 2026-07-23 unless noted — re-verify before external citation. |
| `[VENDOR]` | A product's documented behaviour (Signal linked devices; Matrix cross-signing). Verified live 2026-07-23 — re-verify against current docs/source. |
| `[ACADEMIC]` | A peer-reviewed publication (Macaroons, NDSS 2014). Verified live 2026-07-23. |
| `[REPO]` | Directly verifiable in this repository at the cited path. |
| `[INFERENCE]` | Our design reasoning applying evidence to TECH-ID-08. Not itself a source. |
| `[UNCERTAIN]` | A reading we are not fully confident about (fetch truncation or product drift); treat as a re-verify TODO. |

---

## 0. Scope and non-goals

### 0.1 What a Device Passport is (working definition — design intent, not yet built)

`[INFERENCE]` TECH-ID-08 introduces **one local, root-authorization-scoped, non-cryptographic aggregate** — a `DevicePassportStateV1` (current-process, memory/null) — that records *a local, unsigned authorization CLAIM binding one identity root to one device context*, and nothing cryptographic. The precheck names the planned shape: a new additive `packages/identity/src/device-passports/` module plus a `DevicePassportStateV1` aggregate, with a new `IdentityAuthorityEpoch` type + `IdentityAuthorityEpochStateV1` contract added additively to `identity-types.ts` and the current epoch **caller-resolved** via the approver/root context rather than stored on the root record (`[REPO]` `docs/audits/TECH_ID_08_PRECHECK.md` §4.8). The unit of record is a **local device-passport claim**: a subordinate, revocable, root-scoped, *unsigned* authorization statement that will be **signed LATER by Gate F** — *not* a signature, *not* a verified credential, *not* an attestation, *not* a QR/wire artifact.

- **Local device-passport claim** — *a local statement that a named device context is (or was) authorized under one identity root at a given root authority epoch, carrying the exact scopes, capabilities, and empty device key-slot commitments the device may LATER operate within, held locally, with* **no signature and no key material**. It realises ADR-0013 §11's "Device Passport denotes a *future signed root↔device authorization relationship* only … **no implementation today**" and §19's deferral of the "device-passport signature format" to Gate F (`[REPO]` `docs/adr/ADR-0013-identity-firewall-architecture.md` §11, §19). It reuses the identity revision/schema primitives (`IdentityLocalRevision`, `FIRST_IDENTITY_REVISION`, `nextIdentityRevision`; `[REPO]` `packages/identity/src/identifiers.ts`) and the whole TECH-ID-07 device surface (§6.6).

Like the TECH-ID-07 device-authorization record, a device-passport claim is **local metadata**, memory/null only, scoped to one root, and non-authoritative for anything cryptographic. Its production lifecycle states are `draft`/local-unsigned only; the `issued_future_signed` and `accepted_future_verified` states are **structurally not constructible in production** (`[REPO]` `docs/audits/TECH_ID_08_PRECHECK.md` §4.6).

### 0.2 What a Device Passport is NOT (mandatory distinctions)

`[INFERENCE]` These are load-bearing category boundaries, not marketing copy.

- **A Device Passport is not DevicePosture.** A passport claim says a device context *is authorized under a root*; DevicePosture is an **environment attribute** describing endpoint state, "never identity, never authority" (`[REPO]` `packages/rooms/src/policy-composition/device-posture.ts`). **DevicePosture may restrict use of a device but can neither issue nor validate a passport** (ADR-0013 §11: "DevicePosture may tighten … but cannot authorize a device").
- **A Device Passport is not hardware attestation and not proof a device is safe.** It carries no measurement, no boot state, no enclave quote, no telemetry; it makes no endpoint-safety claim (see §6.5; ADR-0013 §11: a Device Passport "implies **no** hardware attestation, no real-world passport, no endpoint safety").
- **A Device Passport is not proof of real-world identity.** Authorizing a device context is an AAL-flavoured "same keyholder / same authority context" statement, never an IAL "real person" claim; real-world identity proofing is not implemented by default (`[REPO]` `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §1.2; ADR-0013 §4, §18).
- **A device is not a person.** A passport binds a root to a *device context*, not to a human.
- **A passport ID is not a hardware identifier.** The candidate/subject device is named by an opaque `LocalDeviceRef` that encodes "no OS device id, hardware serial, advertising id, browser fingerprint, hostname, model name, or attestation identity" (`[REPO]` `packages/identity/src/devices/device-identifiers.ts`); the identity validator already rejects `hardwareId`/`deviceFingerprint`/`attestation` as forbidden caller input (`[REPO]` `packages/identity/src/identity-validation.ts`).
- **A local unsigned approval is not cryptographic authorization.** No signature bytes, no verification, no key material. A local approval grants **no operational device authority** (`[REPO]` `docs/audits/TECH_ID_08_PRECHECK.md` §4.5, §6). `cryptographicallyAuthorized` is a literal `false` on every device record and snapshot today (`[REPO]` `packages/identity/src/devices/device-types.ts`, `device-authorization-context.ts`).
- **A QR code is not authorization.** A QR is only a *transport representation* of a candidate/link payload; the wire format is **Gate E** and no QR is produced, scanned, or accepted here. The command that would approve a QR (`identity.device.approve_qr`) is in the future-gated list that "must not exist" (`[REPO]` `packages/identity/src/devices/device-commands.ts` — `DEVICE_FUTURE_GATED_COMMAND_NAMES`).
- **RoomOS membership is not device authorization.** A `RoomMembershipRecordV1` is one local, unverified room-member relationship carrying no device key (`[REPO]` `packages/rooms/src/membership/membership-types.ts`); **room membership does not authorize a device**, and a passport neither grants nor proves membership (§6.4; ADR-0013 §10).
- **A device label is not authority.** A local device label is presentation metadata with `authority: "none"` (`[REPO]` `packages/identity/src/devices/device-types.ts` — `LocalDeviceLabelV1`), never a capability, role, or proof.

### 0.3 Non-goals

`[INFERENCE]` TECH-ID-08 introduces **no** cryptography, key material, key generation, signatures, signature verification, key derivation, fingerprints, attestation, hardware binding, **no signed or verified passport**, no linking/provisioning wire format, no QR flow, no cross-signing, no remote activation/acceptance, no remote/cryptographic revocation, no replay-resistant linking, no distributed device lists, no synchronization, no persistence to disk, no network, no notification, no AI, no telemetry. It adds only a **local, non-cryptographic, root-scoped, UNSIGNED** device-passport-claim layer that reuses the identity revision, injected-id + pure-reducer, fail-closed policy, exact-scope `PolicyDecision`, memory/null, and redaction machinery already shipped for roots, aliases, and the TECH-ID-07 device model. It ports no external passport/credential system; it extracts **design principles** from external standards and **reuses patterns** already validated in this monorepo. **The Secure Device provider stays externalized** (`check:no-secure-device-core-implementation`).

---

## 6.1 Authenticator binding + replacement — NIST SP 800-63B (Rev. 4)

**Source** `[STANDARD]` **NIST SP 800-63B, Revision 4 — Digital Identity Guidelines: Authentication and Authenticator Lifecycle Management (2025-08-26)**, §4 "Events" (authenticator binding, maintenance, and invalidation). Verified live 2026-07-23. Cross-referenced with `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §1 and the lifecycle translation in `docs/research/DEVICE_KEY_MODEL_IMPLEMENTATION_RESEARCH.md` §6.1.

**Principles extracted (evidence) — TRANSLATED, not copied:**

1. `[STANDARD]` **Adding a new authenticator requires authority already bound to the identity.** Binding an additional authenticator is a governed event done from an already-authenticated session at the appropriate strength ("Setting or changing the pre-registered telephone number is considered to be the binding of a new authenticator and **SHALL** only occur as described in [Sec. 4.1.2]"). A new authenticator is not silently trusted. `[UNCERTAIN]` the full §4.1.2 text was truncated in one fetch — re-confirm the session-strength wording.
2. `[STANDARD]` **Subscriber intent gates the addition.** Binding is a deliberate, subscriber-driven event, not an implicit side effect.
3. `[STANDARD]` **Lifecycle events are explicit and managed.** Binding (issuance/association), maintenance (adding/replacing), and invalidation (loss, theft, damage, compromise, expiration, revocation) are distinct governed transitions.
4. `[STANDARD]` **Compromise/loss/revocation must trigger prompt invalidation.** Verbatim: "The CSP **SHALL** provide a mechanism to invalidate the authenticator immediately upon notification from a subscriber that the authenticator's loss, theft, or compromise is suspected." Invalidation is a first-class, must-exist path.
5. `[STANDARD]` **Notification is an independent signal.** The guideline stresses subscriber awareness of binding and invalidation events so a silent/unnoticed change is detectable. `[UNCERTAIN]` exact notification sub-clause truncated — re-confirm.

**Translation → TECH-ID-08 (FreeLayer has no CSP/account):**

- `[INFERENCE]` **The local root controller replaces account binding.** FreeLayer has no central CSP, no subscriber account, and no server-side authenticator registry. The analogue of "bind an authenticator to a subscriber account" is "record an **unsigned device-passport claim** under a **local identity root**." The root is the local authority; there is no external issuer (ADR-0013 §7 "the identity root is a private local controller"; §11).
- `[INFERENCE]` **Adding a device requires existing root authority.** No passport claim may be prepared except from an already-authorized approver context under an **active, non-compromised** root — enforced by re-checking a captured `DeviceAuthorizationSnapshotV1` against the authoritative record + `DeviceRootRefV1` (root must be `rootActive` and not `rootCompromised`), which fails closed on any drift (`[REPO]` `packages/identity/src/devices/device-authorization-context.ts` — `assertDeviceAuthorizationSnapshotCurrentV1`). "Adding a device requires **explicit approval**" (ADR-0013 §11).
- `[INFERENCE]` **Subscriber intent maps to an explicit, discriminated command + user action.** There is no generic passport patch; there is no `add_remote`/`link`/`approve_qr` command (future-gated). Acceptance "still requires current policy + user action" (ADR-0013 §14).
- `[INFERENCE]` **Loss/compromise/revocation invalidate local authorization state.** A passport claim's authority is fenced to the underlying TECH-ID-07 device-authorization lifecycle; marking that device `compromised_suspected`/`revoked_tombstone` (terminal) invalidates prior snapshots — a **local** invalidation, explicitly **not** remote erasure (`[REPO]` `packages/identity/src/devices/device-lifecycle.ts`; ADR-0013 §20).
- `[INFERENCE]` **Notification maps to honest redacted summaries.** A device-list/passport summary surfaces lifecycle/assurance honestly and never asserts verification; it is not a network notification.

**Explicitly not done / not claimed:**

- `[INFERENCE]` **No NIST AAL/IAL labels, no compliance claim.** We borrow the **event discipline and separation** (binding ≠ maintenance ≠ invalidation), not conformance. Key-continuity, when it exists (Gate F), is an AAL-flavoured "same keyholder" property, never an IAL "real person" claim.
- `[INFERENCE]` **No CSP, no subscriber record, no server invalidation, no telephone-number authenticator.** The §4 "prompt invalidation" requirement is honoured as **local** revocation only.

---

## 6.2 Signal linked-device ceremony — LESSONS ONLY (concerns SEPARATED)

**Source** `[VENDOR]` **Signal linked-device provisioning** — the candidate device displays a QR containing bootstrap material; the primary phone scans it and is asked "Link this device?" (approve → "Device approved!"); the new device proves it has the account holder's permission and obtains a set of keys from the primary; message-history/media transfer is an **optional** step at link time; linked devices are listed and can be unlinked; there is a fixed device limit. Verified live 2026-07-23 against Signal's blog ("A Synchronized Start for Linked Devices") and support material. `[UNCERTAIN]`/`[VENDOR]` product provisioning/UI evolves across releases — re-verify against current Signal source before external citation.

**Lessons — the ceremony DECOMPOSES into five independent concerns; TECH-ID-08 touches only the first, and only locally:**

| Concern (Signal) | What Signal does `[VENDOR]` | FreeLayer mapping `[INFERENCE]` |
| --- | --- | --- |
| **1. Authorization-to-add** | Primary phone must explicitly approve "Link this device?" | The **only** concern TECH-ID-08 models: an explicit, root-authorized, unsigned local approval to *prepare* a passport claim, gated by an approver `DeviceAuthorizationSnapshotV1` + exact-scope `PolicyDecision` + user action. **Grants no operational authority** (`docs/audits/TECH_ID_08_PRECHECK.md` §4.5). |
| **2. Transport-establishment** | QR carries bootstrap material to open a secure channel | **Gate E** — no QR is produced/scanned/accepted; a QR is only a transport representation, never authorization. `identity.device.approve_qr` is future-gated and must not exist (`device-commands.ts`). |
| **3. History-transfer** | Optional message/media transfer at link time | **Out of scope** — ADR-0013 §11 keeps "history access and device authorization … **separate** decisions." No history is read, copied, or transferred. |
| **4. Ongoing-delivery** | Per-device sessions/mailboxes deliver messages | **Gate F messaging-crypto** — not identity; no sessions, no keys, no delivery here. |
| **5. Removal** | Linked-device list + unlink | A local, honest, redacted passport/device summary + local revocation (state transition, never remote wipe); a removed device "must not remain silently trusted" (ADR-0013 §11) but distributed revocation is deferred (§20). |

**What we deliberately do NOT copy:**

- `[INFERENCE]` **Not Signal's account model, protocol, keys, or servers.** FreeLayer is accountless with no phone/email identity (`identity-validation.ts` rejects `phone`/`email`/`username`; ADR-0013 §18); there is no primary-phone account, no provisioning server, no mailbox model, no key encoding. We take the *separation of the five concerns* and the *authorization-to-add is a deliberate, permissioned, one-time event* shape only.
- `[INFERENCE]` **Not "one-time linking material" as a crypto artifact.** ADR-0013 §14's `device_link_request` invite class is one-time, capability-limited, revocable *in concept*; its token/wire format and replay resistance are **Gate E/F**. TECH-ID-08 produces **no** replay-resistant linking material and makes no replay-resistance claim.

---

## 6.3 Matrix cross-signing hierarchy — LESSONS ONLY (do NOT implement cross-signing)

**Source** `[VENDOR]` **Matrix cross-signing** — a per-user key hierarchy: the **master key** signs both the **self-signing key** and the **user-signing key**; the **self-signing key** signs the user's own device keys; the **user-signing key** signs *other* users' master keys. Verified live 2026-07-23 against matrix.org's cross-signing documentation and MSC1756. `[UNCERTAIN]` the single-page Client-Server API spec was truncated by the fetcher; the exact normative wording of master-key **reset/replacement**, `m.device_list_update` device-list-change notifications, and re-verification-after-key-change was **not** retrievable in one fetch — re-confirm the SHOULD/MUST clauses against the live spec section before external citation.

**Lessons extracted (evidence):**

1. `[VENDOR]` **A root key confers authority on subordinate keys via an explicit signature hierarchy.** Trust is a chain of *explicit signatures*, not an ambient boolean.
2. `[VENDOR]` **Purpose separation is structural.** Signing one's *own devices* (self-signing) is a distinct role from attesting *other users* (user-signing) and from the *root* (master) — three keys, three purposes.
3. `[VENDOR]` **The root key is high-impact.** Because everything hangs off the master key, its change/reset invalidates prior cross-signing trust and warrants explicit re-verification. `[UNCERTAIN]` exact wording — re-confirm.
4. `[VENDOR]` **Device-list changes are a first-class propagated event**, and stale device info is a known hazard.
5. `[VENDOR]` **Keys are named by opaque key-IDs in a separated namespace; a key-ID/device-ID is not a human identity** and confusing one for another is a spoofing/UX hazard.

**Lessons for TECH-ID-08 (do NOT build cross-signing):**

- `[INFERENCE]` **Root-to-device authority, expressed as data, not (yet) a signature.** A device-passport claim is subordinate to the root and never *is* the root; ADR-0013 §11's "each future device has independent key material" plus §7's "no global root public key reused across unrelated relationships" encode Matrix's device-key/master-key role split. The claim must never expose, embed, or derive from the private root id — the root is `publicExposure: "forbidden"` (`[REPO]` `packages/identity/src/identity-types.ts`). The **signature** that would turn this claim into a real credential is Gate F; no signature is created here.
- `[INFERENCE]` **Purpose separation is already enforced in the reused surface.** Each future key slot has exactly one purpose, reuse across purposes is forbidden, and the purpose cannot change after activation (`[REPO]` `packages/identity/src/devices/device-key-purposes.ts`; `DeviceKeyPurposeV1` includes distinct `device_authorization_signing_future` vs `device_linking_future` vs messaging purposes). A passport commits to **empty** key-slots (`algorithm: "not_selected_gate_f"`, `publicMaterialPresent: false`; `[REPO]` `packages/identity/src/devices/device-key-slots.ts`).
- `[INFERENCE]` **Root compromise / root-epoch change is high-impact and must invalidate prior passports (re-verification).** This is the precheck's `IdentityAuthorityEpoch` / `IdentityAuthorityEpochStateV1` (caller-resolved current epoch; `[REPO]` `docs/audits/TECH_ID_08_PRECHECK.md` §4.8): a passport claim binds the root authority **epoch**, so an epoch bump (root reset/recovery/compromise) makes prior claims stale and requires explicit re-approval — mirroring Matrix's "master-key change ⇒ re-verify." ADR-0013 §12 requires that verification "never silently survives incompatible key/root changes," and §13 that on recovery "old device authorizations are reviewed or invalidated." The **detection + warning crypto** is Gate F; TECH-ID-08 wires the **epoch state slot** only.
- `[INFERENCE]` **Explicit re-verification, never a silent refresh.** `assertDeviceAuthorizationSnapshotCurrentV1` fails closed on revision/lifecycle/scope/capability drift and never silently refreshes stale authority (`[REPO]` `packages/identity/src/devices/device-authorization-context.ts`).
- `[INFERENCE]` **Stale device info is a hazard to surface, not hide;** disambiguate by opaque ref, never by label. A device-ref/passport-id proves nothing; security-sensitive UI disambiguates by opaque reference + honest assurance state — the same conclusion the alias work reached for display names.
- `[INFERENCE]` **Key-ID namespace separation.** The reused identifiers keep device/authorization/key-slot references in *separate prefixed namespaces* (`dev-`, `devauth-`, `devslot-`; `[REPO]` `packages/identity/src/devices/device-identifiers.ts`); a passport must not collapse these into one ambiguous id.
- `[INFERENCE]` **Signature-graph exposure is a reason NOT to publish anything.** Building a published signature/attestation graph would create the correlation surface ADR-0013 minimizes (§20 "root compromise can reveal a user's own relationship mapping"); no graph, no publication, no signature exists here.

**Explicitly not done:** `[INFERENCE]` no cross-signing, no master/self-signing/user-signing keys, no published signatures, no signature verification, no device-list gossip protocol — all Gate F/H. TECH-ID-08 records only a local, non-cryptographic, unsigned passport claim.

---

## 6.4 MLS device/client model — RFC 9420 + RFC 9750

**Source** `[STANDARD]` **RFC 9420, "The Messaging Layer Security (MLS) Protocol" (July 2023)** and **RFC 9750, "The Messaging Layer Security (MLS) Architecture" (April 2025)**. Verification carried forward from the live 2026-07-23 verification recorded in `docs/research/DEVICE_KEY_MODEL_IMPLEMENTATION_RESEARCH.md` §6.4 + prior knowledge — re-verify before external citation. Cross-referenced with `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §5.

**Principles extracted (evidence):**

1. `[STANDARD]` **One user = multiple distinct clients.** RFC 9420 defines a Client as "an agent that uses this protocol to establish shared cryptographic state with other clients"; RFC 9750 models one user's several devices as several clients.
2. `[STANDARD]` **A client presents a credential binding an identity to its signing key.** A KeyPackage is "a signed object describing a client's identity and capabilities"; each member "presents a credential that provides one or more identities … and associates them with the member's signing key."
3. `[STANDARD]` **Identity-to-client mapping is the application's responsibility.** RFC 9750 places the binding between application-meaningful identifiers and key material in an external **Authentication Service**, and says it is "up to the application to determine how to present this situation to users" when multiple clients share one identity.
4. `[STANDARD]` **Membership operations act on individual clients.** Removing a *client* is distinct from changing an abstract "user's" logical membership; add/remove/update act per client.
5. `[STANDARD]` **Protocol-client and application-identity are separate layers.**

**FreeLayer implication (do NOT select MLS, do NOT implement KeyPackages):**

- `[INFERENCE]` **A logical membership may map to one *or more* device passports; the two layers must NOT be conflated.** Today `RoomMembershipRecordV1` is one local, unverified relationship carrying no key/device material (`[REPO]` `packages/rooms/src/membership/membership-types.ts`), and the `RoomIdentityBindingV1` that ties a root/persona to a room carries `credentialState: "not_implemented_gate_f"` (`[REPO]` `packages/identity/src/identity-types.ts`). MLS makes the same split structurally: membership is a *group/relationship* fact; credentials/clients are the *cryptographic* layer. A device passport is FreeLayer's "per-client credential" placeholder — keyed to the **root** (`DeviceRootRefV1`), so a single logical membership can, at Gate F, correspond to several authorized device contexts.
- `[INFERENCE]` **Removing a device passport ≠ changing logical membership.** Revoking a passport claim (local device-authorization tombstone) is a client-layer operation; it does not rewrite the membership record or the room binding — the aggregates stay separate (§6.6). This mirrors MLS "remove a client, not the user."
- `[INFERENCE]` **FreeLayer's "AS-equivalent" is local and decentralized.** Any future MLS-style design needs a decentralized Authentication-Service equivalent (trust notebook + verification + key continuity), not a central server (`[REPO]` `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §5.2). That is a **group-crypto track** question, not TECH-ID-08.

**Explicitly not done:** `[INFERENCE]` MLS is **not** selected or implemented; no KeyPackages, no Credentials, no ratchet tree, no AS/DS, no HPKE. TECH-ID-08 records only that the *boundary* exists so future crypto can slot a signed passport under a membership without collapsing the two layers (Gate F).

---

## 6.5 Attestation separation — RFC 9334 (RATS) terminology

**Source** `[STANDARD]` **RFC 9334, "Remote ATtestation procedureS (RATS) Architecture" (January 2023)**. Verified live 2026-07-23. Term definitions quoted below are from the architecture overview.

**Terminology (evidence) — quoted:**

- `[STANDARD]` **Evidence** — "A set of Claims generated by an Attester to be appraised by a Verifier" (configuration data, measurements, telemetry, or inferences about system state).
- `[STANDARD]` **Attestation Result** — "The output generated by a Verifier, typically including information about an Attester, where the Verifier vouches for the validity of the results."
- `[STANDARD]` **Attester** — "A role performed by an entity (typically a device) whose Evidence must be appraised in order to infer the extent to which the Attester is considered trustworthy."
- `[STANDARD]` **Verifier** — appraises Evidence and produces Attestation Results. **Relying Party** — depends on the validity of information about an Attester. **Endorsement** — a secure statement that an Endorser vouches for an Attester's capabilities. **Reference Values** — values Claims are compared against under an Appraisal Policy.

**The load-bearing separation for TECH-ID-08:**

- `[INFERENCE]` **A Device Passport is an AUTHORIZATION credential, orthogonal to the entire RATS pipeline.** It states "*this root authorizes this device context with these scopes/capabilities at this authority epoch*." It is:
  - **NOT Evidence** — it carries no measurements, no boot/config state, no telemetry, no Claims about system trustworthiness.
  - **NOT an Attestation Result** — no Verifier appraises hardware Evidence; the root is a local *authorizer*, not a RATS Verifier vouching for device integrity.
  - **NOT a hardware measurement / Endorsement / Reference Value** — none are collected, stored, or compared.
  - **NOT a DevicePosture assessment** — DevicePosture is FreeLayer's (externalized, untrusted-for-elevation) consumer of environment signals; it "may reduce trust … but may NEVER increase it" and is never identity or authority (`[REPO]` `packages/rooms/src/policy-composition/device-posture.ts`). **DevicePosture may restrict use of a device but can neither issue nor validate a passport.**
- `[INFERENCE]` **Authorization ≠ attestation.** Even a future *signed* passport (Gate F) would attest only "the root authorized this device," never "this device is genuine/measured/safe." Any real device attestation would be a **separate** RATS-style pipeline with a Secure Device provider that is **externalized**, not part of the Identity Firewall (`check:no-secure-device-core-implementation`).

**Explicitly not done:** `[INFERENCE]` no Attester, no Verifier, no Evidence, no Attestation Result, no Endorsement, no Reference Values, no appraisal policy, no hardware measurement. The passport lives entirely on the authorization axis.

---

## 6.6 Credential-format alternatives (evaluation) + repository patterns reused

`[INFERENCE]` The object is *called* a "passport," but that name must not drag in a heavy standard. Below, five candidate formats are evaluated, then the reused local patterns are enumerated with adopted decisions, rejected alternatives, and unresolved Gate F questions.

### 6.6.1 Credential-format alternatives

| Option | What it is | Fit for TECH-ID-08 | Verdict `[INFERENCE]` |
| --- | --- | --- | --- |
| **A. Minimal FreeLayer-specific versioned signed structure** | A small `schemaVersion`-tagged authorization-claims record: exact scopes, capabilities, root authority epoch, empty device key-slot commitments; **signed LATER by Gate F** | Reuses the whole TECH-ID-07 surface; no external dependency, no correlation-heavy metadata, honest "unsigned now, signed later" seam | **RECOMMENDED initial direction.** Non-cryptographic now; signature format deferred to Gate F. |
| **B. Certificate-like object (X.509-style)** | A DER/ASN.1 cert with issuer/subject/validity/extensions | Heavy encoding, PKI mindset, invites a CA/issuer hierarchy FreeLayer rejects | **Reject as the model.** Borrow only the "subject + validity + attenuated extensions" *idea*, already covered by Option A. |
| **C. W3C Verifiable Credential 2.0** `[STANDARD]` (Recommendation, 2025-05-15; issuer/holder/verifier/subject; **proofs live in a separate named graph** from claims, via embedded Data Integrity or enveloping JOSE/COSE) | Presupposes an **issuer** worth trusting + optional revocation/status endpoints (online, correlating) | **Reject as default** (`docs/research/IDENTITY_STANDARDS_RESEARCH.md` §3: issuer dependence + status endpoints are non-starters). **Borrow one idea:** VC 2.0's separation of *proof* from *claims* validates Option A's "claims now, signature later" seam — the unsigned claim is coherent on its own and a Gate-F proof attaches without rewriting it. |
| **D. Macaroon / capability-style attenuation** `[ACADEMIC]` (Birgisson et al., NDSS 2014: bearer credentials whose **caveats attenuate and contextually confine** authority via nested chained HMACs; decentralized delegation) | The *attenuation* model is an excellent conceptual fit; the *bearer-token + HMAC-chain* mechanism is Gate F crypto and a bearer token is a forwarding hazard | **Borrow the attenuation semantics, not the token.** FreeLayer already enforces monotonic attenuation *structurally*: scope may only narrow (`attenuateDeviceAuthorizationScopeV1`), capabilities may only be removed (`attenuateDeviceCapabilitiesV1`). A passport = an attenuated authorization claim. **Do NOT** ship a bearer macaroon (forwarding risk is explicitly modeled — ADR-0013 §14). |
| **E. MLS credential integration** `[STANDARD]` | Bind the passport to an MLS Credential/KeyPackage | MLS is not selected (§6.4); premature | **Defer.** Keep the passport a distinct authorization object so a future MLS credential can *reference* it without the passport becoming MLS-shaped. |

**Recommended initial direction (Option A), stated honestly:** a **minimal FreeLayer-specific versioned authorization-claims structure** carrying exact scopes, capabilities, root authority epoch, and empty device key-slot commitments, **unsigned in TECH-ID-08 and signed LATER by Gate F**. It borrows *only* the VC "proof-separate-from-claims" seam and the Macaroon "monotonic attenuation" semantics — no heavy standard is adopted merely because the object is called a "passport."

### 6.6.2 Repository patterns reused (TECH-ID-07 device surface + identity family)

`[REPO]` TECH-ID-08 **reuses proven local patterns** rather than inventing machinery. Each below carries adopted decisions, rejected alternatives, and unresolved Gate F questions.

1. **Root anchor + revision/schema primitives.**
   - Evidence `[REPO]`: `packages/identity/src/identifiers.ts` — `IdentityLocalRevision` ("NOT a timestamp, NOT tamper resistance, NOT synchronization, NOT cryptographic continuity"), `FIRST_IDENTITY_REVISION`, `nextIdentityRevision`; `LocalIdentityRootId`; the `DeviceAuthorizationRef` brand ("Future-reference ids (Gate F/G) — declared for the contract, never key material").
   - Adopted `[INFERENCE]`: passport claims reuse `IdentityLocalRevision`/`nextIdentityRevision` for per-record optimistic concurrency + `schemaVersion: 1`; the aggregate is keyed to a caller-resolved root ref (long-lived + ephemeral) via the TECH-ID-07 `DeviceRootRefV1`.
   - Rejected `[INFERENCE]`: a bespoke counter; embedding key material or a signature in any id.

2. **Device scope attenuation (monotonic, single-root, no wildcard).**
   - Evidence `[REPO]`: `packages/identity/src/devices/device-scopes.ts` — `DeviceAuthorizationScopeV1` + `validateDeviceAuthorizationScopeV1` + `deviceScopeContainsV1` + `attenuateDeviceAuthorizationScopeV1` ("Attenuation is monotonic … never widened; read-only may never become writable"; "cross-root never contains").
   - Adopted `[INFERENCE]`: a passport's scope is derived by **attenuating** the approver device-authorization's scope — equal-or-narrower only, same root, no wildcard/multi-root. This is the structural realisation of the Macaroon lesson (§6.6.1-D).
   - Rejected `[INFERENCE]`: widening at issuance; a cross-root or wildcard passport; scope inferred from a label or DevicePosture.

3. **Capability attenuation (subset-only; future capabilities denied).**
   - Evidence `[REPO]`: `packages/identity/src/devices/device-authorization-context.ts` — `attenuateDeviceCapabilitiesV1` (requested must be a subset of current; unknown/expansion reject); `packages/identity/src/devices/device-types.ts` — `DEVICE_UNAVAILABLE_CAPABILITIES` = `identity.device.add_future`, `identity.recovery.approve_future` (structurally unavailable in TECH-ID-07).
   - Adopted `[INFERENCE]`: a passport's capabilities are the **intersection** of the approver's capabilities and the request; `add_future`/`recovery.approve_future` remain denied.
   - Rejected `[INFERENCE]`: re-expanding capabilities at issuance; a passport that grants `add_future`/recovery.

4. **Empty device key-slot commitments (no key material).**
   - Evidence `[REPO]`: `packages/identity/src/devices/device-key-slots.ts` — `DeviceKeySlotV1` with `algorithm: "not_selected_gate_f"`, `publicMaterialPresent: false`, `privateMaterialPresent: false`; `packages/identity/src/devices/device-key-purposes.ts` — one purpose per slot, reuse forbidden; `validateDeviceKeySlotId` (`devslot-` namespace).
   - Adopted `[INFERENCE]`: a passport *commits to* the set of empty, purpose-separated key-slot ids the device will LATER hold — a placeholder the Gate-F signature will bind, never key bytes now.
   - Rejected `[INFERENCE]`: any public/private bytes, hash, fingerprint, or algorithm in a passport; reusing one slot across purposes.

5. **Approver authorization snapshot + stale-context fail-closed.**
   - Evidence `[REPO]`: `packages/identity/src/devices/device-authorization-context.ts` — `DeviceAuthorizationSnapshotV1` + `deviceAuthorizationSnapshotV1` + `assertDeviceAuthorizationSnapshotCurrentV1` (re-checks revision/lifecycle/scope/capability against the authoritative record + `DeviceRootRefV1`; `postureTightens === true` denies; `cryptographicallyAuthorized: false`).
   - Adopted `[INFERENCE]`: preparing a passport requires an **approver** snapshot re-validated immediately before the operation; root inactive/compromised, revision drift, non-operational lifecycle, removed capability, or narrowed scope all fail closed. DevicePosture/room policy may only tighten (deny), never authorize.
   - Rejected `[INFERENCE]`: treating a captured snapshot as a global/cryptographic authorization or a trusted timestamp; silently refreshing stale authority.

6. **Root authority epoch (re-verification fence).**
   - Evidence `[REPO]`: `docs/audits/TECH_ID_08_PRECHECK.md` §4.8 — new `IdentityAuthorityEpoch` + `IdentityAuthorityEpochStateV1` (additive to `identity-types.ts`), current epoch **caller-resolved** via approver/root context, not stored on the root record.
   - Adopted `[INFERENCE]`: a passport binds the root authority epoch; an epoch bump (root reset/recovery/compromise) makes prior passports stale and requires explicit re-approval (Matrix lesson §6.3; ADR-0013 §12/§13). A **local** fence — not distributed revocation.
   - Rejected `[INFERENCE]`: an epoch that acts as a trusted timestamp, global ordering, or cross-device consistency token.

7. **PolicyDecision authenticity — authentic, allowed, exact-scope, else reject.**
   - Evidence `[REPO]`: the alias/device repositories require `isPolicyDecision(d) && d.verdict === "allowed" && exact side-effect scope`, else a decision-mismatch error; `@freelayer/privacy` holds the module-private decision set.
   - Adopted `[INFERENCE]`: every passport op requires an authentic exact-scope decision on the passport side-effect namespace; an id, a device label, a `RoomMemberRef`, a role, or DevicePosture never substitutes for a decision.
   - Rejected `[INFERENCE]`: a bare boolean; a non-passport scope authorizing a passport op; mass-assigning authority fields (`identity-validation.ts` `FORBIDDEN_FIELDS` rejects `verified`/`trusted`/`publicKey`/`attestation`/`hardwareId`).

8. **Fail-closed, strictest-wins policy — passport policy may only TIGHTEN, never grant.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-policy.ts` (fail-closed per `PrivacyMode`; `bunker`/`emergency` minimize); `packages/rooms/src/policy-composition/policy-composition.ts` (deny-by-default, strictest-wins).
   - Adopted `[INFERENCE]`: passport prepare/attenuate/revoke/read are gated on a fail-closed per-`PrivacyMode` resolver; room policy, role, and DevicePosture may only **tighten**; strict modes minimize.
   - Rejected `[INFERENCE]`: any path where DevicePosture, a room role, or membership *grants* a passport op.

9. **Memory/null repository; redacted, content-free summaries/errors.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-repository.ts` (memory/null pair, `structuredClone` defensive copies, honest discard); `packages/identity/src/devices/device-errors.ts` (`DeviceKeyModelError` static generic messages; `SAFE_DEVICE_REJECTION`; `device_passport_unavailable` code + `DevicePassportUnavailableError`); `LocalDeviceSummaryV1`/`LocalDeviceRevocationResultV1` carry `cryptographicallyAuthorized: false`, `remotelySynchronized: false`, `deviceDataErased: false`.
   - Adopted `[INFERENCE]`: `DevicePassportStateV1` mirrors the memory/null pair; passport summaries/errors are redacted and never assert verification; `persistenceClass: "memory_only" | "null"`.
   - Rejected `[INFERENCE]`: disk/browser/DB persistence; a serialized passport history log; leaking ids/labels/hardware data in errors.

10. **Separation from RoomOS membership + Secure Device.**
    - Evidence `[REPO]`: `packages/rooms/src/membership/membership-types.ts` (membership carries no device key); `packages/rooms/src/secure-device/{secure-device-provider,sensitive-room-admission}.ts` + `scripts/check-no-secure-device-core-implementation.mjs` (provider externalized, untrusted-for-elevation).
    - Adopted `[INFERENCE]`: a passport neither grants nor proves membership and is never a Secure Device input/output; a new `check:no-device-passport-bypass` guard (**to be authored**) extends the device token-guard family with passport-specific overclaims (signed/verified passport, remote activation/acceptance/revocation, QR acceptance, attestation, hardware id), plus passport `security-regression`/`privacy-regression` suites. **None of these exist yet** (see Limitations).
    - Rejected `[INFERENCE]`: inlining a passport onto `RoomMembershipRecordV1`/`RoomIdentityBindingV1`; using a `RoomMemberRef` as a device/passport reference; shipping the module without a bypass guard.

---

## Mandatory honest framing (restated)

`[INFERENCE]` **A Device Passport is not DevicePosture; it is not hardware attestation; it is not proof a device is safe; it is not proof of real-world identity. A device is not a person; a passport ID is not a hardware identifier; a local unsigned approval is not cryptographic authorization; a QR code is only a transport representation, not authorization; room membership does not authorize a device; DevicePosture may restrict use of a device but can neither issue nor validate a passport.** There is **no cryptographic passport in TECH-ID-08**: no signature, no signed or verified passport, no signature verification, no replay-resistant linking, no remote activation, no remote acceptance, no remote/cryptographic revocation, no attestation, no hardware binding. Signed issuance + verification are **Gate F** (the device-passport signature format is explicitly deferred — ADR-0013 §19); QR/link wire formats + Capsule transport are **Gate E**; multi-device synchronization + distributed revocation are **Gate H** ("Local identity state is authoritative only for the current local vault; no distributed consistency or revocation is claimed" — ADR-0013 §19; a removed device may persist on unreachable peers — §20). The **Secure Device provider is externalized**, not integrated. This is **not** a safe home for real secrets: passport metadata is sensitive, memory/null only, and endpoint exposure (screenshots, second devices, crash dumps, swap, compromised endpoints) is out of scope. **No positive "signed / verified / attested / QR-accepted / remotely-activated Device Passport is implemented" claim is made anywhere, and a passport is never claimed to be cryptographically valid.**

---

## Sources

**External (verified live 2026-07-23 unless noted; re-verify before external citation):**

- `[STANDARD]` **RFC 9334 — Remote ATtestation procedureS (RATS) Architecture, January 2023** — definitions of Evidence, Attestation Result, Attester, Verifier, Relying Party, Endorsement, Reference Values (`https://www.rfc-editor.org/rfc/rfc9334.html`). Used to separate authorization from attestation (§6.5).
- `[STANDARD]` **NIST SP 800-63B, Revision 4 — 2025-08-26**, §4 "Events" (binding an additional authenticator via an authenticated session §4.1.2; "invalidate the authenticator immediately upon notification … loss, theft, or compromise"; subscriber notification) (`https://pages.nist.gov/800-63-4/sp800-63b.html`). Translated, not adopted; no AAL/IAL labels, no compliance claim. `[UNCERTAIN]` §4.1.2 + notification sub-clause truncated in fetch.
- `[VENDOR]` **Signal linked-device provisioning** — candidate QR display, primary "Link this device?" approval, one-time key acquisition, optional message-history transfer, linked-device list + unlink, device limit (`https://signal.org/blog/a-synchronized-start-for-linked-devices/`; `https://support.signal.org/hc/en-us/articles/360007320551-Linked-Devices`). `[UNCERTAIN]` product UI evolves — re-verify.
- `[VENDOR]` **Matrix cross-signing** — master key signs self-signing + user-signing keys; self-signing signs own devices; user-signing signs other users' master keys (`https://matrix.org/docs/older/e2ee-cross-signing/`; MSC1756; `https://spec.matrix.org/latest/client-server-api/#cross-signing`). `[UNCERTAIN]` master-key-reset / `m.device_list_update` / re-verification normative wording — single-page spec truncated in fetch; re-confirm.
- `[STANDARD]` **W3C Verifiable Credentials Data Model v2.0 — W3C Recommendation, 2025-05-15** — issuer/holder/verifier/subject; proofs in a **separate named graph** from claims (embedded Data Integrity or enveloping JOSE/COSE) (`https://www.w3.org/TR/vc-data-model-2.0/`). Rejected as default; only the proof-separate-from-claims seam borrowed (§6.6.1).
- `[ACADEMIC]` **Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud** — Birgisson, Politz, Erlingsson, Taly, Vrable, Lentczner; NDSS 2014 (Google) — caveats that attenuate/contextually confine authority; nested chained HMACs (`https://research.google/pubs/pub41892/`; `https://www.ndss-symposium.org/ndss2014/`). Attenuation semantics borrowed, bearer-token mechanism rejected (§6.6.1).
- `[STANDARD]` **RFC 9420 (MLS Protocol, July 2023)** + **RFC 9750 (MLS Architecture, April 2025)** — Client = agent; multiple clients per user; Credential/KeyPackage; application-defined identity→client mapping via an external AS (`https://www.rfc-editor.org/rfc/rfc9420.html`; `https://www.rfc-editor.org/rfc/rfc9750.html`). Verification carried from `docs/research/DEVICE_KEY_MODEL_IMPLEMENTATION_RESEARCH.md` §6.4 (same date) + prior knowledge — re-verify.

**Repository (verified directly):** `packages/identity/src/devices/{device-scopes,device-types,device-key-purposes,device-key-slots,device-identifiers,device-authorization-context,device-lifecycle,device-commands,device-errors}.ts`; `packages/identity/src/identifiers.ts`; `packages/identity/src/identity-types.ts`; `packages/identity/src/identity-validation.ts`; `packages/identity/src/aliases/alias-repository.ts`; `packages/rooms/src/membership/membership-types.ts`; `packages/rooms/src/policy-composition/{device-posture,policy-composition}.ts`; `packages/rooms/src/secure-device/{secure-device-provider,sensitive-room-admission}.ts`; `docs/adr/ADR-0013-identity-firewall-architecture.md` (§7, §10, §11, §12, §13, §14, §16, §19, §20); `docs/audits/TECH_ID_08_PRECHECK.md`; `docs/research/{IDENTITY_STANDARDS_RESEARCH,DEVICE_KEY_MODEL_IMPLEMENTATION_RESEARCH}.md`.

## Decisions adopted for TECH-ID-08

1. `[INFERENCE]` **One local aggregate class: an unsigned device-passport claim**, held in a `DevicePassportStateV1` (current-process, memory/null) keyed to the TECH-ID-07 `DeviceRootRefV1` (long-lived + ephemeral roots); membership/root/binding records are never rewritten. Local metadata, never signature/verification/key material; grants no operational authority.
2. `[INFERENCE]` **Recommended format = a minimal FreeLayer-specific versioned authorization-claims structure** (exact scopes, capabilities, root authority epoch, empty device key-slot commitments), **signed LATER by Gate F** (§6.6.1-A). Borrow only VC's proof-separate-from-claims seam and Macaroon's monotonic attenuation; adopt no heavy standard.
3. `[INFERENCE]` **Adding a device requires existing root authority** (NIST §6.1): prepared only from an active, non-compromised root via a re-validated approver `DeviceAuthorizationSnapshotV1` + exact-scope `PolicyDecision` + explicit user action. No `add_remote`/`link`/`approve_qr`/`issue_passport`/`verify_attestation` command exists.
4. `[INFERENCE]` **Separate the five Signal concerns** (§6.2): TECH-ID-08 models only *authorization-to-add*, locally and unsigned; transport (QR) is Gate E, history-transfer is out of scope, ongoing-delivery is Gate F, removal is a local state transition.
5. `[INFERENCE]` **Root-to-device authority + purpose separation + root-epoch re-verification** (Matrix §6.3): a passport binds the root authority epoch; an epoch bump invalidates prior passports and requires explicit re-approval; key-slots stay purpose-separated and empty; disambiguate by opaque ref in separated namespaces.
6. `[INFERENCE]` **Logical membership stays distinct from a per-client device passport** (MLS §6.4); a member may map to one or more device passports; removing a passport ≠ changing membership.
7. `[INFERENCE]` **Authorization ≠ attestation** (RATS §6.5): a passport is not Evidence, not an Attestation Result, not a hardware measurement, not DevicePosture; DevicePosture may restrict but cannot issue/validate a passport.
8. `[INFERENCE]` **Fail-closed, strictest-wins policy; memory/null retention; redacted summaries/errors; pure injected-id reducer**; new `check:no-device-passport-bypass` guard + passport regression suites extend the device family. `issued_future_signed`/`accepted_future_verified` states not constructible in production.
9. `[INFERENCE]` **No signature, verification, attestation, QR/link wire format, remote activation/acceptance, remote/cryptographic revocation, or synchronization** (Gates E/F/H). Secure Device externalized; DevicePosture never an input.

## Rejected implementation approaches (and why)

- `[INFERENCE]` **A signed / verified / cryptographically valid passport now** — rejected as a category error and an ADR violation; the device-passport signature format is Gate F (ADR-0013 §19). `cryptographicallyAuthorized` stays literal `false`.
- `[INFERENCE]` **Adopting W3C Verifiable Credentials as the format** — rejected; issuer dependence + revocation/status endpoints are online, correlating authorities FreeLayer lacks (`IDENTITY_STANDARDS_RESEARCH.md` §3). Borrow only the proof/claims separation.
- `[INFERENCE]` **A bearer Macaroon (or any bearer token)** — rejected; forwarding risk is explicitly modeled (ADR-0013 §14) and the HMAC-chain is Gate F. Borrow only the attenuation semantics, already enforced structurally.
- `[INFERENCE]` **An X.509/certificate-like object** — rejected; heavy encoding + implicit CA/issuer hierarchy; the useful "subject + validity + attenuated extensions" idea is covered by the minimal structure.
- `[INFERENCE]` **MLS credential integration** — rejected/deferred; MLS is not selected (§6.4); keep the passport a distinct object a future MLS credential can reference.
- `[INFERENCE]` **Implementing cross-signing / a published signature graph** — rejected; reintroduces the correlation surface ADR-0013 minimizes (§20); all Gate F.
- `[INFERENCE]` **Producing/scanning/accepting a QR or link payload** — rejected; a QR is transport only, wire format is Gate E; `approve_qr`/`link` are future-gated must-not-exist commands.
- `[INFERENCE]` **Remote activation / remote acceptance / remote or cryptographic revocation** — rejected; revocation is local-only, distributed revocation deferred (ADR-0013 §20).
- `[INFERENCE]` **Collecting a hardware/device identifier or any attestation/posture measurement into a passport** — rejected; `identity-validation.ts` rejects `hardwareId`/`attestation`; posture is externalized and never authority.
- `[INFERENCE]` **Persisting passport state to disk/DB or syncing it across devices** — rejected; memory/null only; encrypted persistence is Gate F, cross-device sync is Gate H.

## Limitations / unresolved crypto (Gate F) questions

- **Pre-implementation (passport module).** `packages/identity/src/device-passports/` does **not** exist; only `DevicePassportUnavailableError` (a TECH-ID-07 guard error) exists today (`docs/audits/TECH_ID_08_PRECHECK.md` §4). The `DevicePassportStateV1` aggregate, `IdentityAuthorityEpoch`/`IdentityAuthorityEpochStateV1`, the `check:no-device-passport-bypass` guard, and the passport regression suites are design intent, not shipped code.
- **No cryptographic passport.** No signature, verification, attestation, or replay-resistant linking; a passport claim certifies nothing cryptographic and grants no operational authority.
- **UNRESOLVED — device-passport signature format (Gate F).** The signed root↔device authorization relationship, its serialization, the signing key purpose (`device_authorization_signing_future`), and rotation/revocation signatures are undecided; ADR-0004/ADR-0013 §19 forbid inventing crypto here.
- **UNRESOLVED — passport verification + acceptance semantics (Gate F).** How a peer/other device would *verify* a signed passport, and what "accepted" means, are deferred; the `accepted_future_verified` state is not constructible now.
- **UNRESOLVED — root authority epoch semantics (Gate F).** How an epoch is advanced on root reset/recovery/compromise, how prior passports are detected as stale, and the re-verification warning crypto (ADR-0013 §12) are undecided; only the epoch **state slot** is wired.
- **UNRESOLVED — device-link invite + QR authentication (Gate E/F).** The `device_link_request` invite class (ADR-0013 §14) needs a one-time, capability-limited, revocable, **replay-resistant** token whose wire/QR format and forwarding protection are Gate E/F.
- **UNRESOLVED — remote activation/revocation + cross-device passport synchronization (Gate H).** Activating/revoking a passport across a user's own devices, and reconciling a device removed while peers are unreachable, are deferred; no CRDT designed. Local state is authoritative only for the current vault (ADR-0013 §19/§20).
- **UNRESOLVED — recovery ↔ passport interaction (Gate F + recovery threat review).** How recovery reviews/invalidates prior passports without a provider/admin root, and how `recovered_reverification_required` re-gates them (ADR-0013 §13), needs the dedicated recovery threat review.
- **UNRESOLVED — MLS AS-equivalent mapping (group-crypto track).** If group messaging is later built, how a decentralized Authentication-Service equivalent maps a logical membership to one or more signed passports (§6.4) is open.
- **Memory/null only; not durable, not safe for real secrets.** Passport metadata is sensitive and held in-process; endpoint exposure (screenshots, second devices, crash dumps, swap, compromised endpoints) is external (Secure Device — externalized) or inherent OS behaviour and is prevented by nothing here.
- **Standards may drift.** External claims were verified live 2026-07-23 with versions/dates recorded, but re-verify before external citation; the Matrix master-key-reset/`m.device_list_update`/re-verification wording and the NIST §4.1.2 + notification sub-clause are flagged `[UNCERTAIN]` due to fetch truncation, and the MLS RFCs were carried from the precedent's verification.
