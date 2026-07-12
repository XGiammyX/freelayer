# TECH-16 — Precheck

_Branch: `tech/roomos-foundation` off `main` @ `07fd6e4` (TECH-15 + major-deps + register refresh merged). Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable`._

## Platform baseline

| Item | Evidence | Status |
| --- | --- | --- |
| main green (348 tests, all guards), 0 open PRs | verified at branch point | present |
| AST ESLint / WeakSet `PolicyDecision` / storage+network guardrails / zero-egress scanners | unchanged, verified | present |
| Policy Matrix v1 + export + validator | 94 specs → 658 rules pre-TECH-16 (now 103 → 721) | present |
| Conflict regression suite (TECH-14) | 17 categories, fixtures, `check:policy-conflicts` | present |
| Contributor workflow (TECH-15) | workflow/guide/templates/`check:contributor-workflow` | present |
| PBOM / Trust Center | active contracts | present |
| Anti-spyware externalization | documented + enforced (Gate R, dependency bans, hook-only tests) | present |
| Baseline note | The prompt's "173 tests, 13 checks" predates TECH-10…15; actual baseline is 348 tests / 14 guards. Non-blocking; documented. | present but different |

## RoomOS prior state

| Item | Evidence | Status |
| --- | --- | --- |
| `packages/rooms` | Prompt-03 type scaffolding (event-sourced direction, deferred CRDT, untrusted timestamps, proof placeholders) — extended, locked directions preserved | partial → present |
| `docs/SOVEREIGN_ROOMS.md` | design-stage doc (ADR-0006, Gate H open) — updated with TECH-16 status | present |
| Matrix `room` domain | only `room.sync` (future_gate) — TECH-16 adds 9 local-foundation rows; sync stays gated | partial → present |
| Storage data classes | `room_operation_log`, `materialized_room_state` already modeled (TECH-05) | present |
| README room claims | rooms listed as concept; no overclaims found | present |

## Verdict

All dependencies **present**; the rooms scaffolding was partial by design and is extended (not replaced). No gated work (crypto/sync/identity/capsules/anti-spyware) pulled forward.
