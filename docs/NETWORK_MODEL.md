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

## TECH-09 — Zero-egress default build tests

**The default build makes no automatic network egress on load — machine-checked across four layers** ([research](research/ZERO_EGRESS_RESEARCH.md) · [threat model](audits/TECH_09_ZERO_EGRESS_THREAT_MODEL.md) · [audit](audits/TECH_09_ZERO_EGRESS_AUDIT.md)):

1. **Static source scan** (`check:no-forbidden-network`) — egress API/import tokens, `http:`/`ws(s):`, Node net libs, HTTP client libs, Tauri HTTP, plus a remote-**host allowlist** (only `github.com` navigation anchors permitted in source, reported transparently). CLI modes: default source, `--build <dir>`, `--all`.
2. **Build artifact scan** (`check:build-zero-egress`) — over `apps/web/dist`: a remote-host allowlist ({github.com nav, www.w3.org namespaces, react.dev error links — all benign strings, never fetched}), remote-asset markup detection in built HTML/CSS, and an analytics/telemetry/AI-host denylist. The real build is clean.
3. **Runtime trap** (`createZeroEgressRuntimeTrap`) — patches fetch/XHR/WebSocket/EventSource/RTCPeerConnection/RTCDataChannel/sendBeacon/`serviceWorker.register`/`Image`; FreeLayer's load path (SDK + NetworkPolicy + transports) calls none; positive controls prove the trap fires.
4. **Dependency scan** (`check:no-network-deps`) — no network-client/analytics/AI/Tauri-HTTP dependency anywhere.

Plus: broadened **remote-asset scan** (`check:no-external-assets`), a **service-worker audit** (none exists — [PWA audit](audits/PWA_SERVICE_WORKER_NETWORK_AUDIT.md)), and a **GitHub Actions egress audit** (GitHub-only — [audit](audits/GITHUB_ACTIONS_EGRESS_AUDIT.md)).

**Honest scope — two distinct things:**

- **App runtime egress = zero** (verified above).
- **Development/CI egress exists and is expected:** `pnpm install` contacts the npm registry; GitHub Actions/CodeQL/Dependabot contact GitHub. This is _not_ app behavior and is documented separately ([PBOM.md](PBOM.md)). Neither TECH-09 nor anything else can stop the OS, browser, extensions, package manager, or GitHub infrastructure from using the network.

**Why not just scan minified JS for `fetch(`?** Because React DOM embeds `fetch(`/`createElement('script')` dormantly for its resource APIs — token-scanning would flag every React app falsely. The runtime trap is the real proof. **Deferred:** full in-browser render egress verification (AUDIT-HARD, Playwright).

## TECH-08 — NetworkPolicy implementation

**NetworkPolicy v0 exists and is machine-checked; no real network is implemented** ([research](research/NETWORK_POLICY_RESEARCH.md) · [threat model](audits/TECH_08_NETWORK_THREAT_MODEL.md) · [audit](audits/TECH_08_NETWORK_POLICY_AUDIT.md)):

- **Taxonomy** (`packages/transports`): 13 `NetworkOperationKind`s, 12 `TransportClass`es, `NetworkCapability`, `MetadataExposureLevel`/`MetadataSensitivity`, `NetworkRequest`.
- **`resolveNetworkPolicy`** — default deny; strictest wins; room policy tightens only; unknown operation/transport/mode **fail closed**.
- **Barrier** — `assertNetworkOperationAllowed(request, decision, policy)` requires a `PolicyDecision` scoped to _exactly_ the operation (network/directTransport capability; `generic` rejected); precise errors for telemetry, external assets, link previews, and direct peer connections.
- **Transports** — only `NoopTransport` (validates, does nothing) and `MockNetworkTransport` (test-only, in-memory); both declare `performsRealNetwork: false`. **No fetch, WebSocket, WebRTC, EventSource, sendBeacon, or Tauri HTTP anywhere.**
- **Always denied, every mode:** telemetry, external assets, automatic link previews, remote AI, update checks (ADR-0008).
- **Direct peer connections (WebRTC):** denied in Standard/Private/Ghost/Bunker — a page can read your real IP via ICE/STUN with no prompt (research).
- **Offline Capsule and Emergency:** all network denied. **Ghost/Bunker:** direct network denied. **HTTP/WebSocket/LAN:** forbidden until an approved transport exists. **QR/file/USB:** offline transports, not network operations.
- **Endpoint validation** (`validateNetworkEndpoint`) — misuse detector rejecting insecure scheme, credentials-in-URL, private/loopback hosts, `file:`/`data:`/`blob:`, suspicious query keys, and the network sentinel; never enough on its own to _allow_, and never echoes the endpoint.
- **Metadata leakage labels** (`describeNetworkMetadataLeakage`) — honest per-transport exposure (IP/timing/size/relationship/third-party) with plain-language summaries.
- **Forbidden-network guardrail** (`check:no-forbidden-network`) — source scan for `fetch(`/`WebSocket`/`RTCPeerConnection`/`sendBeacon`/`http:`/Tauri HTTP/Node net libs/HTTP client libs, with fixture self-tests; wired into CI and `audit:privacy`.
- **Runtime trap** — proves the policy layer and mock transports touch no network API; positive controls prove the trap fires.
- **TECH-09 relationship:** this is the foundation; TECH-09 does full-build zero-egress verification.

Honest scope: NetworkPolicy governs **FreeLayer application behavior** — it cannot stop the OS, package manager, GitHub, the browser, extensions, or malware from using the network.

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

