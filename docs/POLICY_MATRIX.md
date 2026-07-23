# Policy Matrix v1

[← Docs Index](README.md) · [Privacy Model](PRIVACY_MODEL.md) · [PBOM](PBOM.md) · [Machine-readable export](policy-matrix.v1.json)

> [!NOTE]
> **The single canonical contract** for what each Privacy Mode permits, denies, redacts, null-routes, memory-limits, future-gates, or marks not implemented. Tests, docs, and the PBOM must agree with this matrix; drift is a bug. It is a typed table and a test oracle — **not** a policy runtime, DSL, or formal-verification proof.

## Purpose and status

FreeLayer has seven policy layers (Storage, Network, Metadata, LinkPreview, ExternalAsset, Notification, plus AI/endpoint hooks). Policy Matrix v1 (`packages/privacy/src/policyMatrix.ts`) unifies them: **94 specs → 658 rules** (one per mode), machine-exported to [policy-matrix.v1.json](policy-matrix.v1.json), validated by `pnpm check:policy-matrix`, and cross-checked against every concrete policy engine by `tests/privacy-regression/policy-matrix/`.

## How to read it

Each rule is `mode × domain × operation → effect`. Core principle:

```
One canonical policy matrix. Default deny. Deny overrides allow.
Strictest policy wins. Undefined behavior is a bug (fails closed).
```

**Effects** (strictest → loosest): `deny` · `null` · `not_implemented` · `future_gate` · `memory_only` · `redact` · `coarsen` · `delay` · `batch` · `require_user_action` · `allow`. Only `allow/memory_only/redact/coarsen/delay/batch` permit anything; `future_gate`/`not_implemented`/`require_user_action` are **not** allow. **v1 invariants:** every rule has `persistentAllowed=false` and `networkAllowed=false` — nothing persists, nothing egresses.

**Composition:** room policy and feature policy can tighten, never loosen. ScreenShield sealed/bunker (and critical device risk) force-deny shield-sensitive rows. Emergency overrides normal behavior. Every unknown mode/domain/operation/sink/transport/class denies (`unknown_input`).

**Reason codes** are stable identifiers (`default_deny`, `strict_mode`, `telemetry_forbidden`, `push_forbidden`, `ai_forbidden`, `deferred_gate`, …) safe for redacted audit events.

## Mode summaries

### Standard

Private by default: no telemetry, no external assets, no automatic previews, no real network. Content persistence targets the future encrypted backend and **fails hard** until Gate F (no silent memory fallback). Memory-only caches allowed; notifications limited to a generic content-free in-app indicator.

### Private

Standard + stricter metadata: receipts/typing/presence/last-seen denied; WebRTC/direct peers denied; notification content denied; preview/thumbnail caches denied.

### Ghost

Memory/null only — no persistent writes, no AI, no notification content or indicators, no direct network, no metadata signals, no cache/preview persistence, no spool timestamps. **Application-level, not forensic.**

### Bunker

Stricter than Ghost: null preferred; no badges/sound/vibration; no reveal state even in memory; endpoint hooks strictest. **Not a guarantee against a compromised device.**

### Offline Capsule

All network denied. QR/file/USB remain conceptual offline channels. Local memory-only behavior where policy-compatible.

### Emergency

Normal writes/network/metadata generation denied. Only a redacted wipe/revoke audit placeholder. Null/safe behavior preferred.

### Sovereign Room

Composes with the device mode: room policy tightens, never loosens; strictest wins. A hostile client can ignore room policy — an **accepted limitation**.

## Mode × domain behavior (summary)

| Domain                              | Standard     | Private      | Ghost       | Bunker      | Offline      | Emergency  |
| ----------------------------------- | ------------ | ------------ | ----------- | ----------- | ------------ | ---------- |
| Storage (persistent)                | future_gate  | deny         | deny        | deny        | deny         | deny       |
| Storage (memory content)            | future_gate¹ | memory_only  | memory_only | memory_only | memory_only  | deny       |
| Network (any egress)                | deny²        | deny²        | deny        | deny        | deny         | deny       |
| Metadata (receipts/typing/presence) | deny         | deny         | deny        | deny        | deny         | deny       |
| Metadata (redacted audit/log)       | redact       | redact       | redact      | redact      | redact       | audit-only |
| Link preview (automatic)            | deny         | deny         | deny        | deny        | deny         | deny       |
| External assets (all 12 kinds)      | deny         | deny         | deny        | deny        | deny         | deny       |
| Notification (content/OS surface)   | deny         | deny         | deny        | deny        | deny         | deny       |
| Notification (generic in-app)       | memory_only  | memory_only  | deny        | deny        | deny         | deny       |
| AI (local)                          | future_gate  | future_gate  | deny        | deny        | future_gate  | deny       |
| AI (remote / caches)                | deny         | deny         | deny        | deny        | deny         | deny       |
| Endpoint (protected reveal)         | memory_only³ | memory_only³ | deny        | deny        | memory_only³ | deny       |

