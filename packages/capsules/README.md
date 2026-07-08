# @freelayer/capsules

**Status: typed interfaces only — no parsing, no dedup, no behavior (Gate E, Phase 4). Capsule ID v1 direction: random, not content-derived.**

Capsule lifecycle (CapsuleNet): creation, bundling, the outbound spool, the Capsule Inbox
(verify → dedup → decrypt → dispatch, with quarantine for anything unknown), and dead-drop workflows.

Security-sensitive path: capsules are hostile input; spool behavior is bound to storage policy.

See [docs/CAPSULENET.md](../../docs/CAPSULENET.md).
