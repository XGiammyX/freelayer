# Per-Room Alias — Implementation Research (TECH-ID-06)

> **Sourcing note (read first).** Unlike the offline TECH-ID-05 note, live internet access **was** available while preparing this document, and the four external standards below (W3C Controlled Identifiers, the Matrix Client-Server API, Unicode UTS #39, SimpleX Chat) were **verified against their primary sources on 2026-07-23**, with version/date recorded per source. Even so, specifications move: **re-verify any claim used for a security decision** against the primary source before relying on it. Throughout, **evidence** (what a standard actually says, or what the code in this repo actually does) is kept separate from **inference** (how we choose to apply it), and each item carries an evidence-type tag. Uncertainty is flagged inline as `[UNCERTAIN]`. This document informs the **local, room-binding-scoped, non-cryptographic** TECH-ID-06 per-room alias work only; it decides nothing that ADR-0013 defers to Gate E (wire formats/exchange), Gate F (cryptography/keys/verification), Gate G (device + identity-binding verification), or Gate H (synchronization/CRDT). It is a **pre-implementation** note: the per-room alias record and module do **not** exist yet — only the binding placeholder `roomAliasState: "not_implemented_tech_id_06"` does (`packages/identity/src/identity-types.ts`).

**Evidence-type tags used below**

| Tag | Meaning |
| --- | --- |
| `[STANDARD]` | A published specification (W3C Controlled Identifiers; Unicode UTS #39, UAX #15 NFC, UAX #9 bidi). Verified live 2026-07-23 — re-verify before external citation. |
| `[VENDOR]` | A product's documented behavior (Matrix Client-Server API; SimpleX Chat). Verified live 2026-07-23 — re-verify against current docs/source. |
| `[REPO]` | Directly verifiable in this repository at the cited path. |
| `[INFERENCE]` | Our design reasoning applying evidence to TECH-ID-06. Not itself a source. |
| `[UNCERTAIN]` | A recollection or reading we are not fully confident about; treat as a re-verify TODO. |

---

## 0. Scope and non-goals

### 0.1 What a per-room alias is (working definition — design intent, not yet built)

`[INFERENCE]` TECH-ID-06 introduces **one local, room-binding-scoped presentation record** and nothing else:

- **Room presentation alias** — *a local display name the user chooses for how they wish to present themselves within exactly one room, bound to one `RoomIdentityBindingV1` (one persona under one root, referencing one room by `RoomLocalIdRef`), held locally and* **not shared** *with the room or its members.* This mirrors the TECH-ID-05 `PairwisePresentationAliasV1` but is keyed to a **room binding** rather than a **pairwise relationship**. The contract placeholder is already present: `[REPO]` `packages/identity/src/identity-types.ts` — `RoomIdentityBindingV1.roomAliasState: "not_implemented_tech_id_06"`; `IdentityPersonaV1.peerVisibleAliasState: "not_implemented_tech_id_05_06"`.

`[INFERENCE]` A secondary *local, private per-member note within a room* (analogous to TECH-ID-05's `LocalPeerLabelV1`) is **out of scope** for this note: RoomOS deliberately holds **no member display name** on its membership record (§6.2/§6.5), and labeling another room member is a consumer concern for a future display-context layer, not part of the self-presentation alias TECH-ID-06 defines. If it is ever added it must inherit every constraint here.

Like the per-contact alias, a room presentation alias is **presentation metadata**, memory/null only, scoped to one binding, and non-authoritative. It reuses the TECH-ID-05 normalized text value (`ContactAliasTextV1`, §6.4) rather than inventing a new one.

### 0.2 What a per-room alias is NOT (mandatory distinctions)

`[INFERENCE]` These are load-bearing category boundaries, not marketing copy.

- **Not identity.** A room alias is not a root, a persona, a relationship, or a room-identity binding. It is a name attached *to* a binding, stored separately and referencing the binding by id. A root is `publicExposure: "forbidden"` / `publicDirectory: "forbidden"` (`[REPO]` `identity-types.ts`) and a room alias must never expose or derive from it (§6.1).
- **Not membership.** Membership in a room is an authorization/relationship fact (`RoomMembershipRecordV1`, `[REPO]` `packages/rooms/src/membership/membership-types.ts`), state `active_local_unverified | suspended_local | removed_tombstone`. A room alias is display text; it neither grants, proves, nor changes membership.
- **Not a role.** A room role (`owner/editor/viewer/auditor` **placeholders**, `[REPO]` `packages/rooms/src/membership/membership-roles.ts`) is one ABAC attribute; **role eligibility is necessary but never sufficient**. A room alias is not a role and a role is not proof of identity.
- **Not verification or authentication.** `RoomIdentityBindingV1.verificationState` is literally `"unverified_local"` and `credentialState: "not_implemented_gate_f"` (`[REPO]` `identity-types.ts`); RoomOS trust is a `verified_placeholder` that "does NOT mean real identity verification" (`[REPO]` `packages/rooms/src/room-types.ts`). A room alias certifies nothing.
- **Not a global username or directory handle.** No global uniqueness, no search, no registry, no discovery. The TECH-ID-05 guardrail already forbids these tokens and TECH-ID-06 inherits them (`[REPO]` `scripts/check-no-contact-alias-bypass.mjs`).
- **Not a `RoomMemberRef`.** `RoomMemberRef` is an opaque local placeholder brand (`[REPO]` `room-types.ts`), owned by RoomOS, Gate G for real identity; a room alias is human-chosen display text and must never be used as, or substituted for, a member reference.
- **Not shared or synchronized (yet).** No wire format, no exchange, no sync (Gates E/F/H).
- **Not a cryptographic identifier or binding.** No key material exists (Gate F); a visible room name is not cryptographic unlinkability (§6.1).
- **Not a confusable/spoofing defense.** Baseline normalization is conservative and honest; it is not a UTS #39 confusable detector and never certifies an alias as safe (§6.4). A collision is not proof of impersonation.
- **Not a Secure Device / endpoint feature.** DevicePosture is not identity; the Secure Device provider is **externalized** and not integrated (§6.5).

### 0.3 Non-goals

`[INFERENCE]` TECH-ID-06 introduces **no** cryptography, key material, signatures, derivation, verification, fingerprints, safety numbers, invites/QR, device keys/passports, Trust Notebook, DID documents, room directories, public usernames, member search, remote alias exchange, persistent historical profile rendering, persistence to disk, network, notification, AI, or synchronization. It adds only a **local, non-cryptographic, room-binding-scoped** presentation layer that reuses the TECH-ID-05 normalization, reuse-warning, memory/null, policy-decision, and redaction machinery unchanged. It ports no external identity system; it extracts **design principles** from external standards and **reuses patterns** already validated in this monorepo (RoomOS + the identity Firewall).

---

## 6.1 Pairwise and contextual identifiers — W3C Controlled Identifiers / DID

**Source** `[STANDARD]` **W3C Controlled Identifiers (CID) v1.0 — W3C Recommendation, 15 May 2025** (`https://www.w3.org/TR/cid-1.0/`), together with **W3C DID v1.1** (`https://www.w3.org/TR/did-1.1/`) and the standing DID privacy-considerations guidance. Cross-referenced with this repo's prior surveys `docs/research/IDENTITY_STANDARDS_RESEARCH.md` §2 and `docs/research/PER_CONTACT_ALIAS_IMPLEMENTATION_RESEARCH.md` §6.1. Verified live 2026-07-23.

**Principles extracted (evidence):**

1. `[STANDARD]` **A controlled identifier document contains cryptographic material and service endpoints.** CID 1.0 abstract: a CID document "contains cryptographic material and lists service endpoints for the purposes of verifying cryptographic proofs from, and interacting with, the controller of an identifier." These are the reusable, correlatable artifacts — not the display name.
2. `[STANDARD]` **Reused keys / verification methods / service endpoints across contexts enable correlation.** CID 1.0 §6.4 ("Controlled Identifier Document Correlation Risks") warns that reusing the same cryptographic keys, verification methods, or service endpoints across different contexts enables correlation and linkability of those contexts. Correlation moves to the reused material even if the visible identifier differs.
3. `[STANDARD]` **Different identifiers per purpose reduce correlation; equivalence must not be assumed.** CID 1.0 §6.3 ("Identifier Correlation Risks") notes a subject may use different identifiers for different purposes (e.g. enhanced privacy) and that strong equivalence expectations between identifiers are not necessarily appropriate. DID's pairwise/`did:peer` pattern is the same idea: a distinct identifier per relationship, off any global registry, to avoid a universal correlator.
4. `[STANDARD]` **Keep personal data out of the identifier document.** CID 1.0 §6.1 ("Keep Personal Data Private") discourages revealing public information (social accounts, personal websites, email) through the document/services, especially for non-public entities.
5. `[STANDARD]` **A distinct visible identifier is not, by itself, cryptographic unlinkability.** The privacy property depends on the underlying keys/endpoints/metadata *not* being reused; a different display name over a reused key or endpoint does not deny linkage.

**Inference → the central implication for a per-room alias:**

- `[INFERENCE]` **A room presentation alias is scoped to exactly one room binding and must never expose, derive from, or serialize the private identity root.** The binding already models this: `RoomIdentityBindingV1` references `rootId` + `personaId` + `roomId: RoomLocalIdRef` but the root itself is `publicExposure: "forbidden"` (`[REPO]` `identity-types.ts`). A room alias must not present, embed, or derive from the root's identifiers, its (future) verification material/keys, other personas/aliases, other room bindings' ids, its metadata, or any service/endpoint reference — the same structural rule TECH-ID-05 enforces (`[REPO]` `packages/identity/src/aliases/alias-identifiers.ts` — alias ids encode no root/persona/relationship/room id, no key material).
- `[INFERENCE]` **No reusable correlator is created.** No key material exists (Gate F), so a room alias cannot embed a cross-context key. When Gate F adds derivation, alias display text must never become a cryptographic identifier or a shared correlator across rooms.
- `[INFERENCE]` **Same normalized text across rooms is a local correlation hint, not a cryptographic link.** This is recorded honestly as a local reuse warning that never reveals which other bindings share the value (§6.4/§6.5), mirroring `[REPO]` `packages/identity/src/aliases/alias-correlation.ts` (`relationshipIdsExposed: false`, `otherRelationshipCountExposed: false`).

**Explicitly not done — DIDs rejected for v1.** No DID method, resolver, DID document, verification method, or service endpoint. FreeLayer adopts the **pairwise/contextual principle** (never reuse peer-facing material across contexts; an alias is bound to one context and never derives from the root) **without** a DID method — consistent with `IDENTITY_STANDARDS_RESEARCH.md` §2's "evaluate only, do not choose DIDs."

---

## 6.2 Room member display names — LESSONS ONLY from Matrix

**Source** `[VENDOR]` **Matrix Client-Server API**, sections "Calculating the display name for a user" and the `m.room.member` state event, plus long-standing spec discussion of per-room display names and disambiguation (`https://spec.matrix.org/latest/client-server-api/`; matrix-spec issues #177, #188, #1138). Verified live 2026-07-23. `[UNCERTAIN]` the exact current normative wording of the "Calculating the display name for a user" subsection was not fully retrievable in one fetch (long single-page spec truncated); the disambiguation behavior below was confirmed via the spec's own issue tracker and summaries — **re-confirm the precise SHOULD-level clause against the live section before external citation.**

**Lessons extracted (evidence) — these are the only things we take:**

1. `[VENDOR]` **Display names are per-room membership state and are not unique.** In Matrix a user can carry different display names in different rooms, expressed as membership (`m.room.member`) state; two members can hold the same display name in one room.
2. `[VENDOR]` **Clients must disambiguate colliding display names to reduce spoofing.** When two users share a display name in a room, clients disambiguate by additionally showing the stable user identifier — i.e. the display name is decorated with the underlying id so a duplicated name cannot silently impersonate another member.
3. `[VENDOR]` **Display state is membership-specific.** The display name lives on the per-room membership event, distinct from any global profile read; it is scoped to the room.
4. `[VENDOR]` **Member display is separate from authorization.** Power/membership authorization (`m.room.power_levels`, membership) is a different mechanism from the display name; renaming a display name changes nothing about what a member may do.

**What we deliberately do NOT copy:**

- `[INFERENCE]` **Not Matrix user IDs / homeservers.** FreeLayer is accountless with no `@user:homeserver`, no federation, no homeserver. Room/member references are opaque local placeholders (`RoomMemberRef`, `RoomLocalIdRef`), Gate G for real identity (`[REPO]` `room-types.ts`, `identifiers.ts`).
- `[INFERENCE]` **Not the event format or power-level model.** RoomOS is an event-sourced operation log with its own placeholder role/capability model (`[REPO]` `membership-roles.ts`), not Matrix events or power levels.
- `[INFERENCE]` **Not persistent historical profile behavior.** FreeLayer **deliberately rejects** rendering a persistent history of past display names/profiles. RoomOS is `no_pre_join_history` by default and never persists plaintext content (`[REPO]` `room-types.ts` header; `packages/rooms/src/policy-composition/policy-composition.ts` — `persistentStorageAllowed: false` structural). Any historical-profile rendering is **deferred to the Messaging / RoomOS / Crypto tracks** (Gates F/H), not built here.

**Inference → how the lessons map to TECH-ID-06:**

- `[INFERENCE]` **Adopt disambiguation, reject name-as-identity.** Because a room alias is user-chosen and non-unique, a security-sensitive room UI must disambiguate duplicates using the opaque, non-sensitive `RoomLocalIdRef` / member reference, never treat the name as an identity key — the same conclusion UTS #39 forces in §6.4.
- `[INFERENCE]` **Keep display strictly separate from role/membership/authorization.** A room alias sits beside `RoomMembershipRecordV1` and the role/capability/PolicyDecision path (`[REPO]` `membership-types.ts`, `membership-roles.ts`); it is read for presentation only and never consulted for authorization.

---

## 6.3 Incognito profiles in groups — SimpleX

**Source** `[VENDOR]` **SimpleX Chat** documentation: "Chat profiles" (`https://simplex.chat/docs/guide/chat-profiles.html`), the Incognito-mode announcement (`https://simplex.chat/blog/20220901-simplex-chat-v3.2-incognito-mode.html`), and FAQ. Verified live 2026-07-23. `[UNCERTAIN]` exact current UI wording/defaults may have shifted across releases — re-verify.

**Behavior extracted (evidence):**

1. `[VENDOR]` **Random per-connection/per-group profile.** With Incognito Mode on, the current profile name/image is hidden from new contacts and "a new random profile name will be generated for each connection" — including when joining a group via a link — while all such connections remain under the same underlying user profile.
2. `[VENDOR]` **Separate chat profiles, including hidden ones.** SimpleX allows creating "as many chat profiles as you like," stored only locally; later versions (v4.6) added muting and hiding of chat profiles.
3. `[VENDOR]` **Incognito is independent from chat profiles.** The docs state explicitly that Incognito Mode "is independent from chat profiles."
4. `[VENDOR]` **Correlation trade-off is the design goal.** SimpleX frames the benefit as "no meta-data in common between your conversations with different contacts" / "anonymous connections … without any shared data" — compartmentalization to prevent cross-connection/group correlation. `[UNCERTAIN]` the chat-profiles page itself does not spell out the trade-off in detail; the framing is drawn from SimpleX's FAQ/blog.

**Distinctions extracted (do not copy without analysis).** SimpleX conflates, at the product layer, several ideas that FreeLayer keeps **separate**. TECH-ID-06 must not blur them:

1. `[INFERENCE]` **Independent identity root** — a separate authority context (`LocalIdentityRootV1`, long-lived; or a TECH-ID-04 ephemeral root). This is the real separation boundary; an alias is **not** one.
2. `[INFERENCE]` **Persona** — a presentation/policy context *under one root* (`IdentityPersonaV1`), explicitly **not guaranteed unlinkable** (`[REPO]` `identity-types.ts`). A persona is chosen; it is not the per-room name.
3. `[INFERENCE]` **Per-contact alias** — TECH-ID-05's `PairwisePresentationAliasV1`, scoped to one pairwise relationship.
4. `[INFERENCE]` **Per-room alias** — TECH-ID-06's record, scoped to one `RoomIdentityBindingV1` (one room). Distinct from the per-contact alias: its scope key is a **room binding**, not a relationship.
5. `[INFERENCE]` **Global profile** — a single reusable public handle. **FreeLayer has none**; a room alias adds none.

**Inference → what TECH-ID-06 adopts and rejects:**

- `[INFERENCE]` **Adopt:** the no-account, no-global-identifier, compartmentalized-by-context stance, and the idea that presentation can differ per room without changing who you are.
- `[INFERENCE]` **Reject / diverge:** we do **not** implement a "random per-room profile generator" as an anonymity claim, and we do **not** treat per-room presentation as a new identity root. Independence lives at the **root** layer (TECH-ID-04), not the alias layer. A room alias may carry an `injected_generated_placeholder`-style origin (mirroring `[REPO]` `packages/identity/src/aliases/alias-types.ts`), but a generated name is **not** promised to be unlinkable, because the underlying binding/root/persona is unchanged.

---

## 6.4 Unicode spoofing — UTS #39

**Source** `[STANDARD]` **Unicode UTS #39 — Unicode Security Mechanisms, version 17.0.0, 2025-09-04** (`https://www.unicode.org/reports/tr39/`), with UAX #15 (Normalization — NFC/NFKC) and UAX #9 (Bidirectional Algorithm). Verified live 2026-07-23.

**Principles extracted (evidence):**

1. `[STANDARD]` **Confusability is not exact.** UTS #39: "confusability among characters cannot be an exact science." Font variation, contextual shaping (e.g. Arabic), and style variants (e.g. italics) mean the data can be over-inclusive and is not exhaustive; "the test may be overly inclusive."
2. `[STANDARD]` **Three distinct classes remain possible.** Single-script confusables (resolved script sets share an element), mixed-script confusables (no element in common), and whole-script confusables (mixed-script where each string is single-script). Each is a separate problem; lookalikes slip through any single check.
3. `[STANDARD]` **The skeleton is a heuristic, not an identity.** The skeleton/`bidiSkeleton` transformation maps a string to representative prototypes (via NFD, removing default-ignorables); identical skeletons indicate **potential** confusability, are "not intended for display," and are "not stable across versions of Unicode." Equal skeletons are not proof two strings denote the same thing.
4. `[STANDARD]` **Confusable/restriction checks are one control, not the whole defense.** UTS #39 notes implementations "may also want to use other checks, such as for confusability, or services such as Safe Browsing" — i.e. confusable detection is a component within a broader strategy, never a standalone identity or anti-spoofing guarantee.
5. `[STANDARD]` **Normalization is a prerequisite, not a solution.** NFC canonicalizes composition so equal-looking sequences compare equal; it does not detect confusables. NFKC (compatibility) is more aggressive and can alter visible meaning — inappropriate for human display names.

**Decision for TECH-ID-06:** `[INFERENCE]` **REUSE the TECH-ID-05 normalization policy unchanged. No bug was found that warrants divergence.**

- The room alias reuses `normalizeContactAliasDisplayTextV1` and the `ContactAliasTextV1` value type verbatim (`[REPO]` `packages/identity/src/aliases/alias-normalization.ts`): **Unicode NFC + ordinary-whitespace trim**, then rejection of dangerous code points via `isRejectedCodePoint` — **C0 controls `U+0000..U+001F` (incl. NUL)**, **DEL + C1 `U+007F..U+009F`**, **line/paragraph separators `U+2028`/`U+2029`**, **bidi overrides `U+202A..U+202E`**, **bidi isolates `U+2066..U+2069`**, **zero-width space `U+200B`**, **word joiner `U+2060`**, **BOM/ZWNBSP `U+FEFF`** — while **retaining `U+200C` (ZWNJ) and `U+200D` (ZWJ)** required for legitimate languages and emoji ZWJ sequences. Bounded length (`CONTACT_ALIAS_LIMITS_V1`: 1..64 scalars, ≤ 256 UTF-8 bytes); raw input discarded (`originalInputState: "discarded_after_validation"`).
- **No case-fold, no transliteration, no script-block/restriction, no confusable detection.** The alias security assessment stays honest: `confusableAssessment: "not_evaluated" | "future_unicode_security_gate"`, `impersonationSafe: false`, `verifiedIdentity: false` (`[REPO]` `packages/identity/src/aliases/alias-types.ts`).

**Explicitly NOT claimed / NOT done:**

- `[INFERENCE]` **No full confusable engine.** Given UTS #39's own statement that confusability is inexact and that mixed/single/whole-script lookalikes remain possible, a room alias never certifies non-confusability. Adopting the (large, version-dependent, "not stable across versions") confusable data is deferred to a dedicated Unicode-security gate.
- `[INFERENCE]` **Collision/confusable warnings are not verification.** A local reuse warning or a future confusable flag is a nudge, never proof that two room names denote the same person and never an authorization input.
- `[INFERENCE]` **Security-sensitive room UI must disambiguate duplicate room names** using the opaque `RoomLocalIdRef`/binding id, never the alias text alone (converges with §6.2's Matrix lesson).

---

## 6.5 RoomOS repository patterns

`[REPO]` TECH-ID-06 **reuses proven local patterns** already validated in `@freelayer/rooms`, `@freelayer/privacy`, and the TECH-ID-03/04/05 identity scaffolding, rather than inventing new machinery. Inspected below with adopted decisions, rejected approaches, and limitations.

1. **Room-identity binding + membership record (the scope key and its neighbors).**
   - Evidence `[REPO]`: `packages/identity/src/identity-types.ts` — `RoomIdentityBindingV1 { bindingId, roomId: RoomLocalIdRef, rootId, personaId, membershipId?: RoomMembershipIdRef, lifecycle (draft_local | active_local_unverified | suspended_local | removed_tombstone), roomAliasState: "not_implemented_tech_id_06", credentialState: "not_implemented_gate_f", verificationState: "unverified_local" }`. `packages/rooms/src/membership/membership-types.ts` — `RoomMembershipRecordV1` carries **no display name / email / phone / key / avatar / presence / endpoint-risk** (those are Gates G/H/R), state `active_local_unverified | suspended_local | removed_tombstone`, `verification: "unverified_placeholder"`.
   - Adopted `[INFERENCE]`: the room alias is a **separate aggregate** keyed to `RoomIdentityBindingV1` (via its binding id / `RoomLocalIdRef`), never a field mutated onto the binding or the membership record — so rotating/retiring an alias never touches binding lifecycle, membership state, or verification.
   - Rejected `[INFERENCE]`: putting the alias inline on `RoomIdentityBindingV1` or on `RoomMembershipRecordV1` (would entangle presentation with binding/membership lifecycle; RoomOS deliberately keeps the membership record display-name-free).

2. **Narrow cross-package refs (avoid the RoomOS↔identity cycle).**
   - Evidence `[REPO]`: `packages/identity/src/identifiers.ts` — identity uses narrow brands `RoomLocalIdRef` / `RoomMembershipIdRef` (`validateRoomLocalIdRef`, `validateRoomMembershipIdRef`) precisely "to avoid a circular dependency with RoomOS; RoomOS maps its own ids to these at the boundary." RoomOS's own `RoomMemberRef` / `RoomLocalId` are distinct brands (`packages/rooms/src/room-types.ts`).
   - Adopted `[INFERENCE]`: the room alias record references the room only through `RoomLocalIdRef` (and optionally `RoomMembershipIdRef`), never importing `@freelayer/rooms`. A room alias is never a `RoomMemberRef`.

3. **Room query views — metadata-minimized, redaction-first.**
   - Evidence `[REPO]`: `packages/rooms/src/query/query-views.ts` — `RoomSummaryViewV1 { title?, redacted, objectCount? }`; summaries never carry content; detail views carry content "only when policy explicitly allows it"; `packages/rooms/src/membership/membership-redaction.ts` — `redactMembershipRecordForQuery` suppresses the member ref unless relationship metadata is allowed (Standard/Offline/Sovereign) and suppresses id/revision/timestamps in strict modes.
   - Adopted `[INFERENCE]`: a room display-context/read view mirrors `ContactDisplayContextV1` (`[REPO]` `packages/identity/src/aliases/alias-types.ts`) — a `redacted` marker, honest `aliasVerified: false` / `realWorldIdentityVerified: false` / `cryptographicBindingAvailable: false`, a `presentationAliasScope: "this_room_only"`-style scope, and mode-driven suppression of the room ref/timestamps.

4. **Room policy composition — deny-by-default, strictest-wins, fail-closed.**
   - Evidence `[REPO]`: `packages/rooms/src/policy-composition/policy-composition.ts` — `composeEffectiveRoomPolicyV1` is pure, "deny-by-default, STRICTEST-POLICY-WINS + DENY-OVERRIDES," no content in the result, `persistentStorageAllowed: false` and `networkAllowed: false` structural; `packages/identity/src/aliases/alias-policy.ts` — `resolveContactAliasPolicyV1` is fail-closed per `PrivacyMode`, with `bunker`/`emergency` forcing `null` retention + denying expansive creates, and `networkSharingAllowed / publicDirectoryAllowed / globalUsernameAllowed / authenticationAvailable / cryptographicBindingAvailable / persistentPlaintextAllowed / notificationAllowed / telemetryAllowed / aiAllowed` all hard-coded `false`.
   - Adopted `[INFERENCE]`: room-alias create/rotate/retire/read are gated on a fail-closed per-mode resolver (a new `identity.room_alias.*` scope), strict modes minimize (force `null` / suppress). **Room policy and DevicePosture may only TIGHTEN, never grant** — the alias policy header is explicit: "room policy does not authorize alias ops; DevicePosture may only tighten." A room role/membership can restrict but never authorize an alias op.
   - Rejected `[INFERENCE]`: letting room role or DevicePosture *grant* an alias operation; first-match/permit-overrides precedence (RoomOS uses deny-overrides).

5. **Membership role / assurance state — necessary, never sufficient; never "verified."**
   - Evidence `[REPO]`: `packages/rooms/src/membership/membership-roles.ts` — `ROLE_CAPABILITY_ELIGIBILITY`, "role eligibility is NECESSARY but never SUFFICIENT … an authentic exact-scope PolicyDecision all still apply"; `packages/identity/src/identity-types.ts` — `IdentityAssuranceStateV1` with `PRODUCTION_ASSURANCE_STATES` limited to `unverified_local | compromised_suspected | revoked` (no verification states promoted by current code).
   - Adopted `[INFERENCE]`: a room alias never reads or writes assurance/verification; the display context surfaces the binding's assurance/lifecycle honestly but adds no verified state. A role is not proof of identity; an alias is not a role.

6. **Local reducer boundaries — pure, deterministic, injected ids/clock, no partial state.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-reducer.ts` + `alias-lifecycle.ts` (TECH-ID-05) and `packages/rooms/src/room-reducer.ts` follow explicit per-aggregate transition tables where terminal-is-terminal and unknown states fail closed; ids are generated at the boundary, never inside the reducer.
   - Adopted `[INFERENCE]`: the room-alias lifecycle (design intent: `draft_local → active_local_unshared → retired_tombstone`, mirroring `PairwisePresentationAliasLifecycleV1` in `alias-types.ts`) uses the same explicit-transition discipline; rotation is a new-record + retire-old within one pure step, never a mutation of binding/membership state.

7. **Identity Firewall alias normalization — reused verbatim.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-normalization.ts` (§6.4). Adopted `[INFERENCE]`: no new normalizer; the room alias consumes `normalizeContactAliasDisplayTextV1` and `ContactAliasTextV1` unchanged.

8. **PolicyDecision provenance + authorization-revision fence.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-repository.ts` — every read/replace/clear requires an **authentic, allowed, exact-scope** decision (`isPolicyDecision(d) && d.verdict === "allowed" && d.sideEffect.startsWith("identity.alias.")`), else `ContactAliasDecisionMismatchError`; `@freelayer/privacy` holds the module-private `WeakSet<PolicyDecision>`. `packages/rooms/src/authorization/authorization-revision.ts` — `RoomAuthorizationRevisionV1` binds `roomId / membershipId / membershipRevision / roomPolicyRevision / roomLifecycle / privacyMode / effectiveDevicePosture / devicePostureSignalRevision` so any relevant local change invalidates a prepared authorization; it is "NOT a global authorization service, trusted timestamp, or cryptographic integrity claim."
   - Adopted `[INFERENCE]`: room-alias ops require an authentic exact-scope decision (`identity.room_alias.*`); an id, room role, `RoomMemberRef`, or DevicePosture never substitutes for a decision. A room display-context read that depends on binding/membership/policy state should be fenced by (or re-validated against) the room authorization revision so a suspended binding or tightened policy invalidates a stale read.

9. **Memory/Null retention — nothing persistent.**
   - Evidence `[REPO]`: `packages/identity/src/aliases/alias-repository.ts` — `InMemoryContactAliasRepositoryV1` / `NullContactAliasRepositoryV1`, `structuredClone` defensive copies, `null` persistence class discards; "no disk, no browser storage, no database, no encrypted storage (encrypted alias persistence is a Gate F + vault-storage question)." RoomOS composition sets `persistentStorageAllowed: false` structurally.
   - Adopted `[INFERENCE]`: the room-alias repository mirrors the memory/null pair with defensive cloning and honest discard; no serialization, no export, no history.

10. **Redacted errors/summaries + guardrail + test conventions.**
    - Evidence `[REPO]`: `scripts/check-no-contact-alias-bypass.mjs` forbids (in shipped code) alias-as-authority (`aliasVerified: true`, `trustFromAlias`), global/public username + directory + search/lookup, phone/email discovery, root-id-as-alias, cross-relationship transfer/contact-merge, remote sharing (`peerShared: true`, `exchangeAlias(`), persistent history, cryptographic alias/signature, full-confusable claims (`spoofProof`, `fullConfusableDetection`), active ScreenShield, generic patch commands, and direct `localStorage./sessionStorage./indexedDB.` storage; plus `ALIAS_LOG_RE`/`ALIAS_NETWORK_RE` forbidding raw alias logging/network inside the module. Sibling RoomOS guards: `scripts/check-no-roomos-bypass.mjs`, `check-no-room-membership-bypass.mjs`, `check-no-device-posture-or-governance-bypass.mjs`, `check-no-secure-device-core-implementation.mjs`.
    - Adopted `[INFERENCE]`: a new `check:no-room-alias-bypass` guardrail (to be authored) extends the contact-alias token set with room-specific overclaims (room-alias-as-membership/role/verification, room directory/search, remote room-alias exchange, room-alias in logs) plus `security-regression`/`privacy-regression` room-alias suites. **These do not exist yet** (see Limitations).

11. **Secure Device is externalized; DevicePosture is not identity.**
    - Evidence `[REPO]`: `packages/rooms/src/secure-device/sensitive-room-admission.ts` (TECH-23) — a fail-closed gate that "NEVER replaces membership, capability, or PolicyDecision"; "because no Secure Device provider is integrated, any room requiring `basic+` … DENIES content now," and untrusted elevation is clamped to `unverified`; `packages/rooms/src/secure-device/null-provider.ts` + `scripts/check-no-secure-device-core-implementation.mjs` keep the provider externalized.
    - Adopted `[INFERENCE]`: a room alias reads none of this and is never a posture/Secure-Device input; DevicePosture may tighten alias policy but says nothing about identity.

---

## Mandatory honest framing (restated)

`[INFERENCE]` A **room alias is not** identity, membership, a role, or verification; **not** a global username or directory handle; **not** a `RoomMemberRef`. A **room role is not proof of identity**. A **name collision is not proof of impersonation**. **DevicePosture is not identity**, and the **Secure Device provider is externalized** (not integrated). None of this is a safe home for **real secrets**: alias text is sensitive relationship/room metadata held in memory/null only, and endpoint exposure (screenshots, second devices, crash dumps, swap) is out of scope. No positive "verified identity / keys / recovery / DID is implemented" claim is made anywhere: **an alias is never verification and never makes impersonation impossible.** Cryptography, verification, device/identity binding, exchange, and sync are **deferred to Gates E/F/G/H**.

---

## Sources (external verified live 2026-07-23; re-verify before external citation)

- `[STANDARD]` W3C **Controlled Identifiers (CID) v1.0**, W3C Recommendation 15 May 2025 — §6.1 Keep Personal Data Private, §6.3 Identifier Correlation Risks, §6.4 Controlled Identifier Document Correlation Risks (`https://www.w3.org/TR/cid-1.0/`); W3C **DID v1.1** (`https://www.w3.org/TR/did-1.1/`); DID privacy-considerations (surveillance/correlation/identification/…).
- `[VENDOR]` **Matrix Client-Server API** — `m.room.member` and "Calculating the display name for a user" (`https://spec.matrix.org/latest/client-server-api/`); disambiguation/per-room-name discussion (matrix-spec issues #177, #188, #1138). `[UNCERTAIN]` exact SHOULD-level clause — re-confirm against the live section.
- `[STANDARD]` **Unicode UTS #39** — Unicode Security Mechanisms, v17.0.0, 2025-09-04 (`https://www.unicode.org/reports/tr39/`); UAX #15 (NFC/NFKC); UAX #9 (bidi).
- `[VENDOR]` **SimpleX Chat** — Chat profiles (`https://simplex.chat/docs/guide/chat-profiles.html`), Incognito Mode v3.2 blog (`https://simplex.chat/blog/20220901-simplex-chat-v3.2-incognito-mode.html`), FAQ. `[UNCERTAIN]` current UI wording/defaults.
- `[REPO]` (verified directly): `packages/identity/src/identity-types.ts`, `packages/identity/src/identifiers.ts`, `packages/identity/src/aliases/{alias-types,alias-normalization,alias-identifiers,alias-policy,alias-correlation,alias-repository,alias-reducer,alias-lifecycle}.ts`, `packages/rooms/src/room-types.ts`, `packages/rooms/src/membership/{membership-types,membership-roles,membership-redaction}.ts`, `packages/rooms/src/query/query-views.ts`, `packages/rooms/src/policy-composition/policy-composition.ts`, `packages/rooms/src/authorization/authorization-revision.ts`, `packages/rooms/src/secure-device/{sensitive-room-admission,null-provider}.ts`, `scripts/check-no-contact-alias-bypass.mjs` (+ sibling RoomOS/secure-device guards), `docs/adr/ADR-0013-identity-firewall-architecture.md`, `docs/research/{IDENTITY_STANDARDS_RESEARCH,PER_CONTACT_ALIAS_IMPLEMENTATION_RESEARCH}.md`.

## Decisions adopted for TECH-ID-06

1. `[INFERENCE]` **One local record class: a room presentation alias**, scoped to exactly one `RoomIdentityBindingV1` (via `RoomLocalIdRef`), in a **separate aggregate**; the binding and membership records are never rewritten. Presentation metadata, never identity/authority/verification.
2. `[INFERENCE]` **Never exposes/derives-from/serializes the private root id** (pairwise/contextual principle, §6.1; CID 1.0 §6.3/§6.4). A visible room alias is not cryptographic unlinkability.
3. `[INFERENCE]` **Reuse the TECH-ID-05 Unicode baseline unchanged** (§6.4): `normalizeContactAliasDisplayTextV1` + `ContactAliasTextV1`; no confusable detection, no script blocking, no case-fold. No divergence justified.
4. `[INFERENCE]` **Disambiguate duplicate room names by opaque id, never by the name** (§6.2/§6.4); local reuse warning is a nudge that never reveals which other bindings collide (mirror `alias-correlation.ts`).
5. `[INFERENCE]` **Fail-closed, strictest-wins policy** on a new `identity.room_alias.*` scope; room policy/role/DevicePosture may only tighten, never grant; `bunker`/`emergency` force `null` retention.
6. `[INFERENCE]` **Memory/null retention only; content-free redacted errors/summaries;** authentic exact-scope `PolicyDecision`, fenced by the room authorization revision; pure injected-ids reducer; explicit lifecycle transitions; identity/RoomOS guardrail + test conventions.
7. `[INFERENCE]` **No history, no sharing, no sync, no directory, no username, no verification** (Gates E/F/G/H); persistent historical profile rendering explicitly deferred to Messaging/RoomOS/Crypto.

## Rejected implementation approaches (and why)

- `[INFERENCE]` **Room alias as a global/public username, room directory, or searchable member handle** — rejected; reintroduces the global-correlator/directory threats ADR-0013 forbids. Aliases are local and never discoverable (`check-no-contact-alias-bypass.mjs`).
- `[INFERENCE]` **Room alias as (or implying) membership / role / verification / impersonation-safety** — rejected as a category error; membership/role/verification live in RoomOS + the binding, honestly `unverified`.
- `[INFERENCE]` **Inline alias field on `RoomIdentityBindingV1` or `RoomMembershipRecordV1`** — rejected; a separate aggregate keeps rotation from touching binding/membership lifecycle and keeps the alias removable without disturbing continuity.
- `[INFERENCE]` **Persistent per-room profile history (Matrix-style)** — rejected; RoomOS is `no_pre_join_history`, never persists plaintext; historical-profile rendering deferred (Gates F/H).
- `[INFERENCE]` **Full UTS #39 confusable engine / whole-script blocking now** — rejected for v1; high i18n false-positive cost, partial coverage, large version-unstable data. Deferred to a dedicated Unicode-security gate.
- `[INFERENCE]` **NFKC for display names** — rejected; NFKC can alter visible meaning. NFC preserves the typed name.
- `[INFERENCE]` **Random per-room profile as an anonymity guarantee** — rejected; independence lives at the root layer (TECH-ID-04), not the alias layer; a generated name is not promised unlinkable.
- `[INFERENCE]` **Room role / DevicePosture granting an alias op** — rejected; they may only tighten, never authorize (alias policy + role-eligibility "necessary not sufficient").
- `[INFERENCE]` **Sharing/syncing room aliases, or a wire format** — rejected; remote exchange is Gate E/F/H.
- `[INFERENCE]` **Deriving trust from alias text, or logging alias text** — rejected; trust is never derived from a name, and alias text never enters logs/telemetry/errors.

## Limitations / unresolved limits

- **Pre-implementation.** The per-room alias record/module does **not** exist yet — only `RoomIdentityBindingV1.roomAliasState: "not_implemented_tech_id_06"` and `IdentityPersonaV1.peerVisibleAliasState: "not_implemented_tech_id_05_06"`. Everything in §0/§6.5 marked `[INFERENCE]` is design intent, not shipped code; the `check:no-room-alias-bypass` guardrail and room-alias regression suites do not exist.
- **No spoofing/impersonation defense.** The reused baseline normalizer is not a confusable detector; single/mixed/whole-script confusables are not caught (§6.4). `impersonationSafe: false`. Security-sensitive room UI must not rely on alias text alone.
- **A visible room alias is not unlinkability.** Presentation hygiene is not cryptographic separation; no key material exists (Gate F). Reused underlying identifiers/transport/endpoint observation can still correlate (CID 1.0 §6.4).
- **Local reuse warning is a nudge, not a guarantee.** It would detect only identical *normalized* text within the local vault; not look-alikes, not remote/cross-device state; it must never reveal which other bindings collide.
- **No sharing / sync / remote update.** Room aliases are local; the room and its members never receive them in TECH-ID-06.
- **Memory/null only; not durable and not safe for real secrets.** Alias text is sensitive room metadata held in-process; not a safe home for information whose exposure would cause real harm until reviewed identity/crypto (Gate F) and storage/endpoint integrations ship.
- **No endpoint guarantee.** Screenshots, second devices, crash dumps/diagnostics, swap, and compromised endpoints are external (Secure Device — externalized, not integrated) or inherent OS behavior; a local room alias prevents none of them.
- **Standards may drift.** External claims (§6.1–6.4) were verified live 2026-07-23 with versions recorded, but re-verify against the primary source before any external citation; the Matrix disambiguation clause in particular is flagged `[UNCERTAIN]` for exact wording.
