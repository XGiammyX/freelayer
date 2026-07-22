# TECH-ID-03 — Local Identity Scaffolding Precheck

- **Date:** 2026-07-22
- **Task:** TECH-ID-03 — Local Identity Scaffolding (first Identity Firewall implementation; **LOCAL, NON-CRYPTOGRAPHIC, metadata-only**).
- **Branch:** `tech/identity-local-scaffolding` (stacked on `architecture/identity-firewall-adr` — TECH-ID-02 / ADR-0013).
- **Base commit (HEAD at branch creation):** `b8ebf2a12decbfc13aab5e49d7014a6334ec1d02` — `docs(identity): decide Identity Firewall architecture` (the ADR-0013 commit; parent `0948995` = RESEARCH-ID-01). This SHA is also the current tip of `architecture/identity-firewall-adr` / `origin/architecture/identity-firewall-adr`, so this branch is exactly stacked on the ADR branch with **no** intervening commits.
- **Working tree at branch creation:** clean (base `b8ebf2a`).
- **Working tree now:** carries **this task's own uncommitted TECH-ID-03 scaffolding** — untracked `packages/identity/` (13 source modules); modified `packages/privacy/src/index.ts` (adds 9 identity `PolicySideEffectScope` values), `package.json`, and `pnpm-lock.yaml` (new workspace package wiring). No unrelated modifications. Nothing is committed to `tech/identity-local-scaffolding` yet.
- **Task type:** first local implementation of the Identity Firewall. **No** cryptography, key material, signatures, fingerprints, derivation, recovery, invites, device keys/passports, aliases, verification, real-world proofing, phone/email, public directory, DID, or key transparency is introduced.

## Status legend

