# TECH-20 — Precheck

_Branch: `tech/roomos-membership-capabilities`, from `main` @ `7405ac0` (TECH-16/17/18/19 all merged). Date: 2026-07-13. Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`._

## Repository / PR state

| Item | Value | Status |
| --- | --- | --- |
| Base | `main` @ `7405ac0` | present |
| Current branch | `tech/roomos-membership-capabilities` | present |
| Working tree at start | clean | present |
| Open PRs | none | present |
| TECH-16 / 17 / 18 / 19 status | **all merged** (#41/#42/#43/#44) | present |
| Branch dependency | none — branched directly from `main` | present |
| Duplicate risk | none — no `membership/` package, no TECH-20 PR | present |
| CI status | `main` green | present |
| Test count at branch point | 460 | present |

## Foundation verification (required by TECH-20)

| Foundation | Evidence | Status |
| --- | --- | --- |
| RoomOS package | `packages/rooms` | present |
| `RoomMaterializedState` | `room-state.ts` | present |
| Room events + replay | `room-event-v1.ts`, `room-reducer.ts`, `room-log.ts` | present |
| Object mutations | `objects/object-pipeline.ts` | present |
| Local queries | `query/query-executor.ts` | present |
| `RoomMemberRef` | `room-types.ts` (branded placeholder) | present |
| Exact-scope `PolicyDecision` enforcement | WeakSet provenance + scope checks | present |
| Room/storage decisions separate | object + query pipelines | present |
| No real identity | member refs are placeholders; no accounts/keys | present |
| No auth dependency | none in the tree | present |
| No capability-token implementation | none (Gate B) | present |
| No endpoint-defense implementation | externalized; hooks placeholder-only | present |

## Current membership / role / capability status

| Item | Status |
| --- | --- |
| `RoomMemberSummary` (content-free member summary) | present (`room-state.ts`) |
| Placeholder role literals (`owner_placeholder`…) | present (in `RoomMemberSummary.role`) |
| Versioned membership records | missing (this is TECH-20) |
| Membership lifecycle / events / projection | missing (TECH-20) |
| Capability descriptors / attenuation | missing (TECH-20) |
| Membership queries / policy | missing (TECH-20) |
| Policy Matrix membership rows | missing (TECH-20) |

## Anti-spyware externalization

`present` — no endpoint monitoring; membership/capability policy accepts a `deviceRiskLevel` placeholder that can only TIGHTEN and is never treated as identity assurance or safety attestation.

## Verdict

All foundations are **present and sufficient** — no minimum-correction subset needed. TECH-20 proceeds as a fresh (non-stacked) branch from `main`, adding local unverified membership + non-authoritative capability scaffolding. Do not auto-merge (per prompt §43).
