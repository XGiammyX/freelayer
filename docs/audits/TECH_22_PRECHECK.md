# TECH-22 — Precheck

_Branch: `tech/roomos-policy-composition-governance`, **stacked on TECH-21** `tech/roomos-revocation-authorization-regression` (open **PR #46**) which is stacked on TECH-20 **PR #45**. Date: 2026-07-13. Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`._

## Repository / PR state

| Item | Value | Status |
| --- | --- | --- |
| Base branch | `tech/roomos-revocation-authorization-regression` @ `fb4a55d` (PR #46, CI green) | present |
| Current branch | `tech/roomos-policy-composition-governance` | present |
| Working tree at start | clean | present |
| Open PRs | #45 (TECH-20), #46 (TECH-21) | present |
| TECH-16/17/18/19 status | **merged** (#41–#44) | present |
| TECH-20 status | open PR #45, CI green, **unmerged** | stacked dependency |
| TECH-21 status | open PR #46, CI green, **unmerged** | stacked dependency |
| Branch dependency | **TECH-22 stacks on #46 → #45 → main**; merge order 45 → 46 → 22 | documented |
| Test count at branch point | 500 | present |

## Foundation verification (required by TECH-22)

| Foundation | Evidence | Status |
| --- | --- | --- |
| TECH-16…21 present locally | full RoomOS + membership + authorization | present |
| RoomPolicy revision handling | `policyRevision?` on state + fingerprint (TECH-21) | present |
| Policy Matrix | 157 specs → 1099 rules | present |
| Membership authorization | `assertRoomAuthorizationContextV1` + prepare/revalidate (TECH-21) | present |
| Endpoint/device-risk hook | `deviceRiskLevel` placeholder (tighten-only); no provider | present |
| RoomPolicy already has a document/revision (branded) | missing (this is TECH-22) | missing |
| Anti-spyware externalization | present — no scanner/MDM/attestation in core | present |

## Project separation (§0)

FreeLayer / ChatControl and **Secure Device / Endpoint Defense** are now clearly separated projects. Secure Device (Pixel/GrapheneOS/Device Posture Checker/Bunker Session/ScreenShield/ProtectedContent) is developed elsewhere; FreeLayer core keeps only interfaces, policy inputs, minimum-posture requirements, protected-content requirements, future integration hooks, and honest disclosures. TECH-22 implements the DevicePosture CONTRACT and fail-closed behavior only — no provider.

## Verdict

All foundations are **present and sufficient** — no minimum-correction subset needed. TECH-22 proceeds as a stacked change adding the policy-composition model, DevicePosture contract, governance pipeline, and regression suite. Do not auto-merge (§40); merge order 45 → 46 → 22.