`present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## 1. Repository head, branch, and stacking

| Item | Status | Evidence |
| --- | --- | --- |
| HEAD SHA | **present** | `b8ebf2a12decbfc13aab5e49d7014a6334ec1d02` |
| Branch | **present** | `tech/identity-local-scaffolding` (local only; not yet pushed) |
| Stacked on ADR branch | **stacked dependency** | HEAD == tip of `architecture/identity-firewall-adr` (PR #57); `git branch --contains HEAD` lists both branches |
| Working tree clean | **partial** | Base `b8ebf2a` was clean; the tree now holds **only** this task's TECH-ID-03 scaffolding (`packages/identity/` untracked; `packages/privacy/src/index.ts`, `package.json`, `pnpm-lock.yaml` modified) — expected in-progress work, not stray drift |
| Duplicate TECH-ID-03 branch / PR | **missing** (good) | Only `tech/identity-local-scaffolding` exists; `gh pr list` shows no scaffolding/local-identity PR |

## 2. Open PRs — stacked identity chain (all unmerged)

The Identity Firewall work forms a linear stack; each PR is open and unmerged, and each is the base of the next.

| PR | Title | Branch | Maps to | Status |
| --- | --- | --- | --- | --- |
| **#48** | feat(rooms): add Secure Device admission contract | `tech/sensitive-room-secure-device-contract` | **TECH-23** | **present**, **stacked dependency** — OPEN, unmerged |
| **#49** | docs(identity): research identity models and threats | `research/identity-competitor-threat-model` | **RESEARCH-ID-01** | **present**, **stacked dependency** — OPEN, unmerged |
| **#57** | docs(identity): decide Identity Firewall architecture | `architecture/identity-firewall-adr` | **TECH-ID-02 / ADR-0013** | **present**, **stacked dependency** — OPEN, unmerged; this task's base |
| — | (TECH-ID-03) | `tech/identity-local-scaffolding` | **TECH-ID-03 (this task)** | **missing** by design — no PR opened yet |

Chain (each stacked on the previous): **#48 → #49 → #57 → TECH-ID-03 (this branch)**. Unrelated Dependabot PRs (#52–#56) are open but out of scope. No identity PR is merged; the stack advances by branching, consistent with the earlier RESEARCH-ID-01 precheck's unmerged-stack path.

## 3. TECH-23 status

| Item | Status | Evidence |
| --- | --- | --- |
| TECH-23 Secure Device admission contract | **present**, **stacked dependency** | `packages/rooms/src/secure-device/`; PR #48 OPEN, unmerged; commit `ed3eb4d` is two commits below HEAD |

TECH-23 is implemented and remains open/unmerged. It is a transitive base of this stack, not a direct dependency of the identity package (identity does not import Secure Device — see §12).

## 4. RESEARCH-ID-01 status

| Item | Status | Evidence |
| --- | --- | --- |
| RESEARCH-ID-01 identity research package | **present** — **complete** | `docs/research/RESEARCH_ID_01_CONCLUSIONS.md` (+ standards / competitor-matrix / threat-model / terminology / decision-inputs docs); PR #49 OPEN |

RESEARCH-ID-01 is complete: it delivered standards research (NIST SP 800-63-4, W3C DID/VC, WebAuthn, MLS), a competitor matrix (Signal, Matrix, SimpleX, Session, Briar), a threat model, the terminology model, and non-binding architecture decision inputs. Its own status header labels every recommendation a **non-binding input** to TECH-ID-02, which the ADR consumed.

## 5. TECH-ID-02 — Architecture ADR

| Item | Status | Evidence |
| --- | --- | --- |
| ADR number | **present** | **ADR-0013** — `docs/adr/ADR-0013-identity-firewall-architecture.md` |
| ADR status | **present** | **Accepted** ("architecture decided; implementation not started") |
| Companion doc | **present** | `docs/IDENTITY_ARCHITECTURE.md` (normative companion; diagrams + non-implementational type appendix) |

ADR-0013 §1 explicitly states it decides *structure and invariants, not algorithms*, and that crypto/wire-formats/sync remain deferred to Gates F/E/H. §21–§25 acceptance criteria are all marked satisfied → **Accepted**.

## 6. Architecture decisions accepted (ADR-0013)

| Decision | Status | ADR reference |
| --- | --- | --- |
| Private **Local Identity Root** — never a public/peer-facing identifier | **present** | §5, §7 |
| Multiple **independent roots** per install (`IdentityVault`) | **present** | §5, §8 |
| Optional **Personas** — organizational only, **NOT guaranteed unlinkable** | **present** | §8, §21 |
| **Pairwise relationships** — per-contact, relationship-scoped identifier, not reused | **present** | §9 |
| **Room-scoped bindings** (root/persona ↔ room ↔ room alias ↔ RoomOS membership) | **present** | §10 |
| **Subordinate, revocable device authorization** (future device keys; DevicePosture tightens, never authorizes) | **present** | §11, §17 |
| **Offline-first recovery** — no admin backdoor, no master key, reduces assurance | **present** | §13 |
| **No public directory / no mandatory global username / no phone/email** | **present** | §7, §19; IDENTITY_ARCHITECTURE "Contact discovery" |
| Claim-specific verification (no generic `verified` boolean) | **present** | §12 |
| DID / VC / passkey-as-root / key-transparency explicitly rejected/deferred for v1 | **present** | §18, §19; IDENTITY_ARCHITECTURE decision table |

## 7. Deferred / unresolved ADR questions — do they block TECH-ID-03?

| Deferred area | Gate | Status | Blocks local non-crypto scaffolding? |
| --- | --- | --- | --- |
| Cryptography (root/relationship/device keys, derivation, fingerprints, signatures, recovery encryption) | **Gate F** | **blocked** (intentionally deferred) | **No** — scaffolding is metadata-only; all key state is a literal `"not_implemented_gate_f"` marker |
| Wire formats (invite/QR tokens, Capsule identity serialization) | **Gate E** | **blocked** (deferred) | **No** — no invites/QR/serialization implemented; `identifiers.ts` is explicitly *not* a hostile-input parser |
| Synchronization (personas/relationships/device-auth/block-lists/recovery/room-bindings across devices) | **Gate H** | **blocked** (deferred) | **No** — local vault is authoritative only for the current local aggregate; the revision counter is documented as *not* a vector clock / not sync / not tamper resistance |

**Confirmed:** the deferred Gate F/E/H questions **do not block** TECH-ID-03. The ADR (§21 "Implementability", §24 sequence) scopes TECH-ID-03 as *local, type-safe scaffolding with no crypto*, and the module realizes exactly that.

## 8. Identity packages / files found

| Item | Status | Evidence |
| --- | --- | --- |
| `packages/identity/` workspace package | **present** (new, this task) | `@freelayer/identity` v0.0.0, private, AGPL-3.0-or-later; deps `@freelayer/privacy`, `@freelayer/security` |
| 13 source modules | **present** | `identity-errors`, `identifiers`, `identity-types`, `identity-lifecycle`, `identity-commands`, `identity-validation`, `identity-policy`, `identity-reducer`, `identity-repository`, `identity-pipeline`, `identity-summary`, `identity-audit`, `index` |
| Private local roots (never peer-facing) | **present** | `LocalIdentityRootV1.publicExposure: "forbidden"`, `publicDirectory: "forbidden"`, `phoneRequired/emailRequired: false` |
| Personas (not guaranteed unlinkable) | **present** | `IdentityPersonaV1`; module + type docs state "NOT guaranteed unlinkable" |
| Pairwise relationship + room-binding placeholders | **present** | `PairwiseRelationshipV1` (`peerReferenceState: "opaque_placeholder"`), `RoomIdentityBindingV1` (`roomAliasState: "not_implemented_tech_id_06"`) |
| Exhaustive lifecycle validators | **present** | `identity-lifecycle.ts` transition tables; unknown/terminal transitions throw; `never`-checked exhaustiveness |
| Policy-gated commands via exact-scope `PolicyDecision` | **present** | `identity-pipeline.ts` requires an authentic decision whose `sideEffect` exactly matches `SCOPE_FOR_OPERATION[operation]` |
| Pure deterministic reducer, separate local aggregate | **present** | `identity-reducer.ts` — injected ids + clock, no I/O/randomness, immutable, exhaustive; explicitly *not* the RoomOS operation log |
| Memory / null repositories | **present** | `InMemoryLocalIdentityRepositoryV1`, `NullLocalIdentityRepositoryV1`; no disk/localStorage/IndexedDB/DB |
| Narrow local room refs (avoid RoomOS circular dep) | **present** | `RoomLocalIdRef`, `RoomMembershipIdRef` branded strings in `identifiers.ts` |
| Identity keys / signatures / derivation / fingerprints | **missing** by design (Gate F) | `keyMaterialState: "not_implemented_gate_f"`; no crypto import |
| Per-contact / per-room aliases | **missing** by design | `"not_implemented_tech_id_05"` / `"not_implemented_tech_id_06"` markers |
| Device keys / passports, Trust Notebook, invites/QR, recovery, sync | **missing** by design | future TECH-ID / Gate F/E/H; no reachable command creates recovery states |
| `packages/privacy` scope additions | **present** | `packages/privacy/src/index.ts` adds 9 `identity.*` `PolicySideEffectScope` values |

## 9. Current identity terminology

| Item | Status | Evidence |
| --- | --- | --- |
| Terminology alignment with ADR/terminology model | **present** | Code uses the ADR-0013 §4 / `IDENTITY_TERMINOLOGY_MODEL.md` vocabulary verbatim: Local Identity Root, Persona, Pairwise Relationship, Room Identity Binding, (future) Device Authorization / Trust Notebook / Recovery Configuration / Invite Authority |
| Term-collapse guards | **present** | `identity-validation.ts` `FORBIDDEN_FIELDS` rejects `verified`, `devicePosture`, `did`, `email`, `phone`, `username`, key/secret/recovery fields; a `RoomMemberRef` / DevicePosture is never treated as identity |

No terminology drift between the module and the ADR was found.

## 10. Current tests / guardrails

| Item | Status | Evidence |
| --- | --- | --- |
| Repo-wide regression harness | **present** | `tests/` with `privacy-regression/`, `security-regression/`, `unit/` (49 test files); sentinel leak tests (e.g. `security-regression/link-preview/url-classification.test.ts`), `security-regression/policy-decision-authenticity.test.ts` |
| In-code guardrails in the identity module | **present** | fail-closed policy, exact-scope decision checks, `WeakSet`-authenticated `isPolicyDecision`, redacted errors/audit with no sentinel/ids/labels, exhaustive `never` switches, revision optimistic concurrency |
| Dedicated identity tests | **missing** (gap for the test phase) | No test imports `@freelayer/identity`; no `tests/**/identity` directory exists yet. Privacy-/security-regression suites for identity (sentinel-leak, policy-authenticity, lifecycle-exhaustiveness, memory/null persistence) still need to be authored |

**Note:** the module ships the guardrail *hooks* (sentinel-free redaction, exact-scope decisions, memory/null repositories) that the regression tests are designed to exercise, but the identity-specific test suite is not yet present. This is the primary follow-up for the TDD phase and is **not** a precheck blocker.

## 11. Documentation mismatches

| Item | Status | Evidence |
| --- | --- | --- |
| ADR / companion vs. code | **present** — no dangerous mismatch | Module scope matches ADR §5–§17 and IDENTITY_ARCHITECTURE invariants |
| "Implementation NOT started" banner | **partial** — **mismatch with documentation** (expected, transient) | `IDENTITY_ARCHITECTURE.md` header and ADR-0013 §1 still say implementation has not started; TECH-ID-03 now *begins* local scaffolding. Per ADR-0010 (docs update with code), those banners should be revised to "local scaffolding in progress (TECH-ID-03); crypto/recovery/invites/aliases still Gate F/E and future TECH-ID" as part of this task |

No document falsely claims implemented crypto, verification, recovery, invites, aliases, device passports, or verified identity. The only mismatch is a *stale "not started" banner*, which is a documentation-freshness item, not an overclaim.

## 12. Secure Device separation

| Item | Status | Evidence |
| --- | --- | --- |
| Secure Device / DevicePosture kept external to identity | **present** — **preserved** | Identity package imports only `@freelayer/privacy` and `@freelayer/security`; no Secure Device import. `devicePosture`/`deviceSafe`/`attestation`/`hardwareId` are in `FORBIDDEN_FIELDS`; policy hard-codes DevicePosture as tighten-only and never an identity grant (matches ADR §11/§17 and IDENTITY_ARCHITECTURE Diagram 8) |

Secure Device separation is intact: DevicePosture may only restrict, never authorize or become identity.

## 13. Determinations (task §4)

1. **RESEARCH-ID-01 — complete.** Full research package delivered as non-binding inputs; consumed by the ADR (§4).
2. **TECH-ID-02 ADR — Accepted.** ADR-0013, status *Accepted*; architecture (not algorithms) decided (§5).
3. **ADR selects the expected model.** Private local root → optional (not-unlinkable) personas → pairwise relationships → room-scoped bindings → subordinate device authorization → offline recovery → no public directory (§6, §7).
4. **Identity code now exists as this task's scaffolding.** `packages/identity/` (13 local, non-cryptographic, metadata-only modules) is present in the working tree as the TECH-ID-03 deliverable (§8).
5. **Identity package now exists.** `@freelayer/identity` is wired into the workspace (`package.json`, `pnpm-lock.yaml`) and adds identity scopes to `@freelayer/privacy` (§8).
6. **No duplicate TECH-ID-03 branch or PR.** Only `tech/identity-local-scaffolding`; no scaffolding PR open (§1, §2).
7. **Existing types do not conflict with the ADR.** Root/persona/relationship/room-binding records and lifecycles match ADR-0013 and IDENTITY_ARCHITECTURE; `RoomMemberRef`/DevicePosture remain non-identity (§8, §9, §12).
8. **No premature crypto in production.** No keys/signatures/derivation/fingerprints, no recovery, no aliases, no device keys/passports, no invites/QR, no verification, no sync — all are literal future-gate markers (§7, §8).

## 14. Blocker

**None.** RESEARCH-ID-01 is complete, ADR-0013 is Accepted and selects the expected model, the deferred Gate F/E/H questions do not block local non-crypto scaffolding, no duplicate branch/PR exists, existing types are consistent with the ADR, and Secure Device separation is preserved. TECH-ID-03 local scaffolding may proceed. Open follow-ups (non-blocking): author the identity-specific privacy-/security-regression test suite (§10) and refresh the "implementation not started" documentation banners per ADR-0010 (§11).
