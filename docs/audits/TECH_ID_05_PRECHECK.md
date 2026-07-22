# TECH-ID-05 — Per-Contact Aliases Precheck

- **Date:** 2026-07-22
- **Task:** TECH-ID-05 — Per-Contact Aliases. A **local, relationship-scoped, non-cryptographic** presentation foundation built on TECH-ID-03/04: a **pairwise presentation alias** (relationship-scoped, persona/root-bound, local-only, non-authoritative, **not yet shared**), a **local peer label** (private, never shared), Unicode **NFC** normalization + dangerous-control rejection, local reuse warnings, rotation, policy-gated display contexts, and memory/null retention. **No** public usernames, directory, search, remote exchange, cryptographic binding, verification, or synchronization.
- **Branch:** `tech/identity-contact-aliases-v1` (stacked on `tech/identity-ephemeral-v1` — TECH-ID-04 / PR #59).
- **Base commit (HEAD):** `2ec6408286a729e7a946321abab1cf83be08e44d` — `feat(identity): add ephemeral identity model` (the TECH-ID-04 deliverable commit). This SHA is **exactly** the tip of `tech/identity-ephemeral-v1` and the head of PR #59 (`headRefOid` `2ec6408…`, state OPEN), so this branch is stacked directly on TECH-ID-04 with **no** intervening commits.
- **Working tree now:** carries **this task's own uncommitted TECH-ID-05 work** — an untracked `packages/identity/src/aliases/` module (four files authored so far: `alias-types.ts`, `alias-normalization.ts`, `alias-identifiers.ts`, `alias-errors.ts`) plus these two TECH-ID-05 documents. Nothing is committed to `tech/identity-contact-aliases-v1` yet, and the module is **partial** (no reducer / policy / repository / pipeline / commands / validation / summary / index authored yet). No committed TECH-ID-03/04 file is modified.
- **Task type:** third Identity Firewall implementation. **No** cryptography, key material, signatures, derivation, fingerprints, verification, recovery, promotion, export, sync, network, notification, AI, or persistence beyond memory/null is introduced. An alias is **local presentation metadata**, never identity, never authority, never a public username, never a discovery handle.

## Status legend

`present` · `partial` · `missing` · `blocked` · `not applicable` · `mismatch with documentation` · `stacked dependency`

## 1. Repository head, branch, and stacking

| Item | Status | Evidence |
| --- | --- | --- |
| HEAD SHA | **present** | `2ec6408286a729e7a946321abab1cf83be08e44d` |
| Branch | **present** | `tech/identity-contact-aliases-v1` (local only; not yet pushed) |
| Stacked on TECH-ID-04 branch | **stacked dependency** | HEAD == tip of `tech/identity-ephemeral-v1` == PR #59 `headRefOid` (`2ec6408…`, OPEN); `git branch --contains HEAD` lists `tech/identity-contact-aliases-v1`, `tech/identity-ephemeral-v1`, and `origin/tech/identity-ephemeral-v1` |
| Working tree clean | **partial** | The tree holds **only** this task's TECH-ID-05 work: untracked `packages/identity/src/aliases/` (four files) + these two docs. All four alias files are untracked (`git ls-files` returns nothing for the folder; not gitignored). Expected in-progress work, not stray drift; no committed file modified |
| Duplicate TECH-ID-05 branch / PR | **missing** (good) | Only `tech/identity-contact-aliases-v1` exists (`git branch -a` shows no other alias/id-05 branch); `gh pr list --state all` shows no alias / TECH-ID-05 PR |

## 2. Open PRs — stacked identity chain (all unmerged)

The Identity Firewall work is a linear stack; each PR is open and unmerged and is the base of the next.

| PR | Title | Branch | Maps to | Status |
| --- | --- | --- | --- | --- |
| **#48** | feat(rooms): add Secure Device admission contract | `tech/sensitive-room-secure-device-contract` | **TECH-23** | **present**, **stacked dependency** — OPEN, unmerged |
| **#49** | docs(identity): research identity models and threats | `research/identity-competitor-threat-model` | **RESEARCH-ID-01** | **present**, **stacked dependency** — OPEN, unmerged |
| **#57** | docs(identity): decide Identity Firewall architecture | `architecture/identity-firewall-adr` | **TECH-ID-02 / ADR-0013** | **present**, **stacked dependency** — OPEN, unmerged |
| **#58** | feat(identity): add local identity scaffolding | `tech/identity-local-scaffolding` | **TECH-ID-03** | **present**, **stacked dependency** — OPEN, unmerged |
| **#59** | feat(identity): add ephemeral identity model | `tech/identity-ephemeral-v1` | **TECH-ID-04** | **present**, **stacked dependency** — OPEN, unmerged; this task's base |
| — | (TECH-ID-05) | `tech/identity-contact-aliases-v1` | **TECH-ID-05 (this task)** | **missing** by design — no PR opened yet |

Chain (each stacked on the previous): **#48 → #49 → #57 → #58 → #59 → TECH-ID-05 (this branch)**. Unrelated Dependabot PRs (#52–#56) are open but out of scope. No identity PR is merged; the stack advances by branching.

## 3. RESEARCH-ID-01 status

| Item | Status | Evidence |
| --- | --- | --- |
| RESEARCH-ID-01 identity research package | **present** — **complete** | `docs/research/RESEARCH_ID_01_CONCLUSIONS.md` (+ standards / competitor-matrix / threat-model / terminology / decision-inputs); PR #49 OPEN |

RESEARCH-ID-01 is complete and directly informs this task. `IDENTITY_TERMINOLOGY_MODEL.md` and the competitor matrix supply the SimpleX/Signal pairwise-and-presentation evidence that separates *identity root* from *persona* from *per-contact presentation* from *relationship identifier*. The correlation threat (globally reused identifiers) and the term-collapse threat (treating a display name as identity/verification) are the two findings TECH-ID-05 must respect when adding a **visible-but-local** alias.

## 4. TECH-ID-02 — Architecture ADR (ADR-0013)

| Item | Status | Evidence |
| --- | --- | --- |
| ADR number | **present** | **ADR-0013** — `docs/adr/ADR-0013-identity-firewall-architecture.md` |
| ADR status | **present** — **current** | **Accepted** (§1) |
| Alias/persona guidance in ADR | **present** | §7 "room aliases … must **not** use display aliases as cryptographic identifiers"; §8 persona may hold display profile / room-alias defaults but **not** a global searchable username or public root identifier; §9 "The display alias may change **without** changing the relationship record; **block state survives display-alias changes**"; §9 "A relationship identifier alone does **not** prove real identity" |
| Sequence places TECH-ID-05 next | **present** | §24 lists **TECH-ID-05 — Per-Contact Aliases** immediately after TECH-ID-04, before TECH-ID-06 (Per-Room Aliases) |
| Schema versioning rule | **present** | §23 "Every architecture entity carries a schema version; unknown versions **fail closed**." |

ADR-0013 decides *structure and invariants, not algorithms*. It authorizes exactly TECH-ID-05's shape: relationship-scoped display aliases that are **presentation, not authority**, that are **never cryptographic identifiers**, that may **rotate without disturbing relationship/trust/block state**, and that carry **no** real-identity proof.

## 5. TECH-ID-03 status (base scaffolding)

| Item | Status | Evidence |
| --- | --- | --- |
| TECH-ID-03 local scaffolding | **present** — **complete**, **stacked dependency** | `packages/identity/` (`@freelayer/identity`, 13 modules); PR #58 OPEN, unmerged; audit verdict Complete in `docs/audits/TECH_ID_03_LOCAL_IDENTITY_SCAFFOLDING_AUDIT.md` |

TECH-ID-03 delivered the local, non-cryptographic scaffolding this task attaches to: long-lived roots, personas, **pairwise relationships**, room bindings, exhaustive lifecycle validators, policy-gated commands via exact-scope `PolicyDecision`, memory/null repositories, and content-free redacted errors. Implemented and **unmerged** (schema still internal, so additive alias types are safe — §8, §9).

## 6. TECH-ID-04 status (immediate base)

| Item | Status | Evidence |
| --- | --- | --- |
| TECH-ID-04 ephemeral identity | **present** — **complete**, **stacked dependency** | `packages/identity/src/ephemeral/` (11 modules); committed as HEAD `2ec6408`; PR #59 OPEN, unmerged; audit verdict Complete in `docs/audits/TECH_ID_04_EPHEMERAL_IDENTITY_AUDIT.md` |
| `rootKind` discriminant available | **present** | `identity-types.ts` `LocalIdentityRootKindV1 = "long_lived_local" \| "ephemeral_current_process"`; both a long-lived and an ephemeral pairwise relationship exist, so an alias must be bindable to a relationship under **either** root kind |

TECH-ID-04 is complete and committed (it is HEAD). It adds the **independent, current-process** ephemeral root and its own `EphemeralPairwiseRelationshipV1`. TECH-ID-05 must therefore support attaching an alias to a relationship under **both** root kinds without letting an alias link them (see §8, §9).

## 7. Identity package structure

| Item | Status | Evidence |
| --- | --- | --- |
| `packages/identity/` workspace package | **present** | `@freelayer/identity`; depends only on `@freelayer/privacy` (+ `@freelayer/security`) |
| TECH-ID-03 modules | **present** | `identity-errors`, `identifiers`, `identity-types`, `identity-lifecycle`, `identity-commands`, `identity-validation`, `identity-policy`, `identity-reducer`, `identity-repository`, `identity-pipeline`, `identity-summary`, `identity-audit`, `index` |
| TECH-ID-04 `ephemeral/` submodule | **present** | `ephemeral-{clock,commands,errors,expiration,pipeline,policy,reducer,repository,summary,types,validation}` + `index` |
| New `aliases/` submodule (this task) | **partial** — in progress | `packages/identity/src/aliases/` present with four untracked files: `alias-types.ts` (`PairwisePresentationAliasV1`, `LocalPeerLabelV1`, `ContactAliasStateV1`, `ContactAliasSecurityAssessmentV1`, `ContactDisplayContextV1`, rotation/reuse results, lifecycle unions), `alias-normalization.ts` (`normalizeContactAliasDisplayTextV1`, NFC + dangerous-code-point rejection, `CONTACT_ALIAS_LIMITS_V1`, `ContactAliasTextV1`), `alias-identifiers.ts` (opaque `ContactAliasId` / `LocalPeerLabelId`, injected generation), `alias-errors.ts` (redacted `ContactAliasError` taxonomy). **Remaining** modules (commands / validation / policy / reducer / repository / pipeline / summary / audit / index wiring) still to be authored |
| Alias module isolation | **present** (by design) | A **separate** `aliases/` submodule, not folded into the long-lived or ephemeral vault types/reducer/repository. Aliases are a distinct aggregate (`ContactAliasStateV1`) referencing a relationship by id, never the reverse |

## 8. Pairwise relationship schema (alias attachment point)

| Item | Status | Evidence |
| --- | --- | --- |
| `PairwiseRelationshipV1` (long-lived) | **present** | `identity-types.ts`: `relationshipId` / `rootId` / `personaId` / `revision`; `lifecycle: PairwiseRelationshipLifecycleV1` (`draft_local` · `active_local_unverified` · `blocked_local` · `compromised_suspected` · `removed_tombstone`); `peerReferenceState: "opaque_placeholder"`; **`aliasState: "not_implemented_tech_id_05"`**; `trustNotebookState: "not_implemented_tech_id_09"` |
| `EphemeralPairwiseRelationshipV1` (current-process) | **present** | `ephemeral/ephemeral-types.ts`: `relationshipId` / `rootId` / `personaId` / `revision`; `lifecycle: EphemeralRelationshipLifecycleV1`; `assurance: "unverified_local"`; **`aliasState: "not_implemented_tech_id_05"`**; `trustState: "not_inherited"`; `persistence`/`export: "forbidden"` |
| Alias state markers are the reserved hook | **present** — **mismatch with documentation** (expected, this task fills it) | Both relationship records carry `aliasState: "not_implemented_tech_id_05"`. TECH-ID-05 does **not** flip these into inline alias fields; it stores aliases in the **separate** `ContactAliasStateV1` aggregate that references the relationship id (`alias-types.ts` `PairwisePresentationAliasV1.relationshipId`). The `aliasState` markers document that per-contact aliases are owned by this task |
| Block/trust survive alias change | **present** (design honored by WIP) | `ContactAliasRotationResultV1` pins `relationshipContinuityPreserved: true`, `trustStateChanged: false`, `blockStateChanged: false` (`alias-types.ts`) — matching ADR §9 "block state survives display-alias changes" |

The alias binds to a relationship (under either root kind) by **reference**; the relationship record is not rewritten, so changing or rotating an alias cannot alter the relationship's lifecycle, assurance, block, or trust state.

## 9. Current display-name / profile / alias types

| Item | Status | Evidence |
| --- | --- | --- |
| Pre-existing peer-facing display-name type | **missing** (good) | No `displayName`, `profileName`, `contactName`, or user-visible name **type** exists anywhere in `packages/`. The only display-adjacent field is `IdentityPersonaV1.localLabel?: string` / `EphemeralIdentityPersonaV1.localLabel?` — explicitly "Local, sensitive, never exported, never a public username" (`identity-types.ts` line 159) |
| Pre-existing profile/alias implementation (committed) | **missing** (good) | In committed code, `alias` appears **only** as: (a) the `aliasState: "not_implemented_tech_id_05"` / `roomAliasState: "not_implemented_tech_id_06"` state markers, (b) module/comment prose describing deferred aliases (`index.ts`, `identifiers.ts`, `identity-types.ts`). `username`/`globalUsername`/`did`/`email`/`phone` appear **only** in `identity-validation.ts` `FORBIDDEN_FIELDS` (rejected on mass-assign) and `ephemeral-validation.ts`. There is **no committed alias record, reducer, or repository** |
| This task's alias code | **partial** — WIP (uncommitted) | The first alias record/normalization/identifier/error code exists as this task's own four untracked files (§7). It is the **only** alias implementation in the tree and is incomplete |
| Alias grants no authority / verification | **present** (design honored by WIP) | `alias-types.ts`: `ContactAliasSecurityAssessmentV1 { impersonationSafe: false, verifiedIdentity: false }`; `LocalPeerLabelV1 { authority: "none", verificationEvidence: false, peerShared: false, visibility: "local_only" }`; `ContactDisplayContextV1 { aliasVerified: false, realWorldIdentityVerified: false, cryptographicBindingAvailable: false }`. Aliases are presentation metadata only |

There was **no** pre-existing alias/profile/display-name implementation to reconcile or supersede; the committed baseline names alias/username only as **rejected data** or **not-implemented state markers**. TECH-ID-05 introduces the first alias code, and its own WIP already fixes aliases as non-authoritative, non-verifying, local presentation metadata.

## 10. Terminology conflicts

| Item | Status | Evidence |
| --- | --- | --- |
| Conflicting use of `alias` | **missing** (good) | `alias` in committed code means only "a deferred per-contact/per-room presentation name" (`not_implemented_tech_id_05/06`) — consistent with the new module's `PairwisePresentationAliasV1`. No competing "alias = key/handle/account" meaning |
| Conflicting use of `username` | **missing** (good) | `username`/`globalUsername` appear **only** as forbidden mass-assign fields (`identity-validation.ts`, `ephemeral-validation.ts`) and as "no public username" prose. FreeLayer has **no** username concept; the new module adds none (a pairwise alias is not a username) |
| Conflicting use of `displayName` | **missing** (good) | The token `displayName` does not appear as a field anywhere; the concept is "local label" (persona) or "display text" (alias) — both explicitly non-public. No collision |

`alias`, `username`, and `displayName` appear across the identity package **only** as rejected data or deferred-state markers. The new module's terminology (`PairwisePresentationAliasV1`, `LocalPeerLabelV1`, `ContactAliasDisplayText`) is additive and consistent; there is no term to disambiguate or supersede.

## 11. Storage & metadata policies

| Item | Status | Evidence |
| --- | --- | --- |
| Identity repositories | **present** | `identity-repository.ts` — `InMemoryLocalIdentityRepositoryV1` (memory-only; defensive clone; discards `persistenceClass:"null"` vaults) and `NullLocalIdentityRepositoryV1` (retains nothing). Every op requires an authentic `identity.*`-scoped `PolicyDecision`; ephemeral has its own current-process/null pair |
| No disk / browser / DB persistence | **present** | Identity + ephemeral repositories are MEMORY-ONLY or NULL — no disk, browser storage, database, or encrypted storage (encrypted persistence is Gate F). The alias aggregate `ContactAliasStateV1` is likewise `persistenceClass: "memory_only" \| "null"` (`alias-types.ts`) |
| `StoragePolicy` (`@freelayer/storage`) | **present** | `packages/storage/src/policy.ts` + `dataClasses.ts` — storage selected only by policy (ADR-0005). Alias text must map to a privacy-sensitive relationship-metadata class, never a public/exported class |
| `MetadataPolicy` (`@freelayer/privacy`) | **present** | `packages/privacy/src/metadataPolicy.ts` — mode-driven minimization; strict modes minimize further. ADR §16 classifies `pairwise_relationship` metadata as privacy-sensitive: no project server, no public directory, no analytics, no automatic export |
| `PolicyDecision` exact-scope gating | **present** | `packages/privacy/src/index.ts` — module-private `WeakSet` provenance; `issuePolicyDecision` / `isPolicyDecision`; each decision carries an exact `sideEffect` scope. Alias operations will require authentic exact-scope `identity.alias.*` decisions (new scopes to be added by this task) |

Alias text is **relationship metadata** (ADR §16 `pairwise_relationship`): privacy-sensitive, local, memory/null only, no public directory, no automatic export, strict-mode minimized. No new storage backend or persistence class is introduced.

## 12. Current guardrails (`check:no-*`)

| Guardrail (in `package.json`) | Relevance to TECH-ID-05 |
| --- | --- |
| `check:no-identity-scaffolding-bypass` | **directly relevant** — static scan that identity stays local/non-crypto/non-authoritative; must extend to cover alias-as-identity/verification bypasses |
| `check:no-ephemeral-identity-bypass` | **relevant** — an alias must not become a promotion/persistence/cross-restart handle for an ephemeral relationship |
| `check:no-forbidden-storage` · `check:no-forbidden-network` · `check:no-external-assets` · `check:no-network-deps` | **relevant** — alias text must not be persisted to disk, sent over the network, or embedded in external assets |
| `check:no-metadata-bypass` | **relevant** — alias text is sensitive relationship metadata; must respect metadata policy |
| `check:no-notification-bypass` · `check:no-telemetry` | **relevant** — alias text must never leak via notifications or telemetry |
| `check:no-secure-device-core-implementation` · `check:no-device-posture-or-governance-bypass` | **relevant** — the alias module must not import Secure Device / DevicePosture or treat posture as identity |
| `check:no-room-*` (authorization / membership / object / query / roomos) | **not applicable** (RoomOS scope; per-room aliases are TECH-ID-06) |
| `check:no-contact-alias-bypass` | **missing** by design — a dedicated alias guardrail does not exist yet; adding one (aliases stay local/non-authoritative/non-shared/non-crypto, no confusable overclaim, redacted errors) is a TECH-ID-05 follow-up, mirroring the identity/ephemeral guardrails |

Adjacent script-level guardrails also present: `check-identity-docs.mjs`, `check-doc-links.mjs`, `check-boundaries.mjs`, `check-build-zero-egress.mjs`, `check-policy-conflicts.mjs`, `check-policy-docs-consistency.mjs`.

## 13. Secure Device separation

| Item | Status | Evidence |
| --- | --- | --- |
| Secure Device / DevicePosture kept external to identity | **present** — **preserved** | The identity package imports only `@freelayer/privacy` (+ `@freelayer/security`); no Secure Device import. The alias module's four files import only sibling identity types and its own error/identifier/normalization helpers — no Secure Device, no DevicePosture, no attestation. DevicePosture remains tighten-only in policy and a rejected caller field (ADR §11/§17) |

Secure Device separation is intact. An alias is local presentation metadata; endpoint protection (screenshots, task-switcher previews, memory hardening) is the external Secure Device / Endpoint Defense project's concern, not this module's.

## 14. Determinations (task §4)

1. **TECH-ID-03 + TECH-ID-04 — complete and unmerged.** `@freelayer/identity` (TECH-ID-03) and its `ephemeral/` submodule (TECH-ID-04) are present and committed (HEAD `2ec6408`); PRs #58 and #59 are OPEN, unmerged (§5, §6).
2. **ADR-0013 — current (Accepted).** It explicitly authorizes relationship-scoped display aliases as presentation (not authority/identity), never cryptographic identifiers, rotatable without disturbing relationship/block/trust state, and sequences TECH-ID-05 next (§4).
3. **Pairwise relationships are placeholders.** `PairwiseRelationshipV1` and `EphemeralPairwiseRelationshipV1` are non-crypto placeholders that reserve alias ownership via `aliasState: "not_implemented_tech_id_05"`; TECH-ID-05 fills this via a **separate** alias aggregate referencing the relationship id (§8).
4. **No pre-existing alias / profile / display-name implementation.** The committed baseline has **no** alias/profile/`displayName` type; `alias`/`username`/`did`/`email`/`phone` appear only as rejected mass-assign fields or `not_implemented_*` state markers. The **only** alias code in the tree is this task's own uncommitted, partial `aliases/` module (§7, §9) — the first such implementation.
5. **No inconsistent `alias` / `username` usage.** All three terms are used consistently (rejected data or deferred-state markers); the new module's terminology is additive with no collision to disambiguate (§10).
6. **No duplicate TECH-ID-05 branch or PR.** Only `tech/identity-contact-aliases-v1`; no alias/id-05 PR open (§1, §2).
7. **No root ID exposed as display identity.** `LocalIdentityRootV1.publicExposure: "forbidden"`; alias identifiers encode "no root/persona/relationship id … no display text" (`alias-identifiers.ts`); display text is a separate `ContactAliasDisplayText`, never derived from or serializing a root id (§9).
8. **No alias grants authority or verification.** The WIP fixes `impersonationSafe: false`, `verifiedIdentity: false`, `authority: "none"`, `verificationEvidence: false`, `aliasVerified: false`, `realWorldIdentityVerified: false`, `cryptographicBindingAvailable: false` (§9).

## 15. Blocker

**None.** RESEARCH-ID-01 is complete; ADR-0013 is Accepted and explicitly authorizes relationship-scoped, non-authoritative, rotatable display aliases that are never cryptographic identifiers; TECH-ID-03 and TECH-ID-04 are implemented (unmerged) and provide the pairwise + ephemeral relationships an alias attaches to; the identity schema is internal/unreleased so additive alias types in a separate aggregate are safe; there is **no** pre-existing alias/profile/display-name implementation or terminology conflict to reconcile; storage/metadata policies and `PolicyDecision` gating already exist to reuse; Secure Device separation is preserved; and no duplicate branch/PR exists. TECH-ID-05 per-contact aliases may proceed. The one intentional in-progress item is this task's own **partial, uncommitted** `packages/identity/src/aliases/` module (four files so far), to be completed with commands/validation/policy/reducer/repository/pipeline/summary, a dedicated `check:no-contact-alias-bypass` guardrail, and privacy/security-regression tests before the audit.
