# Per-Contact Alias — Implementation Research (TECH-ID-05)

> **Sourcing caveat (read first).** Internet access was likely unavailable while preparing this document. Every external standard and product reference below (W3C, Unicode/UTS #39, SimpleX, Signal, OWASP) was consulted **offline, from prior knowledge**, not fetched live. Any claim used for a security decision **must be re-verified against the primary source** before it is relied on. Throughout, **evidence** (what a standard actually says, or what the code in this repo actually does) is kept separate from **inference** (how we chose to apply it), and each item carries an evidence-type tag. Uncertainty is flagged inline as `[UNCERTAIN]`. This document informs the **local, relationship-scoped, non-cryptographic** TECH-ID-05 per-contact alias work only; it decides nothing that ADR-0013 defers to Gate F (cryptography), Gate E (wire formats), or Gate H (synchronization).

**Evidence-type tags used below**

| Tag | Meaning |
| --- | --- |
| `[STANDARD]` | A published specification (W3C DID / Controlled Identifiers; Unicode UAX #15 NFC, UTS #39, UAX #9 bidi; OWASP). Consulted offline — re-verify. |
| `[VENDOR]` | A product's documented behavior (SimpleX, Signal). Consulted offline — re-verify against current docs/source. |
| `[REPO]` | Directly verifiable in this repository at the cited path. |
| `[INFERENCE]` | Our design reasoning applying evidence to TECH-ID-05. Not itself a source. |
| `[UNCERTAIN]` | A recollection we are not confident about; treat as a re-verify TODO. |

---

## 0. Scope and non-goals

### 0.1 What a per-contact alias is (working definitions)

TECH-ID-05 introduces **two distinct, local, relationship-scoped** presentation records — and nothing else:

- **Pairwise presentation alias** — *a local, relationship-scoped display name the user chooses for how they wish to present toward exactly one contact relationship, bound to one persona under one root, held locally and* **not yet shared** *with the peer.* `[REPO]` `packages/identity/src/aliases/alias-types.ts` — `PairwisePresentationAliasV1 { relationshipId, personaId, rootId, rootKind, displayText, sharingState: "not_shared_tech_id_05", authenticatedBinding: "not_implemented_gate_f", … }`.
- **Local peer label** — *a private note-to-self name for a contact, held only locally and* **never sent** *to the peer or anyone else.* `[REPO]` `alias-types.ts` — `LocalPeerLabelV1 { labelText, visibility: "local_only", peerShared: false, authority: "none", verificationEvidence: false }`.

Both are **presentation metadata**, memory/null only, relationship-scoped, and non-authoritative. `[REPO]` `alias-types.ts` module header: "Neither is identity, verification, authentication, a public username, or a cryptographic identifier … Trust/assurance is never derived from alias text."

### 0.2 What a per-contact alias is NOT (mandatory distinctions)

`[INFERENCE]` These are load-bearing category boundaries, not marketing copy.

- **Not identity.** An alias is not a root, a persona, or a relationship identifier. It is a name attached *to* a relationship, stored in a **separate** aggregate (`ContactAliasStateV1`) that references the relationship by id.
- **Not a public username or directory handle.** No global uniqueness, no search, no registry. `[REPO]` `alias-identifiers.ts`: alias ids are "LOCAL record references, NOT visible names and NOT contact-discovery handles."
- **Not verification or authentication.** `[REPO]` `alias-types.ts`: `verifiedIdentity: false`, `impersonationSafe: false`, `aliasVerified: false`, `realWorldIdentityVerified: false`.
- **Not shared or synchronized (yet).** A pairwise presentation alias is `sharingState: "not_shared_tech_id_05"`; a local peer label is `peerShared: false`. No wire format, no exchange, no sync (Gates E/F/H).
- **Not a cryptographic identifier or binding.** `authenticatedBinding: "not_implemented_gate_f"`, `cryptographicBindingAvailable: false`. A visible name is not unlinkability (§6.1).
- **Not a confusable/spoofing defense.** Baseline normalization is conservative and honest; it is **not** a UTS #39 confusable detector and never certifies an alias as safe (§6.4).
- **Not a Secure Device / endpoint feature.** Endpoint protection is the external Secure Device / Endpoint Defense project's concern.

### 0.3 Non-goals

TECH-ID-05 introduces **no** cryptography, key material, signatures, derivation, verification, fingerprints, safety numbers, invites/QR, per-room aliases (TECH-ID-06), device keys/passports, Trust Notebook, DID documents, public usernames, contact directory, search, remote alias exchange, persistence to disk, network, notification, AI, or synchronization. It adds only a **local, non-cryptographic, relationship-scoped** presentation layer: two record classes, NFC normalization + dangerous-control rejection, a local reuse warning, rotation that preserves relationship/block/trust state, policy-gated display contexts, and memory/null retention. It ports no external identity system; it extracts **design principles** from external standards and **reuses patterns** already validated in this monorepo.

---

## 6.1 W3C Controlled Identifiers / DID — pairwise-privacy guidance

**Source** `[STANDARD]` W3C DID Core and the W3C Controlled Identifier / verification-method model, plus general W3C privacy-IG guidance on correlation and pairwise (per-relationship) identifiers (concept shared with OIDC/SAML pairwise subject identifiers). Cross-referenced with SimpleX/Briar pairwise evidence in the RESEARCH-ID-01 competitor matrix and applied to identity in `docs/research/EPHEMERAL_IDENTITY_IMPLEMENTATION_RESEARCH.md` §6.2. Consulted offline — re-verify.

**Principles extracted (evidence):**

1. `[STANDARD]` **Globally reused identifiers enable correlation.** A single identifier presented across relationships lets independent parties (and passive observers) link a subject's contexts into one graph.
2. `[STANDARD]` **Pairwise (per-relationship) identifiers reduce cross-context correlation.** A distinct identifier per relationship denies trivial cross-context linking.
3. `[STANDARD]` **Reused keys, service endpoints, or metadata defeat the separation.** Pairwise identifiers are undermined if the *same key/verification method*, the *same service endpoint*, or a *shared metadata field* appears across relationships — correlation simply moves from the id to the reused material.
4. `[STANDARD]` **A visible alias is NOT cryptographic unlinkability.** Choosing a different display name per contact is presentation hygiene, not a cryptographic guarantee; it does not prevent linkage through reused underlying identifiers, keys, transport, or endpoint observation.
5. `[STANDARD]` **Context-specific identifiers must not be silently reused.** The privacy property depends on identifiers *not* leaking or being reused across contexts by default.

**Inference → the central implication for a per-contact alias:**

- `[INFERENCE]` **Every pairwise presentation alias is bound to exactly one relationship** and must **not** expose, derive from, or serialize the **private root identifier**. Concretely, an alias must not present, embed, or derive from: the long-lived (or ephemeral) root's peer-facing identifiers, its (future) verification material/keys, other personas/aliases/labels, room-alias or device identifiers, its metadata fields, or any shared service/endpoint reference. This is enforced structurally in the WIP: `[REPO]` `alias-identifiers.ts` — alias ids "encode no display text, no root/persona/relationship id, no phone/email/username, no timestamp, no room id, no device info, and no key material"; `[REPO]` `alias-types.ts` — `PairwisePresentationAliasV1.displayText` is a normalized `ContactAliasTextV1`, distinct from every opaque id; the long-lived root is `publicExposure: "forbidden"` (`identity-types.ts`).
- `[INFERENCE]` **No reusable correlator is created.** No key material exists (Gate F), so an alias cannot embed a cross-context key. When Gate F adds derivation, alias display text must **not** be used as a cryptographic identifier (ADR §7) and alias records must not become a shared correlator across relationships.
- `[INFERENCE]` **Same normalized text across relationships is a *local* correlation hint, not a cryptographic link.** The WIP records this honestly as a local reuse warning (`AliasCorrelationRiskV1`, `AliasReuseAssessmentV1`) without exposing which other relationships share the value (`relationshipIdsExposed: false`, `otherRelationshipCountExposed: false`) — see §6.4/§6.5.

**Explicitly not done — DIDs rejected for v1 (ADR §18/§19).** No DID method, resolver, DID document, verification method, or service endpoint. Service-endpoint metadata and registry dependence are themselves correlation vectors; FreeLayer adopts the **pairwise principle** (never reuse peer-facing material across contexts; an alias is bound to one relationship and never derives from the root id) without a DID method.

---

## 6.2 SimpleX incognito profiles / per-contact profile selection / random names

**Source** `[VENDOR]` SimpleX Chat's documented model: no user identifiers/accounts by design; **incognito mode** generates a random profile per new contact; a user may select which chat profile a given contact sees; connections are per-connection (pairwise) rather than a global account. `[UNCERTAIN]` exact current UI wording, defaults, and whether a "random name" is per-contact or per-connection — re-verify against current SimpleX docs/source.

**Distinctions extracted (do not copy without analysis).** SimpleX conflates, at the product layer, several ideas that FreeLayer keeps **separate**. TECH-ID-05 must not blur them:

1. `[INFERENCE]` **Local persona** — a presentation/policy context *under one root* (`IdentityPersonaV1`), explicitly **not guaranteed unlinkable**. A persona is chosen; it is not itself the per-contact name.
2. `[INFERENCE]` **Per-contact presentation** (a pairwise presentation alias) — the name a user shows toward **one** relationship. This is what TECH-ID-05 builds (`PairwisePresentationAliasV1`). It is layered on a persona under a root; it is **not** a new root.
3. `[INFERENCE]` **Independent identity root** — a separate authority context (TECH-ID-04 ephemeral, or a distinct long-lived root). This is the real separation boundary; an alias is **not** one and must never be mistaken for one.
4. `[INFERENCE]` **Relationship identifier** — the peer-facing pairwise identifier for a relationship (future, Gate F). An alias is display text *about* a relationship; it is **not** the relationship identifier and must not be used as one.
5. `[INFERENCE]` **Global profile** — a single reusable public handle. FreeLayer has **none**; an alias adds none.

**Inference → what TECH-ID-05 adopts and rejects:**

- `[INFERENCE]` **Adopt:** the *no-account, no-global-identifier, pairwise-by-default* stance, and the idea that presentation can differ per contact without changing who you are.
- `[INFERENCE]` **Reject / diverge:** we do **not** implement a "random per-contact profile" generator as a headline feature, and we do **not** treat per-contact presentation as a new identity root. FreeLayer's pairwise presentation alias is an explicit, user-chosen, relationship-scoped **local presentation** on top of an existing persona/root — with an optional `injected_generated_placeholder` origin (`[REPO]` `alias-types.ts` `origin`) but no promise that a generated name is unlinkable. Independence lives at the **root** layer (TECH-ID-04), not the alias layer.

**Explicitly not done.** No account/profile database, no automatic random-identity generation as an anonymity claim, no per-connection wire exchange (Gate E). The comparison informs the *conceptual separation* (persona vs presentation vs root vs relationship id vs global profile) only.

---

## 6.3 Signal — usernames vs profile names, phone privacy, safety numbers, blocking, collisions

**Source** `[VENDOR]` Signal's documented model: an optional **username** used to *initiate contact* without sharing a phone number (with a rotating numeric discriminator), distinct from the **profile name** shown in chats; **phone-number privacy** settings; **safety numbers** that verify a specific conversation's key material; **blocking**; and the fact that **profile names are user-set and not unique**. `[UNCERTAIN]` exact current username/discriminator mechanics and safety-number wording — re-verify against current Signal docs/source.

**Principles extracted (evidence):**

1. `[VENDOR]` **A contact-initiation identifier is not the chat profile.** Signal's username (for discovery/initiation) is a different object from the profile name a peer sees in conversation. Collapsing them is a category error.
2. `[VENDOR]` **Display names are not verification.** A profile name is self-set and proves nothing about who the person is.
3. `[VENDOR]` **Safety numbers verify relationship security, not real-world identity.** A matching safety number confirms key continuity/agreement for that conversation — not the counterparty's legal identity.
4. `[VENDOR]` **Blocking is a durable relationship state.** It is not tied to a display name and survives name changes.
5. `[VENDOR]` **Similar/identical profile names can coexist.** Non-uniqueness is expected; the UI must not treat a name as an identity key.

**Inference → how TECH-ID-05 applies the distinctions:**

- `[INFERENCE]` **FreeLayer has no username at all; an alias is strictly the *chat-presentation* object, never a contact-initiation identifier.** There is no discovery handle to build (initiation is the future invite model, ADR §14 — Gate E/F). The pairwise presentation alias maps to Signal's *profile name* concept, not its *username*.
- `[INFERENCE]` **An alias is never verification.** The WIP fixes `aliasVerified: false`, `realWorldIdentityVerified: false`, `verifiedIdentity: false` (`[REPO]` `alias-types.ts`). Verification is claim-specific and lives elsewhere (ADR §12; future TECH-ID-11).
- `[INFERENCE]` **Relationship security ≠ real-world identity.** FreeLayer's analogue of the safety number is future relationship key-continuity state (Gate F), kept separate from alias display; the display context surfaces `cryptographicBindingAvailable: false` so the UI never implies the name is cryptographically bound.
- `[INFERENCE]` **Block/trust are durable and survive alias change/rotation.** `[REPO]` `alias-types.ts` `ContactAliasRotationResultV1 { blockStateChanged: false, trustStateChanged: false, relationshipContinuityPreserved: true }` — matching ADR §9 and Signal's block-survives-rename behavior. An alias lives in a separate aggregate referencing the relationship id, so renaming it cannot touch relationship lifecycle/block/trust.
- `[INFERENCE]` **Name collisions are expected and safe.** Aliases are not unique. Identical normalized text across relationships raises a **local** reuse warning (a nudge), never an error and never a claim that the names denote the same person (§6.1, §6.4).

**Explicitly not done.** No username/discovery handle, no phone number anywhere (FreeLayer is accountless, no phone/email — ADR §7/§18), no safety-number/verification implementation (Gate F / TECH-ID-11), no uniqueness enforcement.

---

## 6.4 Unicode confusables & security — UTS #39, NFC, bidi, invisibles

**Source** `[STANDARD]` Unicode UTS #39 (Security Mechanisms: confusable detection, identifier restrictions, mixed-script and whole-script confusables, restriction levels), UAX #15 (Normalization Forms — NFC/NFD/NFKC/NFKD), UAX #9 (Bidirectional Algorithm — bidi controls/overrides/isolates), and general Unicode security guidance on invisible/default-ignorable characters. Consulted offline — re-verify.

**Principles extracted (evidence):**

1. `[STANDARD]` **Confusables span several classes.** *Single-script* confusables (e.g. Latin `l`/`I`/`1`), *mixed-script* confusables (Latin/Cyrillic/Greek look-alikes), and *whole-script* confusables (an entire word rendered in another script that looks identical) are distinct problems requiring different data/logic.
2. `[STANDARD]` **Bidi controls can reorder or mask text.** Bidi *overrides* (U+202A–U+202E) and *isolates* (U+2066–U+2069) can make displayed text differ from logical order, enabling spoofing.
3. `[STANDARD]` **Invisible / default-ignorable characters distort comparison and display.** Zero-width space (U+200B), word joiner (U+2060), BOM/ZWNBSP (U+FEFF), and C0/C1 controls (incl. NUL, and U+2028/U+2029 line/paragraph separators) can hide differences, break layout, or corrupt logs.
4. `[STANDARD]` **Normalization is a prerequisite, not a solution.** NFC yields a canonical composed form so equal-looking sequences compare equal; it does **not** detect confusables. Compatibility normalization (NFKC) is more aggressive and can *alter visible meaning*, so it is inappropriate for human display names.
5. `[STANDARD]` **Confusable/identifier restriction carries i18n trade-offs and false positives.** Restricting scripts or flagging mixed-script harms legitimate multilingual names; whole-script and single-script confusables still slip through; confusable data is large and version-dependent.

**Decision (baseline for TECH-ID-05):** `[INFERENCE]` a **conservative, honest** baseline — **not** a confusable engine.

- **NFC normalization + ordinary-whitespace trim.** `[REPO]` `alias-normalization.ts` — `input.normalize("NFC").trim()`. NFC (not NFKC) preserves visible meaning while canonicalizing composition.
- **Dangerous-control rejection (exact set).** `[REPO]` `alias-normalization.ts` `isRejectedCodePoint` rejects: **C0 controls** `U+0000..U+001F` (incl. **NUL**); **DEL + C1** `U+007F..U+009F`; **line/paragraph separators** `U+2028` / `U+2029`; **bidi overrides** `U+202A..U+202E`; **bidi isolates** `U+2066..U+2069`; **zero-width space** `U+200B`; **word joiner** `U+2060`; **BOM/ZWNBSP** `U+FEFF`.
- **Retain `U+200C` (ZWNJ) and `U+200D` (ZWJ).** `[REPO]` `alias-normalization.ts` header + comment: they are "required for legitimate languages (e.g. Persian, Devanagari) and emoji ZWJ sequences." Blocking them would break real names and emoji.
- **Bounded length.** `[REPO]` `CONTACT_ALIAS_LIMITS_V1` — scalar length 1..64, ≤ 256 UTF-8 bytes; one active presentation alias and one active local peer label per relationship.
- **Raw input discarded.** `[REPO]` `ContactAliasTextV1 { originalInputState: "discarded_after_validation", normalization: "unicode_nfc" }` — only the normalized value is retained.

**Explicitly NOT claimed / NOT done:**

- `[INFERENCE]` **No full confusable detection.** `[REPO]` `alias-types.ts` `AliasConfusableAssessmentV1 = "not_evaluated" | "future_unicode_security_gate"`; `ContactAliasSecurityAssessmentV1 { impersonationSafe: false }`. We do **not** claim to catch single-script/mixed-script/whole-script confusables.
- `[INFERENCE]` **No whole-script/mixed-script blocking.** We do not block or restrict writing systems; legitimate multilingual names are allowed. Over-restriction's i18n harm and false positives outweigh the partial benefit at this layer.
- `[INFERENCE]` **No large confusable-data dependency.** Adopting a UTS #39 confusable table (large, version-dependent) is deferred to a dedicated future Unicode-security gate; the baseline is self-contained.
- `[INFERENCE]` **Security-sensitive UI must never rely on alias text alone.** `[REPO]` `alias-normalization.ts` header states this; verification/authenticity decisions must use claim-specific state (Gate F / TECH-ID-11), never the display name.

---

## 6.5 OWASP logging — alias text is sensitive relationship metadata

**Source** `[STANDARD]` OWASP Logging Cheat Sheet and ASVS V7 (logging & error handling): do not log sensitive data; produce content-free/generic error responses; use stable reason codes; never serialize raw request objects into logs or errors. Inherited from TECH-ID-03/04 conventions. Consulted offline — re-verify.

**Principles extracted (evidence):**

1. `[STANDARD]` **Do not log sensitive data.** Personal/relationship metadata should not appear in ordinary logs.
2. `[STANDARD]` **Errors are content-free.** User-facing and log errors carry a generic message + stable code, not the offending input.
3. `[STANDARD]` **Never serialize raw commands/state.** Dumping a rejected payload leaks exactly the sensitive fields validation exists to protect.

**Inference → how TECH-ID-05 treats alias text and diagnostics:**

- `[INFERENCE]` **Alias text is sensitive relationship metadata.** It reveals who a user talks to and how they think of them; it is classified with `pairwise_relationship` metadata (ADR §16) — privacy-sensitive, local, no analytics, no export.
- `[INFERENCE]` **No aliases in ordinary logs; no serialized rejected commands.** `[REPO]` `alias-errors.ts` header: "REDACTED: codes + STATIC generic messages only — NEVER alias text, a local peer label, a relationship/root/persona id where avoidable, a command payload, collision details, or the leak sentinel." `SAFE_ALIAS_REJECTION` is a single static string; every error subclass carries only a stable code (`validation`, `normalization`, `policy_denied`, `decision_mismatch`, `not_found`, `revision_mismatch`, `lifecycle`, `relationship_mismatch`, `duplicate_active`, `transfer_forbidden`, `remote_sharing_unavailable`, `authentication_unavailable`, `local_peer_label_visibility`).
- `[INFERENCE]` **Generic reason codes for reuse/collision.** A local reuse warning reports `normalizedValueReused: boolean` + a `reasonCode`, but never *which* relationships collide: `[REPO]` `alias-types.ts` `AliasReuseAssessmentV1 { otherRelationshipCountExposed: false, relationshipIdsExposed: false }`. Duplicate-active rejection uses the `duplicate_active` code without echoing the colliding text.
- `[INFERENCE]` **Redacted local diagnostics.** Transient results (`ContactAliasRotationResultV1`, `ContactDisplayContextV1`) carry `redacted: true` / `redacted: boolean` and disclose *what did not happen* honestly (`remoteCopiesAffected: false`, `authenticatedRemoteUpdatePerformed: false`) rather than dumping content. Mirrors the ephemeral `EphemeralIdentityDestructionResultV1` honesty pattern.

**Explicitly not done.** No telemetry, no analytics, no crash-report inclusion of alias text (external/OS surfaces are out of the module's reach and disclosed, not defended); the module emits no log line containing alias text or ids.

---

## 6.6 Repository patterns reused from this monorepo

`[REPO]` TECH-ID-05 **reuses proven local patterns** already validated in `@freelayer/privacy`, `@freelayer/storage`, and the TECH-ID-03/04 identity scaffolding, rather than inventing new machinery.

1. **Identity validators — exact-keys, dangerous/forbidden-field rejection, bounded strings.**
   - Evidence `[REPO]`: `identity-validation.ts` — `assertExactKeys`, `DANGEROUS_KEYS` (`__proto__`/`prototype`/`constructor`), `FORBIDDEN_FIELDS` (`verified`/`trusted`/`username`/`globalUsername`/`did`/`email`/`phone`/`devicePosture`/…), `MAX_LOCAL_LABEL = 64`, control-char rejection. `alias-identifiers.ts` reuses the same opaque-slug rule (`^[a-z0-9][a-z0-9_-]{2,127}$`, no `@`, prefix-tagged).
   - Reuse `[INFERENCE]`: alias command validation (to be authored) will reject mass-assigned authority/secret fields (`verified`, `authenticated`, `signature`, `peerShared: true`, `shared`, key/seed fields, `did`/`username`/`email`/`phone`, `devicePosture`) and dangerous keys, with exact-key command shapes and bounded display text via `normalizeContactAliasDisplayTextV1`.

2. **Explicit lifecycle reducers — per-aggregate transition tables, terminal-is-terminal.**
   - Evidence `[REPO]`: `identity-lifecycle.ts` uses per-aggregate transition tables where unknown/terminal states throw; `identity-reducer.ts` is pure, deterministic, injected-ids/clock only, no partial state on failure.
   - Reuse `[INFERENCE]`: alias lifecycles (`PairwisePresentationAliasLifecycleV1 = draft_local → active_local_unshared → retired_tombstone`; `LocalPeerLabelLifecycleV1 = active_local_private → cleared_tombstone`, `[REPO]` `alias-types.ts`) use the same explicit-transition, no-silent-default discipline; rotation is a new-record + retire-old within one pure reducer step, never a mutation of relationship state.

3. **Memory / null repositories — nothing persistent.**
   - Evidence `[REPO]`: `identity-repository.ts` — `InMemory…` and `Null…`; "MEMORY-ONLY or NULL — no disk, no browser storage, no database, and no encrypted storage." A `null`-classed aggregate is never retained.
   - Reuse `[INFERENCE]`: `ContactAliasStateV1` is `persistenceClass: "memory_only" | "null"` (`[REPO]` `alias-types.ts`); an alias repository (to be authored) mirrors the memory/null pair with defensive cloning and honest discard — no persistence, no serialization, no export.

4. **`PolicyDecision` provenance + exact side-effect scope (`@freelayer/privacy`).**
   - Evidence `[REPO]`: `packages/privacy/src/index.ts` holds a module-private `WeakSet<PolicyDecision>`; only `issuePolicyDecision(...)` registers, `isPolicyDecision(...)` authenticates; each decision carries an exact `sideEffect` scope; `identity-repository.ts` re-checks authenticity + an `identity.` prefix.
   - Reuse `[INFERENCE]`: every alias operation (create/rotate/retire/read-display-context) requires an **authentic, allowed, exact-scope** decision (new `identity.alias.*` scopes); a stale/forged/wrong-scope decision is rejected (`decision_mismatch`, `[REPO]` `alias-errors.ts`). An id, label, `RoomMemberRef`, or DevicePosture never substitutes for a decision. **Display contexts are policy-gated** — reading one needs its own decision.

5. **`StoragePolicy` / `MetadataPolicy` mode-driven minimization; DevicePosture only tightens.**
   - Evidence `[REPO]`: `identity-policy.ts` is a pure, fail-closed resolver keyed by `PrivacyMode` × operation; strict modes (`ghost`/`bunker`/`emergency`) force `null` persistence and/or deny expansive creates; `network/notification/ai/crypto/recovery` are hard-coded unavailable; "DevicePosture may only TIGHTEN … it NEVER grants." `packages/storage/src/policy.ts` + `dataClasses.ts`; `packages/privacy/src/metadataPolicy.ts`.
   - Reuse `[INFERENCE]`: alias creation/rotation and display-context resolution are policy-gated on the same fail-closed resolver; strict modes minimize (e.g. force `null` retention / suppress a stored label); DevicePosture/RoomOS role can only restrict, never authorize; `policy_denied` names a mode/policy rejection.

6. **Summaries + audit/error redaction — content-free, sentinel-safe.**
   - Evidence `[REPO]`: `identity-summary.ts` emits counts/state without ids or labels; `identity-audit.ts` + `identity-errors.ts` carry a code union + a single static safe message and forbid ids/labels/room refs/raw command/state/secret-like values or the leak sentinel. Ephemeral mirrors this (`EphemeralIdentitySummaryV1`, `SAFE_EPHEMERAL_REJECTION`).
   - Reuse `[INFERENCE]`: alias errors are already redacted (`SAFE_ALIAS_REJECTION`, `[REPO]` `alias-errors.ts`); the alias summary/audit (to be authored) will emit counts + assessment flags only (never alias text or ids), and the `ContactDisplayContextV1` carries `redacted` and honest `*: false` disclosures (§6.5).

7. **Guardrail conventions + test fixtures (privacy/security-regression).**
   - Evidence `[REPO]`: `scripts/check-no-identity-scaffolding-bypass.mjs` and `check-no-ephemeral-identity-bypass.mjs` statically scan `apps/`+`packages/` for bypass tokens with validator/error/matrix allowlists and a `tests/fixtures/*-bypass/` fixture; wired into `audit:privacy` + CI. `tests/{privacy-regression,security-regression}/identity/**` assert forged decisions fail and sentinels never leak.
   - Reuse `[INFERENCE]`: a new `check:no-contact-alias-bypass` guardrail (to be authored) mirrors these — flagging alias-as-identity/verification, alias-as-public-username/directory/search, remote alias sharing/sync, cryptographic-binding claims, confusable-detection overclaims, alias text in logs/telemetry/notifications, and persistent storage of alias text — with a `tests/fixtures/contact-alias-bypass/` fixture and `security-regression/identity/aliases/**` + `privacy-regression/identity/aliases/**` suites as the primary TDD follow-up. **These do not exist yet** (see Limitations).

---

## Sources (all consulted offline — re-verify)

- `[STANDARD]` W3C DID Core; W3C Controlled Identifier / verification-method model; W3C privacy guidance on correlation & pairwise identifiers (also OIDC/SAML pairwise subject identifier concept).
- `[STANDARD]` Unicode UTS #39 (Security Mechanisms: confusables, identifier/script restrictions); UAX #15 (Normalization — NFC/NFKC); UAX #9 (Bidirectional Algorithm). `[UNCERTAIN]` exact confusable-data versions / restriction-level details.
- `[VENDOR]` SimpleX Chat (no accounts; incognito random per-contact profiles; per-connection presentation) — `[UNCERTAIN]` current defaults/wording.
- `[VENDOR]` Signal (optional username-for-initiation vs profile name; phone-number privacy; safety numbers; blocking; non-unique profile names) — `[UNCERTAIN]` current username/safety-number mechanics.
- `[STANDARD]` OWASP Logging Cheat Sheet / ASVS V7 (content-free errors, no raw object serialization, stable reason codes) — inherited from TECH-ID-03/04.
- `[REPO]` (verified directly): `packages/identity/src/aliases/{alias-types,alias-normalization,alias-identifiers,alias-errors}.ts`, `packages/identity/src/{identity-types,identity-validation,identity-lifecycle,identity-reducer,identity-repository,identity-policy,identity-summary,identity-audit,identifiers,index}.ts`, `packages/identity/src/ephemeral/ephemeral-types.ts`, `packages/privacy/src/{index,metadataPolicy}.ts`, `packages/storage/src/{policy,dataClasses}.ts`, `docs/adr/ADR-0013-identity-firewall-architecture.md`, `docs/research/EPHEMERAL_IDENTITY_IMPLEMENTATION_RESEARCH.md`.

## Decisions adopted for TECH-ID-05

1. `[INFERENCE]` **Two distinct local record classes:** a **pairwise presentation alias** (relationship-scoped, persona/root-bound, `not_shared_tech_id_05`) and a **local peer label** (`local_only`, `peerShared: false`). Both are presentation metadata, never identity/authority/verification.
2. `[INFERENCE]` **Relationship-scoped, in a separate aggregate.** Aliases live in `ContactAliasStateV1` and reference a relationship id; the relationship record is never rewritten. Works for relationships under either `rootKind` without linking them.
3. `[INFERENCE]` **Bound to exactly one relationship; never exposes/derives-from/serializes the private root id** (pairwise principle, §6.1). A visible alias is not cryptographic unlinkability.
4. `[INFERENCE]` **Conservative Unicode baseline (§6.4):** NFC + trim + dangerous-control rejection (C0/C1, U+2028/9, bidi overrides U+202A–E, isolates U+2066–9, U+200B, U+2060, U+FEFF, NUL), retaining ZWNJ/ZWJ; bounded length; raw input discarded. **No** confusable-detection, whole-script-blocking, or large-data-dependency claims.
5. `[INFERENCE]` **Local reuse warning, not enforcement.** Identical normalized text raises a local nudge (`AliasCorrelationRiskV1` / `AliasReuseAssessmentV1`) without exposing which relationships collide; aliases are non-unique.
6. `[INFERENCE]` **Rotation preserves relationship/block/trust continuity** (`ContactAliasRotationResultV1`), matching ADR §9 and Signal blocking semantics.
7. `[INFERENCE]` **Policy-gated display contexts.** Reading a `ContactDisplayContextV1` requires an authentic exact-scope `PolicyDecision`; the context surfaces honest `*: false` flags (verified/real-world/crypto-binding) and a `redacted` marker.
8. `[INFERENCE]` **Memory/null retention only; content-free redacted errors/summaries;** reuse of injected-ids/pure-reducer, exact-scope authentic `PolicyDecision`, fail-closed mode policy (DevicePosture only tightens), explicit lifecycle transitions, and the identity/ephemeral guardrail + test conventions.

## Rejected implementation approaches (and why)

- `[INFERENCE]` **Alias as a public username / directory handle / searchable identifier** — rejected; reintroduces the global-correlator and directory threats ADR §7/§18/§19 forbid. Aliases are local and never discoverable.
- `[INFERENCE]` **Alias as (or implying) verification / authentication / impersonation-safety** — rejected as a category error; fixed `verifiedIdentity/aliasVerified/impersonationSafe: false`. Verification is claim-specific (Gate F / TECH-ID-11).
- `[INFERENCE]` **Inline alias field on the relationship record** — rejected; a separate aggregate keeps rotation from touching relationship lifecycle/block/trust and keeps the alias removable without disturbing continuity.
- `[INFERENCE]` **Full UTS #39 confusable engine / whole-script blocking / large confusable table now** — rejected for v1; high i18n false-positive cost, partial coverage, and a heavy version-dependent dependency. Deferred to a dedicated Unicode-security gate; baseline stays conservative and honest.
- `[INFERENCE]` **NFKC (compatibility) normalization for display names** — rejected; NFKC can alter visible meaning. NFC preserves the name the user typed.
- `[INFERENCE]` **Blocking ZWNJ/ZWJ** — rejected; they are required for legitimate languages and emoji ZWJ sequences.
- `[INFERENCE]` **Sharing / syncing aliases now, or a wire format** — rejected; `sharingState: "not_shared_tech_id_05"`, `authenticatedBinding: "not_implemented_gate_f"`. Remote exchange is Gate E/F/H; refusal codes (`remote_sharing_unavailable`, `authentication_unavailable`, `transfer_forbidden`) name it.
- `[INFERENCE]` **Deriving trust/assurance from alias text, or logging alias text** — rejected; trust is never derived from a name (§6.3), and alias text never enters logs/telemetry/errors (§6.5).

## Limitations / unresolved limits

- `[UNCERTAIN]` **Standards not live-verified.** All external claims (§6.1–6.5) are from prior knowledge; re-verify against primary sources before relying on them.
- **No spoofing/impersonation defense.** The baseline normalizer is not a confusable detector; single-script, mixed-script, and whole-script confusables are **not** caught. `impersonationSafe: false`. Security-sensitive UI must not rely on alias text alone.
- **A visible alias is not unlinkability.** Presentation hygiene is not cryptographic separation; no key material exists (Gate F). Reused underlying identifiers, transport, or endpoint observation can still correlate.
- **Local reuse warning is a nudge, not a guarantee.** It detects only identical *normalized* text within the current local vault; it does not detect look-alikes and says nothing about remote or cross-device state.
- **No sharing / sync / remote update.** Aliases are local; a peer never receives them in TECH-ID-05. Rotation changes nothing remote (`remoteCopiesAffected: false`).
- **Memory/null only; not durable and not safe for real secrets.** Alias text is sensitive relationship metadata held in-process; until reviewed identity/crypto (Gate F) and, where relevant, storage/endpoint integrations ship, it must not be treated as a safe home for information whose exposure would cause real harm.
- **No endpoint guarantee.** Screenshots, second devices, crash dumps/diagnostics, swap, and compromised endpoints are external (Secure Device) or inherent OS behavior; a local alias does not prevent them.
- **Module is partial and untested.** Only `alias-types`, `alias-normalization`, `alias-identifiers`, and `alias-errors` exist; commands/validation/policy/reducer/repository/pipeline/summary/audit/index, the `check:no-contact-alias-bypass` guardrail, and `security-regression`/`privacy-regression` alias suites are the primary TDD follow-up and **do not exist yet**.
