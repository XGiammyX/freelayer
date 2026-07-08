# @freelayer/core

**Status: typed scaffolding — operation-pipeline types plus a fail-closed placeholder pipeline (denies everything); the real engine is Gate B (Phase 2).**

The center of FreeLayer: wires policy engines to features and owns the operation pipeline —
**validate → policy check → execute → audit**.

Every side-effectful operation (persist, notify, connect, preview, sync, run AI) passes through core, which consults the active Privacy Mode (`@freelayer/privacy`) and storage policy (`@freelayer/storage`). Features never perform side effects directly — this is what makes privacy core-enforced rather than UI-enforced.

See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) and [docs/PRIVACY_MODEL.md](../../docs/PRIVACY_MODEL.md).
