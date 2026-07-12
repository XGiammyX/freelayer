# TECH-16 — RoomOS Threat Model

_Scope: the room data model's leakage/bypass surfaces and the honest limits of a local foundation. Extends [../THREAT_MODEL.md](../THREAT_MODEL.md)._

## Room data leakage

Room titles, member aliases, message/note/task/decision/poll content, file names (via `file_ref`), room activity patterns, operation timestamps, audit events, settings, future AI memory references. **Mitigation:** object summaries are always redacted (no content); titles absent under Bunker/critical-risk/room-redaction policy; member display is always redacted in v1; audit events drop ALL string details; event IDs are sequence-only; timestamps carry an explicit `local:` label (never trusted time). **Residual:** in-memory content payloads exist while the app runs — that is the point of a local model; nothing persists.

## Policy bypass

An operation without a `PolicyDecision`; a wrong-scope decision; direct state mutation; a room policy loosening the device mode; persistence in Ghost/Bunker; metadata/network side effects. **Mitigation:** `assertRoomOperationAllowed` requires an authentic (WeakSet) decision with the exact `room.*` scope and runs before any transition; `resolveRoomPolicy` composes tighten-only and hard-codes the v1 invariants (`allowPersistentProjection/OperationLogPersistence/NetworkSync/Notifications/LocalAI` false); the matrix carries per-mode rows and both validators pin them; the `check:no-roomos-bypass` guardrail bans direct-mutation/logging patterns; traps prove no network/notification API fires during room ops.

## Event log risks

Append-only logs preserve sensitive content; ordering/timing leak activity; schema migrations can leak old fields; projections can persist derived sensitive state. **Mitigation:** the log is a memory-only placeholder (persistence denied by RoomPolicy + matrix `room.operation_log_persist:deny` + StoragePolicy); events are versioned (`version: 1`) so future migrations are explicit; projections never carry content and cannot persist (`room.project.persist:deny`). **Accepted:** an immutable-log privacy story for *persistent* logs is Gate F/H design work, not v1.

## Sync deferred risks (Gate H)

The local model must not bake in assumptions a future CRDT would break. **Mitigation:** no total-ordering assumption (single local log, fold semantics); no causal metadata to conflict with an engine's own; no CRDT dependency (guardrail-banned); hostile-input parsing for remote operations is Gate E work and is not pretended.

## Identity deferred risks (Gate G)

Member/device refs are validated local placeholders; `verified_placeholder` is explicitly not verification; no trust ceremonies, no recovery; malicious room members remain out of scope for confidentiality (unchanged, top-level threat model).

## Anti-spyware externalization

Protected-room docs must not overclaim endpoint protection; hooks must not read as active. **Mitigation:** `endpointDefenseIntegration` has no "active" value at the type level and the barrier rejects a cast attempt; `endpoint_hook_ref` is a placeholder object kind gated to Gate R; the guardrail bans `endpointDefenseActive: true`/`screenShieldActive: true`; the Trust Center overclaim scanner and TECH-14 dependency bans stay in force.

## Limits (stated plainly)

TECH-16 implements **no sync, no crypto, no identity, no anti-spyware** — and does **not** make rooms safe for real secrets. It is a local data model + policy integration layer: content lives in memory only, member references are placeholders, and every guarantee stated is application-level.