¹ Standard content targets the unimplemented encrypted backend (fails hard). ² Relay send exists only as a user-initiated placeholder (`require_user_action`, performs no I/O). ³ Denied under ScreenShield sealed/bunker or critical device risk.

## RoomOS policy composition + governance rows (TECH-22)

Fourteen rows joined the `room` domain: `room.policy.compose`/`room.governance.update`/`room.governance_log.append`/`room.device_posture.resolve`/`room.sensitive_admission.resolve` are `memory_only`; `room.policy.loosen`/`room.device_posture.elevate`/`room.protected_content.claim_active` are `deny`; `room.device_posture.persist` is `deny` (posture history forbidden); `room.device_posture.verify`/`room.protected_content.require`/`room.secure_device.integration`/`room.governance.distributed_consensus`/`room.governance.signed_policy` are `future_gate` (Secure Device / Gates H/F/G). Composition uses deny-overrides + strictest-wins; governance is tighten-only; posture cannot elevate. Matrix is now **171 specs → 1197 rules**.

## RoomOS revocation + authorization rows (TECH-21)

Eight rows joined the `room` domain: `room.authorization.prepare` and `room.authorization.revalidate` are `memory_only` (pure, side-effect-free); `room.authorization.cache`/`context_persist` are `deny` (persistent-storage forbidden) and `context_serialize` is `deny`; `room.authorization.endpoint_assurance` is `deny` (endpoint state can never grant/restore/prove authority); `room.authorization.distributed_revocation`/`signed_revocation` are `future_gate` (Gates H/F/G). Per-scenario invalidation (suspension/removal/role-change/reactivation/policy/mode) is enforced by `assertPreparedRoomAuthorizationCurrentV1` against the current revision fence. Matrix is now **157 specs → 1099 rules**.

## RoomOS membership + capability rows (TECH-20)

Eighteen rows joined the `room` domain: `room.membership.bootstrap` (memory_only, Emergency deny); `add`/`change_role`/`reactivate` (memory_only, Bunker/Emergency deny — expansion); `suspend`/`remove` (memory_only, restrictive/wipe direction, survive strict modes but preserve last-owner continuity); `membership_log.append` (memory_only, own storage decision); `query.list`/`query.detail` (memory_only, Bunker/Emergency deny); `query.count` (memory_only, Private/Ghost/Bunker/Emergency deny); `capability.resolve` (memory_only, pure); `capability.persist` (**deny**); `capability.serialize` (**deny**); `capability.delegate` (**not_implemented**); `membership.invite`/`identity_verify`/`distributed_revocation`/`endpoint_risk_integration` (**future_gate** — Gates G/E/H/R). Per-mode/role behavior is derived by `resolveRoomMembershipPolicyV1` + `resolveRoomLocalCapabilityV1`; these rows pin the class-level rule. Matrix is now **149 specs → 1043 rules**.

## RoomOS query rows (TECH-19)

Eleven rows joined the `room` domain for the query model: `room.query.summary` is `memory_only` (allowed minimally even in Emergency, redacted); `room.query.list`/`detail`/`count` are `memory_only` (Emergency denies; count also denied in Private/Ghost/Bunker by policy); `room.query.search` is `memory_only` (Offline/Emergency deny; Bunker denies by policy); `room.query.history`/`result_cache`/`search_index` are `deny` in every mode; `room.query.semantic`/`remote`/`bunker_content_view` are `future_gate` (Gates I/H + a protected-presentation gate). Per-mode view/field suppression is derived by `resolveRoomQueryPolicy`; these rows pin the class-level rule. Matrix is now **131 specs → 917 rules**.

## RoomOS object-model rows (TECH-18)

Twelve rows joined the `room` domain for the object model: `room.object.create`/`update`/`archive` are `memory_only` (Emergency denies); `room.object.redact`/`tombstone` are `memory_only` in **every** mode (safe/wipe direction, Emergency included); `room.object.persist` is `deny` (persistent plaintext content — Gate F); `room.object_log.append` is `memory_only` (its own separate storage decision); `room.object.poll_vote`/`file_resolve`/`ai_memory`/`endpoint_hook` are `future_gate`; `room.object.file_preview`/`file_remote` are `deny`. Per-kind behavior is derived by `resolveRoomObjectMutationPolicy`; these rows pin the class-level rule. Matrix is now **120 specs → 840 rules**.

## RoomOS operation-log rows (TECH-17)

