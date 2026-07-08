# @freelayer/transports

**Status: interfaces plus a test-only in-memory MockTransport (no I/O); no real transport exists (Gate D, Phase 4).**

The `Transport` interface and blind-courier adapters: relay, QR, file/bundle, LAN; future Tor/proxy layering and radio-class links. Every transport carries opaque encrypted capsules and is assumed hostile — adding a transport must never require protocol changes.

Transport selection is policy-gated: Privacy Modes restrict which transports are allowed (e.g. Offline Capsule mode permits only non-network transports).

See [docs/NETWORK_MODEL.md](../../docs/NETWORK_MODEL.md).
