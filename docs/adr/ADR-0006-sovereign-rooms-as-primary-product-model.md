# ADR-0006: Sovereign Rooms as the primary product model

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

FreeLayer could be built as "another private messenger" with rooms bolted on later. That ordering produces chat-shaped architecture: message streams as the core abstraction, everything else as attachments. FreeLayer's thesis is the opposite — private groups need operational spaces (documents, tasks, decisions, memory), and chat is one object type within them.

## Decision

1. **The Sovereign Room is FreeLayer's primary product model and primary unit of design.** Product, protocol, and storage design orient around rooms; a 1:1 conversation is a minimal room, not a separate system.
2. A room is an **encrypted, local-first operational space** ([SOVEREIGN_ROOMS.md](../SOVEREIGN_ROOMS.md)) that may contain: messages, notes, documents, files, tasks, decisions, polls, room memory, local AI summaries, document Q&A artifacts, the room operation log, and encrypted audit history.
3. Room state is derived from **signed/encrypted operations** synchronized as capsules (ADR-0003) — no central room server, no homeserver, no cloud document authority.
4. Rooms carry a **room policy** that participates in policy evaluation under the strictest-wins rule (ADR-0002), with the documented honest limit that room policy binds honest clients, not attackers.
5. The concrete synchronization model (event-sourced log vs. Yjs vs. Automerge vs. custom CRDT-lite) is **deliberately undecided**: a formal evaluation is required before implementation, and its outcome will be recorded in a new ADR.

## Consequences

- Messaging MVP (Phase 5) is built on room primitives, even for 1:1 — no throwaway chat architecture.
- Room complexity (merge rules, membership, key rotation) is confronted early rather than retrofitted.
- The object-type model must be extensible without protocol breaks (versioned schemas, ADR-0003).

## Security impact

- The room operation log is the room's audit trail: authenticated operations, member-verifiable history. History manipulation, replay, and unauthorized injection are named threats with required tests ([SOVEREIGN_ROOMS.md](../SOVEREIGN_ROOMS.md)).
- Membership change and key rotation are first-class design obligations, not afterthoughts.

## Privacy impact

- Room content of every type inherits capsule confidentiality and storage policy uniformly.
- Pre-join history exposure is a deliberate design decision (default direction: no pre-join history) rather than an accident of implementation.

## What would require a new ADR

- The CRDT/operation-log model selection (mandatory future ADR, after formal evaluation).
- Any room feature requiring server-side coordination.
- Any second, parallel collaboration model outside rooms.
- Weakening room policy participation in the strictest-wins rule.
