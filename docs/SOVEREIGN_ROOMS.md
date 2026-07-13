# Sovereign Rooms — RoomOS

[← Docs Index](README.md) · [CapsuleNet](CAPSULENET.md) · [Privacy Model](PRIVACY_MODEL.md) · [Glossary](GLOSSARY.md)

> [!NOTE]
> The primary product model (ADR-0006): rooms are private operational spaces on members' devices — chat is one object type inside them. Design stage; implementation blocked by Gate H, including the deliberately-open CRDT decision.

## Purpose

Sovereign Rooms are **encrypted, local-first operational spaces built on top of FreeLayer capsules** — and they are FreeLayer's **primary product model** ([ADR-0006](adr/ADR-0006-sovereign-rooms-as-primary-product-model.md)). Product, protocol, and storage design orient around rooms; a 1:1 conversation is a minimal room, not a separate system.

They are **not just group chats.** A room may contain:

- messages
- notes
- documents
- files
- tasks
- decisions
- polls
- room memory
- local AI summaries *(future, policy-gated — [LOCAL_AI.md](LOCAL_AI.md))*
- document Q&A *(future, policy-gated)*
- room operation log
- encrypted audit history

## Current status

**Local foundation implemented (TECH-16); everything distributed remains design-stage behind its gates.** `packages/rooms` now contains the first safe, testable room data model — sync (Gate H), crypto (Gate F), identity (Gate G), and capsule transport (Gate E) remain blocked; the CRDT decision stays deliberately open.

### TECH-16 — RoomOS foundation (what exists)

- **Identifiers:** branded local placeholders (`RoomLocalId`, `RoomMemberRef`, `RoomDeviceRef`) with slug-validated constructors — no real identity (Gate G).
- **Lifecycle/kind/trust:** `draft → active_local → sealed/archived/emergency_locked/deleted_tombstone`; five room kinds; `RoomTrustState` where `verified_placeholder` explicitly ≠ verification.
- **Object taxonomy:** 12 kinds (message/note/task/decision/poll/file_ref/room_setting/member_ref/audit_event/ai_memory_ref/endpoint_hook_ref/unknown), each with data class + sensitivity + content-bearing flag; content-bearing kinds cannot be plaintext-persisted; `file_ref` is reference-only; `endpoint_hook_ref` is a compatibility placeholder — **the anti-spyware implementation is externalized and no active endpoint protection exists in core**.
- **Operation taxonomy:** 18 operations; every unimplemented feature carries the `_placeholder` suffix.
- **RoomPolicy v1** (`resolveRoomPolicy`): tighten-only composition; v1 invariants — nothing persists, nothing syncs, no metadata/notification/AI side effects, in every mode; Emergency denies normal mutation; Bunker/critical-risk redact titles; member display always redacted.
- **Barrier** (`assertRoomOperationAllowed`): authentic `PolicyDecision` (WeakSet provenance) with exact `room.*` scope, before any state transition.
- **Operation log placeholder:** versioned events (`version: 1`), sequence-only IDs, `local:`-labeled timestamps (never trusted time), no crypto/CRDT metadata; **memory-only** — persistence denied by policy + matrix + StoragePolicy.
- **Materialized projection** (`projectRoomState`): a pure, deterministic, rebuildable fold — NOT collaborative merge; summaries never carry content; projection persistence denied.
- **Factory** (`createLocalRoom`): the only sanctioned creation path.
- **Redacted room audit:** numeric/boolean details only; no titles/member names/content.
- **Machine checks:** 9 matrix rows (`room.*`), `check:no-roomos-bypass` guardrail, 21 regression tests.

## TECH-17 — Local operation log and deterministic projection

> The RoomOS local operation log is **not a CRDT, distributed ledger, tamper-proof log or synchronization protocol.**