- Risks: low bandwidth (fine for keys/invites/short messages; poor for media); shoulder-surfing at exchange time; multi-frame protocol needed for larger capsules _(TODO design)_.

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
- Multi-transport operation multiplies the metadata story; per-transport leakage labels are required UX _(TODO)_.
- NAT traversal for any future direct mode conflicts with IP-privacy goals; direct connections stay policy-gated.

## Open questions

- Relay addressing: how do recipients advertise pickup points without creating a lookup service? (Candidate: pickup hints inside invites/contact capsules.)
- Multi-relay redundancy: send to N relays — dedup cost vs. delivery odds?
- Relay retention limits and capsule expiry semantics?

## Future research required

- Survey: Reticulum/LXMF, Briar/Bramble, Pond/mixnet designs for store-and-forward lessons
- Tor integration patterns for Tauri and browsers
- LAN discovery protocols with minimal presence leakage

## Coordination with the Metadata Firewall (TECH-10)

Network behavior is metadata-producing behavior. The per-transport leakage labels here must coordinate with MetadataPolicy ([METADATA_MODEL.md](METADATA_MODEL.md)):

- WebRTC/direct connections expose IP/NAT metadata (ICE candidates) — `webrtc.ice_candidate` is a denied network-metadata event; NetworkPolicy denies the WebRTC transport in Private/Ghost/Bunker. The two agree (integration test).
- Relay-poll timing, request timing/size, and relay choice are metadata (`transport.poll`, `transport.send_timing`, `transport.size`, `relay.choice`) — denied in v0 (no network) and always in offline/strict modes.
- Link preview and external-asset fetch are metadata-producing egress — denied by both NetworkPolicy and MetadataPolicy in every mode.

### TECH-11 — link previews and external assets are network side effects

Automatic link previews and remote assets (images/fonts/scripts/CSS/avatars/favicons/OpenGraph images/tracking pixels) are network side effects and are denied in every mode. Connection hints — `preconnect`, `dns-prefetch`, `preload`, `prefetch` to remote origins — produce DNS/TCP metadata _before_ any content is fetched and are likewise forbidden. `LinkPreviewPolicy`/`ExternalAssetPolicy` agree with NetworkPolicy's `link.preview`/`asset.fetch` denials. Future transports must not reintroduce preview fetches; a future preview must be user-initiated through an IP-protecting transport with `Referrer-Policy: no-referrer` ([WEB_SECURITY_HEADERS.md](WEB_SECURITY_HEADERS.md)).

### TECH-13 — network behavior is summarized in the Policy Matrix

NetworkPolicy must not contradict the [Policy Matrix](POLICY_MATRIX.md) (agreement is test-enforced): Offline Capsule's total network denial, the always-forbidden operations (telemetry / external assets / link previews / remote AI / update checks / push), and the future-gated real transports are all matrix-covered rows.

### TECH-22 — policy composition + posture are zero-network

Room policy composition, DevicePosture resolution, and governance perform zero network I/O. There are **no remote posture checks, no device-assurance service, no policy distribution, and no Secure Device network bridge** — the (external) Secure Device project would supply posture locally in a future integration, never over a FreeLayer network call. Offline Capsule remains offline; room policy `networkAllowed`/`directPeerAllowed` are conservative and RoomOS stays zero-network in v1 regardless.

### TECH-19 — queries are zero-network

RoomOS queries perform zero network I/O (trap-tested). There is no remote query API, no remote/synchronized search, no file resolution, and no link preview from a query. URL-like text in a message is returned as plain text and never triggers a preview or fetch; file-reference views expose only an opaque `localRefId`. Remote/synchronized queries remain Gate H.

### TECH-18 — object mutations are zero-network

Object creation/edit/redaction and the object mutation log perform zero network I/O (trap-tested). File-reference objects carry no URL/remote path and are never fetched, uploaded, downloaded, previewed, or thumbnailed (`room.object.file_remote`/`file_preview` deny; `file_resolve` future-gate). Messaging transport, delivery, and sync remain Gate H.

### TECH-17 — replay and the operation log are zero-network

The local operation log is **not a transport** and replay performs zero network I/O (trap-tested). Synchronization remains Gate H; there is no awareness/presence provider and no relay polling. Offline Capsule denies room network categorically.

### TECH-16 — RoomOS has no network

The RoomOS foundation performs **zero** network operations: no sync, no relay polling, no CRDT network provider — `room.sync` is pinned `future_gate` (Gate H) by both matrix validators, `RoomPolicy.allowNetworkSync` is false in every mode, Offline Capsule denies room network categorically, and traps prove no network API fires during room operations.

### TECH-12 — push notifications are network behavior

Push notifications (Web Push / APNs / FCM-like systems) require a push service, a subscription with endpoint metadata, and background delivery — network behavior FreeLayer does not implement and does not require by default. `NotificationPolicy` denies push subscribe/receive and service-worker notifications in every mode; NetworkPolicy independently denies the network they would need. Any push service provider metadata would require a future PBOM entry and an ADR/research gate. No push network by default.

## TODO

- [ ] `Transport` interface specification (Phase 4)
- [ ] Relay protocol draft with blinded addressing (Phase 4)
- [ ] Per-transport metadata leakage annex to THREAT_MODEL.md
- [ ] Capsule expiry/retention policy design

## Secure Device provider — zero network (TECH-23)

A Secure Device provider in core makes **no network calls**. The only shipped provider (`NullSecureDeviceProviderV1`) is side-effect-free: no storage, no network, no native calls. Posture assessments never egress, are never fetched remotely, and emit no telemetry. The core-boundary guardrail flags any network primitive used with provider/assessment/posture identifiers.
