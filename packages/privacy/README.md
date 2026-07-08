# @freelayer/privacy

**Status: type-level policy schema, strictest-wins resolver (fail-closed), and the `PolicyDecision` contract; the full engine is Gate B (Phase 2).**

The Privacy Modes engine and metadata firewall policies: Standard, Private, Ghost, Bunker, Offline Capsule, Emergency, Sovereign Room — expressed as a versioned policy schema evaluated by `@freelayer/core` for every side-effectful operation.

Rules encoded here, not in UI: persistence, notifications, external assets, link previews, direct connections, metadata signals (receipts/typing/presence), local AI availability, media cache, room sync, allowed transports.

Loosening any mode's guarantees requires GOVERNANCE-level review.

See [docs/PRIVACY_MODEL.md](../../docs/PRIVACY_MODEL.md) and [docs/METADATA_MODEL.md](../../docs/METADATA_MODEL.md).
