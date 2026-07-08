# Architecture Overview

*Friendly summary — the canonical version is [ARCHITECTURE.md](https://github.com/XGiammyX/freelayer/blob/main/docs/ARCHITECTURE.md).*

## The data lifecycle

Every stage of data has an owner:

```text
Data in transit    → CapsuleNet (sealed capsules over blind couriers)
Data at rest       → Storage Policy (the write barrier)
Data in memory/use → Endpoint Defense Layer
Data in UI         → ProtectedContent (future)
Data in rooms      → Sovereign Rooms
Data in AI         → AI Privacy Guard (future, local-only)
```

## The one pipeline

Every side effect — store, send, notify, preview, copy, run AI — flows through the core:

**validate → classify → resolve policies → strictest policy wins → PolicyDecision → execute → audit**

Apps never call storage, transports, crypto or AI directly. Side-effect modules **reject** calls without a `PolicyDecision`. This is checked mechanically in CI (import boundaries) and at runtime (guards in the scaffolding).

## The constitution

Binding decisions are Architecture Decision Records — [ADR-0001 through ADR-0012](https://github.com/XGiammyX/freelayer/blob/main/docs/adr/README.md). Highlights:

- **ADR-0001** — no project-owned infrastructure, ever.
- **ADR-0002** — core-enforced policy engine.
- **ADR-0003** — capsules are the only cross-device format.
- **ADR-0004** — no crypto implementation before design review.
- **ADR-0012** — Endpoint Defense / ScreenShield as an official pillar.

Implementation is blocked behind explicit [gates](https://github.com/XGiammyX/freelayer/blob/main/docs/IMPLEMENTATION_GATES.md) (A–K): research → design → implementation → tests → audit, enforced in that order.

## Deep dives

[Threat Model](https://github.com/XGiammyX/freelayer/blob/main/docs/THREAT_MODEL.md) · [Privacy Model](https://github.com/XGiammyX/freelayer/blob/main/docs/PRIVACY_MODEL.md) · [CapsuleNet](https://github.com/XGiammyX/freelayer/blob/main/docs/CAPSULENET.md) · [Sovereign Rooms](https://github.com/XGiammyX/freelayer/blob/main/docs/SOVEREIGN_ROOMS.md) · [Endpoint Defense](https://github.com/XGiammyX/freelayer/blob/main/docs/ENDPOINT_DEFENSE_MODEL.md)
