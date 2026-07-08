# Landscape Comparison

[← Docs Index](README.md) · [Readable public version](PUBLIC_COMPARISON.md)

> [!NOTE]
> Research-grade comparison with per-project caveats. Rows marked *TODO research* need verification against current official documentation — each one is a ready-made [contributor task](CONTRIBUTOR_TASKS.md).

> **Disclaimer:** This comparison exists to explain FreeLayer's design choices, not to attack other open-source projects. Projects listed here are valuable contributions to private and decentralized communication. FreeLayer learns from all of them, and several solve problems FreeLayer has not solved yet.

## Purpose

Position FreeLayer honestly within the private/decentralized communication landscape: what each project does well, the trade-offs it accepted, what FreeLayer learns from it, and where FreeLayer's approach differs.

## Current status

**Initial placeholders.** Entries are first-pass summaries from general knowledge; every row needs verification against current documentation of each project. Unverified or unknown areas are marked **TODO research**. Corrections via issues/PRs are very welcome — especially from contributors to the projects listed.

## Method notes

- "Limitation / trade-off" describes an *engineering trade-off*, not a flaw. Every architecture pays somewhere.
- FreeLayer is unimplemented; comparisons are between *designs*, and FreeLayer's own claims are intentions, not achievements.

## Comparison

| Project | Main strength | Limitation / trade-off | What FreeLayer learns | What FreeLayer does differently |
| --- | --- | --- | --- | --- |
| **Signal** | Gold-standard E2EE protocol (double ratchet, sealed sender); massive real-world hardening | Centralized servers; phone number required (username layer added — TODO research current state) | Protocol discipline, external review culture, sealed-sender metadata thinking | No central server at all; no mandatory identifier; multi-transport instead of one pipe |
| **SimpleX** | No user identifiers of any kind; unidirectional queues as anti-metadata design | Depends on (self-hostable) SMP relay servers; queue management complexity — TODO research | Identifier-free design is viable; queue-based metadata reduction | Relays are only one transport among many; capsules also move fully offline (QR/file/USB) |
| **Session** | No phone number; onion-routed via a decentralized service-node network | Service-node network as a dependency; modified protocol removed forward secrecy historically — TODO research current state | Demand for identifier-free messaging; onion-routing UX lessons | No required network of any kind, including a decentralized one; FS treated as a first-class design question |
| **Briar** | True P2P over Tor/Wi-Fi/Bluetooth; works during internet blackouts; forum/blog features | Android-centric; sync limited to online peers — TODO research desktop status | Offline-first transports are practical; mesh thinking; blackout resilience | Store-and-forward capsules (asynchronous by default) rather than online-peer sync; room objects beyond forums |
| **Matrix / Element** | Rich rooms, federation, huge ecosystem, bridging | Server-based federation; historical metadata visibility at homeservers — TODO research current E2EE/metadata state | Rooms-as-platform validated; the cost of retrofitting E2EE onto a server-first design | Local-first rooms with no homeserver concept at all |
| **Cwtch** | Metadata-resistant design on Tor onion services; group research | Tor dependency; asynchronous delivery requires (untrusted) server assistance — TODO research | Explicit metadata threat modeling as a project pillar | Transport-agnostic rather than Tor-bound; Tor becomes one optional transport |
| **Ricochet Refresh** | Radically simple: identity = onion address, no servers, no metadata stored | Both parties must be online; no async, no groups — TODO research current scope | The power of "no account, no server" minimalism | Asynchronous capsules and rooms; accepts more complexity for offline delivery |
| **Berty** | Serverless P2P over IPFS/libp2p with BLE/mDNS offline transports; no identifiers | libp2p/IPFS stack complexity; delivery reliability — TODO research maturity | Multi-transport P2P ambition; mobile offline transport experience | Capsule store-and-forward model rather than live P2P DHT; simpler, dumber transports by design |
| **Jami** | Fully distributed (DHT), no servers, calls + messaging; GNU project | DHT presence/metadata characteristics; multi-device sync friction — TODO research | Serverless calling is possible; DHT trade-offs | No DHT; discovery via invites/out-of-band exchange only |
| **Delta Chat** | Uses existing email infrastructure — no new network needed; Autocrypt E2EE | Email metadata fully visible to providers; encryption limits with non-Delta peers — TODO research current chatmail state | **Transport reuse is powerful** — closest prior art to Blind Courier over email | Email is *one* courier among many; envelope designed for metadata minimization rather than inheriting email's |
| **Nostr clients** | Radically simple relay protocol; censorship resistance through relay multiplicity | Public-by-default model; DM metadata visible to relays (NIP-17 improvements — TODO research) | Relay multiplicity as resilience; simplicity as adoption fuel | Private-by-default; relays carry sealed capsules, not queryable events |
| **Reticulum / LXMF** | Transport-agnostic networking stack down to LoRa/packet radio; store-and-forward LXMF | Ecosystem maturity/UX; not a consumer messenger itself — TODO research | **Strongest prior art for transport-agnostic design**; radio-class constraints inform capsule sizing | Consumer-grade rooms/UX on top of similar transport philosophy; TS/web-first stack |
| **Quiet** | Serverless team spaces (Slack-like) over Tor onion services | Tor dependency; team-size/latency constraints — TODO research current status | Rooms-not-just-chat without servers resonates; onion-service group lessons | Multi-transport capsules instead of Tor-only; offline (non-network) sync paths |
| **Keet / Holepunch** | Impressive P2P (hyperswarm/hypercore) with video; no servers | Parts of stack historically non-open + token association — TODO research current licensing | P2P append-only logs for shared state (relevant to room operation logs) | Fully open, no token, no company-controlled stack; async capsules over live P2P |
| **OnionShare** | Simple, excellent one-shot sharing/chat over onion services | Ephemeral sessions; both ends online; not persistent messaging | Small sharp tools earn trust; onion-service ergonomics | Persistent rooms and async delivery; different problem, shared spirit |
| **Magic Wormhole** | Near-perfect UX for one-time authenticated transfer (PAKE codes) | One-shot, synchronous, single file/message scope | **PAKE-style short codes for invites/verification** — direct inspiration for invite UX | Ongoing relationships and rooms rather than one-shot transfer |

## Synthesis — where FreeLayer sits

FreeLayer's bet combines: **identifier-free identity** (SimpleX, Ricochet), **transport-agnosticism taken further than messaging projects usually go** (Reticulum's philosophy, Delta Chat's reuse insight, generalized to *any* byte channel including QR/USB/courier), **rooms as operational spaces** (Matrix/Quiet direction, but local-first with no homeserver), and **store-and-forward capsules** as the single unifying object. The honest cost: latency, delivery uncertainty, and spam/abuse difficulty — documented in [NETWORK_MODEL.md](NETWORK_MODEL.md) and [THREAT_MODEL.md](THREAT_MODEL.md).

## TODO

- [ ] Verify every row against each project's current docs (each is a discrete, contributor-friendly task)
- [ ] Add columns: license, group support, multi-device story — after verification pass
- [ ] Invite review from communities of listed projects
- [ ] Re-check annually; landscape moves fast
