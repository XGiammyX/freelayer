# NetworkPolicy Research (TECH-08)

_Date: 2026-07-09 · Sources verified online during this pass._

## Sources reviewed

- OWASP MAS — [MASVS-NETWORK](https://mas.owasp.org/MASVS/08-MASVS-NETWORK/), [Testing Network Communication](https://mas.owasp.org/MASTG/0x04f-Testing-Network-Communication/), [MASTG-TEST-0218 insecure TLS](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0218/), [MASTG-TEST-0021 endpoint identity](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0021/), [MASTG-TEST-0068 certificate pinning](https://mas.owasp.org/MASTG/tests/ios/MASVS-NETWORK/MASTG-TEST-0068/)
- MDN / privacy analyses — WebRTC `RTCPeerConnection` ICE/STUN IP leakage; browser network APIs (`fetch`, `WebSocket`, `EventSource`, `sendBeacon`)
- Tauri v2 — [HTTP client plugin](https://v2.tauri.app/plugin/http-client/), [permissions](https://v2.tauri.app/security/permissions/), [capabilities](https://v2.tauri.app/security/capabilities/)

## Findings and FreeLayer implications

### OWASP MASVS-NETWORK

**Finding:** the standard verifies a secure encrypted channel, endpoint identity, and (L2) certificate pinning; plain-HTTP fallback and weak TLS are explicit failures.
**Implication:** any *future* FreeLayer transport must be modeled and tested, use secure channels where networked, and pin/validate endpoints — but **transport-layer security is not enough**: FreeLayer's confidentiality comes from end-to-end encrypted **capsules** (blind couriers, ADR-0003), not from trusting a transport. And the strongest MASVS-NETWORK posture is having **no default network calls at all** — which is exactly TECH-08's default-deny. `http://` and credentials-in-URL are hard rejects (WSTG transport guidance).

### WebRTC / RTCPeerConnection

**Finding (verified):** a page can `new RTCPeerConnection()` with only a **data channel** and trigger ICE gathering that contacts STUN servers and returns the user's **real local and public IP** to JavaScript — no permission prompt, no UI, bypassing VPN/proxy.
**Implication:** WebRTC/direct peer connections are **denied in Private, Ghost, and Bunker by default**, and are a forbidden API in the guardrail. This is the single strongest reason direct transport is opt-in and high-assurance-only.

### Browser network APIs

**Finding:** `fetch`/`XMLHttpRequest` (arbitrary requests), `WebSocket` (persistent bidirectional channel), `EventSource` (server-push stream), `sendBeacon` (fire-and-forget, telemetry-shaped), service workers (network interception + caching), and remote `<script>`/`importScripts` (code + asset loading) are all direct egress channels.
**Implication:** every one is forbidden outside a future approved transport/network package (guardrail), and telemetry-shaped `sendBeacon` is *always* denied by policy — consistent with ADR-0008 (no telemetry) and NO_EXTERNAL_ASSETS_POLICY.

### Tauri v2 network permissions

**Finding:** v2 denies by default; the HTTP plugin's permission set enables fetch operations but allowlists **no origins** until explicitly configured; access is capability-scoped per window.
**Implication:** future desktop network is capability-gated by design — the frontend must never gain broad HTTP permission, and adding `@tauri-apps/plugin-http` is a reviewed, PBOM-recorded event (forbidden token in the guardrail until then).

### Metadata leakage from network behavior

**Finding/reasoning:** even encrypted content leaks **IP, DNS queries, timing, frequency, message/packet size, headers, and the endpoint contacted**; relays see timing/size/client-IP; email/external-app couriers expose the courier's native metadata to that provider; LAN broadcasts presence; WebRTC exposes direct IP/NAT data.
**Implication:** NetworkPolicy treats **metadata as part of the decision** (not an afterthought), and each transport carries a **metadata leakage label** surfaced honestly in UX and docs ([METADATA_MODEL.md](../METADATA_MODEL.md)).

## What can be enforced now

Application-level: FreeLayer code cannot *intentionally* open a network channel without a policy decision — default-deny resolver, side-effect-scoped decisions, forbidden-API guardrail (source scan), and a runtime trap that proves the policy layer and mock transports touch no network API. Telemetry, external assets, automatic link previews, WebRTC, and AI-remote are denied across the board.

## What cannot be guaranteed

NetworkPolicy cannot stop the OS, package manager, GitHub, the browser itself, user-installed extensions, malware, or unrelated apps from using the network. It is an **application-behavior guarantee, not a network-isolation guarantee**.

## Decisions made for TECH-08

1. Default deny; unknown operation/transport/mode ⇒ deny.
2. `http://`, credentials-in-URL, `file:`/`data:`/`blob:`, private/localhost hosts, and suspicious query keys (`token`/`secret`/`key`/`password`/`auth`) are rejected by `validateNetworkEndpoint` — a misuse detector, never enough to *allow* (policy must still allow the operation).
3. QR/file/USB are **offline transports**, not network operations — modeled as `local_only`/`low` metadata, never egress.
4. Runtime trap patches `fetch`/`WebSocket`/`EventSource`/`RTCPeerConnection`/`sendBeacon`/`XMLHttpRequest` where present; absent APIs get synthetic traps or honest "absent" coverage.
5. New sentinel `FREELAYER_NETWORK_SENTINEL_DO_NOT_LEAK` for endpoint-redaction tests.

## TODOs for TECH-09 and later transports

- TECH-09: full-build zero-egress verification (instrument the built app, assert no egress on load).
- Real transports (Gate D / Phase 4): relay client with blinded pickup, file/QR/bundle, LAN — each with its metadata label, tests, PBOM entry, and (networked ones) TLS + pinning per MASVS-NETWORK.
- Tauri capability document before any desktop HTTP.
