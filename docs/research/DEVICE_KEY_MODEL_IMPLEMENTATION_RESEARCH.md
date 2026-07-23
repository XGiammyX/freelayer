# Device Key Model — Implementation Research (TECH-ID-07)

> **Sourcing note (read first).** Live internet access **was** available while preparing this document, and the external standards below were **verified against their primary sources on 2026-07-23**, with version/date recorded per source: **NIST SP 800-63B Revision 4** (2025-08-26), the **Signal Sesame** algorithm document (Revision 2, 2017-04-14), the **Matrix Client-Server API** end-to-end-encryption/cross-signing sections (live spec, verified 2026-07-23), **RFC 9420** (MLS Protocol, July 2023), and **RFC 9750** (MLS Architecture, April 2025). Specifications move: **re-verify any claim used for a security decision** against the primary source before relying on it. Throughout, **evidence** (what a standard actually says, or what the code in this repo actually does) is kept separate from **inference** (how we choose to apply it), and each item carries an evidence-type tag. Uncertainty is flagged inline as `[UNCERTAIN]`. This document informs the **local, root-authorization-scoped, NON-CRYPTOGRAPHIC** TECH-ID-07 device-key-model work only; it decides nothing that ADR-0013 defers to Gate E (invite/QR wire formats), Gate F (cryptography, key material, signatures, verification, device-key authorization, device-passport signature format), or Gate H (multi-device identity synchronization). It is a **pre-implementation** note: **no device module exists yet** — `packages/identity/src/devices/` is absent; only the `DeviceAuthorizationRef` future-reference brand (`packages/identity/src/identifiers.ts`) and the `deviceAuthorizationState: "not_implemented_gate_f_g"` placeholder on the roots (`packages/identity/src/identity-types.ts`, `packages/identity/src/ephemeral/ephemeral-types.ts`) exist today. Design decisions recorded here are cross-checked against the pre-implementation audit `docs/audits/TECH_ID_07_PRECHECK.md`.

**Evidence-type tags used below**

| Tag | Meaning |
| --- | --- |
| `[STANDARD]` | A published specification (NIST SP 800-63B Rev. 4; IETF RFC 9420; IETF RFC 9750). Verified live 2026-07-23 — re-verify before external citation. |
| `[VENDOR]` | A product's documented behavior (Signal Sesame; Matrix Client-Server API). Verified live 2026-07-23 — re-verify against current docs/source. |
| `[REPO]` | Directly verifiable in this repository at the cited path. |
| `[INFERENCE]` | Our design reasoning applying evidence to TECH-ID-07. Not itself a source. |
| `[UNCERTAIN]` | A recollection or reading we are not fully confident about; treat as a re-verify TODO. |

---

## 0. Scope and non-goals

### 0.1 What a device key model is (working definition — design intent, not yet built)

`[INFERENCE]` TECH-ID-07 introduces **one local, root-authorization-scoped, non-cryptographic aggregate** that records *the intent to authorize distinct device contexts under a local identity root* — and nothing cryptographic. The precheck names the planned shape: a separate `DeviceKeyModelStateV1` aggregate (memory/null, like the alias aggregates) plus a caller-resolved `DeviceRootRefV1` that decouples the model from a specific vault and spans both long-lived and ephemeral roots (`[REPO]` `docs/audits/TECH_ID_07_PRECHECK.md` §4.8). The unit of record is a **local device authorization record**: a subordinate, revocable, root-scoped grant placeholder — *not* a key, *not* a signature, *not* an attestation.

- **Local device authorization record** — *a local statement that a named device context is (or was) authorized under one identity root, held locally, carrying lifecycle + a FreeLayer-specific assurance state and* **no key material**. It mirrors ADR-0013 §11's "`LocalIdentityRoot` **authorizes** independent `DeviceAuthorization` records; each future device has independent key material (Gate F)" (`[REPO]` `docs/adr/ADR-0013-identity-firewall-architecture.md` §11), and reuses the identity revision/schema primitives (`IdentityLocalRevision`, `FIRST_IDENTITY_REVISION`, `nextIdentityRevision`; `[REPO]` `packages/identity/src/identifiers.ts`).

Like the aliases, a device authorization record is **local metadata**, memory/null only, scoped to one root, and non-authoritative for anything cryptographic. It reuses the identity revision counter, the injected-id + pure-reducer discipline, the fail-closed policy resolver, the exact-scope `PolicyDecision` fence, and the memory/null repository pattern already validated in `@freelayer/identity`.

### 0.2 What a device key model is NOT (mandatory distinctions)

`[INFERENCE]` These are load-bearing category boundaries, not marketing copy.

