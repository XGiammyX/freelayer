# FreeLayer Compared, Simply

*Audience: people asking "why does this need to exist?" For the research-grade version with per-project caveats, see [COMPETITOR_COMPARISON.md](COMPETITOR_COMPARISON.md).*

> **Two honest rules first.** (1) This is not an attack on any project — the tools below are excellent at what they do, ship real software to real users, and many directly inspire FreeLayer. (2) **FreeLayer is not implemented yet.** Every "FreeLayer aims to…" is a design direction with a gate in front of it, not a claim of being better today. Rows needing re-verification against current official docs are marked *TODO verify*.

## By category

| Category | Existing tools usually optimize for | What can still be a problem | FreeLayer design direction |
| --- | --- | --- | --- |
| Encrypted messengers | Strong message encryption with easy UX | A central service model, identifiers (phone/email), metadata, and everything after decryption | No required server, no identifiers, metadata reduction, and a planned endpoint-defense layer |
| Decentralized / federated systems | Removing the single company in the middle | Servers/relays/nodes are still core infrastructure someone must run and trust | Any courier can carry sealed capsules — including no network at all (files, QR, USB) |
| Collaboration tools | Rich rooms: docs, tasks, search, integrations | The workspace lives in a cloud that sees everything | Rooms with docs/tasks/decisions that live on members' devices |
| Transfer / offline tools | Simple, trustworthy one-time transfers | One-shot by design — no persistent rooms or messaging | Keep that simplicity for invites/capsule exchange, inside a persistent room platform |

## Encrypted messengers

| Project | Great at | Simple trade-off | FreeLayer direction |
| --- | --- | --- | --- |
| **Signal** | The reference for encrypted messaging; mature, audited | Central service; phone-number roots (username layer — *TODO verify*) | FreeLayer aims to need no central service and no phone/email at all |
| **WhatsApp** | Encrypted messaging at planetary scale | Account, platform, cloud-backup and metadata trust are central | User-owned rooms; no platform account |
| **Telegram (secret chats)** | Popular, fast, feature-rich | End-to-end encryption only in secret chats, not default (*TODO verify current state*); central platform | Private-by-default, serverless design |
| **SimpleX** | No user identifiers of any kind | The relay/queue model is the system's backbone | Relays are optional couriers, not the whole system |
| **Session** | No phone number; onion routing | Depends on its service-node network | No required network of any kind |
| **Briar** | Works in blackouts: P2P over Tor/Wi-Fi/Bluetooth | More limited as a workspace; peers sync when online (*TODO verify*) | Offline thinking plus full rooms: docs, tasks, decisions |

## Decentralized / federated systems

| Project | Great at | Simple trade-off | FreeLayer direction |
| --- | --- | --- | --- |
| **Matrix** | Powerful rooms, federation, huge ecosystem | Homeservers are still core infrastructure | Rooms without homeservers — devices hold the room |
| **Nostr** | Radically simple relay protocol; resilient | Public-first design; DM metadata visible to relays (*TODO verify NIP-17 state*) | Private sealed capsules by default, never queryable events |
| **Jami** | Fully distributed calls and messaging, no servers | DHT presence/metadata characteristics; multi-device friction (*TODO verify*) | No DHT — discovery only via invites exchanged out-of-band |
| **Reticulum / LXMF** | Transport-agnostic networking down to packet radio | A technical ecosystem, not a consumer app | Bring the same transport freedom into a usable room platform |

## Collaboration tools

| Product | Great at | Simple trade-off | FreeLayer direction |
| --- | --- | --- | --- |
| **Slack** | Team messaging with integrations | The workspace lives on company servers | Private local-first rooms |
| **Notion** | Flexible docs and knowledge bases | Cloud-hosted content, provider can access | Documents inside encrypted rooms on your devices |
| **Google Docs** | Real-time collaborative editing | Google hosts and processes the documents | Local-first documents synced by sealed capsules (sync model still being researched) |
| **Discord** | Communities and always-on rooms | Central platform; not end-to-end encrypted (*TODO verify current state*) | Sovereign rooms with no platform in the middle |

## Transfer / offline tools

| Project | Great at | Simple trade-off | FreeLayer direction |
| --- | --- | --- | --- |
| **Magic Wormhole** | Near-perfect one-time transfer UX (short codes) | One-shot transfers, not rooms | Borrow the short-code UX for invites and capsule handoff |
| **OnionShare** | Simple, private one-shot sharing over Tor | Ephemeral; both ends online | Persistent rooms with asynchronous delivery — same small-tool spirit |

## What FreeLayer learns from all of them

Protocol discipline and review culture (Signal) · identifier-free identity is viable (SimpleX) · transport reuse and transport-agnosticism (Delta Chat, Reticulum) · offline as a feature (Briar) · rooms are the right unit (Matrix, Quiet) · simplicity earns trust (Wormhole, OnionShare).

## The honest bottom line

FreeLayer combines ideas that usually live in separate projects — no identifiers, sealed objects over any courier, rooms beyond chat, core-enforced policy, endpoint defense — and pays for it with real costs: **slower delivery, best-effort reliability, harder spam control, and a long careful build**. It is research-stage software with no release; if you need private messaging today, use a mature audited tool.
