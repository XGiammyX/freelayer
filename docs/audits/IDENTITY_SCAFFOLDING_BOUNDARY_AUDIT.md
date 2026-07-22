# Identity Scaffolding Package-Boundary Audit (TECH-ID-03)

- **Date:** 2026-07-22
- **Branch:** `tech/identity-local-scaffolding` (stacked on `architecture/identity-firewall-adr` / ADR-0013)
- **Package:** `@freelayer/identity` (`packages/identity/`)

## Desired dependency direction

```
apps → sdk/core Identity Firewall facade → @freelayer/identity
        → @freelayer/privacy (PolicyDecision) + @freelayer/security (Brand)
        → memory/null repository boundaries
RoomOS ──(narrow safe references only)──▶ identity result types
```

`@freelayer/identity` depends **only** on `@freelayer/privacy` (types + `PolicyDecision`/`isPolicyDecision`) and `@freelayer/security` (`Brand`). It imports **no** UI, **no** network transports, **no** Crypto implementation, **no** Secure Device implementation, and it never mutates RoomOS membership.

## RoomOS ↔ Identity — avoiding a circular dependency

RoomOS "may consume identity through a narrow boundary." To avoid an `identity ↔ rooms` package cycle, `@freelayer/identity` does **not** import `@freelayer/rooms`. Instead it defines **narrow, identity-local branded references** — `RoomLocalIdRef` and `RoomMembershipIdRef` (`identifiers.ts`). RoomOS (or the facade) maps its own `RoomLocalId` / `RoomMembershipId` to these refs at the boundary. This keeps the dependency direction one-way and documented.

| Concern | Rule | Enforcement | Status |
| --- | --- | --- | --- |
| Identity imports RoomOS | forbidden (avoid cycle) | narrow `RoomLocalIdRef`/`RoomMembershipIdRef` brands; no `@freelayer/rooms` import | enforced (package.json deps + test) |
| Identity imports UI/transports/crypto/secure-device | forbidden | side-effect trap test scans `packages/identity/src` | enforced (test) |
| RoomOS reads identity vault internals | forbidden | RoomOS receives only result types (root/persona/binding refs + assurance) | architecture-rule |
| `RoomMembershipId` = identity proof | forbidden | binding stores a `RoomMembershipIdRef` placeholder; never identity | architecture-rule + docs |
| DevicePosture authorizes/verifies identity | forbidden | not referenced in identity records; policy resolver ignores posture | enforced (guardrail + test) |
| Persistent identity storage | forbidden (Gate F) | memory/null repositories only; no fs/localStorage/IndexedDB | enforced (guardrail + test) |
| Network / telemetry from identity | forbidden | no transports import; side-effect trap | enforced (test) |
| Ambient/global current identity | forbidden | no `currentIdentity`/`defaultPersona`; callers pass root/persona explicitly | enforced (guardrail) |

## What RoomOS may consume (narrow, safe)

Root/persona/binding **references**, identity-assurance **state**, and an explicit room identity-binding **result** — never local labels, relationship collections, future root secrets, recovery configuration, or trust notes.

## Unresolved dependency direction (honest)

A shared-contract package for room references was **not** introduced (over-engineering for one narrow ref pair); the identity-local brands suffice today. If a future task needs bidirectional room↔identity types, extract a `@freelayer/contracts` package and move the ref brands there. RoomOS does not yet consume identity (no facade wired) — that integration is a later task.
