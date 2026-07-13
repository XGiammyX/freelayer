# TECH-21 — Revocation + Authorization Regression Audit

_Branch: `tech/roomos-revocation-authorization-regression` · **Stacked on PR #45** (TECH-20, `tech/roomos-membership-capabilities` @ `2506bcd`, CI green) · Date: 2026-07-13. Merge order: 45 → 21._

## Precondition / commands

TECH-16/17/18/19 merged; TECH-20 (#45) complete but unmerged → TECH-21 stacked on it ([TECH_21_PRECHECK.md](TECH_21_PRECHECK.md)). Commands run green: typecheck · lint · **500 tests** · build (15/15) · `check:no-room-authorization-bypass` (new) + all prior RoomOS guards · `check:policy-matrix` (157 specs → 1099 rules) · `check:policy-conflicts` · `check:policy-docs` · `check:boundaries` · `audit:privacy` · `audit:supply-chain`.

## Architecture decisions (recorded)

- The revocation pipeline reuses the TECH-20 membership pipeline (owner continuity, revision, event, separate storage decision, log, pure reducer) and adds prepared-authorization revalidation + restrictive-direction enforcement.
- `RoomPolicy` has no explicit revision; TECH-21 adds an optional `policyRevision` on `RoomMaterializedState` + a deterministic local fingerprint fallback (`computeRoomPolicyFingerprintV1`) — a LOCAL fence, not a global version.
- Pipeline/report types use membership-log / membership-event types (documented deviation from the prompt's `RoomOperationLog`/`RoomOperationEventV1` suggestion; invariants identical).

## Research summary

NIST SP 800-53 revocation on attribute change; OWASP authorize-every-operation + regression testing; OWASP transaction-authorization execution binding; Zanzibar consistency prior art (local fence only, global consistency = Gate H); authorization-caching/TOCTOU risks → no cache, revalidate at execution. → [../research/ROOMOS_REVOCATION_AUTHORIZATION_REGRESSION_RESEARCH.md](../research/ROOMOS_REVOCATION_AUTHORIZATION_REGRESSION_RESEARCH.md). Threat model → [TECH_21_REVOCATION_AUTHORIZATION_THREAT_MODEL.md](TECH_21_REVOCATION_AUTHORIZATION_THREAT_MODEL.md). (Internet unavailable → verification-pending marker.)

## Created / modified

**Created** (`packages/rooms/src/authorization/`, 7 modules + index): `authorization-errors.ts`, `authorization-revision.ts`, `prepared-authorization.ts`, `authorization-revalidation.ts`, `role-authority.ts`, `revocation-report.ts`, `revocation-pipeline.ts`. Plus `scripts/check-no-room-authorization-bypass.mjs`, a fixture, 2 test files, 6 docs (incl. cache + boundary audits).
**Modified:** rooms `index.ts` (export authorization), `room-state.ts` (+`policyRevision`), `policyMatrix.ts` (+8 rows), matrix JSON (157/1099), `package.json` + `ci.yml` (guardrail), 13 model docs.

## Status highlights

- **Authorization-revision model:** `RoomAuthorizationRevisionV1` binds room + membership revision + local policy revision + lifecycle + privacy mode; policy revision = explicit counter or deterministic fingerprint.
- **Prepared context:** non-authoritative, transient, `serialization`/`persistence` forbidden; binds capability + side-effect + object id/kind + requested view + target membership/revision.
- **Execution-time revalidation:** 16-point final gate; re-derives the fence from current state, re-checks descriptor currency, verifies operation/object/view/target binding, requires an authentic exact-scope decision; never auto-refreshes.
- **Operation-data binding:** object/operation/view/room/target mismatch all reject with specific binding errors.
- **Suspension/removal/role-change/reactivation:** any state/role/revision change flips the fence → reject; reactivation bumps revision (old contexts stale).
- **Policy/mode/lifecycle invalidation:** policy revision, privacy mode (incl. less-restrictive transitions), and lifecycle changes reject prepared contexts.
- **Role ordering:** capability-SET comparison (`compareRoleAuthorityV1`) covers every role pair; `classifyMembershipChangeDirectionV1` marks restrictive/expansive/neutral/unknown; incomparable/expansive commands rejected by the revocation pipeline.
- **Owner-continuity race:** recomputed from the CURRENT projection at execution (last active owner cannot be removed/suspended/downgraded; second owner unblocks).
- **Cache audit:** no authorization cache exists ([ROOM_AUTHORIZATION_CACHE_AUDIT.md](ROOM_AUTHORIZATION_CACHE_AUDIT.md)); matrix + guard enforce it.
- **Conflict-suite integration:** matrix rows + `check:policy-conflicts` + guard cover cached-authorization / Bunker-elevation / Emergency-expansion / endpoint-grants-access / distributed-revocation-overclaim.
- **Leak/traps:** errors + reports sentinel-free; revalidation touches no network/notification/persistent-write API (trapped).

## Tests added

19 new (**500 total**): prepared-op invalidation (state/operation/binding/policy/mode/lifecycle), same-revision deterministic re-check, role capability-set comparison (all pairs) + direction classifier, revocation pipeline (suspend/last-owner/no-escalation/no-partial-effect), authentic-decision-required, leak-freedom + report shape, side-effect traps, guardrail + import hygiene.

## Known limitations

Local only — no distributed/global revocation (Gate H), no signed/cryptographic revocation (Gates F/G), no verified identity (Gate G), no authorization server, no single-use/nonce-bound decisions (Gate B), no endpoint assurance (device-risk tightens only); prepared contexts + descriptors are not credentials; not safe for real secrets.

## Verdict

**TECH-21 is complete** (stacked on #45; merges after it). All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-22**. Do not auto-merge (§40).