- **Log-grade event schema v1** (`RoomOperationEventV1`): explicit `schemaVersion: 1` + `projectionVersion: 1`; branded `RoomEventId` + `RoomLocalSequence`; typed operation-specific payload union (unknown fields rejected; no real content anywhere). Unknown versions/operations/object kinds **reject** — no coercion, no silent defaults.
- **Local sequence semantics:** positive safe integer, scoped to ONE local log, contiguous and ascending; a complete replay starts at 1 (no snapshots exist). **It is not global or causal ordering** — timestamps (`local:`-labeled) never influence order. No sorting, no deduplication, no skipping, no repair.
- **Event creation boundary:** injected `RoomLocalClock` + `RoomEventIdGenerator`; requires an authentic room-scoped `PolicyDecision`; accepted events are validated, defensively cloned, and frozen.
- **Deterministic replay** (`replayRoomOperationEventsV1`): validates ALL events (structure, room, uniqueness, contiguity, lifecycle transitions) **before applying any** — failure yields no partial result; the reducer is pure (no clock/randomness/storage/network/notification/AI/endpoint calls — guardrail-scanned and trap-tested); same seed + same events ⇒ deep-equal projection, proven across 15 golden fixtures. Replay reconstructs previously **accepted** events and does not re-run write authorization (determinism under policy change); log access itself stays policy-gated; external event ingestion remains Gate E.
- **Lifecycle state machine:** one explicit table (`draft → active_local → sealed/archived/emergency_locked → deleted_tombstone`); tombstone is terminal. **Tombstoning is not forensic deletion** — visible summaries clear, but the in-memory log may retain prior placeholder events until explicitly cleared.
- **Retention:** `InMemoryRoomOperationLog` (memory-only; clone-on-append/read; unique IDs; contiguous sequence; instances share nothing) and `NullRoomOperationLog` (retains nothing; replay unavailable; an ephemeral projection may exist in-process but cannot be rebuilt). **No persistent plaintext event log exists**; persistence is denied everywhere until Gate F. No snapshots/compaction (future gate — they can retain deleted content and need Gate F encryption + StoragePolicy/PBOM review).
- **Separate decisions:** a room mutation and a log append/read/clear are separate side effects, each requiring its own exactly-scoped `PolicyDecision` — cross-scope use rejects.
- **Not a hostile-input parser:** `validateRoomOperationEventV1` checks internal invariants over trusted local/fixture data only (Gate E owns external parsing). No crypto (Gate F), no sync (Gate H), no endpoint-defense implementation (externalized, Gate R).

## TECH-19 — Privacy-safe local query model

> The query layer protects data ACCESS inside FreeLayer core. It does **not** guarantee safe rendering on a compromised or externally captured endpoint (endpoint defense is externalized).

- **Read/write separation:** queries are a SEPARATE layer from the TECH-18 mutation pipeline. They are **side-effect-free** — never append events, never mutate the projection, never write storage, never call network/notification/AI/link-preview/file/endpoint hooks.
- **Immutable snapshot:** a query executes against one frozen, defensively-cloned `RoomQuerySnapshotV1` built from the room state + object projection — never the live projection and never the operation log. (Because TECH-18 keeps full objects in `RoomObjectProjectionV1`, snapshot creation takes both it and `RoomMaterializedState`.)
- **Query taxonomy:** `room.summary`, `room.objects.list`, `room.object.get`, `room.objects.search_plain_text`, `room.tasks/decisions/polls/file_refs.list`, `room.object_counts`. No query language, no SQL/GraphQL, no dynamic field paths, no regex, no semantic queries, no remote kinds. Unknown kinds/views/filters/sorts deny.
- **Privacy-safe view classes:** `room_summary(_redacted)`, `object_summary(_redacted)`, `object_detail_redacted`, `object_detail_content`. Summaries carry **no content**; a content detail view returns local in-memory content only when policy explicitly allows it and **never implies capture protection**. The requested view can only be DOWNGRADED, never upgraded.
- **Policy-gated authorization:** every query needs an authentic `PolicyDecision` scoped to EXACTLY its class (`room.query.summary/list/detail/search/count`). Object IDs and actor refs confer **no authority**; cross-room snapshot/request rejects; a list decision cannot authorize detail, summary cannot authorize search, detail cannot authorize count, and a mutation/storage decision cannot authorize a query.
- **Structured filters + deterministic sorting:** explicit filter fields only (kinds/lifecycles/redacted/statuses/exactTag — no predicates, no regex); sorts (`object_id_asc`/`created_local_asc`/`updated_local_desc`/`revision_desc`) always apply an object-ID tie-breaker and never mutate source arrays; timestamp sorts are denied in strict modes.
- **Bounded local cursors:** default limit 25, max 100 (search max 50); cursors are local typed values — **not authorization tokens**, not persisted, not serialized for remote use, content-free; a cursor must match the query's room + sort; one execution uses one immutable snapshot.
- **Exact in-memory search v1:** exact case-SENSITIVE substring (`String.includes`) over allowed plain-text fields — **no index, history, cache, snippet, ranking, fuzzy, regex, or stemming**; user input never builds a `RegExp`; term ≤256 UTF-8 bytes; redacted/tombstoned content is never searched; the term never appears in errors/logs. Bunker/Emergency deny search.
- **Counts are metadata:** off by default, behind their own scope; Standard/Offline/Sovereign may allow exact local counts; Private/Ghost/Bunker/Emergency deny.
- **Strict-mode redaction:** Ghost/Bunker/Emergency suppress actor refs, timestamps, revisions, counts, and relationship metadata; **Bunker denies content views and search** (enabling them needs a future protected-presentation integration gate); Emergency allows only a minimal room summary.
- **No index/history/cache; no UI; no remote API.** Deterministic + defensively-cloned results — mutating a result cannot mutate source state.

