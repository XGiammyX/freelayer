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

**Design stage.** No implementation exists; implementation is blocked behind Gate H ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)). This document must be complete enough for design review — that is a Phase 0.5 exit criterion.

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
