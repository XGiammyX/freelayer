# TECH-ID-04 — Schema Compatibility Decision (Ephemeral Root Discriminant)

- **Date:** 2026-07-22
- **Task:** TECH-ID-04 — Ephemeral Identity.
- **Branch:** `tech/identity-ephemeral-v1` (stacked on `tech/identity-local-scaffolding` / PR #58).
- **Scope of this note:** the single schema-compatibility question raised by TECH-ID-04 — how to distinguish an **ephemeral** identity root from a **long-lived** one without breaking the TECH-ID-03 `LocalIdentityRootV1` schema. Precheck: [TECH_ID_04_PRECHECK.md](TECH_ID_04_PRECHECK.md).

## 1. Decision

Add a **root-kind discriminant** to the identity model:

```ts
export type LocalIdentityRootKindV1 = "long_lived_local" | "ephemeral_current_process";
```

- **Long-lived roots** (TECH-ID-03) gain a single additive field `rootKind: "long_lived_local"` on `LocalIdentityRootV1`.
- **Ephemeral roots** (TECH-ID-04) are a **separate type** `EphemeralIdentityRootV1` carrying `rootKind: "ephemeral_current_process"`, stored in a **separate, current-process** `EphemeralIdentityRepositoryV1` — **never** in the long-lived `LocalIdentityVaultStateV1`.

This is permitted because TECH-ID-03's `LocalIdentityRootV1` is **internal and unreleased**: the entire identity stack (PRs #57 and #58) is **open and unmerged**, there is **no external consumer** of `@freelayer/identity`, and **nothing is persisted** (memory/null repositories only). Per the task's §9 schema-compatibility determination — and consistent with ADR-0013 §23 ("every architecture entity carries a schema version; unknown versions **fail closed**; there is no legacy identity data to migrate") — adding a discriminant to an unreleased internal schema is an **additive, non-breaking** change, not a mutation of a published contract.

## 2. What was explicitly NOT done

- **NOT `ephemeral: boolean`.** A boolean flag on a shared record would invite a single `LocalIdentityRootV1` type (and a single vault) to carry both concerns, blurring the invariants. A discriminated union keeps the two kinds structurally distinct and exhaustively switchable.
- **NOT a folded/union vault.** Ephemeral roots are **not** added to `LocalIdentityVaultStateV1.roots`. Mixing lifetimes in one collection would let a current-process, non-recoverable root be read/written through the long-lived (memory-retaining) repository path.
- **NOT an incompatible mutation of a published schema.** `schemaVersion` stays `1`; no field is removed, renamed, or retyped. The only change to the long-lived record is one **added** required field. Because the schema is unreleased and unpersisted, no version bump or on-disk migration is warranted.
- **Unknown root kinds fail closed / deny.** Consumers that encounter a `rootKind` outside `LOCAL_IDENTITY_ROOT_KINDS` must reject (ADR-0013 §23 / §17 fail-closed invariants), never coerce to a default.

## 3. Before / after type sketch

**Before (TECH-ID-03, released-internally as v1):**

```ts
interface LocalIdentityRootV1 {
  readonly schemaVersion: 1;
  // no rootKind
  readonly rootId: LocalIdentityRootId;
  readonly lifecycle: LocalIdentityRootLifecycleV1;
  readonly assurance: IdentityAssuranceStateV1;
  readonly persistenceClass: "memory_only" | "null";
  // …long-lived fields (keyMaterialState, recoveryState, deviceAuthorizationState, …)
}
```

**After (TECH-ID-04):**

```ts
type LocalIdentityRootKindV1 = "long_lived_local" | "ephemeral_current_process";

// (A) long-lived root: one additive discriminant, everything else unchanged
interface LocalIdentityRootV1 {
  readonly schemaVersion: 1;
  readonly rootKind: "long_lived_local";        // <-- single additive field
  readonly rootId: LocalIdentityRootId;
  readonly lifecycle: LocalIdentityRootLifecycleV1;
  readonly assurance: IdentityAssuranceStateV1;
  readonly persistenceClass: "memory_only" | "null";
  // …unchanged long-lived fields
}

// (B) ephemeral root: a SEPARATE type, SEPARATE invariants, SEPARATE store
interface EphemeralIdentityRootV1 {
  readonly schemaVersion: 1;
  readonly rootKind: "ephemeral_current_process"; // <-- distinct discriminant
  readonly rootId: EphemeralIdentityRootId;
  readonly processBinding: EphemeralProcessBindingV1; // { crossRestartValidity: false }
  // bounded local lifetime (injected clock), fail-closed expiration;
  // NO recovery / promotion / export / sync / persistence fields
}
```

The reducer change is minimal and localized: the **single** create-root construction site in `identity-reducer.ts` now emits `rootKind: "long_lived_local"`. The lifecycle-transition path rebuilds the root with `{ ...current, … }`, so it **inherits** the discriminant via spread — no second construction site to touch.

## 4. Rationale — separate ephemeral repository vs. one union vault

A separate `EphemeralIdentityRepositoryV1` (current-process) is chosen over adding ephemeral roots to the long-lived `LocalIdentityVaultStateV1` for **strong isolation**:

- **Lifetime containment.** Ephemeral roots are current-process, process-epoch bound, and non-recoverable. Keeping them out of the long-lived vault guarantees they cannot be persisted (even to the memory-only store) or survive a process/epoch change; a `processEpochId` mismatch means expired/destroyed for operational purposes.
- **Invariant separation.** The long-lived root has recovery/device-authorization/verification lifecycle states; the ephemeral root has **none of these** (no recovery, no promotion, no export, no sync, no persistence). Two types + two stores let each set of invariants be validated exhaustively without cross-contamination or "not applicable here" branches.
- **Fail-closed blast radius.** A bug or unknown-kind value in one path cannot silently leak a root into the other store. The long-lived repository only accepts `LocalIdentityVaultStateV1` (long-lived roots); the ephemeral repository only holds `EphemeralIdentityRootV1`.
- **Honest destruction semantics.** Ephemeral destruction is **local and atomic** and claims **no** forensic erasure, **no** remote deletion, and **no** anonymity. A dedicated current-process store makes "destroy = drop the in-process context" the whole story, with nothing to reconcile against a retained long-lived aggregate.
- **ADR alignment.** ADR-0013 §21 recommends **independent roots** (not personas) as the real basis for ephemeral/Ghost separation, and §13 allows ephemeral identities to choose **no recovery**. A separate ephemeral context — rather than a persona under a long-lived root or a flag on the shared record — realizes that guidance directly.

## 5. Migration note

**No data migration is required.**

- Nothing identity-related is persisted: TECH-ID-03 uses memory-only or null repositories, and no encrypted persistence exists before Gate F. There is no on-disk, database, or browser-stored `LocalIdentityRootV1` to upgrade.
- Any long-lived root that exists does so only as **in-memory state within a running process**. After this change, such roots are simply always constructed with `rootKind: "long_lived_local"` (the reducer sets it at creation; transitions carry it forward by spread). There is no pre-existing record lacking the field to backfill.
- Ephemeral roots start their life under this schema and never coexist with a prior format.
- Because the schema is unreleased and unpersisted, `schemaVersion` remains `1`; unknown `rootKind` values fail closed if ever encountered (ADR-0013 §23).

## 6. Summary

| Concern | Decision |
| --- | --- |
| Distinguish ephemeral vs. long-lived | `rootKind` discriminant (`"long_lived_local"` / `"ephemeral_current_process"`), **not** `ephemeral: boolean` |
| Long-lived record change | One **additive** required field; single reducer construction site; `schemaVersion` unchanged |
| Ephemeral record | **Separate** `EphemeralIdentityRootV1`; no recovery/promotion/export/sync/persistence |
| Storage | **Separate** current-process `EphemeralIdentityRepositoryV1`; never the long-lived vault |
| Unknown kinds | **Fail closed / deny** |
| Schema break? | **No** — internal, unreleased, unpersisted schema; additive only |
| Data migration | **None** — nothing persisted; in-memory long-lived roots always carry the new discriminant |
