# TECH-08 Threat Model — NetworkPolicy

_Scope: FreeLayer **application network behavior**. NetworkPolicy can prevent FreeLayer code from intentionally opening network channels; it cannot prevent the OS, package manager, GitHub, the browser, user-installed extensions, malware, or unrelated apps from using the network._

## Direct network bypass

`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `RTCPeerConnection`/`RTCDataChannel`, `navigator.sendBeacon`, service-worker network behavior, Tauri HTTP plugin, Node `http`/`https`/`net`/`dgram`/`tls`, DNS libraries, and HTTP client libraries (axios/got/ky/superagent/request).
**Controls:** default-deny NetworkPolicy, forbidden-network source guardrail, runtime egress trap, mock/noop transports only.

## Metadata leakage

IP address, DNS queries, timing, frequency, request/message/capsule size, relay choice, transport-native metadata (email headers, messenger accounts), user-agent/fingerprint, headers, cookies, referrers, link-preview requests, remote-asset requests, WebRTC ICE/STUN IP exposure.
**Controls:** metadata is part of the policy decision; per-transport leakage labels; WebRTC denied in Private+; external assets and automatic link previews denied everywhere.

## Policy bypass

Feature opens network before a decision; app imports a transport directly; wrong/forged decision accepted; room policy attempts to loosen device mode; Standard behavior leaking into Private/Ghost/Bunker; Offline Capsule accidentally permitting network; Emergency accidentally permitting normal network.
**Controls:** exact-scope decisions, default-deny + strictest-wins resolver, tighten-only room composition, fail-closed unknowns, boundary rules, transport mocks requiring a decision.

## Development / CI leakage

Tests calling the internet; dependency postinstall network calls; CI uploading artifacts to external services; coverage upload; remote badges/assets in the docs site; external docs scripts.
**Controls:** runtime trap fails any test that touches network APIs; forbidden-network scan over source; no external assets (existing guard); dependency policy (install-script review). CI-side egress isolation is a TECH-09 / Phase-10 item.

## Honest non-goals

No claim against OS/browser/extension/malware network use, DNS resolver behavior, or the network stack below the application. **Application-behavior guarantee, not network isolation.**
