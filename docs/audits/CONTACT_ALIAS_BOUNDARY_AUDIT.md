# Per-Contact Alias Package-Boundary Audit (TECH-ID-05)

- **Date:** 2026-07-23
- **Branch:** `tech/identity-contact-aliases-v1` (stacked on `tech/identity-ephemeral-v1` / ADR-0013)
- **Module:** `@freelayer/identity` → [`packages/identity/src/aliases/`](../../packages/identity/src/aliases) (14 files)

This audit covers the package/dependency boundary of the **per-contact alias** module and proves it stays within its declared limits: **local, non-cryptographic presentation metadata** — not identity, verification, or authentication; no network; no directory/search; no persistence; no confusable-safety claim; and DevicePosture / room role never authorize. Aliases live in a **separate** aggregate (`ContactAliasStateV1`) that references a relationship **by id** — they are **not** stored in `LocalIdentityVaultStateV1`, **not** stored in the ephemeral vault, and never rewrite the relationship record. Companion notes: [TECH_ID_05_PRECHECK.md](TECH_ID_05_PRECHECK.md), threat model [TECH_ID_05_PER_CONTACT_ALIAS_THREAT_MODEL.md](TECH_ID_05_PER_CONTACT_ALIAS_THREAT_MODEL.md), main audit [TECH_ID_05_PER_CONTACT_ALIASES_AUDIT.md](TECH_ID_05_PER_CONTACT_ALIASES_AUDIT.md). House style follows [EPHEMERAL_IDENTITY_BOUNDARY_AUDIT.md](EPHEMERAL_IDENTITY_BOUNDARY_AUDIT.md) (TECH-ID-04).

## Desired dependency direction

```
apps → sdk/core Identity Firewall facade → @freelayer/identity (aliases module)
        → @freelayer/privacy (PolicyDecision, PolicySideEffectScope, PrivacyMode)
          + @freelayer/security (Brand, via ../identifiers)
        → alias policy + memory / null repository
RoomOS / UI ──(narrow safe display results only)──▶ alias display context
```

The alias module depends **only** on `@freelayer/privacy` (`PolicyDecision`/`isPolicyDecision`, `PolicySideEffectScope`, `PrivacyMode`), sibling identity types/validators (`../identifiers`, `../identity-types`), and, transitively via `../identifiers`, `@freelayer/security` (`Brand`). It imports **no** UI, **no** network transports, **no** Crypto implementation, **no** Secure Device / DevicePosture / ScreenShield implementation, and it never imports `@freelayer/rooms`. It mutates **no** relationship record: the reducer takes a resolved, validated `ContactAliasRelationshipRefV1` and matches it against the command, but writes only alias/label records ([`alias-reducer.ts`](../../packages/identity/src/aliases/alias-reducer.ts)).

## Separate alias aggregate / repository — isolation rationale

Aliases and labels are held in a **separate** `ContactAliasStateV1` (`persistenceClass: "memory_only" | "null"`), served by a **separate** `ContactAliasRepositoryV1` (`InMemory` = current-process memory, or `Null`). They are never added to `LocalIdentityVaultStateV1` and never travel the ephemeral vault. Deliberate isolation, not incidental layering:

- **Rotation cannot disturb the relationship.** Because the alias references the relationship by id and lives in its own aggregate, rotating/retiring an alias never rewrites the relationship's lifecycle, assurance, block, or trust state (ADR-0013 §9; `ContactAliasRotationResultV1 { blockStateChanged: false, trustStateChanged: false }`).
- **Invariant separation.** The relationship record reserves alias ownership with `aliasState: "not_implemented_tech_id_05"`; the alias record carries the presentation invariants (`sharingState: "not_shared_tech_id_05"`, `authenticatedBinding: "not_implemented_gate_f"`). Each set is validated exhaustively without "not applicable here" branches.
- **Fail-closed blast radius.** A bug in one path cannot leak an alias into the identity vault or vice versa; each repository accepts only its own aggregate type and only an `identity.alias.*`-scoped decision.
- **Honest, atomic removal.** Clearing a label removes the record (no retained text); retiring/rotating an alias is a revision-checked reducer step — nothing to reconcile against a retained relationship aggregate.

## What a consumer (UI / RoomOS) may consume (narrow, safe)

Only a policy-safe result surface, mapped by the (future) facade — never the internal aggregate:

- a **redacted display context** (`ContactDisplayContextV1`) that returns `relationshipAssurance` / `relationshipLifecycle` **separately** from alias text, fixes `aliasVerified: false` / `realWorldIdentityVerified: false` / `cryptographicBindingAvailable: false`, and redacts the relationship id + labels in strict modes — obtained only with its own `identity.alias.display_context.read` decision ([`alias-summary.ts`](../../packages/identity/src/aliases/alias-summary.ts));
- a **local reuse warning** (`AliasReuseAssessmentV1`) that is a boolean-style nudge with `relationshipIdsExposed: false` / `otherRelationshipCountExposed: false`;
- a **rotation result** (`ContactAliasRotationResultV1`) disclosing honestly what rotation does **not** do (`remoteCopiesAffected: false`, `authenticatedRemoteUpdatePerformed: false`);
- a **redacted audit event** (`ContactAliasAuditEventV1 { redacted: true }`) — category + outcome + reason code only.

To avoid an `identity ↔ rooms` cycle, the alias module (like TECH-ID-03/04) uses only narrow identity-local brands; RoomOS or the facade maps its own ids at the boundary. A `RoomMembershipId` / room role is **not** an alias authority and is **not** identity.

## What must NEVER cross the boundary

