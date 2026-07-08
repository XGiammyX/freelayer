# ADR-0002: Core-enforced policy engine

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

Most privacy failures in applications are not cryptographic — they are a feature that forgot to check a setting: a cache written in incognito mode, a preview fetched despite a toggle, a notification leaking content. If privacy is enforced in the UI layer, every feature is one missed `if` away from a leak.

## Decision

All privacy and security policy in FreeLayer is enforced by the **core policy engine** (`packages/core` + `packages/privacy`), never by UI code alone:

1. Every side-effectful operation — persist, notify, connect, transmit, fetch, preview, sync, run AI — flows through the core pipeline: **validate → policy check → execute → audit**.
2. Side-effect modules (`storage`, `transports`, `ai`, notification adapters) **reject any call that does not carry a valid `PolicyDecision`** issued by core.
3. Apps and features never call side-effect modules directly; they call core.
4. When device mode, room policy, transport policy, storage policy, and AI policy conflict, **the strictest policy wins** ([PRIVACY_MODEL.md — Policy conflict rule](../PRIVACY_MODEL.md)).
5. Features may tighten policy locally; they may never loosen it. Loosening any policy guarantee requires a new ADR or GOVERNANCE-level review.

## Consequences

- A UI bug cannot leak what core refuses to release; the failure domain of feature mistakes shrinks to "feature doesn't work" instead of "feature leaks".
- All features pay an indirection cost through core. Accepted: convenience never outranks enforceability.
- The `PolicyDecision` mechanism must exist before any side-effectful feature ships (Implementation Gate B — [IMPLEMENTATION_GATES.md](../IMPLEMENTATION_GATES.md)).
- Policy behavior is testable at one choke point, enabling the privacy-regression suite.

## Security impact

- Single audited enforcement path instead of scattered checks; hostile-input validation happens before policy evaluation, uniformly.
- The policy engine itself becomes the highest-value code target — it lives in CODEOWNERS-protected packages with elevated review (ADR-0009).

## Privacy impact

- Privacy Modes (Standard, Private, Ghost, Bunker, Offline Capsule, Emergency, Sovereign Room) are guarantees of core behavior, not UI suggestions.
- Machine-checkable invariants ("Ghost ⇒ zero persistent writes", "Offline Capsule ⇒ zero network egress") become possible and are required tests.

## What would require a new ADR

- Any side effect path that bypasses core, however small.
- Any "fast path" or "debug path" exempt from policy evaluation.
- Weakening the strictest-wins conflict rule.
- Moving policy evaluation into apps or UI components.
