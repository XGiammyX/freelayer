# TECH-21 — Precheck

_Branch: `tech/roomos-revocation-authorization-regression`, **stacked on TECH-20** `tech/roomos-membership-capabilities` (open **PR #45**, CI green, unmerged). Date: 2026-07-13. Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`._

## Repository / PR state

| Item | Value | Status |
| --- | --- | --- |
| Base branch | `tech/roomos-membership-capabilities` @ `2506bcd` (PR #45, CI green) | present |
| Current branch | `tech/roomos-revocation-authorization-regression` | present |
| Working tree at start | clean | present |
| Open PRs | only #45 (TECH-20) | present |
| TECH-16/17/18/19 status | **merged** (#41/#42/#43/#44) | present |
| TECH-20 status | open PR #45, CI green, **unmerged** | stacked dependency |
| Branch dependency | **TECH-21 stacks on #45**; merges after it (rebase on #45's squash) | documented |
| CI state | green on `main` and #45 | present |
| Test count at branch point | 481 | present |

## TECH-20 foundation verification (required by TECH-21)

| Foundation | Evidence | Status |
| --- | --- | --- |
| Versioned membership record | `membership/membership-types.ts` | present |
| Membership revision | `membership/membership-ids.ts` (positive local) | present |
| active/suspended/removed states | lifecycle machine | present |
| Removed state terminal | `assertMembershipTransition` | present |
| Capability descriptor non-authoritative | `authoritative: false` | present |
| Descriptor binds membership revision | `membershipRevision` field | present |
| Authentic `PolicyDecision` required | `assertRoomAuthorizationContextV1` | present |
| Role→capability matrix | `ROLE_CAPABILITY_ELIGIBILITY` | present |
| Attenuation | `attenuateRoomCapabilityDescriptorV1` | present |
| Last-owner invariant | membership pipeline | present |
| Object mutations use authorization context | `assertRoomObjectMutationAllowed` + membership authz | present |
| Queries use authorization context | query policy + scopes | present |
| No capability persistence | `persistence: "forbidden"`; matrix deny | present |
| No identity/auth dependency | none | present |
| No endpoint-defense implementation | externalized; device-risk tightens only | present |

## Current revocation / cache behavior (what TECH-21 adds)

| Item | Status |
| --- | --- |
| Local suspension/removal (mutation) | present (TECH-20) |
| Execution-time authorization revalidation (prepare vs execute) | missing (TECH-21) |
| Authorization-revision fence (membership + policy + mode + lifecycle) | missing (TECH-21) |
| Role capability-set comparison + change-direction classifier | missing (TECH-21) |
| Authorization cache | **none exists** (audited — [ROOM_AUTHORIZATION_CACHE_AUDIT.md](ROOM_AUTHORIZATION_CACHE_AUDIT.md)) |

## Anti-spyware externalization

`present` — device-risk placeholder can only tighten; `endpointIntegration` never `active`; TECH-21 adds an explicit matrix row (`room.authorization.endpoint_assurance` → deny) stating endpoint state can never grant/restore/prove authority.

## Verdict

All TECH-20 foundations are **present and sufficient** — no minimum-correction subset needed. TECH-21 proceeds as a stacked change adding the prepared/revalidate authorization layer + local revocation regression suite. Merge order: 45 → 21. Do not auto-merge (§40).
