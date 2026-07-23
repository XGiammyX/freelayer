# TECH-ID-06 — Per-Room Alias Threat Model

> **Sourcing caveat (read first).** Internet access was likely unavailable while preparing this document. External references (Unicode UAX #15 normalization, UTS #39 confusables/mixed-script, W3C pairwise-identifier guidance, SimpleX, Briar) were consulted **offline, from prior knowledge**, not fetched live, and **must be re-verified against the primary source** before being relied on for a security decision. This is a **documentation-only** threat model: it adds no identity, key, cryptographic alias authenticity, credential, network path, directory, verification, or remote alias exchange, and invents no cryptography. Structural decisions: [ADR-0013](../adr/ADR-0013-identity-firewall-architecture.md) §7–§10 (identifier / persona-alias / pairwise / room-binding models). Companion models: [TECH_ID_05_PER_CONTACT_ALIAS_THREAT_MODEL.md](TECH_ID_05_PER_CONTACT_ALIAS_THREAT_MODEL.md) (per-contact aliases; the normalization reused here) and [TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md](TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md). Design decisions carried in from [TECH_ID_06_PRECHECK.md](TECH_ID_06_PRECHECK.md).

> [!IMPORTANT]
> Read the **[Explicitly NOT provided](#explicitly-not-provided-read-this)** section first. This task covers one **local, non-cryptographic presentation** artifact and nothing more:
>
> - A **per-room alias** is *the local presentation the user intends to show inside exactly one room binding* ([`RoomIdentityBindingV1`](../../packages/identity/src/identity-types.ts)). It is local-only in TECH-ID-06 — **not** transmitted, negotiated, signed, or authenticated to any room peer, and **not** exchanged between the user's own devices.
>
> **A room alias is not identity, not membership, not a role, not verification, not authentication, not a `RoomMemberRef`, not a public/global username, and not a cryptographic identifier; it does not prove key control and does not grant admission.** Room aliases are **memory/null only** (never persistent-capable in this task). Text handling is **baseline Unicode NFC normalization + dangerous-control/bidi rejection — NOT full confusable/homograph detection** (shared with per-contact aliases via [`alias-normalization.ts`](../../packages/identity/src/aliases/alias-normalization.ts)). **DevicePosture is not identity; a room role is not proof of identity; a name collision is not proof of impersonation.** Cryptographic alias authenticity is **Gate F**, any wire/remote alias exchange is **Gate E**, distributed alias revocation/sync is **Gate H**, historical-message relabelling is **deferred (Gate F/H)**, and endpoint protection is **external** (Secure Device / Endpoint Defense). **No complete mitigation is claimed for any threat below.**

## How to read this model

Each category lists a concrete **attack**, then **why it fails / residual** (the structural, policy, or gate reason the attack is blunted, and what it leaves behind), and the **control** that carries the weight. A control is one of:

| Control kind | Meaning |
| --- | --- |
| **Design** | A structural invariant / type boundary / reducer discipline the room-alias module must uphold in `@freelayer/identity` — opaque non-encoding ids, memory/null retention, NFC-normalize + dangerous-control rejection, content-free errors, revision-checked lifecycle, room-binding-scoped records, no automatic reuse, a role/state/assurance display context of **separate** fields, and a redacted cross-room reuse **warning** exposing no room ids or counts. The normalization (`alias-normalization.ts`), opaque-id (`alias-identifiers.ts`), content-free-error (`alias-errors.ts`), and local reuse-warning (`alias-correlation.ts`) disciplines are already shipped for per-contact aliases and are **reused, not duplicated**. |
| **Policy** | A fail-closed decision resolved against `PrivacyMode` + an authentic exact-scope `PolicyDecision`, composed with RoomOS room policy under **strictest-wins / deny-overrides** ([`policy-composition.ts`](../../packages/rooms/src/policy-composition/policy-composition.ts)) and the sensitive-room admission gate ([`sensitive-room-admission.ts`](../../packages/rooms/src/secure-device/sensitive-room-admission.ts)). DevicePosture may only **tighten**, never grant ([`device-posture.ts`](../../packages/rooms/src/policy-composition/device-posture.ts)). |
| **Gate** | Not solvable by this module: **Gate F** (crypto / alias authenticity / verification / credentials), **Gate E** (wire / remote alias exchange), **Gate H** (sync / distributed revocation / historical relabelling), **External** (Secure Device / endpoint), **Inherent** (disclosed trade-off). |

**Code anchors used repeatedly.** Shared normalization — [`aliases/alias-normalization.ts`](../../packages/identity/src/aliases/alias-normalization.ts) (`normalizeContactAliasDisplayTextV1`: Unicode NFC + trim + rejection of C0/C1 controls, bidi overrides `202A..202E`, bidi isolates `2066..2069`, and selected zero-width/BOM code points; `ZWJ`/`ZWNJ` retained for legitimate scripts; `CONTACT_ALIAS_LIMITS_V1.maximumActivePresentationAliasesPerRelationship = 1`; comment states plainly it is **NOT** a UTS #39 confusable detector and normalization is **NOT** proof an alias is safe). Opaque ids — [`aliases/alias-identifiers.ts`](../../packages/identity/src/aliases/alias-identifiers.ts) (bodies encode **no** display text / root / persona / relationship id / **room id** / timestamp / device / key material; grant **no** authority, prove **no** identity; injected generation). Content-free errors — [`aliases/alias-errors.ts`](../../packages/identity/src/aliases/alias-errors.ts) (redacted `ContactAliasErrorCode` + static `SAFE_ALIAS_REJECTION`). Local reuse warning — [`aliases/alias-correlation.ts`](../../packages/identity/src/aliases/alias-correlation.ts) (`assessContactAliasReuseV1`: pure, `otherRelationshipCountExposed: false`, `relationshipIdsExposed: false`, no telemetry; reused value is **not** proof of linkage). Room binding + assurance — [`identity-types.ts`](../../packages/identity/src/identity-types.ts) (`RoomIdentityBindingV1.roomAliasState = "not_implemented_tech_id_06"` today; `credentialState = "not_implemented_gate_f"`; `verificationState = "unverified_local"`; `IdentityAssuranceStateV1` with `PRODUCTION_ASSURANCE_STATES` limited to `unverified_local` / `compromised_suspected` / `revoked`). RoomOS membership authority — [`membership/membership-types.ts`](../../packages/rooms/src/membership/membership-types.ts) (`RoomMembershipRecordV1` carries **no** display name; `removed_tombstone` terminal; `verification: "unverified_placeholder"`) and [`membership/membership-roles.ts`](../../packages/rooms/src/membership/membership-roles.ts) (`RoomMembershipRoleV1` placeholders; role eligibility **necessary but never sufficient**).

Per [TECH_ID_06_PRECHECK.md](TECH_ID_06_PRECHECK.md) §4.8, the room-alias module migrates `roomAliasState` from the `"not_implemented_tech_id_06"` placeholder to a real `RoomAliasBindingStateV1 = "none" | "local_alias_v1" | "retired"` (local, memory-only, unreleased; no persisted data to migrate). This document states the invariants that migration must uphold; the alias record stays authoritative in the Identity Firewall and the binding's `roomAliasState` is a **derived hint**, never a second source of truth (precheck §6).

---

## 1. Cross-room correlation

The crown-jewel risk: alias material that re-links a user's separate rooms, or links a room presentation back to a private root, to another room, or to a per-contact context.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Same alias reused across rooms** as a shared handle | A room alias is a per-binding presentation record scoped to exactly one `RoomIdentityBindingV1` (ADR-0013 §10); it is not a global handle and is not searchable. Residual: a human who *chooses* to type the same text in two rooms creates observable-to-self linkage, and any peer who later (Gate E) received both could correlate — behavioral, not an API-provided join. | **Design** (binding-scoped record) + **Inherent** (user behavior) |
| **Per-contact alias reused as a room alias** (a pairwise name bleeds into a room) | TECH-ID-05 aliases are relationship-scoped (`sharingState: "not_shared_tech_id_05"`); there is no code path that copies a contact alias into a room binding, and the room-alias module must forbid such reuse by construction (precheck §4.4). No automatic reuse exists: a room alias comes only from explicit user input or an injected placeholder. Residual: the user may *retype* the same text (§behavioral). | **Design** (no automatic cross-context reuse) + **Inherent** (retyping) |
| **Persona label copied automatically** into a room alias | The persona `localLabel` is local, sensitive, and "never a public username" ([`identity-types.ts`](../../packages/identity/src/identity-types.ts)); the room-alias module must not seed a room alias from a persona/root field. A room alias is explicit input, never a derived copy. Residual: none from an automatic path; user re-entry is behavioral. | **Design** (no auto-derivation from persona/root) |
| **Avatar / future key reused** across rooms links them | TECH-ID-06 governs room alias *text* only; avatar/profile/key material is not bound into the alias record or its id, and key material remains `not_implemented_gate_f`. Residual: a user reusing one avatar everywhere is behavioral correlation, out of module scope. | **Design** (no avatar/key in alias record) + **Gate F** |
| **Alias identifier encodes root / room / membership** (id is a linking oracle) | Opaque ids encode no display text, no root/persona/relationship id, **no room id**, no membership id, no timestamp ([`alias-identifiers.ts`](../../packages/identity/src/aliases/alias-identifiers.ts)); possessing an id reveals no room graph. Residual: the id→binding *mapping* exists in local memory (endpoint scope, §7). | **Design** (opaque non-encoding id) |
| **Room export reveals other rooms' aliases** | Room aliases are local presentation, not room state; ADR-0013 §10 requires room export to **not** expose unrelated bindings, and this task adds no export path. Residual: room bundle/export semantics stay deferred (RoomOS/CapsuleNet) and must preserve this. | **Design** (no export) + **Gate E** (bundle semantics deferred) |
| **Aliases map back to one private root** | Roots are PRIVATE and never peer-facing ([`identity-types.ts`](../../packages/identity/src/identity-types.ts)); the alias record and its id carry no root material, and no query returns the root behind an alias. Residual: local memory holds the mapping (endpoint scope, §7); root-linkage across rooms is not cryptographically prevented. | **Design** (no root exposure) + **Inherent** (organizational, not cryptographic) |
| **Local reuse diagnostics expose the room graph** | The cross-room reuse assessment is a **LOCAL redacted WARNING** only, reusing `assessContactAliasReuseV1` discipline ([`alias-correlation.ts`](../../packages/identity/src/aliases/alias-correlation.ts)): pure, no room ids, no counts, no telemetry/logging. A reused value is **not** proof of linkage; a unique value is **not** proof of unlinkability. Residual: the boolean tells the local user "reused somewhere," which is a coarse local signal by design. | **Design** (warning exposes no room ids/counts) + **Inherent** |

---

## 2. In-room spoofing

Alias text is attacker-controllable presentation. The threat is a member acting on a name that *looks* like another member.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Duplicate aliases** (two members show the same name) | Room aliases are not required to be unique; the UI must never treat the alias string as a member key. Uniqueness is not claimed — instead, **disambiguation is REQUIRED** and membership identity is the `RoomMembershipRecordV1`, not the name. Residual: two members can legitimately share an alias — names collide. | **Design** (alias is not a key; disambiguation required) + **Inherent** (names collide) |
| **Visually confusable aliases** (Latin/Cyrillic look-alikes) | NFC + dangerous-control rejection run at the boundary ([`alias-normalization.ts`](../../packages/identity/src/aliases/alias-normalization.ts)), but this is **baseline hygiene, honestly NOT full confusable detection**; two glyph-distinct-but-look-alike strings can both be accepted. The alias is never presented as proof of who a member is. Residual: confusables remain storable/displayable. | **Design** (NFC + control rejection) + **Inherent** (no full confusable detection) + **Gate F** |
| **Bidi / invisible characters** (RLO/LRO reorder; zero-width padding) | Bidi overrides (`202A..202E`), bidi isolates (`2066..2069`), C0/C1 controls, and selected zero-width/BOM code points are rejected at input ([`alias-normalization.ts`](../../packages/identity/src/aliases/alias-normalization.ts)); an alias cannot be smuggled with reordering or invisible padding. `ZWJ`/`ZWNJ` are retained for legitimate scripts. Residual: not every codepoint edge case is enumerable offline; conservative rejection may refuse some benign controls. | **Design** (dangerous-control/bidi rejection) + **Inherent** |
| **Alias changed to resemble another member** | An alias rename is the user's own local presentation; no member can rename another member's room alias, and any future peer-supplied text (Gate E) is untrusted presentation, never verification. Residual: a member may still choose a confusing look-alike (see confusables above). | **Design** (local-controlled; peer text untrusted) + **Inherent** |
| **Role label embedded in alias text** ("owner", "mod") to fake authority | Role is not carried in the alias string; roles come only from `RoomMembershipRoleV1` via the RoomOS eligibility table ([`membership-roles.ts`](../../packages/rooms/src/membership/membership-roles.ts)). The display context returns role/state/assurance as **separate structured fields**, so alias text embedding "owner" confers nothing. Residual: text can still *say* "owner" — but it is never read as authority. | **Design** (role is a separate field, not alias text) |
| **Alias shown without membership / assurance context** | The display contract must return membership state (`RoomMembershipStateV1`) and assurance (`IdentityAssuranceStateV1`) as separate fields alongside the alias, never the alias alone. Sensitive UI must show verification/continuity state, not the name, as the identity signal (TECH-ID-11/13). Residual: enforcement is at the presentation layer, disclosed as an obligation. | **Design** (context fields required) + **UX** |
| **Collision resolved with a global root / user identifier** | Disambiguation must never expose a global or root identifier; roots are private and ids are opaque non-encoding ([`alias-identifiers.ts`](../../packages/identity/src/aliases/alias-identifiers.ts)). A collision is disambiguated with room-local, non-identifying context (role/state/assurance fields), not a global handle. Residual: none from this vector by construction. | **Design** (no global/root id in disambiguation) |

---

## 3. Authority confusion

An alias must never be authority. Every path that lets a name grant, replace, reset, or transfer state is an attack.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Alias grants membership / role** (holding/knowing an alias = access) | Opaque ids "grant NO authority, prove NO identity" ([`alias-identifiers.ts`](../../packages/identity/src/aliases/alias-identifiers.ts)); membership and role come only from RoomOS records, and role eligibility is **necessary but never sufficient** ([`membership-roles.ts`](../../packages/rooms/src/membership/membership-roles.ts)). Every mutating operation still requires an authentic exact-scope `PolicyDecision`. Residual: none from this vector by construction. | **Design + Policy** (id ≠ authority) |
| **Alias replaces `RoomMemberRef`** (name fuses/represents a member) | `RoomMembershipRecordV1` carries no display name and is keyed by `membershipId`/`memberRef` ([`membership-types.ts`](../../packages/rooms/src/membership/membership-types.ts)); ADR-0013 §18 rejects `RoomMemberRef`-as-identity and a mandatory global username. Equal aliases never fuse members. Residual: none — the alias has no member-key surface. | **Design** (membership-keyed, not name-keyed) |
| **Alias rename resets suspension / block** | Membership state (`suspended_local`, `removed_tombstone`) is RoomOS-owned and transitions only through `assertMembershipTransition` ([`membership-types.ts`](../../packages/rooms/src/membership/membership-types.ts)); rotating a room alias touches presentation only and must preserve role, suspension, and assurance. Residual: none from this vector by construction. | **Design** (state survives alias change) |
| **Alias change transfers verification** | Verification/continuity binds to key/assurance state (`verificationState: "unverified_local"`, `credentialState: "not_implemented_gate_f"` — Gate F), not to presentation text; changing an alias cannot move or confer a trust state. Residual: verification itself is deferred — the invariant is "presentation change never alters trust." | **Design** (verification ≠ presentation) + **Gate F** |
| **Owner / moderator alias treated as authority** | An alias reading "owner" is not `owner_placeholder`; authority is the RoomOS role attribute resolved through the eligibility table + `PolicyDecision` ([`membership-roles.ts`](../../packages/rooms/src/membership/membership-roles.ts)). The PolicyDecision is exact-scope (precheck §5). Residual: UX must render role from membership, not from alias text — disclosed obligation. | **Design + Policy** (role from membership, exact-scope decision) + **UX** |
| **DevicePosture validates an alias** (posture "confirms" a name) | DevicePosture may only **tighten** (`mayOnlyTighten: true`, `trustedForElevation: false`; [`device-posture.ts`](../../packages/rooms/src/policy-composition/device-posture.ts)) and is explicitly "never identity, never authority"; it can restrict alias operations but can never validate, sign, or bless alias text. Residual: none — posture cannot grant. | **Policy** (posture tightens only) |

---

## 4. Lifecycle and history

Aliases are created, rotated, retired, and tombstoned. Every state that lingers past its intended scope, moves where it should not, or rewrites the past is an attack.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Multiple active aliases per binding** (ambiguous room presentation) | At most **one active alias per binding** is enforced, mirroring `maximumActivePresentationAliasesPerRelationship = 1` ([`alias-normalization.ts`](../../packages/identity/src/aliases/alias-normalization.ts)); a second active create is rejected (`duplicate_active`). Residual: none from this vector by construction. | **Design** (≤1 active per binding) |
| **Retired alias reactivated** to resurrect an old presentation | Terminal states are terminal — the `RoomAliasBindingStateV1` `"retired"` value and the `removed_tombstone` binding lifecycle mirror the terminal membership transition ([`membership-types.ts`](../../packages/rooms/src/membership/membership-types.ts)); reactivation of a retired/tombstoned record fails (`lifecycle`). A new presentation is a new record, not a revival. Residual: none by construction. | **Design** (terminal transitions) |
| **Alias moved to another room** (retarget a name onto a different binding) | Cross-binding transfer is refused (`transfer_forbidden` / `relationship_mismatch` discipline reused from [`alias-errors.ts`](../../packages/identity/src/aliases/alias-errors.ts)); an alias belongs to the binding it was created under. Residual: a user can *type* the same text into another room (a new record), which is behavioral (§1), not a transfer. | **Design** (no retarget) + **Inherent** (retyping) |
| **Root / persona / binding tombstone leaves an active alias** | Tombstoning the binding (or destroying an ephemeral root, TECH-ID-04) must invalidate its alias record atomically; an orphaned alias referencing a dead binding is rejected (`not_found` / `lifecycle`), not left live. Residual: memory-page/endpoint remnants are out of module reach (§7). | **Design** (tombstone invalidation; orphan rejection) + **External** (endpoint) |
| **Stale alias shown after rotation** | Rotation replaces the active presentation and revision-checks the write (`revision_mismatch`, `IdentityLocalRevision`); the prior value is not the active presentation. Residual: any locally retained prior value is a local artifact to minimize, not a peer-facing log. | **Design** (revision-checked replace) + **Inherent** (local history) |
| **Historical messages relabelled with the newest alias** | There is **NO automatic historical-message relabelling** — associating a room alias with prior messages requires a signed, ordered binding history that does not exist and is deferred (Gate F/H). Residual: without it, a rename does not rewrite the past and cannot be cryptographically attributed either — stated, not solved. | **Gate F/H** (relabelling deferred) + **Design** (no auto-rewrite) |
| **Broad plaintext alias history leaks participation** | Retention is **memory/null** only (`persistenceClass: "memory_only" | "null"`, [`identity-types.ts`](../../packages/identity/src/identity-types.ts)); there is no broad plaintext alias-history sink that would reveal which rooms a user participated in. Residual: OS swap / memory pages are outside the module (§7). | **Design** (memory/null; no history sink) + **External** (swap) |

---

## 5. Room policy and admission

Room aliases live inside RoomOS policy composition and the sensitive-room admission gate. The threat is a name path that bypasses, loosens, or falsely satisfies those gates.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Room requires a fixed alias but the client bypasses it** | Room policy composes under **strictest-wins / deny-overrides** with no caller-controlled precedence and no first-match bypass ([`policy-composition.ts`](../../packages/rooms/src/policy-composition/policy-composition.ts)); a client that ignores a room's alias requirement is refused at the deny-by-default gate. Residual: a malicious *local* client on a compromised endpoint is out of scope (§6, §7). | **Policy** (strictest-wins, deny-by-default) + **External** |
| **Room policy lowers Identity Firewall constraints** | Composition only ever tightens: strict modes bias to redaction, emergency denies content, and no layer can loosen another ([`policy-composition.ts`](../../packages/rooms/src/policy-composition/policy-composition.ts); `governance_loosen_attempt` is a named conflict kind). A room policy may **only tighten** the user's Identity Firewall posture, never relax it. Residual: none from this vector by construction. | **Policy** (room policy may only tighten) |
| **Bunker room shows aliases despite a protected-presentation requirement** | A `*_future_required` protected-content requirement is **UNSATISFIED** because Secure Device / ScreenShield is not integrated, so content display is denied and `activeProtectionClaim: false` ([`protected-content.ts`](../../packages/rooms/src/policy-composition/protected-content.ts)); admission returns `deny_bunker_session_unavailable` / `deny_protected_presentation_unavailable` ([`sensitive-room-admission.ts`](../../packages/rooms/src/secure-device/sensitive-room-admission.ts)). Bunker assumes **no** ScreenShield. Residual: no active capture protection is claimed — endpoint capture remains possible (§7). | **Policy** (future-required denies) + **External** (Secure Device) |
| **At-risk posture elevates permissions** | `at_risk` satisfies nothing and always tightens ([`device-posture.ts`](../../packages/rooms/src/policy-composition/device-posture.ts)); admission denies content on `at_risk` (`deny_posture_at_risk`) and posture may only tighten. Residual: none — posture cannot elevate. | **Policy** (posture tightens only) |
| **Alias creation bypasses admission** | The sensitive-room admission gate is an **ADDITIONAL** fail-closed gate resolved before authorization/execution that "NEVER replaces membership, capability, or PolicyDecision" ([`sensitive-room-admission.ts`](../../packages/rooms/src/secure-device/sensitive-room-admission.ts)); admission may restrict alias-bearing actions but never grants identity or membership. Residual: admission screens out obviously-revoked authority only — real authorization is still separate. | **Policy** (admission is additive, never granting) |

---

## 6. Remote and distributed limits

TECH-ID-06 is local. The threats here are about *pretending it is remote* — treating a local room alias as an authenticated, agreed, deletable remote fact. These are honest limitations.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Local alias mistaken for an authenticated room profile** | A room alias has no wire format and no authentication; the model states plainly that a local room alias asserts nothing about the peer. Residual: UX must not render a local alias as a room-confirmed member name — disclosed obligation. | **Design** (local, unauthenticated) + **Gate E/F** |
| **Peers retain an old alias after a local rename** | The module cannot reach a peer; anything a peer already holds (in a future exchange) is beyond local control, and no "delete on the peer" exists. Residual: stale copies persist once an exchange exists — disclosed. | **Gate H / Inherent** (no remote deletion) |
| **No remote acknowledgement of a rename** | There is no alias exchange protocol; a rename is a local presentation change only. Residual: once an exchange exists (Gate E), peers may ignore or lag a rename — an inherent distributed-state limit. | **Gate E** (no exchange) + **Inherent** |
| **Conflicting aliases across the user's own devices** | No cross-device synchronization exists (Gate H); the alias record is single-vault memory/null, so no alias↔binding map is published anywhere and devices are not reconciled. Residual: two devices can hold different aliases for the same binding — disclosed. | **Gate H** (sync deferred) + **Inherent** (distributed state) |
| **A malicious client ignores room alias policy** | Core composes strictest-wins policy locally ([`policy-composition.ts`](../../packages/rooms/src/policy-composition/policy-composition.ts)), but cannot compel a remote or modified client to honor it without a signed protocol. Residual: enforcement against a non-cooperating remote is Gate E/F — stated, not solved. | **Gate E/F** (no signed enforcement) + **Inherent** |
| **No signed membership / alias binding** | Alias authenticity and any membership↔alias binding proof are Gate F; this task derives no key material (`credentialState: "not_implemented_gate_f"`, [`identity-types.ts`](../../packages/identity/src/identity-types.ts)). Residual: until Gate F, no alias change or member↔name association can be cryptographically attributed — stated, not solved. | **Gate F** (authenticity deferred) |

---

## 7. Endpoint limits

The endpoint is outside the module's trust boundary. This section states that plainly rather than pretending otherwise.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Screenshot reveals aliases + the membership graph** | Screenshot / task-switcher preview blocking is an **external** Secure Device capability, hook-only in core; a `*_future_required` protected-content requirement denies display but claims no active capture protection ([`protected-content.ts`](../../packages/rooms/src/policy-composition/protected-content.ts)). Residual: screenshots can capture alias↔member mappings. | **External** (Secure Device) |
| **Compromised endpoint reads all room mappings** | On a compromised endpoint, memory-resident alias/binding state is readable regardless of module design; malware sees what the user sees. Residual: total — the endpoint boundary is not defended by core. | **External** (endpoint) |
| **Secure Device unavailable** (posture cannot be enforced) | Missing posture cannot *loosen* alias behavior — DevicePosture only tightens and a room requiring `basic+` denies content when no trusted provider exists ([`device-posture.ts`](../../packages/rooms/src/policy-composition/device-posture.ts), [`sensitive-room-admission.ts`](../../packages/rooms/src/secure-device/sensitive-room-admission.ts)); absence fails safe toward restriction, not a false "protected" claim. Residual: no endpoint hardening is provided by core. | **Policy** (fail toward restriction) + **External** |
| **Keyboard / input leakage** (a keylogger captures alias text as typed) | Secure-input protection is an external Secure Device capability, hook-only in core; the module never claims input-path protection. Residual: alias text can be captured at the keyboard. | **External** (Secure Device) |

---

## Explicitly NOT provided (read this)

**Stated plainly, without hedging:**

- **No cryptographic alias authenticity.** Room aliases are local, non-cryptographic presentation metadata. Nothing signs them, and nothing proves who set or changed a name. Authenticity is Gate F and is not present.
- **No full confusable protection.** The module applies baseline NFC normalization and rejects dangerous control characters (bidi overrides/isolates, C0/C1, selected zero-width/BOM). It does **not** perform full UTS #39 confusable/homograph adjudication; visually similar names can still be accepted. A confusable/mixed-script warning is a hint, never proof of impersonation.
- **No remote alias deletion.** Room aliases are local. There is no alias exchange, no distributed revocation, and no "delete on the peer." Anything a future exchange delivered would persist beyond local control.
- **No cross-device consistency.** There is no synchronization; two of the user's devices may hold different aliases for the same room binding. Reconciliation is Gate H and is not present.
- **No unlinkability guarantee.** Binding-scoping and opaque non-encoding ids reduce alias-driven cross-room correlation, but this is a structural/organizational property, not a cryptographic one. Reused text, reused avatars, reused behavior, or a compromised process can still correlate rooms.
- **No endpoint guarantee.** Screenshots, second devices, keyloggers, crash dumps, diagnostics, and swap are external (Secure Device) or inherent OS behavior. Memory/null retention does not stop them.

**And, stated as invariants:**

- **A room alias is not identity, not membership, not a role, not verification, not a `RoomMemberRef`, and not a global username.** It is a local presentation choice inside one room binding and must never be the sole basis for a sensitive confirmation; verification/continuity/key state carries that weight (Gate F).
- **A room role is not proof of identity.** Roles are RoomOS placeholders and role eligibility is necessary but never sufficient ([`membership-roles.ts`](../../packages/rooms/src/membership/membership-roles.ts)); membership itself is `unverified_placeholder` ([`membership-types.ts`](../../packages/rooms/src/membership/membership-types.ts)).
- **A name collision is not proof of impersonation**, and a unique name is not proof of authenticity. Disambiguation is required; sameness and uniqueness both mean nothing about identity.
- **DevicePosture is not identity.** It is an environment attribute that may only tighten and can never validate a name ([`device-posture.ts`](../../packages/rooms/src/policy-composition/device-posture.ts)).
- **Secure Device / ScreenShield is externalized.** Protected-presentation and posture elevation are separate projects; a `*_future_required` requirement denies content and claims no active protection.
- **Not safe for real secrets.** Until reviewed identity/crypto (Gate F) and, where relevant, an endpoint integration ship, room aliases must not be treated as a safe home for information whose exposure would cause real harm.
- **Deferred Gates E / F / G / H.** Remote/wire alias exchange (E), crypto / alias authenticity / verification / credentials (F), device authorization (G), and sync / distributed revocation / historical relabelling (H) are all out of scope for TECH-ID-06.

## Top threats — indicative severity / likelihood and resolving control

Severity and likelihood are **indicative pre-implementation judgments**, not measurements — they rank where design and test attention are most needed. "Resolved / bounded by" names the control (Design / Policy / Gate) that carries each item; none is claimed fully solved.

| # | Threat | Severity | Likelihood | Resolved / bounded by |
|---|--------|----------|------------|-----------------------|
| 1 | Alias id encodes room / root / membership, or an alias maps back to a private root — (1) | Critical | Low | **Design** (opaque non-encoding id; no root exposure); treat any encoding/derivation as a top-severity regression |
| 2 | Per-contact / persona alias auto-reused as a room alias re-links contexts — (1) | High | Medium | **Design** (no automatic reuse — explicit input or injected placeholder only) + **Inherent** (retyping) |
| 3 | Room alias treated as authority / role / membership / `RoomMemberRef` — (3) | High | Low | **Design + Policy** (id ≠ authority; membership-keyed; role from RoomOS, exact-scope `PolicyDecision`) |
| 4 | Alias rename resets suspension/block or transfers verification — (3) | High | Low | **Design** (state survives alias change; verification ≠ presentation) + **Gate F** |
| 5 | Confusable / bidi / invisible-char alias used to impersonate a member — (2) | High | Medium | **Design** (NFC + dangerous-control/bidi rejection) + **Inherent** (no full confusable detection) + **Gate F** |
| 6 | Alias shown without membership/assurance context; collision read as impersonation — (2) | High | Medium | **Design** (role/state/assurance as separate fields; disambiguation required) + **UX** |
| 7 | Room policy loosens Identity Firewall / Bunker shows aliases without protection — (5) | High | Low | **Policy** (strictest-wins; room policy may only tighten; future-required denies) + **External** |
| 8 | Historical messages relabelled with the newest alias — (4) | Medium | Low | **Gate F/H** (no signed binding history; no auto-rewrite) |
| 9 | Cross-room reuse diagnostics leak the room graph — (1) | Medium | Low | **Design** (local redacted warning; no room ids/counts) |
| 10 | Broad plaintext alias history leaks room participation — (4) | Medium | Medium | **Design** (memory/null; no history sink) + **External** (swap / crash dumps) |
| 11 | Local alias mistaken for an authenticated / deletable / synced remote profile — (6) | Medium | Medium | **Design** (local, unauthenticated) + **Gate E/F/H** (no exchange / authenticity / sync) |
| 12 | Endpoint compromise / screenshot reveals all alias↔member mappings — (7) | High | Medium | **External** (Secure Device) — not defended by core |

## References

- [TECH_ID_05_PER_CONTACT_ALIAS_THREAT_MODEL.md](TECH_ID_05_PER_CONTACT_ALIAS_THREAT_MODEL.md) — per-contact alias model; shared normalization, opaque-id, content-free-error, and local reuse-warning disciplines reused here.
- [TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md](TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md) — ephemeral identity model; independent roots and memory/null retention.
- [TECH_ID_06_PRECHECK.md](TECH_ID_06_PRECHECK.md) — TECH-ID-06 design decisions, stacked-dependency state, and the `roomAliasState` → `RoomAliasBindingStateV1` migration.
- [TECH_22_POLICY_COMPOSITION_GOVERNANCE_THREAT_MODEL.md](TECH_22_POLICY_COMPOSITION_GOVERNANCE_THREAT_MODEL.md) — room policy composition (strictest-wins / deny-overrides) and DevicePosture-tightens-only.
- [TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md) — sensitive-room admission gate and endpoint / Secure Device boundary (external project).
- [ADR-0013](../adr/ADR-0013-identity-firewall-architecture.md) — identifier model (§7), persona & alias model (§8), pairwise relationship model (§9), room-binding model (§10), rejected alternatives (§18: no `RoomMemberRef`-as-identity, no mandatory global username), deferred gates (§19).
- [ADR-0012](../adr/ADR-0012-endpoint-defense-layer.md) — endpoint defense / Secure Device externalization.
- [RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md) — the broader identity threat catalogue (correlation, impersonation, alias, abuse).
- [../IDENTITY_FIREWALL.md](../IDENTITY_FIREWALL.md) — invariants (DevicePosture ≠ identity; membership ≠ identity; not safe for real secrets).
