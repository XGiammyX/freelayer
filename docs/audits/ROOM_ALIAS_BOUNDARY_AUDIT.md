# Per-Room Alias Package-Boundary Audit (TECH-ID-06)

- **Date:** 2026-07-23
- **Branch:** `tech/identity-room-aliases-v1` (stacked on `tech/identity-contact-aliases-v1` / TECH-ID-05, PR #60)
- **Module:** `@freelayer/identity` → [`packages/identity/src/room-aliases/`](../../packages/identity/src/room-aliases) (14 files)

This audit covers the package/dependency boundary of the **per-room alias** module and proves it stays within its declared limits: **local, room-binding-scoped, non-cryptographic presentation metadata** — not identity, membership, a role, verification, a `RoomMemberRef`, or a global username; no network; no directory/search; no persistence; no confusable-safety claim; and DevicePosture / room role never authorize. A room presentation alias lives in a **separate** aggregate (`RoomAliasStateV1`) that references a `RoomIdentityBindingV1` **by id** — it is **not** stored on the binding record, **not** stored in `LocalIdentityVaultStateV1`, **not** a per-contact alias, and never mutates the binding, membership, or role. Companion notes: [TECH_ID_06_PRECHECK.md](TECH_ID_06_PRECHECK.md), threat model [TECH_ID_06_PER_ROOM_ALIAS_THREAT_MODEL.md](TECH_ID_06_PER_ROOM_ALIAS_THREAT_MODEL.md), main audit [TECH_ID_06_PER_ROOM_ALIASES_AUDIT.md](TECH_ID_06_PER_ROOM_ALIASES_AUDIT.md). House style follows [CONTACT_ALIAS_BOUNDARY_AUDIT.md](CONTACT_ALIAS_BOUNDARY_AUDIT.md) (TECH-ID-05).

## Desired dependency direction

```
apps → sdk/core Identity Firewall facade → @freelayer/identity (room-aliases module)
        → @freelayer/privacy (PolicyDecision, PolicySideEffectScope, PrivacyMode)
          + @freelayer/security (Brand, via ../identifiers)
        → room-alias policy + memory / null repository
        → a NARROW, read-only RoomOS membership/binding read model
          (RoomLocalIdRef / RoomMembershipIdRef + mirrored role/state values)
RoomOS / UI ──(narrow policy-safe display results only)──▶ room member display context
```

The room-alias module depends **only** on `@freelayer/privacy` (`PolicyDecision`/`isPolicyDecision`, `PolicySideEffectScope`, `PrivacyMode`), sibling identity types/identifiers (`../identifiers`, `../identity-types`), the reused TECH-ID-05 normalization value (`../aliases` — `normalizeContactAliasDisplayTextV1`, `ContactAliasTextV1`), and, transitively via `../identifiers`, `@freelayer/security` (`Brand`). It imports **no** UI, **no** network transports, **no** Crypto implementation, **no** Secure Device / DevicePosture / ScreenShield implementation, and — the crown-jewel rule of this task — **it never imports `@freelayer/rooms`.**

Because RoomOS is the authority for membership, role, and room graph, the module must read a small slice of that state to disambiguate names and surface honest context. It does so through a **mirror, not an import**: `RoomOsMembershipRoleV1` (`owner_placeholder`/`editor_placeholder`/`viewer_placeholder`/`auditor_placeholder`) and `RoomOsMembershipStateV1` (`active_local_unverified`/`suspended_local`/`removed_tombstone`) are declared locally in [`room-alias-types.ts`](../../packages/identity/src/room-aliases/room-alias-types.ts) as a caller-supplied **read model**, and rooms are referenced only through the narrow identity-local brands `RoomLocalIdRef` / `RoomMembershipIdRef` (`../identifiers`). RoomOS maps its own `RoomLocalId` / `RoomMemberRef` onto these at the boundary; a room alias is never a `RoomMemberRef`. The reducer takes a resolved, validated `RoomAliasBindingRefV1` and matches it against the command, but writes only alias records ([`room-alias-reducer.ts`](../../packages/identity/src/room-aliases/room-alias-reducer.ts)) — it performs **no** direct RoomOS membership mutation.

## Separate alias aggregate / repository — isolation rationale

Room presentation aliases are held in a **separate** `RoomAliasStateV1` (`persistenceClass: "memory_only" | "null"`), served by a **separate** `RoomAliasRepositoryV1` (`InMemory` = current-process memory, or `Null`). They are never added to the binding record, `RoomIdentityBindingV1`, or `LocalIdentityVaultStateV1`. Deliberate isolation, not incidental layering:

- **Rotation cannot disturb the binding, membership, or role.** Because the alias references the binding by id and lives in its own aggregate, rotating/retiring an alias never rewrites the binding lifecycle, membership state, role, or assurance (`RoomAliasRotationResultV1 { roomBindingPreserved: true, membershipPreserved: true, membershipRoleChanged: false, assuranceChanged: false }` — [`room-alias-reducer.ts`](../../packages/identity/src/room-aliases/room-alias-reducer.ts)). Membership and role live on RoomOS; the alias cannot touch them.
- **Invariant separation.** The binding record reserves alias ownership with a `roomAliasState` that migrated from the `"not_implemented_tech_id_06"` placeholder to `RoomAliasBindingStateV1 = "none" | "local_alias_v1" | "retired"` ([`identity-types.ts`](../../packages/identity/src/identity-types.ts)); the alias record carries the presentation invariants (`sharingState: "not_shared_tech_id_06"`, `authenticatedBinding: "not_implemented_gate_f"`, `remoteUpdateState: "not_implemented_gate_e_f_h"`). The alias **record** is authoritative; `roomAliasState` is a **derived hint** (`deriveRoomAliasBindingStateV1` — [`room-alias-summary.ts`](../../packages/identity/src/room-aliases/room-alias-summary.ts)), never a second source of truth.
- **Fail-closed blast radius.** A bug in one path cannot leak an alias into the identity vault or the binding record, or vice versa; each repository accepts only its own aggregate type and only an `identity.room_alias.*`-scoped decision.
- **Honest, atomic-within-its-own-store removal.** Retiring/rotating an alias is a revision-checked reducer step; there is nothing to reconcile against a retained binding aggregate, and no cross-package atomicity is claimed (see the honest note below).

## What a consumer (RoomOS / UI) may consume (narrow, safe)

Only a policy-safe result surface, mapped by the (future) facade — never the internal aggregate:

- a **redacted room member display context** (`RoomMemberDisplayContextV1`) that returns `membershipRole` / `membershipState` / `identityAssurance` as **separate structured fields** from alias text, fixes `aliasVerified: false` / `realWorldIdentityVerified: false` / `cryptographicBindingAvailable: false` / `authorityDerivedFromAlias: false`, carries `aliasScope: "this_room_only"`, forces a safe `disambiguation` strategy on a duplicate, and omits the room id + alias text in strict modes — built only with its own `identity.room_alias.display_context.read` decision ([`room-alias-summary.ts`](../../packages/identity/src/room-aliases/room-alias-summary.ts));
- a **room-local collision assessment** (`RoomAliasCollisionAssessmentV1`) that is a transient nudge with `exactCollisionCountExposed: false` / `collidingMemberIdsExposed: false` / `impersonationProven: false`;
- a **cross-room reuse warning** (`RoomAliasReuseAssessmentV1`) with `affectedRoomIdsExposed: false` / `affectedRoomCountExposed: false` / `unlinkabilityGuaranteed: false`;
- a **rotation result** (`RoomAliasRotationResultV1`) disclosing honestly what rotation does **not** do (`remoteCopiesAffected: false`, `authenticatedRemoteUpdatePerformed: false`, `historicalMessagesRelabelled: false`);
- a **redacted audit event** (`RoomAliasAuditEventV1 { redacted: true }`) — category + outcome + reason code only.

To avoid an `identity ↔ rooms` cycle, the room-alias module uses only the narrow identity-local brands and the mirrored role/state read model; RoomOS or the facade maps its own ids and supplies the authoritative membership snapshot at the boundary. A `RoomMembershipId` / room role is **not** an alias authority and is **not** identity.

## What must NEVER cross the boundary

- the **raw alias aggregate** — the repository `#state`, defensive-clone behavior, `read`/`replace`/`clear` (each gated on an authentic `identity.room_alias.*` decision);
- **alias display text** to peers, rooms, notifications, telemetry, logs, or persistent storage (text is sensitive room/relationship metadata);
- the **private root id / persona label / peer-facing root material** — an alias never exposes, derives from, or serializes it; ids are opaque and non-derived ([`room-alias-identifiers.ts`](../../packages/identity/src/room-aliases/room-alias-identifiers.ts));
- a **per-contact alias** (TECH-ID-05 `PairwisePresentationAliasV1`) — there is no code path that copies a contact alias into a room binding; the validator rejects `copyFromContact` / `contactAliasId` / `copyFromRoom` fields ([`room-alias-validation.ts`](../../packages/identity/src/room-aliases/room-alias-validation.ts));
- a **reuse / collision map, alias history, or local member label** — no cross-room reuse index, no collision index, and no alias-history sink is ever persisted ([`room-alias-collision.ts`](../../packages/identity/src/room-aliases/room-alias-collision.ts), [`room-alias-repository.ts`](../../packages/identity/src/room-aliases/room-alias-repository.ts)); a private per-member note is explicitly out of scope for this task;
- a **RoomOS membership / role mutation** — the identity package never mutates membership, suspends, sets a role, tombstones, or persists a room graph; the guardrail's `MEMBERSHIP_MUTATION_RE` bans it inside the module;
- **future secrets / key material** — `authenticatedBinding` / `cryptographicBindingAvailable` are `not_implemented` / `false` markers (Gate F), never key bytes or signatures.

## No peer-facing text, no side effects, no automatic mutation

The room-alias module performs no storage/network/notification/AI/crypto/randomness. It never sends alias text anywhere. Creating or rotating an alias does not create, alter, or revoke a RoomOS membership or role and does not touch the binding record. There is no directory, no search, no global username, and no remote exchange; rotation discloses `remoteCopiesAffected: false`. A room alias is never seeded automatically from a persona label, another room, the root id, or a `RoomMemberRef` — it comes only from explicit user input or an injected placeholder (`origin: "user_supplied_local" | "injected_generated_placeholder"`). DevicePosture and room role can only **restrict** via policy — they never validate, sign, or bless alias text, and appear only as rejected caller fields in validation.

## Honest note on the read-model coupling (unavoidable)

Unlike the per-contact alias module, the room-alias module cannot be fully self-contained: correct disambiguation and honest display require the **current RoomOS membership/role/state** for the room, which RoomOS owns. The module keeps this coupling as narrow and one-directional as possible — a **read-only, caller-supplied** snapshot (`RoomAliasBindingRefV1` + `RoomAliasObservationV1` + the mirrored role/state values), never an import, never a write path. The consequence, disclosed rather than hidden: there is **no true cross-package atomicity**. A membership can change in RoomOS between the moment the caller resolves the snapshot and the moment the alias operation commits; the alias record stays authoritative for the *name*, RoomOS stays authoritative for *membership*, and the binding's `roomAliasState` is only a derived hint. The pipeline's documented ordering (validate → caller-resolved RoomOS snapshot → resolve room-alias policy → exact-scope `PolicyDecision` obtained after room admission where required → reduce → persist) narrows, but cannot cryptographically close, this window; genuine binding-authenticity and synchronized revocation are Gate F/H.

## Boundary summary

| Boundary | Rule | Allowed flow | Never crosses | Status |
| --- | --- | --- | --- | --- |
| Room-aliases module → `@freelayer/rooms` | forbidden (avoid cycle) | mirrored role/state read model + narrow id brands | any `@freelayer/rooms` import | architecture-rule (guardrail + mirror types) |
| Room-aliases module → UI / transports / crypto / Secure Device | forbidden | (none) | UI, network, crypto, DevicePosture, ScreenShield imports | enforced (`check:no-room-alias-bypass` + no such imports) |
| Alias aggregate vs binding record / identity vault | separate stores | alias record ↔ `RoomAliasRepositoryV1` only | alias onto `RoomIdentityBindingV1` / into `LocalIdentityVaultStateV1` | enforced (distinct type + repo; ref-by-id; derived `roomAliasState`) |
| Binding / membership / role mutation from alias op | forbidden | validated read-only `RoomAliasBindingRefV1` | any write to binding lifecycle / membership / role / assurance | enforced (reducer writes only alias records; `MEMBERSHIP_MUTATION_RE`) |
| Per-contact alias → room alias | forbidden (no auto reuse) | explicit user input / injected placeholder only | copying `PairwisePresentationAliasV1` into a room | enforced (validator rejects `copyFromContact`/`contactAliasId`; guardrail) |
| RoomOS / UI ← alias results | narrow result types only | display context, collision/reuse warnings, rotation result, redacted audit | raw aggregate, repository internals, root id, persona label, key material | architecture-rule (facade not yet wired) |
| RoomOS membership/role read model → alias module | read-only mirror | caller-supplied snapshot (`RoomAliasBindingRefV1` + observations) | any write back; any `@freelayer/rooms` symbol | enforced (mirror types; no import) |
| Alias text → disk / network / logs / telemetry / notifications | forbidden | memory or null retention only | disk / localStorage / sessionStorage / IndexedDB / DB / fetch / WS / console | enforced (`check:no-room-alias-bypass` + repository types + content-free errors) |
| Public directory / username search / room-alias lookup | forbidden | (none — no such surface) | any directory / search / lookup / global-username path | enforced (no code + Policy Matrix `deny` + guardrail) |
| Remote sharing / authenticated update / sync / historical relabel | not implemented | (none — local-only) | any exchange / signed update / sync / relabel path | future-gate (`remote_sharing` not_implemented; Gate E/F/H) |
| Cryptographic binding / confusable-safety claim | not implemented / not claimed | opaque non-derived id; NFC + control/bidi rejection | key bytes, signatures, "spoof-proof"/full-confusable/unlinkable claim | enforced (markers `false`; guardrail bans overclaim) |
| DevicePosture / room role as identity/authority | forbidden | posture/role may only RESTRICT via policy | posture/role as an authority or verifier of an alias | enforced (policy tighten-only + rejected caller fields + guardrail) |

## Honest enforcement status

- **Enforced today:** dependency set (privacy + security + sibling identity types + reused TECH-ID-05 normalization only), no `@freelayer/rooms` import, no-transport/UI/crypto/Secure-Device imports, memory/null-only storage, separate aggregate with binding-by-reference (no binding/membership/role rewrite), no direct RoomOS membership mutation, no automatic reuse from contact aliases / persona / other rooms / root / `RoomMemberRef`, exact-scope `identity.room_alias.*` `PolicyDecision` on every pipeline and repository op (re-checked by `isAuthentic`, which requires the `identity.room_alias.` prefix), the five structural Policy Matrix denies/future-gates, and the `check:no-room-alias-bypass` static guardrail (wired into `audit:privacy` + CI, with a `tests/fixtures/room-alias-bypass/` fixture). Sentinel, structural-absence, and not-identity traps cover the module.
- **Architecture-rule (not yet code-enforced end to end):** RoomOS / UI does **not** yet consume the room-alias module — **no facade is wired.** The narrow display-result surface and the read-only membership/role read model are documented and structurally supported (result types exist; role/state/assurance are returned separately from text), but the sdk/core Identity Firewall facade that maps RoomOS ids ↔ alias results is a later task (Gate G). Until then, "what a consumer may consume" describes the intended contract, not a live integration.
- **Future-gate:** cryptographic alias authenticity / key continuity is Gate F; wire formats / remote room-alias exchange Gate E; synchronization / distributed revocation / historical-message relabelling Gate H. This module claims none of them, and no external Secure Device / Endpoint Defense capability is implemented in core — only contracts, policy inputs, and honest disclosures.

## Unresolved dependency direction (honest)

As in TECH-ID-03/04/05, no shared-contract package was introduced for room references; the identity-local brands plus the mirrored RoomOS role/state read model suffice. The room-alias module's one honest concession is that it must **read** a slice of RoomOS-owned membership/role state to disambiguate and display, which it does through a caller-supplied read model rather than an import — accepting the lack of true cross-package atomicity in exchange for a clean, cycle-free dependency graph. If a future task needs bidirectional room↔identity↔alias types, extract a `@freelayer/contracts` package and move the ref brands + role/state mirror there. The alias↔RoomOS/UI integration remains a later task; this audit fixes the boundary it must honor when it lands — above all, that a room alias is local presentation, that identity never imports or mutates RoomOS, and that neither the alias nor a room role is identity, membership, verification, or authority.
