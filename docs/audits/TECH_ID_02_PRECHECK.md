# TECH-ID-02 — Identity Architecture ADR — Precheck

- **Date:** 2026-07-22
- **Branch:** `architecture/identity-firewall-adr` (stacked on `research/identity-competitor-threat-model` → `tech/sensitive-room-secure-device-contract` → `main`)
- **Base commit:** `0948995` (tip of RESEARCH-ID-01)
- **Working tree at branch creation:** clean
- **Task type:** architecture decision (ADR) — documentation only. **No** identity/key/recovery/invite/device-passport implementation; **no** cryptographic algorithm selection; **no** central service.

## Status legend

`present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## 1. Prerequisite status

| Item | Status | Evidence |
| --- | --- | --- |
| TECH-23 Secure Device contract | **present**, **stacked dependency** | `packages/rooms/src/secure-device/`; PR **#48** OPEN (green, unmerged) |
| RESEARCH-ID-01 | **present / complete**, **stacked dependency** | commit `0948995`; PR **#49** OPEN (unmerged); all deliverables below |
| — Standards research | **present** | `docs/research/IDENTITY_STANDARDS_RESEARCH.md` (NIST SP 800-63-4, W3C DID, VC, WebAuthn, MLS) |
| — Competitor matrix | **present** | `docs/research/IDENTITY_COMPETITOR_MATRIX.md` (Signal, Matrix, SimpleX, Session, Briar +1) |
| — Identity threat model | **present** | `docs/audits/RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md` |
| — Terminology model | **present** | `docs/research/IDENTITY_TERMINOLOGY_MODEL.md` |
| — Decision inputs (models/recovery/multi-device/Trust-Notebook) | **present** | `docs/research/IDENTITY_ARCHITECTURE_DECISION_INPUTS.md` |
| — Conclusions | **present** | `docs/research/RESEARCH_ID_01_CONCLUSIONS.md` |
| — Research precheck + audit | **present** | `docs/audits/RESEARCH_ID_01_PRECHECK.md`, `RESEARCH_ID_01_AUDIT.md` |
| RESEARCH-ID-01 source currency | **partial** | research conducted **offline** (stated in each doc); re-validated for the most consequential decisions in `TECH_ID_02_SOURCE_VALIDATION.md` |

## 2. Existing identity code / ADRs

| Item | Status | Evidence |
| --- | --- | --- |
| Identity implementation code | **missing** (by design — Gate G) | no `IdentityRoot`/`persona`/`PairwiseRelationship`/keys/recovery/invites/aliases anywhere in `packages/*/src` |
| `RoomMemberRef` | **present** (local, unverified placeholder) | `packages/rooms/src/room-types.ts` — explicitly **not** identity |
| Existing ADRs | **present** | `docs/adr/ADR-0001`…`ADR-0012`; next number = **ADR-0013** |
| Conflicting architecture decisions | **none found** | no prior ADR decides an identity model; ADR-0004 (no crypto before review), ADR-0006 (Sovereign Rooms), ADR-0012 (endpoint defense) are compatible |

## 3. Current PBOM / Trust Center identity claims

**Honest.** `docs/PBOM.md` and `docs/TRUST_CENTER.md` (updated in RESEARCH-ID-01) state identity is **not implemented** (Gate G): no verified identity, device passport, key transparency, QR verification, recovery, or secure identity storage; no phone/email/central account; `RoomMemberRef` is not identity; DevicePosture is not identity. No premature or dangerous overclaim located.

## 4. Secure Device separation

**Preserved.** DevicePosture remains an external environment attribute; the ADR keeps Identity Firewall independent of Secure Device (DevicePosture may *tighten* an authorized device's permissions but never *authorizes* a device or proves identity).

## 5. Repository health

Green on the base (`0948995`): typecheck, lint, **555 tests**, build, all `check:*` guards, matrix 195 specs → 1365 rules, `audit:privacy`/`audit:security`/`audit:supply-chain`. TECH-ID-02 changes are documentation-only (+ an optional `check:identity-docs` guard); final verification re-runs the doc-affecting checks + typecheck/lint/test/build.

## 6. Determinations (task §3)

1. RESEARCH-ID-01 exists and is **complete**.
2. Source research is **offline** (documented); consequential decisions **re-validated** here.
3. Threat model — **present**.
4. Terminology model — **present**.
5. Competitor + recovery research — **present**.
6. TECH-ID-02 work — **not yet existing** (this branch begins it; no duplicate).
7. Conflicting architecture decisions in docs — **none**.
8. Premature identity implementation — **none**.

**No prerequisite blocker.** The ADR can be marked **Accepted** (its status is decided in the ADR itself against the source-validation pass).