## TECH-18 — RoomOS Object Model v1

> A RoomOS message object is currently a local data object. **It is not sent, encrypted, synchronized, or delivered.** Notes/tasks/decisions/polls are not collaborative documents; file refs hold no bytes/path/URL; poll voting does not exist.

- **Concrete object kinds (v1):** `message`, `note`, `task`, `decision`, `poll`, `file_ref`. Each has an explicit versioned schema (`schemaVersion`/`projectionVersion` 1; unknown versions/kinds/commands reject) over a common envelope (`objectId`, `roomId`, positive local `revision`, `lifecycle`, `sensitivity`, local timestamps, placeholder actor refs, `redacted`). `ai_memory_ref`/`endpoint_hook_ref`/`member_ref`/`room_setting`/`audit_event` remain non-executable placeholders.
- **Plain-text-only content:** no HTML mode, no rendered Markdown, no embedded remote resources; NUL + lone surrogates rejected; conservative UTF-8 byte limits + bounded tag/option/assignee arrays (`ROOM_OBJECT_LIMITS_V1`).
- **Explicit commands, never generic patch:** a discriminated command union (`message.create/edit/redact`, `note.*`, `task.*`, `decision.*`, `poll.*`, `file_ref.*`, `object.archive/redact/tombstone`). No `object.patch`/`set_property`/`merge_payload`/`json_patch`; accepted fields are explicitly extracted (never spread); `__proto__`/`prototype`/`constructor` rejected; getters never invoked. Internal validators protect invariants — they are **not** a hostile-input boundary (Gate E).
- **Local revisions = optimistic concurrency:** creation → revision 1; every accepted mutation increments by exactly one; updates require `expectedRevision`; stale/future/missing/overflow reject before any side effect. **Not** a timestamp, not global, not causal ordering, not distributed version vectors (Gate H), not tamper resistance (Gate F).
- **Policy-gated mutation pipeline** (`applyLocalRoomObjectMutationV1`): validate command → locate object → room/object match → resolve RoomPolicy + object mutation policy → cross-check Policy Matrix → **exact-scope mutation decision** → lifecycle/revision check → build operation-specific event (injected clock) → **separate storage decision** → append to memory/null object log → deterministic pure projection update → metadata-only summary. A failure produces no event, no log entry, no projection change (logical all-or-nothing at the local in-memory boundary — not a crash-safe DB transaction). Object IDs/actor refs confer **no authority**.
- **Deterministic events + projection:** each accepted mutation yields a versioned object event carrying the resulting object; `reduceRoomObjectEventV1` is pure (no clock/id/storage/network/notification/AI/endpoint, no silent fallback); replay validates all before applying any (no partial result) and reproduces state deep-equal.
- **Lifecycle/redaction/tombstone:** `active → archived (read-only) → redacted (content removed, one-way) → deleted_tombstone (terminal)`; redact/tombstone survive Emergency (safe/wipe direction). **Tombstoning is not forensic erasure.**
- **Retention:** memory/null object logs only; **no persistent plaintext content** (Gate F); Ghost/Bunker deny persistence (Bunker prefers null); Offline Capsule triggers no network/remote refs; Emergency denies ordinary create/edit. Matrix rows (`room.object.*`) + StoragePolicy + MetadataPolicy agree.
- **Not:** messaging transport, sync, CRDT, crypto, verified identity, authoritative voting/ownership, real persistence, AI, anti-spyware.

### What does NOT exist (honest)

