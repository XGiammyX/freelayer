# RoomOS Operation Log + Projection — Research Note (TECH-17)

_Date: 2026-07-13. Informs the log-grade V1 event model, deterministic replay, and memory/null logs._

> [!NOTE]
> **Source verification pending: internet unavailable in this environment.** The concepts below are stable event-sourcing/local-first knowledge (author cutoff 2026-01). Re-confirm current library specifics against primary sources before external citation.

## 7.1 Event sourcing (Fowler; CQRS/ES literature)

**Summary:** state derives from an append-only event history by replay; duplicates/ordering must be explicit; operational complexity is real; **long-lived history is a privacy liability**.

**Adopted:** accepted room operations are events; projections are rebuildable; the projector is pure/deterministic; append-only ≠ retain-forever — Ghost/Bunker never persist, and no permanent immutable history is promised. **Rejected:** any event-sourcing framework dependency.

## 7.2 Materialized projections

**Summary:** read models derive from ordered events via deterministic reducers; replay failures need explicit handling; snapshots trade speed for another derived-data store.

**Adopted:** projection = pure function of seed + validated ordered events; replay calls no clock/randomness/storage/network/platform APIs (guardrail-scanned + trap-tested); `projectionVersion: 1` explicit; failure is fail-closed with stable codes and **no partial result** (validate-all + dry-run before apply). **Deferred:** snapshots/checkpoints (new future matrix row `room.snapshot_future`).

## 7.3 Event schema evolution

**Summary:** versioned schemas with upcasting are the standard path; silent reinterpretation of historical payloads is the classic failure.

**Adopted:** `schemaVersion: 1` explicit; unknown schema/projection versions **reject** (`RoomEventVersionUnsupportedError`); no upcaster framework, no automatic/lossy migration. **Future:** the new **Room Event Schema Evolution Gate** requires research, migration design, test vectors, compat fixtures, privacy review (+ hostile-input review if import is involved).

## 7.4 Local-first operation logs

**Summary:** local replicas own the data; sync is an optional, replaceable transport layer.

**Adopted:** TECH-17 works entirely locally; no server; local ordering explicitly documented as NOT global/causal ordering; future sync stays replaceable (Gate H).

## 7.5 CRDT prior art (Automerge / Yjs / Loro) — no selection

**Summary:** all three model local updates + incremental changes and keep awareness/presence and network providers separate from the data type.

**Adopted:** events carry no CRDT/causal metadata so any future engine can be layered; no awareness/presence; `localSequence` is explicitly not a distributed-ordering solution. Gate H untouched.

## 7.6 Deterministic and regression testing

**Summary:** pure reducers test best with injected clocks/IDs, golden fixtures, table-driven sequences, and full-projection comparisons; property-testing dependencies aren't required for deterministic generators.

**Adopted:** `RoomLocalClock`/`RoomEventIdGenerator` injected at the creation boundary only; replay never touches time (tested with a `Date.now` spy); 15 golden fixtures with static IDs/times and **explicit expected projections**; deterministic valid/invalid sequence generators; repeated/cloned replay compared deep-equal. **Rejected:** property-testing dependency; snapshot-only opaque assertions.

## Key decisions for TECH-17

1. Log-grade `RoomOperationEventV1` (typed discriminated payload union) added **alongside** the TECH-16 lightweight event — no breaking change; V1 is the log/replay contract.
2. Operation-specific payload validators — small, explicit, unknown-field-rejecting; **no schema library**.
3. Complete local replay starts at sequence 1 (no snapshots exist); contiguous ascending; no sort/dedupe/skip/repair.
4. Room mutation and log append are **separate side effects** with separate exactly-scoped decisions (`room.mutate` vs `room.operation_log.append`/`.read`/`.clear`).
5. Replay reconstructs **previously accepted** events and does not re-run write authorization (determinism under policy change); log access itself stays policy-gated.
6. Internal validators are **not hostile-input parsers** — external ingestion is Gate E, stated everywhere.

## Deferred questions / TODOs (Gate H + evolution)

Merge semantics for concurrent logs; capsule-carried event envelopes (Gate E); snapshot privacy semantics (retained deleted content) + Gate F encryption; upcasting design with golden migration fixtures; persistent-log StoragePolicy classes when Gate F opens.
