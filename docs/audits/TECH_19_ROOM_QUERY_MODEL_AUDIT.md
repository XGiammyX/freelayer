# TECH-19 — RoomOS Query Model Audit

_Branch: `tech/roomos-query-model` (from `main` @ `f72c29b`, not stacked — TECH-16/17/18 all merged). Date: 2026-07-13._

## Precondition / commands

TECH-18 foundations verified `present` — [TECH_19_PRECHECK.md](TECH_19_PRECHECK.md). Commands run green: typecheck · lint · **460 tests** · build (15/15) · `check:no-room-query-bypass` (new) · `check:no-room-object-bypass` · `check:no-roomos-bypass` · `check:policy-matrix` (131 specs → 917 rules) · `check:policy-conflicts` · `check:policy-docs` · `check:boundaries` · `audit:privacy` · `audit:supply-chain`.

## Architecture decision (recorded)

TECH-18 keeps full `RoomObjectV1` objects in `RoomObjectProjectionV1`, separate from the content-free `RoomMaterializedState.objects` summaries. So `createRoomQuerySnapshotV1` takes BOTH (a documented deviation from the prompt's single-`roomState` snapshot signature). Everything else follows the prompt.

## Research summary

CQRS/read-model separation (queries side-effect-free; no framework); materialized-view privacy risks (no persistent index/cache; strictest-source policy; redacted/tombstoned never reappears); OWASP object-level authz (deny-by-default, exact scope, IDs confer no authority, downgrade-only views); NIST minimization (terms/counts/timing sensitive; counts off by default); local-search privacy (direct scan only, no index/regex/history/snippet); cursor safety (local, non-authority, content-free). → [../research/ROOMOS_LOCAL_QUERY_MODEL_RESEARCH.md](../research/ROOMOS_LOCAL_QUERY_MODEL_RESEARCH.md). Threat model → [TECH_19_QUERY_MODEL_THREAT_MODEL.md](TECH_19_QUERY_MODEL_THREAT_MODEL.md). (Internet unavailable → verification-pending marker.)

## Created / modified

**Created** (`packages/rooms/src/query/`): `query-errors.ts`, `query-types.ts`, `query-requests.ts`, `query-validation.ts`, `query-cursor.ts`, `query-policy.ts`, `query-snapshot.ts`, `query-redaction.ts`, `query-views.ts`, `query-search.ts`, `query-executor.ts`, `index.ts`. Plus `scripts/check-no-room-query-bypass.mjs`, a guardrail fixture, 2 test files, 5 docs.
**Modified:** rooms `index.ts` (export query), privacy `index.ts` (+5 `room.query.*` scopes), `policyMatrix.ts` (+11 rows), regenerated `policy-matrix.v1.json` (131/917), `package.json` + `ci.yml` (guardrail), and 12 model docs.

## Status highlights

- **Query kinds / view classes:** explicit taxonomy + 6 view classes; unknown kind/view/filter/sort deny; requested view downgrade-only.
- **Request validation:** fail-closed; exact own-key checks; prototype-pollution keys reject (shared object guard); getters never invoked; no field-selection arrays; no input serialization or term echo in errors.
- **QueryPolicy:** deny-by-default per mode; `queryHistoryAllowed`/`resultCacheAllowed`/`persistentIndexAllowed`/`networkAllowed`/`notificationAllowed` are typed `false`; `endpointIntegration` cannot be `active`.
- **Authorization:** authentic exact-scope decision required; list≠detail≠search≠count; mutation/storage cannot authorize a query; IDs/actor refs confer no authority; cross-room rejects.
- **Immutable snapshot:** frozen deep clone from room state + object projection; no operation-log access; no side effect.
- **Views/redaction:** summaries content-free; content detail only where policy allows AND object not redacted/tombstoned; actor refs/timestamps/tags/assignees neutralized per policy; file-ref views expose no path/URL; no signature/consensus/vote claims.
- **Filters/sorts/cursors:** structured fields only; deterministic sort with object-ID tie-breaker; source arrays never mutated; bounded cursors (25/100/50) that are content-free, non-authority, room+sort-matched, not persisted.
- **Search:** exact case-sensitive `String.includes` only; no index/history/cache/snippet/regex/fuzzy; term ≤256 bytes; redacted/tombstoned never searched; term never logged; Bunker/Emergency deny.
- **Counts:** own scope; off by default; Standard/Offline/Sovereign allow; Private/Ghost/Bunker/Emergency deny.
- **Determinism/immutability:** repeated query deep-equal; result mutation cannot mutate source; sorting does not mutate source.
- **Integrations:** matrix rows + StoragePolicy (query data classes memory-only; history/cache/index denied) + MetadataPolicy agreement; network/notification/persistent-write traps clean.
- **Guardrail/boundary:** `check:no-room-query-bypass` (fixture-proven) forbids raw `roomState.objects.*` traversal outside the query/objects packages, FTS/dynamic-regex/history/cache/index, query/term logging, network/file/AI. Boundary audit documents the Gate-B limitation. Endpoint defense externalized (import-hygiene test).

## Tests added

28 new (**460 total**): summary/detail/redaction, strict-mode suppression, search safety+leak, filters/sort/counts/pagination, determinism/immutability, zero-side-effect traps, specialized views, authorization, cross-room/unknown/scope-mismatch, cursor safety, guardrail + import hygiene.

## Known limitations

Local-only; no authenticated identity; no persistent/encrypted index; no constant-time queries; no defense against process-memory inspection; **no protection of rendered results from screenshots/capture** (endpoint defense externalized); no remote/synchronized queries; no semantic search; not safe for real secrets.

## Verdict

**TECH-19 is complete.** All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-20**.