No real messaging, no sync, no CRDT selection, no crypto/room keys, no identity/invites, no capsule import/export, no persistent storage (Standard fails hard until the encrypted backend; Ghost/Bunker never persist), no notifications, no AI, **no anti-spyware** — rooms are NOT safe for real secrets.

## Design direction

- **Local-first** — the authoritative room state lives on members' devices.
- **Operation-log based** — room state is derived from **signed/encrypted operations**, not from mutable shared documents.
- **Capsule-synced** — every room update crosses devices as an encrypted capsule ([ADR-0003](adr/ADR-0003-capsules-as-only-cross-device-format.md)).
- **Transport-agnostic** — a room syncs over relays, files, QR, USB, or LAN alike.
- **No central room server. No homeserver. No cloud document authority.** ([ADR-0001](adr/ADR-0001-no-project-owned-infrastructure.md))
- **Strict room policy** — each room carries a policy participating in the strictest-wins rule ([PRIVACY_MODEL.md — Policy conflict rule](PRIVACY_MODEL.md)); honest limit: it binds honest clients, not attackers.
- **Room state derived, never asserted** — a member's view of the room is a deterministic function of the authenticated operations they hold.
- **No pre-join history by default** — new members receive room state from their join point onward. Sharing earlier history is a future, explicit design decision (room-configurable at most, never silent).
- **Honest enforcement limits** — hostile clients cannot be forced to obey room policy; policy binds honest clients. Documentation and UI must never imply otherwise.

### Room object model

| Object | Notes |
| --- | --- |
| Messages | Chat, threads — one object type among many |
| Notes | Shared free-form notes |
| Documents | Versioned collaborative documents (merge model TBD — see open decision) |
| Files | Encrypted blobs referenced by room objects |
| Tasks | Assignable, stateful items |
| Decisions | Explicit signed records; see decision ledger |
| Polls | Structured group choice |
| Room memory | Curated durable knowledge (pinned facts, agreements) with provenance display |
| AI artifacts | Derived suggestions only; human-confirmed before entering room state ([ADR-0007](adr/ADR-0007-local-ai-disabled-by-default.md)) |

### Room operation log

Each member's client appends authenticated operations (add message, edit document, complete task, record decision) to an encrypted log; state is materialized from it. The log **is** the encrypted audit history: member-visible only, append-only per author, merge rules handling concurrency. Operation authentication is a crypto-design dependency (members must not be able to forge each other's operations).

### Room bundles

A room exportable as one encrypted artifact — operation-log slice plus referenced blobs, packed as capsules — for new-device onboarding, backup, and courier-based sync.

### Decision ledger and proof-of-agreement

Decisions are first-class, explicitly signed records — deliberately attributable where chat may prefer deniability (per-object-type trade-off, see [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md)). Proof-of-agreement: a decision capsule co-signed by agreeing members, verifiable by any member, meaningless outside the room without keys.

## Open design decision — synchronization model

**The CRDT/operation-log implementation is deliberately not chosen yet.** A formal evaluation is **required before implementation** (Gate H), and its outcome will be recorded in a new ADR. Candidates:

| Candidate | For | Against / must verify |
| --- | --- | --- |
| **Event-sourced operation log** (custom, per-object-type merge rules) | Full control; natural fit for capsule delivery; minimal dependency surface; audit history for free | Concurrent document editing needs real merge semantics; "custom" carries design risk |
| **Yjs** | Mature, fast, wide ecosystem | Metadata characteristics under encryption (actor IDs, update structure); GC/tombstone behavior vs. no-persistence modes; dependency weight — **TODO research** |
| **Automerge** | Principled CRDT model, audit-friendly change history | Payload size and performance envelope; same metadata questions — **TODO research** |
| **Loro** | Modern CRDT engine, strong performance focus, rich-text support | Younger ecosystem; maturity, audit history, and metadata characteristics — **TODO research** |
| **Custom CRDT-lite** (LWW registers + ordered logs for specific object types) | Tailored to exactly our object types; small surface | Easy to get subtly wrong; must not become "custom crypto" of the data layer — needs review discipline |

Likely hybrid outcome (to validate, not assume): operation log as the backbone for all object types, with a CRDT engine only for collaborative document bodies. Evaluation criteria: convergence guarantees under out-of-order/duplicated delivery, metadata leakage inside encrypted payloads, payload size vs. capsule padding buckets, tombstone/history behavior vs. Ghost/Bunker, dependency health, auditability.

