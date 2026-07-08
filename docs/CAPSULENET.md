# CapsuleNet — Encrypted Capsules and the Blind Courier

## Purpose

Specify FreeLayer's central abstraction: the **capsule**, an encrypted, self-contained, transport-agnostic data object; and the **Blind Courier** principle that lets any medium carry capsules without being trusted.

## Current status

**Concept stage.** Capsule format, addressing, and spool behavior are Phase 4 (CapsuleNet MVP) deliverables. Everything below is design direction.

## The capsule

A capsule is a sealed envelope. Outside: the minimum needed to route and process it. Inside: encrypted payload, opaque to every carrier.

A capsule may contain:

- a message
- a file reference (or inline small file chunk)
- a document update
- a room update (operation-log entries)
- an invite
- a contact exchange
- a decision
- a task update
- a **bundle**: multiple encrypted objects packed as one capsule

### Envelope design direction

- Versioned, minimal header: format version, algorithm identifiers (crypto agility), routing hint (opaque), size-padded body.
- **No plaintext sender, recipient name, room name, or type information** in the envelope. Even "this is an invite" is inside the seal where feasible *(TODO: routing may need a coarse type bit — minimize and justify in protocol design)*.
- Canonical encoding defined in `packages/protocol` with test vectors.

## Blind Courier principle

> The transport is a courier that cannot read the letter, doesn't know who wrote it, and is assumed to be hostile.

Consequences:

- Confidentiality/integrity never depend on transport behavior.
- Any byte-moving channel is a valid transport: relays, QR codes, files, USB drives, LAN, external messengers, email, shared folders, future radio links, human couriers.
- Transports can drop, delay, duplicate, reorder, or replay — the protocol and room layers must tolerate all of it.

## Components

### Capsule Inbox
Unified intake: capsules arriving from any transport land in one inbox for verification → dedup → decryption → dispatch to the owning room/feature. Unknown or undecryptable capsules are quarantined, never auto-processed. **Capsules are hostile input**; parsing happens with strict validation and resource limits (see [THREAT_MODEL.md](THREAT_MODEL.md)).

### Capsule spool
Outbound queue: capsules awaiting a transport opportunity (a relay poll, a QR display, a file export). Spool respects storage policy (see [STORAGE_MODEL.md](STORAGE_MODEL.md)) and mode-based transport restrictions.

### Bundles
Many capsules packed into one artifact — "everything this room needs to catch up" — for file/USB/courier workflows and efficient batching (which also blunts timing metadata).

### QR capsules
Small capsules (invites, contact exchange, keys, short messages) rendered as QR sequences. Multi-frame encoding for anything beyond trivial size *(TODO design)*.

### Dead Drop mode
Sender and recipient never interact directly, even in time: capsules parked at an agreed location (a relay mailbox, a shared folder, a file path) and collected later. Decouples send/receive timing — a metadata mitigation, with the honest limit that the drop location itself observes access patterns.

## Capsule parsing is hostile-input parsing

Every capsule arrives through an untrusted courier and is treated as an attack until proven otherwise ([ADR-0003](adr/ADR-0003-capsules-as-only-cross-device-format.md)). Binding rules for all capsule-handling code:

