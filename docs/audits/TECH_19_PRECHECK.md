# TECH-19 — Precheck

_Branch: `tech/roomos-query-model`, from `main` @ `f72c29b` (TECH-16/17/18 all merged). Date: 2026-07-13. Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`._

## Repository / PR state

| Item | Value | Status |
| --- | --- | --- |
| Base | `main` @ `f72c29b` | present |
| Current branch | `tech/roomos-query-model` | present |
| Working tree at start | clean | present |
| Open PRs | none | present |
| TECH-16 status | **merged** (#41) | present |
| TECH-17 status | **merged** (#42) | present |
| TECH-18 status | **merged** (#43) | present |
| Branch dependency | none — branched directly from `main` (not stacked) | present |
| Duplicate risk | none — no `query/` package, no TECH-19 PR | present |

## Local checks at branch point

typecheck 0 errors · **432 tests pass** · `check:policy-matrix` OK (120 specs → 749? see note) — actually 120 specs → 840 rules (post-TECH-18). Full suite re-run at completion.

## TECH-18 foundation verification (required by TECH-19)

| Foundation | Evidence | Status |
| --- | --- | --- |
| `RoomMaterializedState` | `room-state.ts` | present |
| RoomOS objects v1 (`RoomObjectV1`) | `objects/object-types.ts` | present |
| Object summaries (`RoomObjectSummaryV1`) | `objects/object-types.ts` | present |
| Object lifecycle | `objects/object-lifecycle.ts` | present |
| Room/object IDs | `room-types.ts`, `objects/object-ids.ts` | present |
| Object revisions | `objects/object-ids.ts` | present |
| Deterministic projection (`RoomObjectProjectionV1`) | `objects/object-reducer.ts` | present |
| Mutation pipeline | `objects/object-pipeline.ts` | present |
| RoomPolicy | `room-policy.ts` | present |
| StoragePolicy | `@freelayer/storage` | present |
| MetadataPolicy | `@freelayer/privacy` | present |
| Policy Matrix room-object rows | 12 `room.object.*` rows | present |
| Raw projection not broadly exposed | full objects live in `RoomObjectProjectionV1`; apps cannot import rooms | present |
| No query/search dependency | none in the tree | present |
| No persistent index | none | present |
| No endpoint-defense implementation | externalized; hooks placeholder-only | present |

## Existing direct-query patterns

TECH-18 exposes `RoomObjectProjectionV1.objects` (a `readonly RoomObjectV1[]`) but apps cannot import `@freelayer/rooms` (boundary guard), so no app-side raw traversal exists. TECH-19 adds the approved query API + a `check:no-room-query-bypass` guard that forbids `roomState.objects.*` traversal outside the query/objects packages.

## Anti-spyware externalization

`present` — `endpoint_hook_ref` stays placeholder-only; query policy carries a non-authoritative `endpointIntegration: "externalized"` marker and cannot represent "active"; no capture/monitoring is implemented.

## Verdict

All TECH-18 foundations are **present and sufficient** — no minimum-correction subset needed. TECH-19 proceeds as a fresh (non-stacked) branch from `main` adding the read boundary. Merge decision left to the user.
