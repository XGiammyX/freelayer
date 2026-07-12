# RoomOS Foundation — Research Note (TECH-16)

_Date: 2026-07-12. Informs the Sovereign Room data model in `packages/rooms`._

> [!NOTE]
> **Source verification pending: live internet was unavailable in this environment.** The concepts below are stable local-first/distributed-systems knowledge (author cutoff 2026-01). Re-confirm current library details against primary sources before external citation.

## 7.1 Local-first software principles (Ink & Switch, "Local-first software")

**Summary:** data lives on the user's devices; offline is the normal case; collaboration must not require a cloud authority; longevity and user control are design goals; sync is an *optional layer*, not the foundation — and local-first systems carry real complexity costs (merge semantics, schema evolution).

**Applied:** RoomOS is useful as a **local data model before any sync exists**; no server anywhere; every local operation is policy-controlled; sync remains Gate H.

## 7.2 CRDT prior art — WITHOUT choosing a library

**Summary:** Automerge (JSON CRDT, columnar storage, Rust core), Yjs (high-performance shared types, wide ecosystem), Loro (rich-text/tree focus, Rust) — different trade-offs in memory, storage compaction, and merge semantics. All impose their own event/metadata formats.

**Applied (Gate H stays open):** no CRDT dependency; room operations are modeled as **plain versioned events** with no causal/CRDT metadata, so a future evaluation can layer any engine (or a custom event-log merge) without rewriting the taxonomy. The projection is a simple fold — deliberately *not* a merge.

## 7.3 Event sourcing / append-only logs

**Summary:** state derives from an append-only event log; projections are rebuildable; events need explicit versioning for schema evolution; **immutable logs are a privacy liability** — they preserve everything forever.

**Applied:** `RoomOperationEvent` carries `version: 1`; projections are pure folds (rebuildable by construction); the log is a **memory-only placeholder** — persistence follows StoragePolicy and is denied everywhere in v1 (Ghost/Bunker forever; Standard until the encrypted backend passes Gate F); content payloads never enter audit/summaries.

## 7.4 Collaborative workspace data models

**Summary:** workspace tools converge on a common object vocabulary — messages, notes, tasks, files, decisions, polls, members, roles, settings, audit trails — each with distinct sensitivity.

**Applied:** 12 `RoomObjectKind`s, each with a data class + sensitivity + content-bearing flag in `ROOM_OBJECT_KIND_META`; content-bearing kinds (message/note/task/decision/poll) cannot be plaintext-persisted; `file_ref` is reference-only; every mutation routes through room operations.

## 7.5 Capability-based design

**Summary:** authority should be explicit and least-privilege; global mutable access is the anti-pattern; construction tokens/factories confine who can create privileged objects.

**Applied:** room state is created only via `createLocalRoom` (factory requiring an authentic `PolicyDecision`); no exported mutation helpers — the projection returns new immutable objects; the guardrail bans `.objects.push(`-style direct mutation. Full capability-token construction remains **Gate B** (unchanged).

## 7.6 Internal review

- Existing `packages/rooms` scaffolding already locked the right directions (event-sourced, deferred CRDT, untrusted local time, no pre-join history) — preserved verbatim in the new module headers.
- `docs/SOVEREIGN_ROOMS.md` claimed design-stage only — accurate; updated with the foundation status without overclaiming.
- Matrix gap: `room` domain had only `room.sync` — 9 local-foundation rows added; validators updated so `room` is no longer a fully-deferred domain while `room.sync` is pinned `future_gate`.
- Anti-spyware: `endpoint_hook_ref` exists as a compatibility placeholder only; `endpointDefenseIntegration` has **no "active" member** at the type level.

## Decisions for TECH-16

1. Extend the existing scaffolding; never replace locked directions.
2. Events = plain versioned records; projection = pure fold; **no ordering assumptions** beyond array order of a single local log.
3. Room decisions issue against the `persistence` capability with exact `room.*` scopes.
4. `RoomPolicy` v1 invariants: nothing persists, nothing syncs, no metadata/notification/AI side effects — in every mode; Emergency denies normal mutation.
5. Titles/member display redacted in Bunker (and critical risk); member display is always redacted in v1 (no display names exist).

## TODOs for TECH-17 / Gate H

- **TECH-17 (Operation Log + Projection Regression Suite):** property-style projection tests (fold determinism, event reordering tolerance limits), log-boundary storage tests, projection-rebuild equivalence, event-schema migration fixtures.
- **Gate H:** CRDT/event-log evaluation memo → ADR; merge semantics; capsule-carried operations (Gate E interplay); pre-join history decision stays locked.
