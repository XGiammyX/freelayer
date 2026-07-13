# RoomOS Policy Composition Boundary Audit (TECH-22)

_Date: 2026-07-13. Verifies `apps → sdk/core RoomOS facade → membership/capability → effective DevicePosture → policy composition → admission → execution-time authorization → side-effect policy → execution`._

## Enforced today (mechanical)

- **Apps cannot import `@freelayer/rooms` at all** (`scripts/check-boundaries.mjs`). So apps cannot construct trusted posture, mutate room policy directly, choose policy precedence, bypass composition, lower room requirements, mark ScreenShield active, call Secure Device code, or treat posture as identity.
- **`check:no-device-posture-or-governance-bypass`** forbids posture elevation / provider integration in production, posture-as-identity/authority, endpoint-grants-access, active ScreenShield claims, direct room-policy mutation / loosening / posture-lowering, posture persistence/telemetry, and device-management/attestation/anti-spyware imports (MDM/Device Owner/Play Integrity/GrapheneOS manager/custom ROM). A fixture proves it catches representative violations.
- Composition is pure + deterministic (deny-overrides + strictest-wins); governance is tighten-only (`compareRoomPoliciesV1` accepts only `stricter`); the governance pipeline requires a current membership + a governance capability + an authentic exact-scope `PolicyDecision` + execution-time revalidation (bound to policy revision + posture).
- DevicePosture resolves fail-closed to `unverified`/`at_risk`; `providerIntegrated`/`trustedForElevation`/`activeProtectionClaim` are structurally `false`.

## Documented limitation (honest)

Within-boundary granularity is convention + review, not compile-time: `core` (and tests) can import `composeEffectiveRoomPolicyV1` / `applyLocalRoomGovernanceUpdateV1` / the resolvers directly. Tests legitimately do. Full **construction-authority confinement** (making the composition + governance pipeline reachable only via a core facade with a capability token, and confining a future Secure Device adapter behind a trust boundary) remains **Gate B** + the **Secure Device Integration Gate** and is deliberately not implemented early. Because posture cannot elevate and governance cannot loosen, this limitation cannot be leveraged to weaken protections.

## Future step

Expose a single core RoomOS facade owning membership → posture → composition → admission → authorization → execution behind a capability token; add a Secure Device adapter boundary (posture provenance/freshness/anti-replay) behind the Secure Device Integration Gate + ADR; narrow `packages/rooms` public exports.
