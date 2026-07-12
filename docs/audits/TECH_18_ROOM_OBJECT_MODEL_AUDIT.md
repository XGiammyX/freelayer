# TECH-18 — RoomOS Object Model v1 Audit

_Branch: `tech/roomos-object-model` · **Stacked on PR #42** (TECH-17) → **PR #41** (TECH-16) → main · Date: 2026-07-13. Merge order: 41 → 42 → 18._

## Precondition / commands

TECH-17 foundations verified `present` (no minimum-correction subset needed) — [TECH_18_PRECHECK.md](TECH_18_PRECHECK.md). Commands run green: typecheck · lint · **432 tests** · build (15/15) · `check:no-room-object-bypass` (new) · `check:no-roomos-bypass` · `check:policy-matrix` (120 specs → 840 rules) · `check:policy-conflicts` · `check:policy-docs` · `check:boundaries` · `audit:privacy` · `audit:supply-chain`.

## Architecture decision (recorded)

To avoid destabilizing the TECH-17 tight, content-free `RoomOperationEventV1` union (and its 399 green tests), TECH-18 is a cohesive `packages/rooms/src/objects/` subsystem with its own versioned `RoomObjectEventV1` envelope + memory/null object log, structurally parallel to the TECH-17 log and reusing every TECH-17 pattern: injected clock/id at the creation boundary, separate exact-scoped storage decision, validate-all-then-apply determinism, defensive cloning. The pipeline produces a versioned object event (not the literal TECH-17 event type); §30's suggested signature is followed in spirit with object-model types.

## Created / modified

**Created** (`packages/rooms/src/objects/`): `object-errors.ts`, `object-ids.ts`, `object-limits.ts`, `object-validation.ts`, `object-types.ts`, `object-lifecycle.ts`, `object-commands.ts`, `object-policy.ts`, `object-events.ts`, `object-reducer.ts`, `object-redaction.ts`, `object-log.ts`, `object-pipeline.ts`, `index.ts`. Plus `scripts/check-no-room-object-bypass.mjs`, a guardrail fixture, 2 test files, and 5 docs.
**Modified:** rooms `index.ts` (export objects), privacy `index.ts` (+8 scopes: 5 mutation, 3 object-log), `policyMatrix.ts` (+12 rows), regenerated `policy-matrix.v1.json` (120/840), `package.json` + `ci.yml` (guardrail), TECH-17 import-hygiene test (recursive), and 12 model docs.

## Core-invariant coverage (§9)

All 29 invariants are implemented and tested: explicit schema version + single-room ownership + opaque IDs + positive revisions + discriminated unions; unknown kind/version/command deny; no generic patch; every mutation needs an exact-scope decision; expected-revision required + stale rejects before side effects; cross-room mutation rejects; IDs/actor refs confer no authority; accepted mutations produce versioned events; projection changes only via reduction; pure side-effect-free reducers; defensive copying; content never in errors/audit; persistent plaintext forbidden; Ghost/Bunker no persistence; Offline no network; Emergency denies ordinary mutation; tombstone terminal + not forensic; file refs hold no bytes/path/URL; poll voting gated; endpoint hooks placeholder-only.

## Status highlights

- **Validation:** fail-closed; exact own-key checks; `__proto__`/`prototype`/`constructor` rejected; getters never invoked; UTF-8 byte limits with exact-boundary + multi-byte tests; file-ref path/URL/credential rejection. Internal-invariant only (NOT hostile-input — Gate E).
- **Revisions:** create→1, +1 per mutation, stale/future/missing/overflow reject; documented as local optimistic concurrency, not distributed/causal/tamper resistance.
- **Pipeline:** validate → locate → room/object match → policies → matrix cross-check → exact-scope mutation decision → lifecycle/revision → build event (injected clock) → separate storage decision → memory/null append → deterministic projection → metadata-only summary; failure ⇒ no event/log/projection change.
- **Determinism:** reducer pure; replay validates-all-then-applies; repeated/cloned replay deep-equal; network/notification/persistent-write traps clean.
- **Content safety:** summaries/status/errors/console sentinel-free; strict modes suppress summary signals; content lives only in the in-memory event/projection.
- **Policy agreement:** 12 matrix rows; StoragePolicy denies persistence; Emergency denies ordinary/allows safe direction; Ghost/Bunker null-preferred; guardrail + boundaries.

## Tests added

33 new (**432 total**): message/note/task/decision/poll/file-ref behavior (§35-40), authorization + concurrency + determinism (§41), content-leak + proto-pollution + accessor + guardrail + import hygiene + traps (§42-45).

## Known limitations

Local-only; unencrypted content (not safe for real secrets); revisions are local optimistic-concurrency values (no distributed conflict resolution); no verified identity/voting; tombstones are not forensic erasure; internal validation is not a hostile-input boundary; no messaging transport/sync/CRDT; no anti-spyware active.

## Verdict

**TECH-18 is complete** (stacked on #42; merges after 41 → 42). All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-19**.
