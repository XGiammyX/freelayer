# @freelayer/privacy

**Status: type-level policy schema, strictest-wins resolver (fail-closed), and the `PolicyDecision` contract — now with per-operation side-effect scoping (TECH-05): a decision names the exact operation it authorizes (`storage.write`, `storage.cache.read`, …), and strict barriers reject mismatches and `generic` scopes. The full engine is Gate B (Phase 2).**

The Privacy Modes engine and metadata firewall policies: Standard, Private, Ghost, Bunker, Offline Capsule, Emergency, Sovereign Room — expressed as a versioned policy schema evaluated by `@freelayer/core` for every side-effectful operation.

Rules encoded here, not in UI: persistence, notifications, external assets, link previews, direct connections, metadata signals (receipts/typing/presence), local AI availability, media cache, room sync, allowed transports.

Loosening any mode's guarantees requires GOVERNANCE-level review.

See [docs/PRIVACY_MODEL.md](../../docs/PRIVACY_MODEL.md) and [docs/METADATA_MODEL.md](../../docs/METADATA_MODEL.md).
