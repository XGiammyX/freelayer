# RESEARCH-ID-01 — Repository & Roadmap Precheck

- **Date:** 2026-07-13
- **Branch:** `research/identity-competitor-threat-model` (stacked on `tech/sensitive-room-secure-device-contract` — TECH-23)
- **Base commit:** `ed3eb4d` (tip of the TECH-23 branch)
- **Working tree at branch creation:** clean
- **Task type:** research + threat modeling + roadmap reconciliation. **No** identity/crypto/recovery/invite/device-passport implementation.

## Status legend

`present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## 1. TECH-23 status

| Item | Status | Evidence |
| --- | --- | --- |
| TECH-23 Secure Device contract | **present**, **stacked dependency** | `packages/rooms/src/secure-device/` on this branch's base; PR **#48** OPEN (all CI checks green, not merged) |
| RESEARCH-ID-01 base | **stacked** on the TECH-23 branch | branched from `ed3eb4d`; PR base will be `tech/sensitive-room-secure-device-contract` |

TECH-23 is complete but **unmerged** (PR #48 open, mergeable state BLOCKED = awaiting review, checks pass). Per the task's §29 unmerged path, this research branch is stacked on TECH-23 and isolates research commits.

## 2. Identity documents & code found

| Area | Status | Evidence |
| --- | --- | --- |
| `docs/IDENTITY_FIREWALL.md` | **present** (stub; created in TECH-23) | posture-vs-identity note only; expanded here |
| Identity implementation code | **missing** (by design — Gate G) | no identity keys / recovery / invites / aliases / DID / login anywhere in `packages/*/src` |
| `RoomMemberRef` (local placeholder) | **present** | `packages/rooms/src/room-types.ts` — a **local, unverified** slug; explicitly *not* identity |
| Room membership record | **present** (unverified) | `RoomMembershipRecordV1.verification = "unverified_placeholder"` (TECH-20) |
| Alias / persona / device-key / recovery types | **missing** | none exist; all are future design |
| DevicePosture coupling to identity | **not applicable / clean** | posture is an environment attribute; `docs/IDENTITY_FIREWALL.md` + GLOSSARY already state "never identity" |
| Central-server / phone / email identity dependency | **missing** (good) | serverless, accountless; no phone/email anywhere |

## 3. Current identity terminology (docs)

Existing docs are already honest: `docs/GLOSSARY.md` marks Identity Firewall as **"Design only (Gate G)"**, room membership as **"local, UNVERIFIED … verified identity is Gate G"**, and DevicePosture as **"an environment attribute, never identity"**. `docs/TRUST_CENTER.md` repeatedly states **"no verified identity (Gate G)"**. No document claims FreeLayer currently has verified identities, device passports, key transparency, QR verification, recovery, or unlinkable personas.

## 4. Inconsistencies / overclaims found

**None dangerous.** The Glossary's Identity-Firewall row lists future features ("per-contact aliases, one-time invites, QR verification, recovery kit") but qualifies them as **"Design only (Gate G)"** — acceptable. This task adds explicit **research/planned/future-gate** status language to `docs/IDENTITY_FIREWALL.md` and related docs to remove any ambiguity, but no false "implemented" claim was located.

## 5. Repository health

Repository checks were run green on `ed3eb4d` during TECH-23 (typecheck 0 errors, lint clean, 555 tests, build 15/15, all `check:*` guards incl. `check:no-secure-device-core-implementation`, matrix 195 specs → 1365 rules, `audit:privacy`/`audit:security`/`audit:supply-chain` clean). RESEARCH-ID-01 changes are **documentation-only**; final verification re-runs the doc-affecting checks (`check:policy-docs`, `check:doc-links`, `check:policy-conflicts` overclaim scan) plus typecheck/lint/test/build.

## 6. Secure Device separation

**Preserved.** Secure Device / Endpoint Defense remains external (TECH-23 contract only). Identity research keeps DevicePosture strictly separate from identity (see `IDENTITY_TERMINOLOGY_MODEL.md` and the identity threat model's endpoint-boundary section).

## 7. Determinations (task §3)

1. TECH-23 — **implemented, open in PR #48, unmerged** (stacked dependency).
2. Identity Firewall docs — **present but minimal** (expanded here).
3. Identity-related production code — **none** (Gate G).
4. Conflicting identity terminology — **none dangerous**; terminology model added to prevent future drift.
5. Identity claim depending on phone/email/central server — **none**.
6. DevicePosture incorrectly coupled to identity — **no**; separation is explicit and reinforced.