- the **raw alias aggregate** — the repository `#state`, defensive-clone behavior, `read`/`replace`/`clear` (each gated on an authentic `identity.alias.*` decision);
- **alias / label display text** to peers, rooms, notifications, telemetry, logs, or persistent storage (text is sensitive `pairwise_relationship` metadata; ADR-0013 §16);
- a **local peer label** to any peer-facing surface — it is `visibility: "local_only"`, `peerShared: false`, and any code path that would place it on a peer-bound surface fails (`local_peer_label_visibility`);
- the **private root id / peer-facing root material** — an alias never exposes, derives from, or serializes it; ids are opaque and non-derived ([`alias-identifiers.ts`](../../packages/identity/src/aliases/alias-identifiers.ts));
- **future secrets / key material** — `authenticatedBinding` / `cryptographicBindingAvailable` are `not_implemented` / `false` markers (Gate F), never key bytes or signatures.

## No peer-facing local peer label, no side effects, no automatic mutation

The alias module performs no storage/network/notification/AI/crypto/randomness. It never sends a local peer label anywhere. Creating or rotating an alias does not create, alter, or revoke a RoomOS membership and does not touch the relationship record. There is no directory, no search, no global username, and no remote exchange; rotation discloses `remoteCopiesAffected: false`. DevicePosture and room role can only **restrict** via policy — they never validate, sign, or bless alias text, and appear only as rejected caller fields in validation.

## Boundary summary

| Boundary | Rule | Allowed flow | Never crosses | Status |
| --- | --- | --- | --- | --- |
| Aliases module → `@freelayer/rooms` | forbidden (avoid cycle) | narrow identity-local id brands | any `@freelayer/rooms` import | architecture-rule (guardrail + side-effect trap) |
| Aliases module → UI / transports / crypto / Secure Device | forbidden | (none) | UI, network, crypto, DevicePosture, ScreenShield imports | enforced (`check:no-contact-alias-bypass` + side-effect test) |
| Alias aggregate vs identity / ephemeral vault | separate stores | alias record ↔ `ContactAliasRepositoryV1` only | alias into `LocalIdentityVaultStateV1` / ephemeral vault; relationship rewrite | enforced (distinct type + repo; ref-by-id) |
| Relationship record mutation from alias op | forbidden | validated `ContactAliasRelationshipRefV1` (read-only) | any write to lifecycle / block / trust / assurance | enforced (reducer writes only alias/label records) |
| RoomOS / UI ← alias results | narrow result types only | display context, reuse warning, rotation result, redacted audit | raw aggregate, repository internals, root id, key material | architecture-rule (facade not yet wired) |
| Local peer label → peer / room surface | forbidden | local-only recognition aid | label onto any peer-facing surface | enforced (`local_only` / `peerShared: false`; `local_peer_label_visibility`) |
| Alias / label text → disk / network / logs / telemetry / notifications | forbidden | memory or null retention only | disk / localStorage / sessionStorage / IndexedDB / DB / fetch / WS / console | enforced (`check:no-contact-alias-bypass` + repository types + content-free errors) |
| Public directory / username search / global handle | forbidden | (none — no such surface) | any directory / search / global-username path | enforced (no code + Policy Matrix `deny` + guardrail) |
| Remote sharing / authenticated update / sync | not implemented | (none — local-only) | any exchange / signed update / sync path | future-gate (`remote_sharing_unavailable` / `authentication_unavailable`; Gate E/F/H) |
| Cryptographic binding / confusable-safety claim | not implemented / not claimed | opaque non-derived id; NFC + control rejection | key bytes, signatures, "spoof-proof"/full-confusable claim | enforced (markers `false`; guardrail bans overclaim) |
| DevicePosture / room role as identity/authority | forbidden | posture may only RESTRICT via policy | posture/role as an authority or verifier of an alias | enforced (policy tighten-only + rejected caller fields + guardrail) |

## Honest enforcement status

- **Enforced today:** dependency set (privacy + security + sibling identity types only), no-transport/UI/crypto/Secure-Device imports, memory/null-only storage, separate aggregate with relationship-by-reference (no relationship rewrite), exact-scope `identity.alias.*` `PolicyDecision` on every repository and pipeline op (re-checked by `isAuthentic`), the six structural Policy Matrix denies/future-gates, and the `check:no-contact-alias-bypass` static guardrail (wired into `audit:privacy` + CI, with a `tests/fixtures/contact-alias-bypass/` fixture). Sentinel, side-effect, and not-identity traps cover the module.
- **Architecture-rule (not yet code-enforced end to end):** RoomOS / UI does **not** yet consume the alias module — **no facade is wired**. The narrow display-result surface and "no local peer label to peers" rule are documented and structurally supported (result types exist; assurance is returned separately from text), but the sdk/core Identity Firewall facade that maps RoomOS ids ↔ alias results is a later task (Gate G). Until then, "what a consumer may consume" describes the intended contract, not a live integration.
- **Future-gate:** cryptographic alias authenticity / key continuity is Gate F; wire formats / remote alias exchange Gate E; synchronization / distributed alias revocation Gate H. This module claims none of them, and no external Secure Device / Endpoint Defense capability is implemented in core — only contracts, policy inputs, and honest disclosures.

## Unresolved dependency direction (honest)

As in TECH-ID-03/04, no shared-contract package was introduced for room references; the identity-local brands suffice. If a future task needs bidirectional room↔identity↔alias types, extract a `@freelayer/contracts` package and move the ref brands there. The alias↔RoomOS/UI integration remains a later task; this audit fixes the boundary it must honor when it lands — above all, that an alias is local presentation, a local peer label is never peer-facing, and neither is identity, verification, or authority.
