# RoomOS Revocation + Authorization Regression — Research Note (TECH-21)

_Date: 2026-07-13. Informs execution-time revalidation, revision binding, and local revocation semantics._

> [!NOTE]
> **Source verification pending: internet unavailable in this environment.** The concepts below are stable, widely-documented knowledge (author cutoff 2026-01). Re-confirm current specifics (NIST SP 800-53, OWASP, Zanzibar) against primary sources before external citation.

## 7.1 NIST access-authorization revocation (SP 800-53)

**Summary:** access must be revoked following changes in subject/object security attributes; revocation timing must be explicit (immediate vs next-access).

**Adopted:** suspension changes a subject-relationship attribute; removal terminates the local relationship; role changes change authorization attributes; policy/mode changes change environmental/resource attributes. The chosen LOCAL rule: *a changed local membership or policy invalidates prior descriptors before the next protected operation executes.* No distributed-immediacy claim.

## 7.2 OWASP authorization guidance

**Summary:** least privilege, deny-by-default, authorize EVERY operation, object-level checks, safe failure, access-control regression tests, ABAC/ReBAC over role-only.

**Adopted:** authorization is checked AT EXECUTION — a successful earlier check is insufficient after state changes; each room/object/action combination is checked; IDs confer no authority; missing mappings deny; failures leave no partial side effect. This TECH-21 suite is exactly the regression coverage OWASP calls for.

## 7.3 Transaction authorization + execution binding (OWASP)

**Summary:** bind authorization to significant operation data; invalidate after relevant data changes; a final execution gate; prevent replay/reuse across different operations.

**Adopted:** `PreparedRoomAuthorizationV1` binds room, membership, membership revision, capability, operation, object scope, requested view, and a local policy revision + mode + lifecycle fence. A context prepared for one operation cannot authorize another; changed operation data forces re-preparation; `assertPreparedRoomAuthorizationCurrentV1` is the final gate immediately before the local side effect. **No cryptographic transaction signing is claimed** (Gate F).

## 7.4 Zanzibar consistency (prior art)

**Summary:** relationship changes, decision consistency, stale-authorization risk, causal ordering of permission changes vs resource actions.

**Adopted:** FreeLayer uses explicit LOCAL ordering between membership changes and protected local actions via the projection + revision fence — a narrow local fence, NOT Zanzibar's global consistency/storage/serving infrastructure. **Distributed consistency remains Gate H.**

## 7.5 Authorization caching risks

**Summary:** cached allow decisions, stale role caches, stale membership snapshots, memoized policy results, revocation latency, and TOCTOU between check and use.

**Adopted:** **no persistent authorization cache, no cross-operation allow cache**; descriptors/contexts are recomputed or revalidated; the current projection is checked immediately before execution; prepared operations FAIL when a relevant revision changes; no asynchronous gap is hidden by the API. Audited in [../audits/ROOM_AUTHORIZATION_CACHE_AUDIT.md](../audits/ROOM_AUTHORIZATION_CACHE_AUDIT.md).

## 7.6 FreeLayer internal review

Reviewed the membership package, capability resolution, authorization context, object/query pipelines, RoomPolicy, Policy Matrix, and existing tests. Findings:

- The TECH-20 `assertRoomAuthorizationContextV1` already requires an authentic exact-scope decision + current descriptor; TECH-21 adds a **prepared-vs-execute** fence (revision binding) and centralizes it in `assertPreparedRoomAuthorizationCurrentV1`.
- No authorization cache, global current-member state, or stale membership snapshot exists.
- Role checks live only in the membership/authorization packages (guard-enforced); RoomPolicy has no explicit revision, so TECH-21 introduces an optional `policyRevision` on `RoomMaterializedState` plus a deterministic local fingerprint fallback.
- The revocation pipeline reuses the TECH-20 membership pipeline (owner continuity, revision, event, log, reducer) and adds prepared-authorization revalidation + restrictive-direction enforcement.

## Adopted / rejected / deferred

**Adopted:** prepare/execute split with a revision fence; execution-time revalidation as the final gate; capability-set role comparison; restrictive-vs-expansive classification; local revocation semantics; no authorization cache; content-free invalidation reports. **Rejected:** cryptographic capability tokens / single-use signed decisions / bearer credentials / a global authorization service / OpenFGA/SpiceDB/OPA/JWT/macaroon/UCAN/DID dependencies / distributed revocation broadcast. **Deferred:** single-use or nonce-bound decisions + factory-token architecture (Gate B); external/serialized revocation + capsule format (Gate E); signed revocations + certificates (Gate F); verified identity + invites (Gate G); distributed/CRDT revocation + global consistency (Gate H); endpoint integration (Gate R).

## Known limits

Local only — no distributed immediacy, no global authorization epoch, no signed/authenticated actor, no verified identity, no endpoint assurance; capability descriptors and prepared contexts are not credentials; not safe for real secrets.

## TODOs for Gates B, G, H

Gate B: single-use/nonce-bound decisions + capability-construction tokens. Gate G: bind verified identity to membership so revocation becomes identity revocation (additive, never authority-granting alone). Gate H: causal distributed revocation with consistency tokens + signed membership events.