- **A DeviceKey is not DevicePosture.** A device authorization record says a device *context is authorized under a root*; DevicePosture is an **environment attribute** describing endpoint state, "never identity, never authority" (`[REPO]` `packages/rooms/src/policy-composition/device-posture.ts`). They are different layers and must never be conflated.
- **DevicePosture is not identity.** No posture value (`unverified | basic | hardened | high_assurance | managed_bunker | at_risk`) authorizes a device or a person; an untrusted signal "may reduce trust (→ at_risk) but may NEVER increase it" (`[REPO]` `device-posture.ts`; ADR-0013 §11: "DevicePosture may tighten … but cannot authorize a device").
- **A device is not a person.** Authorizing a device context is an AAL-flavored "same keyholder / same authority context" statement, never an IAL "real person" claim; real-world identity proofing is not implemented by default (`[REPO]` `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §1.2; ADR-0013 §4).
- **A device reference is not a hardware identifier.** No serial/model/MAC/IMEI/advertising id is collected or stored; the identity validator already rejects `hardwareId`, `deviceFingerprint`, `devicePosture`, `attestation`, `deviceSafe`, and key fields as forbidden caller input (`[REPO]` `packages/identity/src/identity-validation.ts` — `FORBIDDEN_FIELDS`). The Secure Device provider contract states "No stable device-identifying field exists" (`[REPO]` `packages/rooms/src/secure-device/secure-device-provider.ts`).
- **A device label is not authority.** A local device name is presentation metadata, never a capability, role, or proof — the same rule personas already carry (`[REPO]` `packages/identity/src/identity-types.ts` — `localLabel` "never a public username").
- **A local authorization record is not a cryptographic proof.** No key bytes, no signature, no verification. `keyMaterialState: "not_implemented_gate_f"` and `deviceAuthorizationState: "not_implemented_gate_f_g"` are literal on the roots today (`[REPO]` `identity-types.ts`, `ephemeral/ephemeral-types.ts`).
- **Device revocation is not remote erasure.** Revoking a device authorization changes **local** authorization state only; ADR-0013 §20 records the honest residual: "distributed revocation is deferred (a removed device may persist on unreachable peers)" (`[REPO]` `docs/adr/ADR-0013-identity-firewall-architecture.md` §20). It is not remote wipe, not forensic erasure, not a network operation.
- **RoomOS membership is not device authorization.** A `RoomMembershipRecordV1` is one local, unverified room-member relationship carrying "NO … device key … those are Gates G/H/R" (`[REPO]` `packages/rooms/src/membership/membership-types.ts`). Membership is authorization to be *in a room*, never a device credential; the two are distinct aggregates in distinct packages.
- **Not a Device Passport.** The signed root↔device relationship is **TECH-ID-08** and Gate F; ADR-0013 §11 is explicit that "Device Passport denotes a *future signed root↔device authorization relationship* only … no implementation today."

### 0.3 Non-goals

`[INFERENCE]` TECH-ID-07 introduces **no** cryptography, key material, key generation, signatures, key derivation, fingerprints, safety numbers, attestation, hardware binding, device passports, linking/provisioning wire formats, QR flows, cross-signing, verification, remote/cryptographic revocation, distributed device lists, synchronization, persistence to disk, network, notification, AI, or telemetry. It adds only a **local, non-cryptographic, root-scoped** device-authorization record layer that reuses the identity revision, injected-id + pure-reducer, fail-closed policy, exact-scope `PolicyDecision`, memory/null, and redaction machinery already shipped for roots and aliases. It ports no external multi-device system; it extracts **design principles** from external standards and **reuses patterns** already validated in this monorepo (the identity Firewall + RoomOS + the Secure Device contract).

---

## 6.1 Authenticator lifecycle — NIST SP 800-63B (Rev. 4) authenticator event management

**Source** `[STANDARD]` **NIST SP 800-63B, Revision 4 — Digital Identity Guidelines: Authentication and Authenticator Lifecycle Management (2025-08-26)**, §4 "Events" (authenticator binding, maintenance, and invalidation), with the syncable-authenticator material in §3.1.6/§3.1.7 and Appendix B. Verified live 2026-07-23. Cross-referenced with this repo's prior survey `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §1.

**Principles extracted (evidence) — TRANSLATED, not copied:**

1. `[STANDARD]` **Authenticator lifecycle is a set of explicit, managed events.** 800-63B §4 treats binding (initial issuance/association), maintenance (adding or replacing an authenticator), and invalidation (loss, theft, damage, compromise, expiration, revocation) as distinct, governed transitions — not implicit side effects.
2. `[STANDARD]` **Adding another authenticator requires existing authenticated authority.** Binding an additional authenticator to an existing subscriber is done from an already-authenticated session at the appropriate strength; a new authenticator is not silently trusted.
3. `[STANDARD]` **Loss/theft/compromise must trigger prompt invalidation.** The CSP "SHALL provide a mechanism to invalidate the authenticator immediately upon notification … that the authenticator's loss, theft, or compromise is suspected." Invalidation is a first-class, must-exist path.
4. `[STANDARD]` **Expiration and revocation are explicit end-states**; an authenticator does not remain valid by default after its lifecycle ends.
5. `[STANDARD]` **Users must be kept aware of their authenticators.** The guideline stresses subscriber notification/awareness of binding and invalidation events so a silent or unnoticed change is detectable.

**Translation → the central implication for TECH-ID-07 (FreeLayer has no CSP/account):**

- `[INFERENCE]` **Local root authorization replaces account binding.** FreeLayer has no central CSP, no subscriber account, and no server-side authenticator registry. The analogue of "bind an authenticator to a subscriber account" is "record a subordinate device authorization under a **local identity root**" (ADR-0013 §11; `[REPO]` `docs/adr/ADR-0013-identity-firewall-architecture.md`). The root is the local authority; there is no external issuer.
- `[INFERENCE]` **Device lifecycle events must be explicit, mirroring §4's event discipline.** The device-authorization record uses an explicit lifecycle state machine (design intent: `draft_local → authorized_local_unverified → suspended_local → revoked_tombstone`, tombstone terminal), the same terminal-is-terminal, unknown-fails-closed discipline as `RoomMembershipRecordV1` transitions (`[REPO]` `packages/rooms/src/membership/membership-types.ts`) and the root lifecycle (`[REPO]` `packages/identity/src/identity-types.ts` — `LOCAL_IDENTITY_ROOT_LIFECYCLES`).
- `[INFERENCE]` **Adding a device later requires strong existing authority.** No device authorization may be created except from an already-authorized context under an active, non-compromised root, enforced by an authentic exact-scope `PolicyDecision` (see §6.6); "adding a device requires explicit approval" (ADR-0013 §11).
- `[INFERENCE]` **Loss/compromise/revocation must invalidate local authorization state.** Marking a device lost/compromised/revoked transitions the record to a suspended/tombstone state and must feed the root's assurance signalling — the contract already reserves `device_change_warning_future` for exactly this (`[REPO]` `identity-types.ts` — `IdentityAssuranceStateV1`), though current production code may only write `unverified_local | compromised_suspected | revoked` (`PRODUCTION_ASSURANCE_STATES`). "Lost/removed devices must not remain silently trusted" (ADR-0013 §11).
- `[INFERENCE]` **User awareness maps to honest redacted summaries.** A device-list summary view (design intent, mirroring `EphemeralIdentitySummaryV1`; `[REPO]` `packages/identity/src/ephemeral/ephemeral-types.ts`) surfaces lifecycle/assurance honestly and never asserts verification.

**Explicitly not done / not claimed:**

- `[INFERENCE]` **No NIST AAL labels, no compliance claim.** As with §1 of the standards survey, we borrow the **event discipline and separation** (proofing ≠ authentication ≠ recovery), not conformance. We do **not** label anything AAL1/2/3 and make **no** 800-63 compliance claim. Key-continuity, when it exists (Gate F), is an AAL-flavored "same keyholder" property, never an IAL "real person" claim (`[REPO]` `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §1.2).
- `[INFERENCE]` **No CSP, no subscriber record, no server invalidation.** The §3 "prompt invalidation" requirement is honored as a **local** revocation of authorization state; it is explicitly **not** remote erasure and makes no distributed-revocation guarantee (§0.2; ADR-0013 §20).

---

## 6.2 Signal multi-device / Sesame — LESSONS ONLY

**Source** `[VENDOR]` **Signal, "The Sesame Algorithm: Session Management for Asynchronous Message Encryption," Revision 2, 2017-04-14** (`https://signal.org/docs/specifications/sesame/`). Verified live 2026-07-23. `[UNCERTAIN]` product provisioning/UI behavior around device linking has evolved across Signal releases since the 2017 algorithm document — re-verify against current Signal source before external citation.

**Lessons extracted (evidence) — these are the only things we take:**

1. `[VENDOR]` **Devices are distinct endpoints, each with its own identity/keys.** Sesame indexes correspondents by `UserID` in a `UserRecord`, and within each `UserRecord` holds a set of `DeviceRecord`s indexed by `DeviceID`. A user is explicitly modeled as *multiple devices*, each a separate cryptographic endpoint.
2. `[VENDOR]` **Sessions and delivery are per device.** "For each non-stale `DeviceRecord` … that contains an active session, the sending device encrypts the plaintext using that active session"; messages are delivered separately to each recipient device's mailbox by `DeviceID`. Every device is separately keyed and separately reachable.
3. `[VENDOR]` **Device sets change over time and must be reconciled.** Sesame's core concern is keeping the local `DeviceRecord` set (stale/active) consistent as devices are added or removed — i.e. device add/remove is a first-class, ongoing state-management problem, not a one-time setup.

**Design lessons for TECH-ID-07 (no crypto, no protocol):**

- `[INFERENCE]` **Model devices as distinct records under a per-context container**, mirroring `UserRecord → DeviceRecord`: FreeLayer's `DeviceKeyModelStateV1` holds a set of device-authorization records under one resolved `DeviceRootRefV1` (`[REPO]` `docs/audits/TECH_ID_07_PRECHECK.md` §4.8). Each record is independent; there is no "primary device" special-case baked into the record shape.
- `[INFERENCE]` **Adding a device is an explicit, permissioned event with one-time linking material** — conceptually. Sesame's device-set growth motivates a future **one-time, capability-limited, revocable** `device_link_request` invite class, which ADR-0013 §14 already lists — but its token/wire format is **Gate E/F** and out of scope here.
- `[INFERENCE]` **Per-device separation is the goal; removal must be real.** Device removal must change local authorization state so a removed device is not silently retained (converges with §6.1 and ADR-0013 §11 "lost/removed devices must not remain silently trusted"). A user-visible device list (honest, redacted) is the local surface for this.

**What we deliberately do NOT copy:**

- `[INFERENCE]` **Not Signal's phone-number account.** FreeLayer is accountless with no phone/email identity (`[REPO]` `identity-validation.ts` rejects `phone`/`email`/`username`; ADR-0013 §18). `UserID` in Sesame is a phone-number-style account key; FreeLayer's per-context container is a local `DeviceRootRefV1`, not a global account.
- `[INFERENCE]` **Not the provisioning address, the server mailbox model, the algorithms, or the key formats.** Separately-encrypted per-device delivery, the double-ratchet sessions, the staleness rules, and any key encoding are **Gate F** messaging-crypto concerns, not TECH-ID-07. We take the *device-as-distinct-endpoint* shape only.

---

## 6.3 Matrix device keys + cross-signing — LESSONS ONLY

**Source** `[VENDOR]` **Matrix Client-Server API**, end-to-end-encryption sections "Device keys," "Cross-signing," and "Device verification" (`https://spec.matrix.org/latest/client-server-api/`). Verified live 2026-07-23: the spec describes per-device identity keys and a cross-signing hierarchy of **master key**, **self-signing key**, and **user-signing key**, with device verification expressed through signatures. `[UNCERTAIN]` the precise normative wording of the master-key-change warning behavior and the exact key-ID handling were not fully retrievable in one fetch (long single-page spec) — re-confirm the SHOULD-level clauses against the live section before external citation.

**Lessons extracted (evidence):**

1. `[VENDOR]` **A device key is distinct from the account/user key.** Each device carries its own identity key(s); cross-signing adds a separate per-user key hierarchy. The device key and the user's cross-signing **master key** occupy different roles.
2. `[VENDOR]` **Trust is expressed as an explicit signature hierarchy.** The master key signs the self-signing key (which signs the user's own devices) and the user-signing key (which signs other users' master keys). Verification is a chain of **explicit signatures**, not an ambient boolean.
3. `[VENDOR]` **A master-key change is a security-relevant event.** Because everything hangs off the master key, a change to it invalidates prior cross-signing trust and warrants an explicit warning/re-verification. `[UNCERTAIN]` exact wording — re-confirm.
4. `[VENDOR]` **Signatures over the social graph are exposed.** Cross-signing signatures (who signed whose keys) are published and can reveal a verification/social graph — a correlation surface inherent to the signature model.
5. `[VENDOR]` **Key-IDs are easy to confuse and are not identity.** Devices and keys are named by opaque key-IDs; treating a key-ID or device-ID as a human identity, or confusing one device's key-ID for another's, is a known spoofing/UX hazard.

**Lessons for TECH-ID-07 (do NOT implement cross-signing):**

- `[INFERENCE]` **Device key ≠ root key — different roles.** The device-authorization record is subordinate to the root and never *is* the root; ADR-0013 §11's "each future device has independent key material" plus §7's "no global root public key reused across unrelated relationships" encode exactly Matrix's device-key/master-key role split (`[REPO]` `docs/adr/ADR-0013-identity-firewall-architecture.md` §7, §11). The record must never expose, embed, or derive from the private root id — the root is `publicExposure: "forbidden"` (`[REPO]` `identity-types.ts`).
- `[INFERENCE]` **Device keys must be purpose- and namespace-safe (future Gate F).** ADR-0013 §7 requires derivation that "must **not** create avoidable cross-relationship correlation and must **not** use display aliases as cryptographic identifiers." A device label is never a device key; a device reference is never a cross-context correlator.
- `[INFERENCE]` **Root compromise is high-impact.** As Matrix's master-key change cascades, a FreeLayer root compromise cascades to its device authorizations; ADR-0013 §20's honest residual ("root compromise can reveal a user's own relationship mapping") applies. The model must make root-scoped blast radius explicit, not hide it.
- `[INFERENCE]` **Key/device changes need explicit trust-state handling.** The assurance contract already reserves `key_change_warning_future` and `device_change_warning_future` and the root lifecycle reserves `recovered_reverification_required` (`[REPO]` `identity-types.ts`); ADR-0013 §12 requires that verification "never silently survives incompatible key/root changes." TECH-ID-07 wires the *state slots* for this; the warning **crypto** is Gate F.
- `[INFERENCE]` **Identifiers alone ≠ verification; disambiguate by opaque id, never by label.** A device-ID/key-ID or a device label proves nothing; security-sensitive UI must disambiguate devices by opaque reference and honest assurance state — the same conclusion the alias work reached for display names (`[REPO]` `docs/research/PER_ROOM_ALIAS_IMPLEMENTATION_RESEARCH.md` §6.2/§6.4).
- `[INFERENCE]` **Signature-graph exposure is a reason NOT to publish cross-signing now.** Building a published signature graph would create the very correlation surface ADR-0013 rejects; cross-signing is **not** implemented (Gate F), and any future design must weigh graph exposure against metadata minimization.

**Explicitly not done:** `[INFERENCE]` no cross-signing, no master/self-signing/user-signing keys, no published signatures, no key-ID scheme, no verification chain — all Gate F. TECH-ID-07 records only local, non-cryptographic device authorizations.

---

## 6.4 MLS client/device boundary — RFC 9420 + RFC 9750

**Source** `[STANDARD]` **RFC 9420, "The Messaging Layer Security (MLS) Protocol" (July 2023)** and **RFC 9750, "The Messaging Layer Security (MLS) Architecture" (April 2025)** (`https://www.rfc-editor.org/rfc/rfc9420.html`, `https://www.rfc-editor.org/rfc/rfc9750.html`). Verified live 2026-07-23. Cross-referenced with `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §5.

**Principles extracted (evidence):**

1. `[STANDARD]` **A client is an agent defined by keys, not a person.** RFC 9420 §2 defines a Client as "an agent that uses this protocol to establish shared cryptographic state with other clients." The operational unit is the key-holding agent.
2. `[STANDARD]` **A group member is a cryptographic client.** Group membership is managed over clients (add/remove/update via proposals and commits); each member is a client, and multiple clients can represent one user's different devices/signature keys (RFC 9750).
3. `[STANDARD]` **KeyPackages and Credentials carry the client's identity + capabilities.** RFC 9420: a KeyPackage is "a signed object describing a client's identity and capabilities, including a[n] HPKE public key," and each member "presents a credential that provides one or more identities … and associates them with the member's signing key."
4. `[STANDARD]` **Identity-to-client mapping is the application's responsibility.** RFC 9750 places the binding between application-meaningful identifiers and key material in an external **Authentication Service**, and states it is "up to the application to determine how to present this situation to users" when multiple clients share one identity.
5. `[STANDARD]` **Membership operations are per client.** Removal and update act on individual clients, not on an abstract "user."

**FreeLayer implication (do NOT select MLS, do NOT implement KeyPackages):**

- `[INFERENCE]` **RoomOS membership is a logical identity relationship; a future messaging client/credential is a separate cryptographic thing — the two layers must NOT be conflated.** Today `RoomMembershipRecordV1` is one local, unverified relationship carrying no key/device material (`[REPO]` `packages/rooms/src/membership/membership-types.ts`), and the `RoomIdentityBindingV1` that ties a root/persona to a room carries `credentialState: "not_implemented_gate_f"` (`[REPO]` `identity-types.ts`). MLS makes the same split structurally: membership is a *group/relationship* fact, credentials/clients are the *cryptographic* layer. FreeLayer must keep RoomOS membership (logical) distinct from any future per-member device/client credential (cryptographic).
- `[INFERENCE]` **A future member may map to one *or more* device/client credentials.** MLS's "multiple clients per user" is exactly TECH-ID-07's multi-device intent (ADR-0013 §11): a single logical membership could, at Gate F, correspond to several authorized device contexts. The device-authorization aggregate is therefore keyed to the **root** (`DeviceRootRefV1`), and the mapping from membership → device set is an application concern, echoing RFC 9750's "AS/application defines identity-to-client mapping."
- `[INFERENCE]` **FreeLayer's "AS-equivalent" is local and decentralized.** Per the standards survey, any future MLS-style design would need a decentralized Authentication-Service equivalent (trust notebook + verification + key continuity), not a central server (`[REPO]` `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §5.2). That is a **group-crypto track** question, not TECH-ID-07.

**Explicitly not done:** `[INFERENCE]` MLS is **not** selected or implemented; no KeyPackages, no Credentials, no ratchet tree, no AS/DS, no HPKE. TECH-ID-07 records only that the *boundary* exists so future crypto can slot a device/client credential under a membership without collapsing the two layers (Gate F).

---

## 6.5 Syncable authenticator risks — NIST guidance

**Source** `[STANDARD]` **NIST SP 800-63B Rev. 4 (2025-08-26)**, syncable-authenticator material (§3.1.6/§3.1.7 and Appendix B). Verified live 2026-07-23. Cross-referenced with the passkey/sync-fabric analysis in `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §4.

**Principles extracted (evidence):**

1. `[STANDARD]` **A syncable authenticator can copy private key material across devices through a sync fabric** (a cloud provider). This is the defining property: the key is *exportable/replicable* rather than device-bound.
2. `[STANDARD]` **Exportability is a strength ceiling.** 800-63B does **not** permit syncable authenticators at its highest authenticator-assurance tier precisely because the private key can leave the authenticator; non-exportability is required for the strongest level.
3. `[STANDARD]` **The sync/recovery provider becomes part of the trust boundary.** When a provider's fabric holds/recovers the key, provider compromise or a weak recovery path can add authenticators or expose key material — the recovery/sync root becomes a de-facto authority (reinforced by §4's passkey-sync-fabric analysis in the standards survey).

**Default FreeLayer direction (design intent):**

- `[INFERENCE]` **Do NOT copy the private identity root to every ordinary device by default.** ADR-0013 §18 explicitly rejects "one identity root copied unprotected to every device." The default is **subordinate, independent device keys** under the root (ADR-0013 §11: "each future device has independent key material"), added deliberately after **Gate F** — not a root replicated through a sync fabric.
- `[INFERENCE]` **No provider sync-fabric recovery root, no admin/master key.** ADR-0013 §13's recovery model is offline-first with "no FreeLayer-controlled master key … no silent server recovery"; a syncable-authenticator/provider-fabric recovery would reintroduce exactly the external authority FreeLayer rejects. Recovery yields `recovered_reverification_required`, and "old device authorizations are reviewed or invalidated" (ADR-0013 §13) — a recovered identity does not silently re-trust its former devices.
- `[INFERENCE]` **Unclear device boundaries are a hazard to design away.** The device-authorization aggregate keeps each device an explicit, independently-revocable record so "which device holds what" is never ambiguous (converges with §6.2's per-device separation). Synchronization of device-auth state across a user's own devices is **Gate H** (`[REPO]` `docs/adr/ADR-0013-identity-firewall-architecture.md` §19) and is not designed here.

**Explicitly not done:** `[INFERENCE]` no sync fabric, no exportable root, no provider recovery, no cross-device replication of key material — TECH-ID-07 is single-vault, local, non-cryptographic; multi-device *synchronization* is Gate H and real keys are Gate F.

---

## 6.6 Repository patterns

`[REPO]` TECH-ID-07 **reuses proven local patterns** already validated across `@freelayer/identity` (roots, ephemeral, aliases, room-aliases), `@freelayer/rooms` (membership, authorization, Secure Device), and `@freelayer/privacy`, rather than inventing new machinery. Inspected below with adopted decisions, rejected alternatives, and unresolved Gate F questions.

1. **Identity root + revision/schema primitives (the authority anchor and its counter).**
   - Evidence `[REPO]`: `packages/identity/src/identifiers.ts` — `IdentityLocalRevision` ("a POSITIVE LOCAL optimistic-concurrency counter … NOT a timestamp, NOT tamper resistance, NOT synchronization, NOT cryptographic continuity"), `FIRST_IDENTITY_REVISION`, `nextIdentityRevision`, `IDENTITY_SCHEMA_VERSION`; the `DeviceAuthorizationRef` brand — "Future-reference ids (Gate F/G) — declared for the contract, never key material." `packages/identity/src/identity-types.ts` — `LocalIdentityRootV1` with `keyMaterialState: "not_implemented_gate_f"`, `deviceAuthorizationState: "not_implemented_gate_f_g"`, `publicExposure: "forbidden"`; `LocalIdentityRootKindV1 = "long_lived_local" | "ephemeral_current_process"`.
   - Adopted `[INFERENCE]`: device-authorization records reuse `IdentityLocalRevision`/`nextIdentityRevision` for per-record optimistic concurrency and the `schemaVersion: 1` discipline; the aggregate is keyed to a caller-resolved `DeviceRootRefV1` covering **both** long-lived and ephemeral roots (`[REPO]` `docs/audits/TECH_ID_07_PRECHECK.md` §4.8), so the model never imports a specific vault. `DeviceAuthorizationRef` stays a reference brand — never key bytes.
   - Rejected `[INFERENCE]`: minting a new bespoke revision/counter; embedding key material in any id (identifiers.ts forbids it); coupling the aggregate to one vault type instead of a resolved root ref.

2. **Ephemeral-root parity — device authorizations must respect ephemeral forbiddens.**
   - Evidence `[REPO]`: `packages/identity/src/ephemeral/ephemeral-types.ts` — `EphemeralIdentityRootV1` carries `deviceAuthorizationState: "not_implemented_gate_f_g"` and `persistence/recovery/export/synchronization/promotion/longLivedRootLink: "forbidden"`; the ephemeral vault is a separate current-process aggregate.
   - Adopted `[INFERENCE]`: when a `DeviceRootRefV1` resolves to an ephemeral root, device-authorization records inherit the ephemeral forbiddens (no persistence/export/sync/recovery) and live only for the current process; Ghost/ephemeral identities "may choose no recovery" (ADR-0013 §13).
   - Rejected `[INFERENCE]`: a device authorization that outlives or escapes its ephemeral root, or that promotes an ephemeral context to long-lived.

3. **Explicit lifecycle reducers — pure, deterministic, injected ids/clock, terminal-is-terminal.**
   - Evidence `[REPO]`: `packages/rooms/src/membership/membership-types.ts` — `assertMembershipTransition` with a `TRANSITIONS` table, `removed_tombstone` terminal, unknown fails closed; `packages/identity/src/identity-types.ts` lifecycle unions; `packages/identity/src/aliases/alias-lifecycle.ts` + `alias-reducer.ts` (ids generated at the boundary, never inside the reducer).
   - Adopted `[INFERENCE]`: the device-authorization lifecycle (design intent `draft_local → authorized_local_unverified → suspended_local → revoked_tombstone`) uses an explicit transition table with terminal tombstone and fail-closed unknowns; ids are injected at the boundary; the reducer is pure and deterministic (no clock/random inside). Revocation is a state transition, not a mutation or delete.
   - Rejected `[INFERENCE]`: implicit/auto transitions; a reducer that reads a clock or generates ids; resurrecting a tombstoned device.

4. **Authorization snapshots / revision fences — invalidate stale authority on relevant change.**
   - Evidence `[REPO]`: `packages/rooms/src/authorization/authorization-revision.ts` — `RoomAuthorizationRevisionV1` binds `roomId / membershipId / membershipRevision / roomPolicyRevision / roomLifecycle / privacyMode / effectiveDevicePosture / devicePostureSignalRevision`, "a narrow LOCAL fence — NOT a global authorization service, trusted timestamp, cryptographic integrity claim, global ordering, or distributed-consistency token."
   - Adopted `[INFERENCE]`: a device-scoped authorization snapshot binds the resolving root's lifecycle/assurance + the device record's revision so a root going `compromised_suspected`/`revoked`, or a device transition, invalidates any prepared device-authorization operation before it executes. It is a **local** fence, not distributed revocation.
   - Rejected `[INFERENCE]`: treating a captured snapshot as a global/cryptographic revocation or a trusted timestamp.

5. **Memory/null repositories — nothing persistent, defensive clones, explicit discard.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-repository.ts` — `InMemoryContactAliasRepositoryV1` / `NullContactAliasRepositoryV1`, `structuredClone` defensive copies, `null` persistence class discards, "no disk, no browser storage, no database, no encrypted storage (encrypted … persistence is a Gate F + vault-storage question)."
   - Adopted `[INFERENCE]`: a `DeviceKeyModelStateV1` repository mirrors the memory/null pair with deep defensive clones and honest discard; `persistenceClass: "memory_only" | "null"` as on the vault; no serialization, no export, no hidden history. Encrypted device-auth persistence is a Gate F question.
   - Rejected `[INFERENCE]`: any disk/browser/DB persistence; a global singleton; a serialized snapshot or device-auth history log.

6. **PolicyDecision authenticity — authentic, allowed, exact-scope, else reject.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-repository.ts` — every op requires `isPolicyDecision(d) && d.verdict === "allowed" && d.sideEffect.startsWith("identity.alias.")`, else `ContactAliasDecisionMismatchError`; `@freelayer/privacy` holds the module-private decision set.
   - Adopted `[INFERENCE]`: every device-authorization op requires an authentic exact-scope decision on a new `identity.device.*` namespace (the precheck plans **8** new scopes; `[REPO]` `docs/audits/TECH_ID_07_PRECHECK.md` §3, §4.7); an id, a device label, a `RoomMemberRef`, a role, or DevicePosture never substitutes for a decision. Existing matrix rows `identity.device_key_future` (operation `identity.device_key`) and `identity.device_passport_future` stay **future-gated** (`[REPO]` `docs/audits/TECH_ID_07_PRECHECK.md` §3).
   - Rejected `[INFERENCE]`: accepting a bare boolean/flag; letting a non-`identity.device.*` scope authorize a device op; mass-assigning authority fields (`identity-validation.ts` `FORBIDDEN_FIELDS` already rejects `verified/trusted/authenticated/publicKey/attestation/hardwareId/...`).

7. **Fail-closed, strictest-wins policy — device policy may only TIGHTEN, never grant.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-policy.ts` — `resolveContactAliasPolicyV1` is fail-closed per `PrivacyMode` with `bunker`/`emergency` forcing `null` retention and hard-coded `false` for network/directory/username/authentication/cryptographic-binding/persistent-plaintext/notification/telemetry/ai; `packages/rooms/src/policy-composition/policy-composition.ts` — deny-by-default, "STRICTEST-POLICY-WINS + DENY-OVERRIDES."
   - Adopted `[INFERENCE]`: device-authorization create/suspend/revoke/read are gated on a fail-closed per-`PrivacyMode` resolver on the `identity.device.*` scope; strict modes (`bunker`/`emergency`) minimize (force `null`/deny expansive creates); room policy, role, and DevicePosture may only **tighten**, never authorize a device op — mirroring "DevicePosture may tighten … but cannot authorize a device" (ADR-0013 §11).
   - Rejected `[INFERENCE]`: any path where DevicePosture, a room role, or membership *grants* a device authorization; permit-overrides/first-match precedence.

8. **DevicePosture contract — environment attribute, tightening-only, no device identity.**
   - Evidence `[REPO]`: `packages/rooms/src/policy-composition/device-posture.ts` — `DevicePosture` union + `EffectiveDevicePostureV1 { trustedForElevation: false; mayOnlyTighten: true; providerIntegrated: false }`, "an untrusted signal may reduce trust (→ at_risk) but may NEVER increase it … DevicePosture is an ENVIRONMENT attribute — never identity, never authority"; `packages/rooms/src/secure-device/secure-device-provider.ts` — production lifecycles only `not_integrated | unavailable | failed`, `trustedForPostureElevation: false` structural, "No stable device-identifying field exists"; `packages/rooms/src/secure-device/sensitive-room-admission.ts` — the gate "NEVER replaces membership, capability, or PolicyDecision," untrusted elevation clamped to `unverified`.
   - Adopted `[INFERENCE]`: the device-authorization model reads **no** posture and is never a posture input; a DeviceKey record is a *root-authorization* fact, DevicePosture is an *endpoint-environment* fact, and the Secure Device provider stays externalized (`check:no-secure-device-core-implementation`). Posture may tighten a device op's policy but never authorize a device.
   - Rejected `[INFERENCE]`: coupling device authorization to posture/attestation; treating any posture value as device identity or as elevation; collecting a stable device-identifying field.

9. **RoomOS membership authorization — separate aggregate, necessary-not-sufficient.**
   - Evidence `[REPO]`: `packages/rooms/src/membership/membership-types.ts` — `RoomMembershipRecordV1` carries no device key, `verification: "unverified_placeholder"`; `packages/rooms/src/membership/membership-roles.ts` (per the alias survey) — "role eligibility is NECESSARY but never SUFFICIENT"; ADR-0013 §10 — "RoomOS membership remains separate from identity verification and a RoomOS role does not prove identity ownership."
   - Adopted `[INFERENCE]`: RoomOS membership is **not** device authorization and is never read as one; a device-authorization record neither grants nor proves membership, and membership neither grants nor proves a device. The MLS boundary (§6.4) is honored: logical membership stays distinct from any future per-member device credential.
   - Rejected `[INFERENCE]`: inlining device authorization onto the membership record or the `RoomIdentityBindingV1`; deriving device trust from a room role; using a `RoomMemberRef` as a device reference.

10. **Guardrail + test conventions — extend the identity family.**
   - Evidence `[REPO]`: `scripts/check-no-identity-scaffolding-bypass.mjs`, `check-no-ephemeral-identity-bypass.mjs`, `check-no-contact-alias-bypass.mjs`, `check-no-room-alias-bypass.mjs` (token guards forbidding overclaims — verified/authority tokens, global/public identifiers, remote sharing, persistent history, cryptographic/signature claims, raw logging/network in-module); sibling RoomOS/secure-device guards `check-no-secure-device-core-implementation.mjs`, `check-no-device-posture-or-governance-bypass.mjs`.
   - Adopted `[INFERENCE]`: a new `check:no-device-key-bypass` guardrail (**to be authored**) extends the identity token set with device-specific overclaims — device-key-as-cryptographic-key, real signature/attestation, hardware identifier collection (`hardwareId`/serial/MAC/IMEI), device-passport implementation (TECH-ID-08), remote/cryptographic device revocation, cross-device key sync (Gate H), device-as-membership/posture, and raw device-label logging/network — plus `security-regression`/`privacy-regression` device suites. **None of these exist yet** (see Limitations).
   - Rejected `[INFERENCE]`: shipping the device module without a bypass guard or regression suites.

11. **Secure Device is externalized; the model reads none of it.**
   - Evidence `[REPO]`: `packages/rooms/src/secure-device/sensitive-room-admission.ts` + `secure-device-provider.ts` + `scripts/check-no-secure-device-core-implementation.mjs` keep the provider externalized and untrusted-for-elevation in core.
   - Adopted `[INFERENCE]`: a device-authorization record is never a Secure Device input or output; DevicePosture/attestation says nothing about whether a device is *authorized under a root*, and vice versa.

---

## Mandatory honest framing (restated)

`[INFERENCE]` **A DeviceKey is not DevicePosture; DevicePosture is not identity; a device is not a person; a device reference is not a hardware identifier; a device label is not authority; a local authorization record is not a cryptographic proof; device revocation is not remote erasure; RoomOS membership is not device authorization.** There is **no real key security in TECH-ID-07**: no key bytes, no signatures, no attestation, no fingerprints, no verification, no hardware binding, no cross-signing, no device passport. Real keys/signatures/derivation/verification are **Gate F**; the signed root↔device relationship (**Device Passport**) is **TECH-ID-08**; invite/QR device-link wire formats are **Gate E**; multi-device identity **synchronization** is **Gate H**; a dedicated **Secure Device gate** governs protected presentation — the Secure Device provider is **externalized**, not integrated. Device revocation changes **local** authorization state only and makes **no** distributed-revocation or remote-erasure claim (a removed device may persist on unreachable peers; ADR-0013 §20). This is **not** a safe home for real secrets: device-authorization metadata is sensitive, memory/null only, and endpoint exposure (screenshots, second devices, crash dumps, swap, compromised endpoints) is out of scope. **No positive "verified device / real key / signature / attestation / Device Passport is implemented" claim is made anywhere**, and cryptographic authorization is never claimed.

---

## Sources (external verified live 2026-07-23; re-verify before external citation)

- `[STANDARD]` **NIST SP 800-63B, Revision 4** — Digital Identity Guidelines: Authentication and Authenticator Lifecycle Management, 2025-08-26; §4 "Events" (authenticator binding/maintenance/invalidation), §3.1.6/§3.1.7 + Appendix B (syncable authenticators) (`https://pages.nist.gov/800-63-4/sp800-63b.html`). Translated, not adopted; no AAL labels, no compliance claim.
- `[VENDOR]` **Signal, "The Sesame Algorithm: Session Management for Asynchronous Message Encryption," Revision 2, 2017-04-14** — `UserRecord`/`DeviceRecord`/`DeviceID`, per-device sessions, separate per-device delivery (`https://signal.org/docs/specifications/sesame/`). `[UNCERTAIN]` current product provisioning/linking UI has evolved — re-verify.
- `[VENDOR]` **Matrix Client-Server API** — Device keys; Cross-signing (master key / self-signing key / user-signing key); Device verification (`https://spec.matrix.org/latest/client-server-api/`). `[UNCERTAIN]` exact master-key-change-warning and key-ID clauses — re-confirm against the live section.
- `[STANDARD]` **RFC 9420, "The Messaging Layer Security (MLS) Protocol," July 2023** — Client = agent; KeyPackage; Credential (`https://www.rfc-editor.org/rfc/rfc9420.html`).
- `[STANDARD]` **RFC 9750, "The Messaging Layer Security (MLS) Architecture," April 2025** — client basic unit; multiple clients per user; Authentication Service attests identifier↔key bindings; application maps identity→client (`https://www.rfc-editor.org/rfc/rfc9750.html`).
- `[REPO]` (verified directly): `packages/identity/src/identifiers.ts`, `packages/identity/src/identity-types.ts`, `packages/identity/src/identity-validation.ts`, `packages/identity/src/ephemeral/ephemeral-types.ts`, `packages/identity/src/aliases/{alias-repository,alias-policy,alias-lifecycle,alias-reducer}.ts`, `packages/rooms/src/membership/{membership-types,membership-roles}.ts`, `packages/rooms/src/authorization/authorization-revision.ts`, `packages/rooms/src/policy-composition/{device-posture,policy-composition}.ts`, `packages/rooms/src/secure-device/{secure-device-provider,sensitive-room-admission}.ts`, `docs/adr/ADR-0013-identity-firewall-architecture.md`, `docs/audits/TECH_ID_07_PRECHECK.md`, `docs/research/{IDENTITY_STANDARDS_RESEARCH,PER_ROOM_ALIAS_IMPLEMENTATION_RESEARCH}.md`, `scripts/check-no-*-bypass.mjs` (identity/ephemeral/contact-alias/room-alias/secure-device family).

## Decisions adopted for TECH-ID-07

1. `[INFERENCE]` **One local aggregate class: a device authorization record**, held in a separate `DeviceKeyModelStateV1` keyed to a caller-resolved `DeviceRootRefV1` (long-lived + ephemeral roots), memory/null only; the root and membership records are never rewritten. Local metadata, never identity/authority/verification/key material.
2. `[INFERENCE]` **Subordinate, independent device keys under the root (future Gate F), never a copied/synced root** (§6.5; ADR-0013 §11/§18). No sync fabric, no provider recovery root, no admin/master key.
3. `[INFERENCE]` **Explicit lifecycle event discipline** translated from NIST 800-63B §4 (§6.1): create-requires-strong-existing-authority; loss/compromise/revocation invalidate local authorization state; terminal tombstone, fail-closed unknowns. No AAL labels, no compliance claim.
4. `[INFERENCE]` **Device key ≠ root key; identifiers ≠ verification; disambiguate by opaque ref** (§6.3, Matrix lessons). Purpose-/namespace-safe derivation is Gate F; key/device-change warning **state slots** are wired (`*_change_warning_future`), the warning crypto is Gate F.
5. `[INFERENCE]` **RoomOS membership (logical) stays distinct from a future per-member device/client credential (cryptographic)** (§6.4, MLS). A member may map to one or more device contexts; the two layers are never conflated.
6. `[INFERENCE]` **Fail-closed, strictest-wins policy** on **8** new `identity.device.*` scopes; room policy/role/DevicePosture may only tighten, never grant; `bunker`/`emergency` minimize. Authentic exact-scope `PolicyDecision` on every op, fenced by a local device-authorization revision snapshot.
7. `[INFERENCE]` **Memory/null retention only; content-free redacted summaries/errors;** pure injected-id reducer; identity/RoomOS guardrail + regression-test conventions extended by a new `check:no-device-key-bypass` guard. Existing `identity.device_key_future`/`identity.device_passport_future` matrix rows stay future-gated.
8. `[INFERENCE]` **No keys, signatures, attestation, cross-signing, passport, linking wire format, remote/cryptographic revocation, or synchronization** (Gates E/F/H; TECH-ID-08). Secure Device externalized; DevicePosture never an input.

## Rejected implementation approaches (and why)

- `[INFERENCE]` **Copying/syncing the private identity root to every device (syncable-authenticator model)** — rejected; ADR-0013 §18 forbids it and §6.5's NIST analysis shows a sync/recovery provider becomes a de-facto authority. Independent subordinate device keys (Gate F) instead.
- `[INFERENCE]` **A device authorization that is (or implies) a cryptographic key / signature / attestation / verified device** — rejected as a category error; all crypto is Gate F, verification never a boolean (ADR-0013 §12). `keyMaterialState`/`deviceAuthorizationState` stay `not_implemented_*`.
- `[INFERENCE]` **Implementing cross-signing / a published signature graph now** — rejected; reintroduces the correlation/social-graph surface ADR-0013 minimizes (§6.3). Deferred to Gate F with an explicit graph-exposure review.
- `[INFERENCE]` **Collecting a hardware/device identifier** (serial/model/MAC/IMEI/advertising id / stable device field) — rejected; `identity-validation.ts` already rejects `hardwareId`, and the Secure Device contract exposes no stable device-identifying field.
- `[INFERENCE]` **Coupling device authorization to DevicePosture/attestation, or letting posture/role/membership grant a device op** — rejected; posture and roles may only tighten (ADR-0013 §11; `device-posture.ts`).
- `[INFERENCE]` **Inlining device authorization onto `RoomMembershipRecordV1` or `RoomIdentityBindingV1`, or using `RoomMemberRef` as a device reference** — rejected; separate aggregate keeps revocation from touching membership/binding lifecycle and honors the MLS logical/cryptographic split.
- `[INFERENCE]` **Selecting or implementing MLS / KeyPackages here** — rejected; MLS is a future group-crypto input only (§6.4; standards survey §5), after an identity-model AS-equivalent is defined.
- `[INFERENCE]` **Implementing the Device Passport (signed root↔device relationship)** — rejected; that is **TECH-ID-08** and Gate F. TECH-ID-07 records only local, non-cryptographic authorizations.
- `[INFERENCE]` **Claiming remote/cryptographic device revocation or remote erasure** — rejected; revocation is local-only, distributed revocation deferred (ADR-0013 §20).
- `[INFERENCE]` **Persisting device-auth state to disk/DB, or syncing it across devices** — rejected; memory/null only, encrypted persistence is Gate F, cross-device sync is Gate H.

## Limitations / unresolved Gate F questions

- **Pre-implementation.** The device module does **not** exist — `packages/identity/src/devices/` is absent; only `DeviceAuthorizationRef` and the roots' `deviceAuthorizationState: "not_implemented_gate_f_g"` placeholder exist. Everything in §0/§6.6 marked `[INFERENCE]` is design intent, not shipped code; the `DeviceKeyModelStateV1` aggregate, the 8 `identity.device.*` scopes, the `check:no-device-key-bypass` guard, and the device regression suites do **not** exist yet.
- **No real key security.** No key bytes, signatures, attestation, fingerprints, or verification; a device-authorization record certifies nothing cryptographic. `impersonationSafe`/`verifiedDevice`-style claims are structurally absent.
- **UNRESOLVED — device-key derivation (Gate F).** How subordinate per-device keys are derived so they are purpose- and namespace-safe, create no avoidable cross-relationship correlation, and never use display labels as cryptographic identifiers (ADR-0013 §7) — undecided; ADR-0004 forbids inventing crypto here.
- **UNRESOLVED — device-passport signature format (Gate F / TECH-ID-08).** The signed root↔device authorization relationship, its format, and rotation/revocation signatures are deferred.
- **UNRESOLVED — key/device-change warning semantics (Gate F).** The `key_change_warning_future`/`device_change_warning_future`/`recovered_reverification_required` **state slots** exist, but the detection, invalidation-of-prior-verification, and warning crypto (ADR-0013 §12) are undecided.
- **UNRESOLVED — device-link invite authentication (Gate E/F).** The `device_link_request` invite class (ADR-0013 §14) needs a one-time, capability-limited, revocable token whose wire format and authentication are Gate E/F.
- **UNRESOLVED — cross-device device-auth synchronization (Gate H).** Synchronizing device authorizations/revocations across a user's own devices, and reconciling a device removed while peers are unreachable, are deferred; no CRDT designed. Local state is authoritative only for the current vault.
- **UNRESOLVED — recovery ↔ device interaction (Gate F + recovery threat review).** How recovery reviews/invalidates prior device authorizations without a provider/admin root, and how `recovered_reverification_required` re-gates devices (ADR-0013 §13), needs the dedicated recovery threat review.
- **UNRESOLVED — MLS AS-equivalent mapping (group-crypto track).** If group messaging is later built, how a decentralized Authentication-Service equivalent maps a logical membership to one or more device/client credentials (§6.4) is open.
- **Memory/null only; not durable, not safe for real secrets.** Device-authorization metadata is sensitive and held in-process; endpoint exposure (screenshots, second devices, crash dumps, swap, compromised endpoints) is external (Secure Device — externalized) or inherent OS behavior and is prevented by nothing here.
- **Standards may drift.** External claims (§6.1–6.5) were verified live 2026-07-23 with versions/dates recorded, but re-verify against the primary source before any external citation; the Matrix master-key-change-warning wording is flagged `[UNCERTAIN]`.
