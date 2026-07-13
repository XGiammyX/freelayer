# TECH-20 — Membership + Capability Scaffolding Audit

_Branch: `tech/roomos-membership-capabilities` (from `main` @ `7405ac0`, not stacked — TECH-16/17/18/19 all merged). Date: 2026-07-13._

## Precondition / commands

Foundations verified `present` — [TECH_20_PRECHECK.md](TECH_20_PRECHECK.md). Commands run green: typecheck · lint · **481 tests** · build (15/15) · `check:no-room-membership-bypass` (new) · `check:no-room-query-bypass` · `check:no-room-object-bypass` · `check:no-roomos-bypass` · `check:policy-matrix` (149 specs → 1043 rules) · `check:policy-conflicts` · `check:policy-docs` · `check:boundaries` · `audit:privacy` · `audit:supply-chain`.

## Architecture decisions (recorded)

- Membership events use a dedicated `RoomMembershipEventV1` envelope + parallel memory/null log (same precedent as TECH-18/19), avoiding destabilization of the TECH-17 event union.
- Membership records are held on `RoomMaterializedState.membershipRecords` (optional, memory-only) so pre-membership construction stays valid and existing tests are unaffected.
- The pipeline signature uses `RoomMembershipLog` / `RoomMembershipEventV1` (documented deviation from the prompt's `RoomOperationLog`/`RoomOperationEventV1` suggestion; the invariants are identical).

## Research summary

NIST ABAC (role is one attribute among subject/object/operation/environment); OWASP (deny-by-default, authorize every op, IDs confer no authority); Zanzibar prior art with explicit rejection of a centralized authz service/global relationship DB; object-capability least authority (no ambient authority, attenuation only, non-forgeable-not-claimed); local-first membership (one projection, local revocation only). → [../research/ROOMOS_MEMBERSHIP_CAPABILITY_RESEARCH.md](../research/ROOMOS_MEMBERSHIP_CAPABILITY_RESEARCH.md). Threat model → [TECH_20_MEMBERSHIP_CAPABILITY_THREAT_MODEL.md](TECH_20_MEMBERSHIP_CAPABILITY_THREAT_MODEL.md). (Internet unavailable → verification-pending marker.)

## Created / modified

**Created** (`packages/rooms/src/membership/`, 18 modules): errors, ids, roles, capability-types, membership-types, capability-resolution, capability-attenuation, authorization-context, membership-commands, membership-policy, membership-events, membership-reducer, membership-log, membership-pipeline, membership-redaction, membership-queries, index. Plus `scripts/check-no-room-membership-bypass.mjs`, a fixture, 2 test files, 5 docs.
**Modified:** rooms `index.ts` (export membership), `room-state.ts` (+`membershipRecords`), privacy `index.ts` (+11 scopes), `policyMatrix.ts` (+18 rows), matrix JSON (149/1043), `package.json` + `ci.yml` (guardrail), 14 model docs.

## Status highlights

- **Membership schema/lifecycle:** versioned record; opaque IDs; positive local revision; `verification: "unverified_placeholder"`; explicit lifecycle machine (tombstone terminal); duplicate active room/member rejects.
- **Roles:** conservative placeholders; explicit role→capability eligibility table; role eligibility necessary, never sufficient; owner-placeholder documented as not cryptographic ownership.
- **Capability taxonomy/descriptor:** 19 narrow capabilities; no wildcard; descriptor `authoritative:false`, serialization/persistence forbidden, delegation not implemented; bound to room+membership+revision.
- **Attenuation:** narrow-only (`isRoomCapabilitySubsetV1`); widening / object-kind widening / exact-object removal / view widening all reject.
- **Revocation/staleness:** currency binding rejects role/state/revision/room drift; local revocation only (documented, not distributed).
- **Owner continuity:** last active owner cannot be removed/suspended/demoted; a second owner unblocks it.
- **Authorization:** `assertRoomAuthorizationContextV1` requires current membership + current descriptor + authentic exact-scope decision; forged descriptor + no decision fails; wrong-scope/denied reject.
- **Pipeline:** validate → room match → membership policy → matrix → (bootstrap exact decision + empty | authorization context) → revision → owner-continuity → build event → separate storage decision → memory/null log → pure reducer; no partial mutation.
- **Queries:** redacted list/get/count with own scopes; never return identity/presence/descriptor; count off by default.
- **Policy integrations:** 18 matrix rows; StoragePolicy (memory/null; capability persist deny); MetadataPolicy agreement; device-risk tightens only; endpoint never active.

## Tests added

21 new (**481 total**) covering §35 invariants: bootstrap/lifecycle/revisions, owner continuity, per-mode behavior, redacted queries, determinism + reducer purity, capability resolution/currency/attenuation/subset, authorization (fake/denied/wrong-scope/descriptor-alone), command validation (unknown/proto/authority-field), leak-freedom, guardrail + import hygiene.

## Known limitations

Membership is local and unverified (Gate G); capabilities are non-authoritative descriptors (a real runtime is Gate B); no cryptographic ownership (Gate F); no distributed revocation (Gate H — local removal ≠ global); no invites (Gate G/E); no endpoint assurance (externalized; device-risk tightens only); not safe for real secrets.

## Verdict

**TECH-20 is complete.** All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-21**. Do not auto-merge (per prompt §43) — merge on explicit instruction.