Four rows joined the `room` domain: `room.operation_log.read` and `room.replay` are `memory_only` (Emergency denies); `room.operation_log.clear` is `memory_only` in **every** mode (wipe direction, Emergency included); `room.project.snapshot` is a pinned **`future_gate`** (snapshots can retain deleted content and need Gate F + StoragePolicy/PBOM review). Matrix is now **107 specs → 749 rules**.

## RoomOS domain (TECH-16)

The `room` domain graduated from fully-deferred to a **local foundation**: 9 new rows model policy-controlled local state transitions — `room.create` / `room.mutate` / `room.lifecycle_update` / `room.policy_update` / `room.operation_log.append` / `room.project` are `memory_only` (Emergency denies all but lifecycle); `room.operation_log.persist` and `room.project.persist` are **deny in every mode** (encrypted backend is Gate F); `room.audit` is `redact`. **`room.sync` stays `future_gate`** (Gate H) — pinned by both validators. Endpoint hook rows remain externalized/future-gated. Matrix is now **103 specs → 721 rules**.

## Deferred gates (all `future_gate`, 22 specs)

Crypto (Gate F) · encrypted persistent storage (Gate F) · capsule wire format/transport (Gate D/E) · room sync (Gate H) · identity invites/verification (Gate G) · local AI (Gate I) · user-initiated preview · push subscribe/receive/service-worker notifications · clipboard/secure-input/task-switcher/screenshot-blocking (TECH-EDL) · Tauri desktop permissions (Phase 9). Marking them here **encodes the decision without implementing the feature**.

## Accepted limitations

The matrix is a living contract, not a proof: it does not verify crypto/protocol correctness, does not defend against same-realm hostile code beyond `PolicyDecision` scope checks, does not provide anonymity or forensic guarantees, and cannot bind hostile room members.

## Test coverage

Every rule carries `testCoverage` (`covered`/`partial`/`deferred`); 40+ matrix tests plus cross-policy agreement tests keep the matrix and the concrete engines in lockstep. Validation: `pnpm check:policy-matrix` (structure/invariants) and `pnpm check:policy-docs` (doc consistency), both in CI.

## Conflict regression suite (TECH-14)

The matrix is now guarded by a dedicated conflict suite: 17 conflict categories (`allow_vs_deny`, `persistent_allowed_conflict`, `future_gate_treated_as_allow`, `externalized_component_marked_implemented`, …), table-driven matrix↔engine comparisons, intentional-contradiction fixtures the validator provably detects, and `check:policy-conflicts` in CI. Current status: **0 conflicts** ([audits/POLICY_CONFLICT_REPORT.md](audits/POLICY_CONFLICT_REPORT.md)).

Full contributor procedure with worked examples: **[POLICY_DEVELOPER_GUIDE.md](POLICY_DEVELOPER_GUIDE.md)** (TECH-15). Every row change must keep the conflict regression suite green.

**Adding a row without creating conflicts:** pick a unique spec id and a unique `domain|operation` pair; default to `deny`/`future_gate`; never mark an always-forbidden behavior (telemetry, external assets, automatic previews, push, remote AI) as allowing; keep Ghost/Bunker persistent sinks and Offline network denied; mirror the change into `policy-matrix.v1.json` (the sync test fails otherwise); add/extend an agreement test if a concrete engine covers the row.

**Endpoint-defense rows are hooks, not implementation.** The anti-spyware project is **externalized**; capability rows (`clipboard_copy`, `secure_input`, `task_switcher_preview`, `screenshot_blocking`, `tauri_desktop_permissions`) stay `future_gate` until the [integration gate](IMPLEMENTATION_GATES.md) opens.

## How contributors update it

Any PR that changes privacy/security behavior must update, in the same PR: (1) the spec table in `packages/privacy/src/policyMatrix.ts`, (2) the mirrored `docs/policy-matrix.v1.json` (the sync test fails on drift), (3) the relevant model doc + [PBOM](PBOM.md), and (4) tests. See [CONTRIBUTING_SECURITY.md](CONTRIBUTING_SECURITY.md).

## TECH-23 rows — Secure Device admission contract

TECH-23 adds 24 `room`-domain rows (195 specs → 1365 rules): provider status/capability reads and posture-assessment reads (memory-only); `at_risk` tightening (restriction only); raw evidence input/persist, device identifier/history/inventory (**deny**); redacted/full summary and content read/mutate/search (admission-gated memory-only, Emergency denies); content export/copy/file-open/local-AI (`not_implemented`); protected-content intent + session create/revalidate (memory-only); and trusted-provider elevation / ScreenShield / Bunker requirements (**future_gate** — Secure Device is external). Raw evidence and identifiers are never allowed; posture is never treated as identity. These agree with the concrete Secure Device contract module and are enforced by the conflict suite.

## TECH-ID-03 rows — local identity scaffolding

