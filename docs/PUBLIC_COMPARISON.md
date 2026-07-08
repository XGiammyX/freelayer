# FreeLayer and the Landscape — Public Comparison

> **Disclaimer:** This comparison explains FreeLayer's design choices. It is not an attack on other projects — many of them solve hard problems, ship real software to real users, and directly inspire FreeLayer. Where FreeLayer differs, it differs in *design direction*, not in proven capability.

> **Honest status:** FreeLayer is **not production software**. It is in the foundation stage: no release, no implemented cryptography, no product features. Every "FreeLayer aims to…" below is an intention with a documented gate in front of it, not a shipped property. Rows marked *TODO verify* need re-checking against each project's current state — corrections are welcome, especially from those projects' contributors.

This is the readable version; the research-grade table with per-project caveats lives in [COMPETITOR_COMPARISON.md](COMPETITOR_COMPARISON.md).

## The landscape

| Project | What it does brilliantly | Trade-off it accepted | FreeLayer's design direction |
| --- | --- | --- | --- |
| **Signal** | The reference for E2EE messaging UX and protocol rigor | Central service; phone-number identity roots (username layer added — *TODO verify*) | No required backend at all; no phone/email identity |
| **SimpleX** | No user identifiers of any kind | Relay/queue model complexity | Learn identifier minimization; make relays just one of many transports |
| **Session** | No phone number; onion-routed | Depends on its service-node network | No required network of any kind — capsules also move fully offline |
| **Briar** | True P2P over Tor/Wi-Fi/Bluetooth; works in blackouts | Workspace features are limited; sync needs online peers (*TODO verify*) | Combine offline-first thinking with full Sovereign Rooms |
| **Matrix / Element** | Rich rooms, federation, huge ecosystem | Homeserver-based architecture | Rooms without homeservers: local-first state, capsule sync |
| **Nostr clients** | Radically simple relay protocol; censorship resilience | Public-first events; DM metadata trade-offs (*TODO verify NIP-17 state*) | Private-by-default sealed capsules, never queryable events |
| **Reticulum / LXMF** | Transport-agnostic networking down to packet radio | Technical ecosystem, not consumer UX | Bring the same transport philosophy into UX-first rooms |
| **Quiet** | Serverless team collaboration direction | Tor-specific architecture | Multi-transport rooms; Tor becomes one optional transport |
| **Keet / Holepunch** | Impressive direct P2P sync with media | P2P availability/NAT/IP exposure trade-offs | Transport choice governed by policy (Bunker mode can forbid direct connections) |
| **Magic Wormhole** | Near-perfect one-time transfer UX (short codes) | One-shot transfers, not persistent messaging | Borrow the short-code UX for invites and capsule exchange |
| **OnionShare** | Simple, trustworthy one-shot sharing over onion services | Ephemeral; both ends online | Persistent rooms and asynchronous delivery; same small-tool spirit |
| **Delta Chat** | Reuses email infrastructure — no new network needed | Email metadata fully visible to providers | The closest prior art to the Blind Courier idea — generalized to *any* channel with a metadata-minimal envelope |

## What FreeLayer learns from them

- **Protocol discipline and review culture** (Signal) — which is why FreeLayer's crypto is blocked until reviewed, not shipped early.
- **Identifier-free identity is viable** (SimpleX, Ricochet lineage).
- **Transport reuse is powerful** (Delta Chat) and **transport-agnosticism can go all the way down** (Reticulum).
- **Offline is a feature, not a fallback** (Briar).
- **Rooms are the right unit for collaboration** (Matrix, Quiet).
- **Simplicity earns trust** (Magic Wormhole, OnionShare).

## What FreeLayer aims to do differently

One architecture that combines: identifier-free identity, **capsules as the only cross-device format** over *any* byte-carrying medium (including QR/USB/courier — no required network), **rooms as operational spaces** rather than message streams, and **privacy enforced by a core policy engine** rather than UI settings. The honest cost, accepted openly: higher latency, best-effort delivery, and harder spam control than centralized designs — documented in [NETWORK_MODEL.md](NETWORK_MODEL.md) and [THREAT_MODEL.md](THREAT_MODEL.md).

## TODO

- [ ] Verification pass of every *TODO verify* row against current project documentation
- [ ] Invite review from the communities of the projects listed
- [ ] Re-check annually
