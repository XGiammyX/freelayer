# TECH-ID-06 — Per-Room Aliases — Precheck

**Status legend:** `present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## 1. Repository state

| Item | Value |
| --- | --- |
| Branch (work) | `tech/identity-room-aliases-v1` |
| Base branch | `tech/identity-contact-aliases-v1` (TECH-ID-05, PR #60, **open/unmerged**) |
| Base SHA | `918c09c` (`feat(identity): add per-contact alias foundations`) |
| Working tree at branch point | clean |
| Stacked dependency | **stacked dependency** — TECH-ID-06 stacks on TECH-ID-05, which stacks on TECH-ID-04 (`tech/identity-ephemeral-v1`, PR #59-era) → TECH-ID-03 → ADR-0013 → RESEARCH-ID-01 |

Hosted CI runs only on `main`-targeted PRs, so this stacked PR is verified **locally**.

## 2. Prerequisite status

| Prerequisite | Status | Evidence |
| --- | --- | --- |
| TECH-ID-02 — Identity Architecture ADR | `present` | `docs/adr/ADR-0013-identity-firewall-architecture.md` (Accepted); remains current |
| TECH-ID-03 — Local Identity Scaffolding | `present` | `packages/identity/src/` roots/personas/relationships/room-bindings + validators + reducer + policy |
| TECH-ID-04 — Ephemeral Identity | `present` | `packages/identity/src/ephemeral/` independent current-process roots + `EphemeralRoomIdentityBindingV1` |
| TECH-ID-05 — Per-Contact Aliases | `present` (unmerged) | `packages/identity/src/aliases/` — reused here for text normalization |
| Identity Firewall package | `present` | `@freelayer/identity` (deps: `@freelayer/privacy`, `@freelayer/security` only) |
| RoomOS membership + role model | `present` | `packages/rooms/src/membership/` — `RoomMembershipId`, `RoomMembershipRoleV1` (owner/editor/viewer/auditor placeholders), `RoomMembershipStateV1` (active_local_unverified/suspended_local/removed_tombstone) |
| Room identity binding | `present` | `packages/identity/src/identity-types.ts` — `RoomIdentityBindingV1` with placeholder `roomAliasState: "not_implemented_tech_id_06"` |

## 3. Cross-package types the room-alias module must reference

| Type | Home | Note |
| --- | --- | --- |
| `LocalIdentityRootId`, `IdentityPersonaId`, `RoomIdentityBindingId`, `IdentityLocalRevision` | `packages/identity/src/identifiers.ts` | branded, opaque, validated |
| `RoomLocalIdRef`, `RoomMembershipIdRef` | `packages/identity/src/identifiers.ts` | **narrow identity-local refs to RoomOS ids (avoid circular dep)** |
| `IdentityAssuranceStateV1` | `packages/identity/src/identity-types.ts` | reused directly |
| `ContactAliasTextV1`, `ContactAliasDisplayText`, `normalizeContactAliasDisplayTextV1` | `packages/identity/src/aliases/` (TECH-ID-05) | **reused, not duplicated** |
| `RoomMembershipRoleV1`, `RoomMembershipStateV1` | `packages/rooms/src/membership/` | **mirrored as a narrow local read-model contract** in the room-alias module (identity must NOT import `@freelayer/rooms`) |

## 4. Determinations

1. **TECH-ID-03/04/05 complete** — `present`. TECH-ID-05 is complete but unmerged (branch from it; stacked PR base = `tech/identity-contact-aliases-v1`).
2. **ADR current** — `present`. ADR-0013 already anticipates room-scoped aliases (`RoomIdentityBinding`).
3. **RoomOS membership + room identity bindings exist** — `present` (see §2).
4. **Per-contact aliases leak into rooms?** — `not applicable` / no. TECH-ID-05 aliases are relationship-scoped (`PairwisePresentationAliasV1`, `sharingState:"not_shared_tech_id_05"`); there is no code path that reuses a contact alias as a room alias. TECH-ID-06 forbids such reuse by construction (§15).
5. **`displayName`/`alias`/`nickname`/`memberName`/`roomProfile` used inconsistently?** — `not applicable`. RoomOS `RoomMembershipRecordV1` carries **no** display name (explicitly "no display name/email/phone/…"); there is no `roomProfile`/`nickname`/`memberName` field anywhere. Room-alias presentation is introduced here for the first time, cleanly separated from membership.
6. **Any existing room alias grants role/membership/verification?** — no. `RoomIdentityBindingV1.roomAliasState` is a `"not_implemented_tech_id_06"` placeholder with no authority; roles come only from `RoomMembershipRoleV1` via the RoomOS ABAC table + exact-scope `PolicyDecision`.
7. **TECH-ID-06 branch/PR already exists?** — `missing` (this is the first). No duplicate.
8. **Schema changes require a version/migration?** — `partial`. `RoomIdentityBindingV1.roomAliasState` (and the ephemeral `EphemeralRoomIdentityBindingV1.roomAliasState`) migrate from the literal `"not_implemented_tech_id_06"` to a new `RoomAliasBindingStateV1 = "none" | "local_alias_v1" | "retired"` (default `"none"`). This is a **local, memory-only, unreleased** schema; the change is additive-in-spirit (a placeholder literal widened to a real union). Construction sites: `identity-reducer.ts` (2), `ephemeral-reducer.ts` (1); assertion sites: `scaffolding.test.ts` (1). No persisted data exists to migrate.

## 5. Policy / retention / guardrails baseline

| Item | Status |
| --- | --- |
| Policy Matrix | `present` — 241 specs → 1687 rules (post TECH-ID-05); TS mirrored to `docs/policy-matrix.v1.json` via sync test |
| Memory/Null retention | `present` — established pattern (identity + contact aliases) |
| Exact-scope `PolicyDecision` | `present` — `issuePolicyDecision`/`isPolicyDecision`, module-private provenance |
| Existing guardrails | `present` — `check:no-identity-scaffolding-bypass`, `check:no-ephemeral-identity-bypass`, `check:no-contact-alias-bypass`, `check:no-roomos-bypass`, `check:no-room-membership-bypass`, `check:no-room-authorization-bypass`, `check:no-secure-device-core-implementation`, `check:identity-docs`, `check:policy-*` |
| Secure Device separation | `present` — externalized; core keeps contracts/policy inputs/honest disclosures only (`check:no-secure-device-core-implementation` enforces) |

## 6. Blockers

**None.** All prerequisites are `present`. Proceed with TECH-ID-06 on a stacked branch. Consistency limitation (documented, not simulated): true cross-package atomicity between the Identity Firewall alias record and RoomOS membership is unavailable; the alias record stays authoritative in the Identity Firewall and the binding's `roomAliasState` is a derived hint (§14/§27).
