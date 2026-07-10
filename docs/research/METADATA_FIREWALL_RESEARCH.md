# Metadata Firewall — Research Note (TECH-10)

_Date: 2026-07-10. Informs the MetadataPolicy design in `packages/privacy`._

> [!NOTE]
> **Source verification pending: live internet was unavailable in this environment.** The facts below are well-established, stable web-platform and privacy-engineering knowledge (author cutoff 2026-01). Specific spec wordings and current-version details should be re-confirmed against the primary sources named before any of this is cited externally. No claim here depends on an unverified novel result.

## Why this pass

Encrypted content is not enough. An app leaks *who / when / how-often / how-big / with-whom* through side channels that never touch message bodies. TECH-10 makes those side channels explicit and policy-gated. Scope is an **app-level boundary** — not anonymity, not defense against a global passive adversary, not elimination of metadata.

## 1. OWASP MASVS / MASTG (privacy & network)

**Reviewed (pending live re-confirm):** OWASP MASVS categories for storage, network communication, and privacy; MASTG test guidance on sensitive data in logs/local storage and on network-observable metadata.

**Summary:** MASVS treats logs, caches, debug artifacts, and local storage as places sensitive data leaks; it requires sensitive data be kept out of them and that network communication minimize observable metadata. Privacy guidance treats behavioral signals (who/when) as sensitive, not just content.

**FreeLayer implications (applied):**
- Metadata is modeled as sensitive/content-adjacent data (`MetadataSensitivity`).
- Logs and audit events are redacted by construction (`createRedactedAuditEvent`, `redactMetadataPayload` keep numeric/boolean counters only — never strings).
- Every metadata-producing behavior is policy-gated (`resolveMetadataPolicy` + the barrier).
- Tests prove metadata signals are absent in strict modes (privacy-regression suite).

## 2. Browser request metadata (MDN)

**Reviewed (pending live re-confirm):** MDN `Referrer-Policy`, the `Referer` header, link-navigation metadata, and the resource hints `preconnect` / `dns-prefetch` / `preload` / `prefetch`; remote-asset request metadata.

**Summary:** Any outbound request (asset, preview, hint) leaks IP, timing, and often a `Referer`. Resource hints trigger early connections/DNS before user intent. `Referrer-Policy: no-referrer` suppresses the referrer; it does not suppress the request itself.

**FreeLayer implications (applied):**
- Automatic link previews are always denied (`link.preview` forbidden in every mode; agrees with NetworkPolicy).
- External assets/fonts/images/avatars are forbidden (`asset.remote_fetch`, `avatar.remote_fetch` denied; ADR-0008).
- Resource hints are out of scope now; the app and docs ship zero remote resources (check-no-external-assets / build-zero-egress).
- Future external navigation must carry `Referrer-Policy: no-referrer`-equivalent and no room/message context — recorded as a TECH-11 TODO.

## 3. WebRTC / direct connection metadata (MDN/WebRTC)

**Reviewed (pending live re-confirm):** MDN `RTCPeerConnection`, ICE candidate gathering, STUN/TURN, host/srflx/relay candidate types.

**Summary:** ICE gathering enumerates local and reflexive addresses; STUN reveals the public IP even behind a VPN in some configurations. A direct peer connection exposes IP and NAT/topology metadata to the peer.

**FreeLayer implications (applied):**
- `webrtc.ice_candidate` is a network-metadata event, denied in v0; WebRTC transport stays denied in Private/Ghost/Bunker (NetworkPolicy). MetadataPolicy and NetworkPolicy agree (integration test).
- Direct/LAN transports carry metadata labels and user-visible warnings when they eventually exist; not implemented now.

## 4. Notifications & local metadata (MDN + OS docs)

**Reviewed (pending live re-confirm):** MDN Notification API permission model and `Notification` content; OS notification-center / lock-screen preview behavior; badge APIs (`navigator.setAppBadge`); push metadata.

**Summary:** Notification content can surface on a lock screen and in an OS notification center outside the app's control. Even a content-free badge or "room active" ping is behavioral metadata. Push services see delivery metadata.

**FreeLayer implications (applied):**
- Notification content is denied in strict modes; in v0 all `notification.*` events are denied (no notifications implemented). `check-no-metadata-bypass` flags `new Notification(` / `navigator.setAppBadge`.
- Notification policy lives under the Metadata Firewall (`evaluateNotificationPolicy`).
- Push services are not permitted by default (no network).

## 5. Messaging metadata prior art

**Reviewed (documented prior art):** read receipts, typing indicators, presence/last-seen, delivery acknowledgements; Signal's *sealed sender* (metadata reduction); traffic-analysis limits; padding/batching/cover-traffic trade-offs.

**Summary:** Receipts/typing/presence are relationship metadata emitted continuously; most secure messengers make them optional and off-by-default in high-privacy settings. Sealed-sender-style techniques reduce (not eliminate) who-talks-to-whom. Padding/batching/cover traffic mitigate traffic analysis at real cost and are never absolute.

**FreeLayer implications (applied):**
- Receipts/typing/presence/last-seen off by default; denied in Private+ (v0 denies in all modes — no messaging exists yet).
- Delivery acknowledgements must later be **end-to-end capsule content**, not transport-visible plaintext — TECH-12+ TODO.
- Padding/batching/cover traffic belong to future CapsuleNet work (Gate E) and are **not promised**.

## 6. FreeLayer metadata categories

Mapped onto [../METADATA_MODEL.md](../METADATA_MODEL.md) and implemented as the event taxonomy:

| Category | Events (examples) |
| --- | --- |
| Communication-pattern | receipts, typing, presence, room.activity |
| Network | transport timing/size, relay.choice, lan.discovery, webrtc.ice_candidate |
| Content-adjacent | link.preview, asset/avatar fetch, preview/thumbnail generated |
| Local | capsule spool existence/timestamp, cache.exists, logs, audit events |
| Endpoint/display | screen.capture_detected, protected_content.revealed, device_risk.changed, watermark.generated |
| AI-derived | ai.prompt/cache/summary existence |
| Development/CI | GitHub contributor/PR/CI metadata (out of app scope; noted in threat model) |

## Decisions made for TECH-10

1. MetadataPolicy lives in `packages/privacy` (lowest policy layer) and is **self-contained** — it must not import storage/transports (boundary rule); context types are mirrors, agreement is proven by tests.
2. **Default deny**, strictest-wins, fail-closed on unknown mode/event/sink.
3. **v0 invariant:** no metadata persists and no metadata egresses — the ceiling for any allowed event is memory-only, redacted.
4. Metadata payloads may carry only numeric/boolean counters/flags — **never strings** (a slug is indistinguishable from a room name). Categorization is carried by the typed event kind.
5. Enforcement reuses the existing WeakSet `PolicyDecision` provenance — not re-implemented.

## TODOs for TECH-11/12/13/14

- **TECH-11 (Link Preview / External Asset Blocking):** `Referrer-Policy: no-referrer` in the web shell; explicit user-initiated-only preview model (still no auto-fetch); sanitized external-navigation path.
- **TECH-12+:** delivery acks as sealed capsule content; notification model with content-free defaults; batching/coarsening windows for any future network metadata.
- **TECH-13/14:** ScreenShield reveal/watermark/canary metadata contracts; device-risk signal coarsening; AI metadata gates when Local AI (Gate I) is designed.
