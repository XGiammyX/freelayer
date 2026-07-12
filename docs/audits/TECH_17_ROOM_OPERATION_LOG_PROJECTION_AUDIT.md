# TECH-17 — RoomOS Operation Log + Projection Audit

_Branch: `tech/roomos-operation-log-projection` · **Stacked on PR #41** (TECH-16, `tech/roomos-foundation` @ `44aef34`, CI green) · Date: 2026-07-13._

## Precondition / commands

TECH-16 verified `present` (no partial fixes needed) — [TECH_17_PRECHECK.md](TECH_17_PRECHECK.md). Commands: typecheck · lint · test · build · all 11 privacy guards incl. `check:no-roomos-bypass` (extended) · `check:policy-matrix` (107 specs → 749 rules) · `check:policy-docs` · `check:policy-conflicts` · `check:contributor-workflow` · `check:doc-links` · audits · coverage. All green.

## Research summary

Event sourcing (append-only ≠ retain-forever; history is a privacy liability), materialized projections (pure deterministic reducers; explicit versions; fail-closed replay), schema evolution (v1 explicit; unknown rejects; no upcasting — future Schema Evolution Gate), local-first logs (local ordering ≠ global causality; sync replaceable), CRDT prior art without selection (no causal metadata baked in; Gate H open), deterministic testing (injected clocks/IDs; golden fixtures; no property-testing dependency). → [../research/ROOMOS_OPERATION_LOG_PROJECTION_RESEARCH.md](../research/ROOMOS_OPERATION_LOG_PROJECTION_RESEARCH.md). Threat model → [TECH_17_OPERATION_LOG_THREAT_MODEL.md](TECH_17_OPERATION_LOG_THREAT_MODEL.md). (Internet unavailable → verification-pending marker.)

## Created / modified

**Created** (`packages/rooms/src/`): `room-log-errors.ts` (11 coded errors), `room-event-v1.ts` (typed payload union, validators, injected clock/ID creation, clone helpers), `room-lifecycle.ts` (explicit transition table), `room-reducer.ts` (pure exhaustive reducer + validate-all-then-apply replay), `room-log.ts` (InMemory/Null logs). Plus 15 golden fixtures (`tests/fixtures/rooms/v1/`), 2 test files, 5 docs.
**Modified:** rooms/privacy `index.ts` (3 new log scopes + `room.replay`), `policyMatrix.ts` (+4 rows), regenerated `policy-matrix.v1.json`, `check-no-roomos-bypass.mjs` (determinism + serialization checks), roomos-bypass fixture, 12 docs.

## Status highlights

- **Event schema v1 / projection v1:** explicit; unknown versions reject; typed payloads reject unknown fields; no real content representable in placeholder payloads.
- **Injected clock/ID:** creation boundary only; a `Date.now` spy proves replay makes 0 clock calls; the guardrail statically bans nondeterminism in `room-reducer.ts`/`room-log.ts`/`room-lifecycle.ts`.
- **Memory log:** unique IDs, contiguous ascending sequences, clone-on-append AND clone-on-read, private `#` internals (unreachable), metadata-only status, policy-gated clear. **Null log:** explicit `discarded_by_null_policy`, zero retention, `replayAvailable: false`.
- **Separate decisions:** `room.mutate` ≠ `room.operation_log.append` ≠ `.read` ≠ `.clear` ≠ `room.audit` — every cross-scope use rejects (tested).
- **Deterministic replay:** validate-all → dry-run → apply; failure = no partial state; no sorting/dedup/skip/repair; complete replay starts at sequence 1; timestamps scrambled in tests without changing results.
- **Lifecycle machine:** conservative v1 table; tombstone terminal; documented as not forensic deletion.
- **Fixtures:** 8 valid scenarios with explicit expected projections + 7 invalid with stable error codes; deterministic invalid variants (dup/missing-first/gap/swap/wrong-room/after-tombstone) all reject.
- **Policy integration:** matrix rows agree (Emergency denies read/replay, allows clear — wipe direction; snapshot future-gated); StoragePolicy persistence denial; MetadataPolicy activity/persistence denial; zero network/notification during any log operation (trapped).
- **Boundaries:** apps cannot import rooms at all; within-boundary confinement limitation documented honestly → [ROOMOS_BOUNDARY_AUDIT.md](ROOMOS_BOUNDARY_AUDIT.md) (Gate B).
- **Externalization preserved:** endpoint hooks placeholder-only; no monitoring/CRDT/crypto/network dependency added (import-hygiene test).

## Tests added

30 new (**399 total**): golden fixture replay (valid + invalid), determinism (repeat/clone/timestamp-scramble/no-clock), creation boundary, log hardening (14 memory + null cases), separate-decision enforcement, policy agreement, generated sequences, sentinel-freedom, mutation isolation, guardrail fixtures, import hygiene.

## Known limitations

Local-only; unsigned/unencrypted events (not tamper resistance); local order ≠ causality; internal validation ≠ hostile-input parsing; tombstone ≠ forensic deletion; memory content exists while the process runs; not safe for real secrets.

## Verdict

**TECH-17 is complete** (stacked on #41; merges after it). All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-18**.
