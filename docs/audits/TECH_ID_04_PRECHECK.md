# TECH-ID-04 — Ephemeral Identity Precheck

- **Date:** 2026-07-22
- **Task:** TECH-ID-04 — Ephemeral Identity (an **independent, current-process, non-recoverable, non-cryptographic** local ephemeral identity context built on TECH-ID-03).
- **Branch:** `tech/identity-ephemeral-v1` (stacked on `tech/identity-local-scaffolding` — TECH-ID-03 / PR #58).
- **Base commit (HEAD):** `84644a94704bb4e5d590af8c26a4a65b2b82efe8` — `feat(identity): add local identity scaffolding` (the TECH-ID-03 deliverable commit). This SHA is **exactly** the tip of `tech/identity-local-scaffolding` and the head of PR #58 (`headRefOid` `84644a9…`, state OPEN), so this branch is stacked directly on TECH-ID-03 with **no** intervening commits.
- **Working tree now:** carries **this task's own uncommitted TECH-ID-04 work** — an untracked `packages/identity/src/ephemeral/` module and two modified TECH-ID-03 files (`identity-types.ts`, `identity-reducer.ts`) that add the additive `rootKind` discriminant. Nothing is committed to `tech/identity-ephemeral-v1` yet.
- **Task type:** second Identity Firewall implementation. **No** cryptography, key material, signatures, derivation, fingerprints, recovery, promotion, export, sync, or persistence is introduced. Ephemeral identity is **local, current-process, process-epoch bound**, with a bounded local lifetime via an injected clock, **fail-closed expiration**, and **atomic local destruction that claims NO forensic erasure, NO remote deletion, and NO anonymity**.

## Status legend

`present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## 1. Repository head, branch, and stacking

| Item | Status | Evidence |
| --- | --- | --- |
| HEAD SHA | **present** | `84644a94704bb4e5d590af8c26a4a65b2b82efe8` |
| Branch | **present** | `tech/identity-ephemeral-v1` (local only; not yet pushed) |
| Stacked on TECH-ID-03 branch | **stacked dependency** | HEAD == tip of `tech/identity-local-scaffolding` == PR #58 `headRefOid`; `git branch --contains HEAD` lists `tech/identity-ephemeral-v1`, `tech/identity-local-scaffolding`, and `origin/tech/identity-local-scaffolding` |
| Working tree clean | **partial** | The tree holds **only** this task's TECH-ID-04 work: untracked `packages/identity/src/ephemeral/`; modified `packages/identity/src/identity-types.ts` and `identity-reducer.ts` (the additive `rootKind` discriminant). Expected in-progress work, not stray drift |
| Duplicate TECH-ID-04 branch / PR | **missing** (good) | Only `tech/identity-ephemeral-v1` exists (`git branch -a` shows no other ephemeral/id-04 branch); `gh pr list --state all` shows no ephemeral/TECH-ID-04 PR |

## 2. Open PRs — stacked identity chain (all unmerged)

The Identity Firewall work is a linear stack; each PR is open and unmerged and is the base of the next.

| PR | Title | Branch | Maps to | Status |
| --- | --- | --- | --- | --- |
| **#48** | feat(rooms): add Secure Device admission contract | `tech/sensitive-room-secure-device-contract` | **TECH-23** | **present**, **stacked dependency** — OPEN, unmerged |
| **#49** | docs(identity): research identity models and threats | `research/identity-competitor-threat-model` | **RESEARCH-ID-01** | **present**, **stacked dependency** — OPEN, unmerged |
| **#57** | docs(identity): decide Identity Firewall architecture | `architecture/identity-firewall-adr` | **TECH-ID-02 / ADR-0013** | **present**, **stacked dependency** — OPEN, unmerged |
| **#58** | feat(identity): add local identity scaffolding | `tech/identity-local-scaffolding` | **TECH-ID-03** | **present**, **stacked dependency** — OPEN, unmerged; this task's base |
| — | (TECH-ID-04) | `tech/identity-ephemeral-v1` | **TECH-ID-04 (this task)** | **missing** by design — no PR opened yet |

Chain (each stacked on the previous): **#48 → #49 → #57 → #58 → TECH-ID-04 (this branch)**. Unrelated Dependabot PRs (#52–#56) are open but out of scope. No identity PR is merged; the stack advances by branching.

## 3. RESEARCH-ID-01 status

| Item | Status | Evidence |
| --- | --- | --- |
| RESEARCH-ID-01 identity research package | **present** — **complete** | `docs/research/RESEARCH_ID_01_CONCLUSIONS.md` (+ standards / competitor-matrix / threat-model / terminology / decision-inputs); PR #49 OPEN |

RESEARCH-ID-01 is complete and directly informs this task. `IDENTITY_TERMINOLOGY_MODEL.md` defines **Ephemeral identity** as "an intentionally short-lived identity with limited continuity … not recoverable by default; not a durable account," and `IDENTITY_ARCHITECTURE_DECISION_INPUTS.md` Q11 records **"Ephemeral identities support recovery? — rejected"** (ephemeral identities are non-recoverable by definition; adding recovery would make them persistent). TECH-ID-04 implements exactly that stance.

## 4. TECH-ID-02 — Architecture ADR (ADR-0013)

| Item | Status | Evidence |
| --- | --- | --- |
| ADR number | **present** | **ADR-0013** — `docs/adr/ADR-0013-identity-firewall-architecture.md` |
| ADR status | **present** | **Accepted** |
| Ephemeral guidance in ADR | **present** | §13 "Ghost/ephemeral identities may choose **no recovery**"; §21 "Independent roots provide the real separation and are recommended for ephemeral/Ghost use"; §24 sequence lists **TECH-ID-04 — Ephemeral Identity** immediately after TECH-ID-03 |
| Schema versioning rule | **present** | §23 "Every architecture entity carries a schema version; unknown versions **fail closed**. There is no legacy identity data to migrate (none exists)." |

ADR-0013 decides *structure and invariants, not algorithms*. It endorses ephemeral identities as **independent roots** with **no recovery**, matching the TECH-ID-04 design (a separate current-process context rather than a persona under a long-lived root).

## 5. TECH-ID-03 status (this task's base)

| Item | Status | Evidence |
| --- | --- | --- |
| TECH-ID-03 local scaffolding | **present** — **complete**, **stacked dependency** | `packages/identity/` (`@freelayer/identity`, 13 modules); committed as HEAD `84644a9`; PR #58 OPEN, unmerged; audit verdict Complete in `TECH_ID_03_LOCAL_IDENTITY_SCAFFOLDING_AUDIT.md` |

TECH-ID-03 delivered the local, non-cryptographic scaffolding this task extends: long-lived roots, personas, pairwise relationships, room bindings, exhaustive lifecycle validators, policy-gated commands via exact-scope `PolicyDecision`, and memory/null repositories. It is implemented and **unmerged**, so its `LocalIdentityRootV1` schema is still internal (see §7).

## 6. Identity package structure

| Item | Status | Evidence |
| --- | --- | --- |
| `packages/identity/` workspace package | **present** | `@freelayer/identity`; depends only on `@freelayer/privacy` (+ `@freelayer/security`) |
| TECH-ID-03 modules | **present** | `identity-errors`, `identifiers`, `identity-types`, `identity-lifecycle`, `identity-commands`, `identity-validation`, `identity-policy`, `identity-reducer`, `identity-repository`, `identity-pipeline`, `identity-summary`, `identity-audit`, `index` |
| New `ephemeral/` submodule (this task) | **partial** — in progress | `packages/identity/src/ephemeral/` present with `ephemeral-errors.ts` (redacted error taxonomy: `expired`, `process_epoch_mismatch`, `clock_rollback`, `lifetime`, `promotion_forbidden`, `recovery_forbidden`, `persistence_forbidden`, `export_forbidden`, `synchronization_forbidden`, `destruction`, `orphan_state`, …) and `ephemeral-clock.ts` (`IdentityLocalClockV1`, opaque non-persisted `IdentityProcessEpochId`, `EphemeralProcessBindingV1 { crossRestartValidity: false }`, `EPHEMERAL_IDENTITY_LIMITS_V1`). Remaining ephemeral modules (types/reducer/policy/repository/index wiring) still to be authored |
| Ephemeral module isolation | **present** (by design) | The ephemeral context is a **separate** submodule, not folded into the long-lived vault types/reducer/repository |

## 7. Current root / persona / relationship schemas + compatibility risk

| Item | Status | Evidence |
| --- | --- | --- |
| `LocalIdentityRootV1` (long-lived) | **present** | `identity-types.ts`; `schemaVersion: 1`; private, never peer-facing; `keyMaterialState:"not_implemented_gate_f"`; memory/null persistence |
| `IdentityPersonaV1` / `PairwiseRelationshipV1` / `RoomIdentityBindingV1` | **present** | placeholders; not guaranteed unlinkable; no crypto/alias |
| `LocalIdentityVaultStateV1` | **present** | immutable collections; no ambient/default identity |
| New `rootKind` discriminant on `LocalIdentityRootV1` | **present** — **mismatch with documentation** (expected, additive) | `identity-types.ts` adds `LocalIdentityRootKindV1 = "long_lived_local" \| "ephemeral_current_process"` and `readonly rootKind: "long_lived_local"` to `LocalIdentityRootV1`; `identity-reducer.ts` sets `rootKind:"long_lived_local"` at the single create-root construction site (line ~91). The lifecycle-transition construction (`{ ...current, … }`) inherits it via spread — so exactly **one** literal construction site changed |
| Schema compatibility risk | **partial** — **not applicable as a break** | `LocalIdentityRootV1` is **internal and unreleased** (all identity PRs #57/#58 unmerged; no external consumer; nothing persisted). Adding a discriminant to an unreleased internal schema is an additive, non-breaking change. Rationale + before/after are detailed in `TECH_ID_04_SCHEMA_COMPATIBILITY.md` |

The compatibility posture: a `rootKind` discriminant is added rather than an `ephemeral: boolean` flag; unknown kinds fail closed (per ADR §23); long-lived roots always carry `"long_lived_local"`; ephemeral roots are a **separate** `EphemeralIdentityRootV1` (`"ephemeral_current_process"`) that lives in a **separate** current-process repository, never the long-lived vault.

## 8. Current repository / storage / policy behavior

| Item | Status | Evidence |
| --- | --- | --- |
| Long-lived repositories | **present** | `InMemoryLocalIdentityRepositoryV1` (memory-only; defensive clone; discards `persistenceClass:"null"` vaults) and `NullLocalIdentityRepositoryV1` (retains nothing; honest discard). Every op requires an authentic `identity.*`-scoped `PolicyDecision` |
| No disk / browser / DB persistence | **present** | `identity-repository.ts` module doc: "MEMORY-ONLY or NULL — no disk, no browser storage, no database, and no encrypted storage (encrypted persistence is Gate F)" |
| Identity policy resolver | **present** | `resolveLocalIdentityPolicyV1` — strictest-wins, fail-closed on unknown mode/operation, `networkAllowed/notificationAllowed/aiAllowed/identityProofingAvailable/cryptoAvailable/recoveryAvailable` all `false`; Bunker/Emergency deny expansive creates |
| Ephemeral repository / policy | **missing** by design (in progress) | The ephemeral context will use its **own** current-process `EphemeralIdentityRepositoryV1` (not the long-lived vault) and its own policy gating; not yet authored beyond errors/clock scaffolding |

## 9. Existing ephemeral / temporary / guest / incognito / session identity references

| Item | Status | Evidence |
| --- | --- | --- |
| Pre-existing ephemeral **identity type** in code | **missing** (good) | A repo-wide search (`ephemeral`/`incognito`/`guest`/`temporary`/`session identity`) finds only (a) this task's new `packages/identity/src/ephemeral/` files, (b) the additive `rootKind` union in `identity-types.ts`, and (c) **documentation** references — never a competing implementation |
| Conflicting temporary / guest / incognito identity | **missing** (good) | No `guest`/`incognito`/`temporary`/`session` identity type, class, or module exists anywhere in `packages/` |
| Documentation references to "ephemeral" | **present** (conceptual only) | ADR-0013 §13/§21/§24, `IDENTITY_TERMINOLOGY_MODEL.md`, `IDENTITY_ARCHITECTURE_DECISION_INPUTS.md` (Model D / Q11), `RESEARCH_ID_01_*`, `ROADMAP.md`, `PRIVACY_MODEL.md`, `GLOSSARY.md`, `IDENTITY_FIREWALL.md`. All are **design/roadmap** language, none an implemented type. "Ephemeral sessions" in competitor docs (OnionShare) is unrelated |

There is **no** pre-existing ephemeral, temporary, guest, incognito, or session identity implementation to reconcile or supersede. TECH-ID-04 introduces the first one.

## 10. Secure Device separation

| Item | Status | Evidence |
| --- | --- | --- |
| Secure Device / DevicePosture kept external to identity | **present** — **preserved** | Identity package imports only `@freelayer/privacy` (+ `@freelayer/security`); no Secure Device import. The ephemeral module (`ephemeral-clock.ts`) explicitly binds to a local **process epoch** that "contains NO OS process id, is never persisted, and is never exposed to peers"; DevicePosture remains tighten-only and never an identity grant (ADR §11/§17) |

Secure Device separation is intact. The ephemeral context adds a process-epoch binding for lifetime, **not** a device/attestation signal.

## 11. Determinations (task §4)

1. **TECH-ID-03 — implemented and unmerged.** `@freelayer/identity` is present (committed at HEAD `84644a9`); PR #58 is OPEN, unmerged (§5).
2. **TECH-ID-02 ADR — Accepted.** ADR-0013 endorses ephemeral identities as independent, no-recovery roots and sequences TECH-ID-04 next (§4).
3. **`packages/identity` exists.** The workspace package and its 13 TECH-ID-03 modules are present; the new `ephemeral/` submodule is in progress (§6).
4. **Identity schema v1 is internal / unreleased**, so a discriminant may be added additively. No external consumer, nothing persisted (§7; detailed in `TECH_ID_04_SCHEMA_COMPATIBILITY.md`).
5. **The root model gains a discriminant.** `LocalIdentityRootV1` now carries `rootKind:"long_lived_local"` (single additive field; one construction site in the reducer) (§7).
6. **No ephemeral type exists yet** beyond this task's own in-progress module; ephemeral roots will be a **separate** `EphemeralIdentityRootV1` in a **separate** current-process repository (§6, §8).
7. **No conflicting temporary / guest / incognito identity** exists anywhere in the codebase (§9).
8. **No duplicate TECH-ID-04 branch or PR.** Only `tech/identity-ephemeral-v1`; no ephemeral PR open (§1, §2).

## 12. Blocker

**None.** RESEARCH-ID-01 is complete; ADR-0013 is Accepted and explicitly endorses independent, non-recoverable ephemeral identities; TECH-ID-03 is implemented (unmerged) and provides the base; the identity schema is internal/unreleased so the additive `rootKind` discriminant is safe; no pre-existing ephemeral/temporary/guest/incognito/session identity conflicts; Secure Device separation is preserved; and no duplicate branch/PR exists. TECH-ID-04 ephemeral identity may proceed. The one intentional, transient item is the additive `rootKind` change to the unreleased TECH-ID-03 `LocalIdentityRootV1` schema, documented in `TECH_ID_04_SCHEMA_COMPATIBILITY.md`.
