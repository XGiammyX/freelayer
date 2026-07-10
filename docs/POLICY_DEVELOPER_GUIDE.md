# Policy Developer Guide

[← Docs Index](README.md) · [Policy Matrix](POLICY_MATRIX.md) · [Contributor Workflow](CONTRIBUTOR_WORKFLOW.md)

> [!NOTE]
> How to work on FreeLayer's policy system without creating conflicts or overclaims. The [Policy Matrix](POLICY_MATRIX.md) is canonical; every other layer must agree with it (test-enforced).

## Structure

- **`packages/privacy`** — the policy layer: `PolicyDecision` (WeakSet provenance — never re-implement), MetadataPolicy, LinkPreviewPolicy, ExternalAssetPolicy, NotificationPolicy, **Policy Matrix v1** (`policyMatrix.ts`, 94 specs → 658 rules), conflict taxonomy (`policyConflicts.ts`).
- **`packages/storage` / `packages/transports`** — StoragePolicy/NetworkPolicy + side-effect barriers (enforcement points).
- **Reason codes** (`PolicyReasonCode`) are stable slugs safe for redacted audit events — never free-form sensitive text.
- **Side-effect scopes** (`PolicySideEffectScope`): every barrier requires a decision scoped to *exactly* its operation; `generic` is never accepted by strict barriers.

## Effects vocabulary

`deny` (strictest) · `null` · `not_implemented` · `future_gate` · `memory_only` · `redact` · `coarsen` · `delay` · `batch` · `require_user_action` · `allow`. Only allow/memory_only/redact/coarsen/delay/batch permit anything. **`future_gate`, `not_implemented`, and `require_user_action` are NOT allow.** Deny overrides everything; unknown inputs deny.

## Adding a new policy row (the one procedure)

1. Add a spec to `POLICY_MATRIX_SPECS` (`packages/privacy/src/policyMatrix.ts`): unique `id`, unique `domain|operation` pair, default `deny`/`future_gate`, per-mode overrides only where behavior genuinely differs, stable `reasonCode`, short non-sensitive `rationale`, honest `testCoverage`, real `docsRefs`.
2. Mirror it into `docs/policy-matrix.v1.json` — the sync test fails on any drift.
3. If a concrete resolver covers the behavior, update it AND add an agreement row in `tests/privacy-regression/policy-conflicts/` (compare real resolver output vs the matrix).
4. Update the relevant model doc; PBOM if behavior changes; Trust Center if a user-facing guarantee changes.
5. Run `pnpm check:policy-matrix && pnpm check:policy-docs && pnpm check:policy-conflicts && pnpm test`.

**Never:** mark telemetry/external-assets/auto-previews/push/remote-AI as allowing; give Ghost/Bunker a persistent sink; give Offline Capsule network; loosen a strict mode from a room/feature context.

## Marking behavior honestly

- **Future-gated:** effect `future_gate` + reason `deferred_gate`/`crypto_not_implemented`/… + a gate entry in [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md). Not executable.
- **Not implemented:** effect `not_implemented` — models a decision about a feature that doesn't exist. Not executable.
- **Accepted limitation:** document in the model doc + [THREAT_MODEL.md](THREAT_MODEL.md); reason `accepted_limitation`. Never silently delete one.
- **Externalized (anti-spyware):** endpoint-defense capability rows stay `future_gate` hook-only; the implementation lives in the standalone project; integration goes through Gate R. Never mark them implemented in core.

## Avoiding overclaims

Trust Center language is scanned (`check:policy-conflicts`) — phrases like "stops spyware", "guaranteed anonymity", "unbreakable" (unnegated) fail CI. Write what is machine-checked, then what is NOT guaranteed, in that order.

## Worked examples

**A — adding a denied metadata event:** add `MetadataEventKind` + resolver denial in `metadataPolicy.ts` → matrix spec (`domain: "metadata"`, effect `deny`) → JSON mirror → regression test (all 7 modes) + agreement row → METADATA_MODEL.md note. No PBOM change if it stays denied (PBOM already says undocumented behavior is a bug — but list it if it's a new user-visible category).

**B — future-gated encrypted storage:** it already exists as `storage.encrypted_persistent_backend` (`future_gate`). Any work before Gate F may only refine docs/tests — the placeholder keeps throwing; no silent memory fallback; PBOM keeps "not implemented"; the conflict validator hard-fails if the effect changes.

**C — anti-spyware integration:** do **not** implement in core. Open the Gate R ADR referencing the standalone project; until accepted, only hooks/types/matrix rows/docs may change, and `assertExternalizedHookOnly` + dependency bans enforce that.