The `identity` domain graduated from deferred in TECH-ID-03 (local, non-cryptographic scaffolding). 18 rows added (195 → **213 specs → 1491 rules**): root/persona/relationship/room-binding create + lifecycle (memory-only; Bunker/Emergency deny expansive creates; restrictive lifecycle allowed) and summary read; identity **keys/device-key/device-passport/per-contact-alias/per-room-alias/trust-notebook/recovery/invite/verification** stay **future_gate**; **public directory** and **persistent vault** deny. All rows are `persistentAllowed:false`, `networkAllowed:false`. IdentityPolicy (`@freelayer/identity`) agrees with these rows (test-enforced).

## TECH-ID-04 rows — ephemeral identity

13 rows added (**226 specs → 1582 rules**): ephemeral create/activate/persona-create/relationship-create/room-binding-create (memory-only; Bunker/Emergency deny expansive), restrictive lifecycle (shorten/mark/expire/destroy) + relationship-block + summary-read (memory-only; restrictive allowed in strict modes; summary/expansive deny in Emergency); and **promotion/recovery/export/synchronize/persistent-storage DENY**. All `persistentAllowed:false`, `networkAllowed:false`. IdentityPolicy/EphemeralIdentityPolicy agree (test-enforced).

## TECH-ID-05 rows — per-contact aliases

15 rows added (**241 specs → 1687 rules**), split into 9 operational + 6 structural. The **9 operational** alias rows — presentation-alias create/activate/rotate/retire, local-peer-label set/replace/clear, display-context read, and reuse-assessment read — are `memory_only` (strictest-wins; Bunker/Emergency deny expansive create/activate/rotate/set/replace, while restrictive retire/clear stay allowed). The **6 structural** rows pin the boundaries: `alias_remote_sharing` is **not_implemented**; `alias_public_directory`, `alias_username_search`, `alias_persistence`, and `alias_history` are **deny**; `alias_authenticated_update_future` is **future_gate** (Gate E/F). Aliases are local, relationship-scoped, non-cryptographic, and metadata-only: a pairwise presentation alias is `not_shared_tech_id_05` (not authenticated, not remotely updatable) and a local peer label is `local_only`/`peerShared:false` (never sent to the peer). Normalization is Unicode NFC + dangerous-control rejection only (retains ZWJ/ZWNJ; no case-fold, transliteration, whole-script blocking, or confusable detection; normalization is not proof an alias is safe). All `persistentAllowed:false`, `networkAllowed:false`. 7 new `identity.alias.*` PolicySideEffectScope values enforce exact-scope `PolicyDecision`s; IdentityPolicy and the alias policy agree (test-enforced). Secure Device / ScreenShield / anti-spyware remains **externalized**.

## TECH-ID-06 rows — per-room aliases

12 rows added (**253 specs → 1771 rules**), split into 7 operational + 5 structural. The **7 operational** room-alias rows — room-alias create/activate/rotate/retire, display-context read, collision-assessment read, and reuse-assessment read — are `memory_only` (strictest-wins; Bunker/Emergency deny expansive create/activate/rotate, while restrictive retire stays allowed). The **5 structural** rows pin the boundaries: `room_alias_remote_sharing` is **not_implemented**; `room_alias_persistence` and `room_alias_history` are **deny**; `room_alias_authenticated_binding_future` and `room_alias_bundle_export_import_future` are **future_gate** (Gates E/F/H). Room aliases are local, room-binding-scoped, non-cryptographic, and metadata-only: each presentation alias is bound to ONE identity room binding (`RoomIdentityBindingV1`), ≤1 active per binding, and is never shared, authenticated, or remotely updatable. A room alias is not identity, membership, a role, verification, a `RoomMemberRef`, or a global username; a room role is not proof of identity and a collision is not proof of impersonation; duplicate aliases are permitted but require safe disambiguation (which is not verification). Normalization reuses the TECH-ID-05 Unicode NFC + dangerous-control baseline unchanged (retains ZWJ/ZWNJ; no confusable detection — baseline Unicode validation is not full spoofing prevention). All `persistentAllowed:false`, `networkAllowed:false`. 6 new `identity.room_alias.*` PolicySideEffectScope values (create, lifecycle, rotate, display_context.read, collision_assessment.read, reuse_assessment.read) enforce exact-scope `PolicyDecision`s; the schema migrated `RoomIdentityBindingV1.roomAliasState` from the `not_implemented_tech_id_06` placeholder to `RoomAliasBindingStateV1` (`none`/`local_alias_v1`/`retired`, default `none`), with the alias record authoritative and the binding state a derived hint. IdentityPolicy and the room-alias policy agree (test-enforced); `check:no-room-alias-bypass` guards the boundary in CI + `audit:privacy`. Secure Device / ScreenShield / anti-spyware remains **externalized**.