- **Strict schema validation** — anything that does not match the versioned schema exactly is rejected.
- **Explicit size limits** at every level: envelope, payload, bundle member count, individual field lengths.
- **Explicit recursion/depth limits** — no recursive unbounded structures; nesting depth is capped and enforced.
- **No dynamic code** — nothing inside a capsule is ever evaluated, compiled, or executed.
- **No HTML rendering** of capsule content, and **no markdown rendering until sanitized and policy-approved**; rich text renders only through a safe, allowlisted formatting subset.
- **No remote asset fetching** triggered by capsule content, ever ([ADR-0008](adr/ADR-0008-no-external-assets-or-telemetry.md)).
- **No automatic decompression of untrusted payloads without limits** — decompression bombs are an attack class; expansion ratios and output sizes are bounded and enforced.
- **Unknown capsules go to quarantine** — unknown types or versions are never best-effort processed.
- **Undecryptable capsules are not auto-processed** — quarantined with policy-respecting bookkeeping, never retried in a loop, never silently dropped.
- **Malformed capsules are rejected safely** — bounded resource use, no crash, no partial state left behind.
- **Every parser must have fuzz tests before it is used in production** (Gate E — [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)).
- **All capsule formats carry version identifiers**, and **algorithm identifiers where relevant** (crypto agility, [ADR-0004](adr/ADR-0004-no-crypto-implementation-before-review.md)).
- **All replay/dedup behavior must be deterministic** — the same input set produces the same outcome regardless of arrival order.
- **Parsing happens before dispatch, and dispatch happens only after validation and policy check** — no feature ever sees capsule content that has not passed the full pipeline.

## Capsule wire format gates

No capsule implementation may start until all of the following exist (this is Gate E in [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)):

1. Wire format draft (versioned envelope, canonical encoding).
2. Test vector format (known-answer + interop vectors).
3. Hostile-input parser design (schemas, limits, error taxonomy).
4. Fuzz harness design.
5. Size limit policy (per level: envelope, payload, bundle, fields).
6. Replay/dedup design (deterministic, cross-transport).
7. Quarantine behavior specification (storage policy, user surfacing, retention).
8. Crypto design review of the envelope assumptions ([CRYPTO_DESIGN.md](CRYPTO_DESIGN.md), Gate F).

**TODO (Gate E blockers):**

- [ ] Capsule wire format draft before any implementation
- [ ] Fuzz harness for the capsule parser
- [ ] Test vector format (known-answer + interop vectors)
- [ ] Replay/dedup matrix (capsule types × transports × failure modes)
- [ ] Quarantine UX design (how users see, inspect, and purge quarantined capsules)

## Future protocol work (explicitly not designed yet)

- **Replay protection**: duplicate suppression is straightforward (capsule IDs + seen-window); *malicious* replay across contexts needs binding of capsules to room/epoch state — Phase 4 design with [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md).
- **Anti-spam / flooding resistance**: with no central authority, options are contact-gating (capsules from unknown senders are heavily rate-limited/quarantined), proof-of-work stamps (research: cost asymmetry), and invite-scoped intake. *(TODO research — hard problem, no promises.)*
- **Expiry**: capsule TTL semantics across transports that can't enforce them.

## Limitations (honest)

- Delivery is best-effort. No capsule is guaranteed to arrive, and "delivered" is only known if the recipient says so end-to-end.
- Capsule size padding and batching reduce but do not eliminate traffic analysis.
- A transport's own metadata (email headers, messenger accounts) is visible to that transport's provider — carrying capsules doesn't anonymize the carrier channel.
- Multi-transport redundancy trades duplication (and metadata surface) for delivery odds.

## Open questions

- Capsule ID design: random vs. content-derived (dedup power vs. correlation risk)?
- How much routing hint does a relay actually need? Can pickup be pull-only with blinded mailbox tokens?
- Bundle compression before encryption: size wins vs. compression-oracle risks *(likely: fixed policy, research)*?

## Future research required

- Store-and-forward prior art: Pond, Briar/Bramble, LXMF, mixnet mailbox designs
- QR multi-frame encoding formats and camera ergonomics
- PoW-style spam stamps: effectiveness and battery cost on mobile-class devices

## TODO

- [ ] Capsule envelope format draft (`packages/protocol`, Phase 4)
- [ ] Inbox pipeline spec: verify → dedup → decrypt → dispatch, with quarantine rules
- [ ] Spool policy spec tied to Privacy Modes
- [ ] Bundle format + export/import UX draft
- [ ] Replay-protection design with crypto review
- [ ] Anti-spam research memo