## Security concerns

Named threats this design must answer (tracked against [THREAT_MODEL.md](THREAT_MODEL.md)):

- **Malicious room member** — full plaintext access is inherent; the design bounds what they can *forge*, *rewrite*, or *inject*, not what they can read or leak.
- **Operation replay** — replaying old operations (own or captured) to corrupt state; requires binding operations to room/epoch context.
- **History rewriting** — reordering or selectively withholding operations when syncing others; candidate mitigations: per-author hash-linked logs, cross-member attestation.
- **Unauthorized operation injection** — operations from non-members or forged authorship; requires member-scoped authentication of every operation.
- **Stale room bundle import** — importing an old bundle must never roll back state or resurrect removed members' access; import is merge, never replace.
- **Member removal and key rotation** — departed members keep what they received (unavoidable); confidentiality of *future* operations requires key rotation on membership change (crypto dependency, Gate F).
- **Document merge conflicts** — merge behavior must be deterministic and non-destructive; a conflict must never silently drop a member's contribution.
- **AI prompt injection through room documents** — a hostile member crafts content that steers AI features; threat annex required before any Q&A ships (Gate I).
- **Derived cache leaks** — search indexes, previews, AI artifacts outliving the room's storage policy; prevented structurally by cache inheritance ([ADR-0005](adr/ADR-0005-storage-selected-only-by-policy.md)).
- **Room policy ignored by hostile clients** — room policy binds honest clients only; UI and docs must never imply otherwise.
- **Room memory poisoning** — durable "facts" written by a hostile member gain unearned authority; provenance display is required on all room-memory entries.
- **Malicious document payloads** — documents are hostile input like any capsule content: parsed through the approved parser only, rendered through sanitized, allowlisted formatting ([CAPSULENET.md](CAPSULENET.md)).
- **Malicious file metadata** — filenames, MIME types, and embedded metadata are attack surface (path traversal, type confusion, tracking data smuggled in metadata); validated and sanitized before display or use.
- **Log divergence** — two members holding conflicting views of the same room (through attack or bug) without detection; requires divergence detection with honest, non-alarmist UX.

## Sync behavior

Out-of-order, partial, duplicated delivery is the **normal case** under multi-transport sync. The object model must converge deterministically regardless of arrival order; divergence detection needs honest UX ("this device may be missing updates") without alarm fatigue. Storage-policy conflicts across members resolve strictest-local-wins, visibly.

## Required tests (future — Gate H and beyond)

- Out-of-order operation convergence (same final state for any arrival permutation)
- Duplicate operation deduplication (idempotent application)
- Stale bundle handling (no rollback, no access resurrection)
- Unauthorized operation rejection (non-member and forged-author operations)
- Member revocation behavior (post-rotation operations unreadable by removed members)
- Room policy enforcement (strictest-wins against device mode, per operation type)
- No plaintext room state persistence in Ghost/Bunker (write-barrier integration)
- Document merge tests (deterministic, non-destructive, conflict-surfacing)
- Decision ledger authenticity tests (co-signature verification, tamper rejection)
- Room memory provenance tests (every entry attributable; provenance survives sync)
- AI cache policy tests (derived artifacts respect room storage policy; absent in Ghost/Bunker)
- Malicious room operation fuzzing (parser and merge robustness against crafted operations)

## Open questions

- One log per room vs. per object type per room?
- Pre-join history: the default (**no pre-join history**) is locked in the design direction above; whether rooms may *opt in* to sharing history with new members remains open *(TODO decide before Gate H)*
- What substitutes for trusted time in decisions/polls without a server?
- Epoch/snapshot design for log compaction without breaking auditability?

## Future research required

- CRDT evaluation per the table above (formal memo → ADR)
- Hash-linked / transparency-log constructions for member-verifiable history
- Group key agreement fit (MLS question in [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md))

## TODO

- [ ] Room object type schemas (draft, Phase 6 research)
- [ ] Formal CRDT/operation-log evaluation memo (incl. Loro) → new ADR (Gate H blocker)
- [ ] Membership change / key rotation design with crypto review
- [ ] Room bundle format aligned with CapsuleNet bundles
- [ ] Decision ledger + proof-of-agreement draft
- [ ] Design review of this document (Phase 0.5 exit criterion)
