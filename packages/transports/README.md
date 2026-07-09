# @freelayer/transports

**Status: NetworkPolicy v0 + side-effect barrier implemented (TECH-08); only mock/noop transports exist. No real network — no fetch/WebSocket/WebRTC/relay (Gate D, Phase 4).**

TECH-08 adds: `resolveNetworkPolicy` (13 operations × 12 transports × 7 modes, default deny, fail-closed unknowns, strictest-wins room composition), `assertNetworkOperationAllowed` (exact-scope `PolicyDecision` required), `NoopTransport`/`MockNetworkTransport` (`performsRealNetwork: false`), `validateNetworkEndpoint` (redacted misuse detector), `describeNetworkMetadataLeakage` (per-transport honest labels), and a redacted network error taxonomy. Always denied: telemetry, external assets, automatic link previews, remote AI, update checks. WebRTC/direct peer denied in Private+. Enforced in source by `check:no-forbidden-network`. Research: [docs/research/NETWORK_POLICY_RESEARCH.md](../../docs/research/NETWORK_POLICY_RESEARCH.md).

The `Transport` interface and blind-courier adapters: relay, QR, file/bundle, LAN; future Tor/proxy layering and radio-class links. Every transport carries opaque encrypted capsules and is assumed hostile — adding a transport must never require protocol changes.

Transport selection is policy-gated: Privacy Modes restrict which transports are allowed (e.g. Offline Capsule mode permits only non-network transports).

See [docs/NETWORK_MODEL.md](../../docs/NETWORK_MODEL.md).
