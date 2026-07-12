# TECH-16 — RoomOS Foundation Audit

_Branch: `tech/roomos-foundation` · Base: `main` @ `07fd6e4` (TECH-15 merged) · Date: 2026-07-12._

## Commands run

`pnpm typecheck` · `lint` · `test` · `build` · all guardrails incl. **`check:no-roomos-bypass`** · `check:policy-matrix` · `check:policy-docs` · `check:policy-conflicts` · `check:contributor-workflow` · `check:doc-links` · `audit:privacy` · `audit:supply-chain` · `test:coverage`. All green.

## Precheck / research

Baseline `present` (348 tests pre-TECH-16; the prompt's "173 tests" figure predates TECH-10…15 — documented). The Prompt-03 rooms scaffolding was partial-by-design and was **extended, not replaced** (locked directions preserved verbatim). → [TECH_16_PRECHECK.md](TECH_16_PRECHECK.md). Research: local-first principles (useful before sync; no cloud authority), CRDT prior art **without choosing** (plain versioned events keep Gate H open), event sourcing (versioned events, rebuildable projections, immutable-log privacy risk → memory-only), workspace object models, capability design (factory-only creation; Gate B tokens unchanged). → [../research/ROOMOS_FOUNDATION_RESEARCH.md](../research/ROOMOS_FOUNDATION_RESEARCH.md). Threat model → [TECH_16_ROOMOS_THREAT_MODEL.md](TECH_16_ROOMOS_THREAT_MODEL.md). (Live internet unavailable → verification-pending marker.)

## Created / modified

**Created** (`packages/rooms/src/`): `room-types.ts` (branded IDs + validators; lifecycle/kind/trust; 12-kind object taxonomy with `ROOM_OBJECT_KIND_META`; 18-operation taxonomy; legacy locked-direction placeholders), `room-errors.ts` (9 redacted errors), `room-policy.ts` (`RoomPolicy`/`resolveRoomPolicy`/`expectedRoomScope`/`assertRoomOperationAllowed`), `room-events.ts` (versioned events + factory), `room-state.ts`, `room-projection.ts` (pure fold), `room-audit.ts`, `room-factory.ts`. Plus `scripts/check-no-roomos-bypass.mjs`, fixtures, 2 test files, 4 docs.
**Modified:** rooms `index.ts` (restructured; header preserves locked directions), privacy `index.ts` (7 `room.*` scopes), `policyMatrix.ts` (+9 room rows → **103 specs/721 rules**), both matrix validators (`room` graduated; `room.sync` pinned `future_gate`; room persistent-sink hard check), regenerated `policy-matrix.v1.json`, `package.json` (script + workspace link), CI, 12 docs.

## Status highlights

- **RoomPolicy v1 invariants:** nothing persists, nothing syncs, no metadata/notification/AI side effects — every mode; Emergency denies normal mutation; Bunker/critical-risk redact titles; member display always redacted.
- **Barrier:** authentic WeakSet-provenance decisions with exact `room.*` scopes, checked before any state transition; forged/wrong-scope/denied decisions rejected (tested).
- **Events/projection:** `version: 1`, sequence-only IDs, `local:` timestamps; projection is a pure rebuildable fold that skips foreign-room events and never surfaces content.
- **Policy integrations (all tested):** Matrix `room` rows agree with `RoomPolicy` per mode; StoragePolicy agrees on log/projection persistence denial; network/notification traps prove zero side effects; Metadata denies room activity/AI; Offline denies sync; link-preview/asset denials hold for room content.
- **Guardrail:** catches direct mutation, room/event payload logging, `endpointDefenseActive: true` overclaims, and Yjs/Automerge/Loro imports (8 fixture findings); real source clean.
- **Anti-spyware externalization preserved:** `endpointDefenseIntegration` has no "active" member; barrier rejects a cast; `endpoint_hook_ref` is Gate-R-gated placeholder.
- **Deferred gates preserved:** sync (H), crypto (F), identity (G), capsules (E) all still `future_gate` and non-executable (tested); no CRDT/crypto/network/DB dependency added.

## Tests added

21 new (**369 total**): decision enforcement, fail-closed, tighten-only, persistence denials, mode denials, redaction, no-side-effect traps, event/projection semantics, sentinel-freedom (errors/audit/projection/IDs), gated non-executability, matrix↔RoomPolicy agreement, guardrail fixtures.

## Known limitations

Rooms are **not safe for real secrets**: content exists in memory only; member refs are placeholders; no authenticity/ordering guarantees (no crypto/sync); the projection is single-log fold, not merge; immutable-log privacy for *persistent* logs is Gate F/H design work. Application-level only.

## Verdict

**TECH-16 is complete.** All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-17 — RoomOS Local Operation Log + Projection Regression Suite**.
