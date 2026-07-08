# FreeLayer Network Model

## Purpose

Describe how FreeLayer moves data between devices without any required, project-owned infrastructure, and document the risks and limits of each transport class.

## Current status

**Design stage.** No transport is implemented. The `Transport` interface and the relay protocol are Phase 4 deliverables.

## Foundational principle: no required infrastructure

- FreeLayer, the project, operates **no servers users must depend on**.
- Every networked component is optional, self-hostable, and replaceable by a non-networked transport.
- If every relay on the internet disappeared, FreeLayer would still function over QR, files, USB, and LAN.
- Transports are **blind couriers**: they carry opaque encrypted capsules and are assumed hostile (see [THREAT_MODEL.md](THREAT_MODEL.md)).

## Network side-effect barrier

**No package may open a network connection unless all of the following hold** (network mirror of the storage write barrier — [ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md), [STORAGE_MODEL.md — Write barrier](STORAGE_MODEL.md)):

- NetworkPolicy allows the operation.
- The active mode allows it (strictest wins — [PRIVACY_MODEL.md](PRIVACY_MODEL.md)).
- The transport is explicitly selected or allowed by policy.
- The behavior is represented in [PBOM.md](PBOM.md).
- A metadata leakage warning exists in UX where the transport requires one ([METADATA_MODEL.md](METADATA_MODEL.md)).

Standing rules:

- No automatic update check by default (any future check is manual, user-initiated).
- No telemetry endpoint, ever ([ADR-0008](adr/ADR-0008-no-external-assets-or-telemetry.md)).
- No remote fonts/scripts, no remote avatars, no automatic link previews ([NO_EXTERNAL_ASSETS_POLICY.md](NO_EXTERNAL_ASSETS_POLICY.md)).
- No background network activity that is not represented in PBOM.
- The relay transport is optional and self-hostable; `apps/relay` must never become required infrastructure ([ADR-0001](adr/ADR-0001-no-project-owned-infrastructure.md)).

TODO (Gate D — [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)):

- [ ] Define the NetworkPolicy interface
- [ ] Define transport leakage labels (schema + UX)
- [ ] Define the zero-egress test for the default build
- [ ] Define the "Bunker: no direct transport" test

## Transport classes

### Relay transport (optional)
Self-hostable store-and-forward node (`apps/relay`). Holds ciphertext capsules addressed by opaque routing hints until collected. Anyone can run one; clients can use several simultaneously.

- Risks: relay sees arrival/pickup timing, capsule sizes (mitigated by padding), client IPs (mitigated by future Tor/proxy support). A popular relay becomes a metadata concentration point — relay diversity is a health metric, not an afterthought.

### QR transport
Capsules encoded as QR code sequences for fully air-gapped, in-person or camera-relayed exchange.

- Risks: low bandwidth (fine for keys/invites/short messages; poor for media); shoulder-surfing at exchange time; multi-frame protocol needed for larger capsules *(TODO design)*.

### File / bundle transport
Capsules exported as files — moved by USB drive, shared folder, cloud drive, or any file channel. Bundles pack many capsules (a room's pending updates) into one artifact.

- Risks: the file channel's own metadata (names, timestamps, accounts); stale-bundle replay (protocol must handle duplicates idempotently); users forgetting exported bundles on media.

### External app / email courier
Capsule blobs sent through existing channels (any messenger, email).

- Risks: **the courier's metadata is fully visible to that provider** — sender, recipient, time. Content stays sealed, but the relationship leaks to the courier. UI must label this honestly.

### LAN transport
Discovery and transfer on a local network for same-site sync (e.g. desktop ↔ laptop).

- Risks: presence broadcast reveals a FreeLayer device on the LAN — discovery must be off in Bunker; local attackers can observe transfers (still ciphertext).

### Future transports (research)
- **Tor / proxy layering** for relay connections — IP protection.
- **Radio adapters** (e.g. LoRa-class links) — extreme latency/bandwidth constraints; capsule format must already fit this envelope, which is why size discipline matters now.
- **Offline courier ("sneakernet") workflows** — first-class UX for moving bundles via people, not networks.

## Delivery semantics

- **Best-effort, at-least-once.** Capsules may arrive late, out of order, duplicated, or never. The protocol layer deduplicates; the room layer merges out-of-order operations (see [SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md)).
- No transport is trusted for delivery confirmation; acknowledgements are themselves end-to-end capsules.

## Risks and limitations (summary)

- Serverless delivery is **slower and less reliable** than centralized push. This is a real trade-off, accepted deliberately and stated openly.
- Spam/abuse control without a central authority is hard (see [CAPSULENET.md](CAPSULENET.md) — anti-spam future).
- Multi-transport operation multiplies the metadata story; per-transport leakage labels are required UX *(TODO)*.
- NAT traversal for any future direct mode conflicts with IP-privacy goals; direct connections stay policy-gated.

## Open questions

- Relay addressing: how do recipients advertise pickup points without creating a lookup service? (Candidate: pickup hints inside invites/contact capsules.)
- Multi-relay redundancy: send to N relays — dedup cost vs. delivery odds?
- Relay retention limits and capsule expiry semantics?

## Future research required

- Survey: Reticulum/LXMF, Briar/Bramble, Pond/mixnet designs for store-and-forward lessons
- Tor integration patterns for Tauri and browsers
- LAN discovery protocols with minimal presence leakage

## TODO

- [ ] `Transport` interface specification (Phase 4)
- [ ] Relay protocol draft with blinded addressing (Phase 4)
- [ ] Per-transport metadata leakage annex to THREAT_MODEL.md
- [ ] Capsule expiry/retention policy design
