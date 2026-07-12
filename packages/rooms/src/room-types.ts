/**
 * RoomOS foundation types (TECH-16). Locked directions preserved from the
 * Prompt-03 scaffolding (docs/SOVEREIGN_ROOMS.md, ADR-0006):
 *
 * - RoomOS base is an EVENT-SOURCED OPERATION LOG; room state is derived from
 *   operations, never asserted.
 * - The CRDT choice is DEFERRED (Gate H): no Yjs/Automerge/Loro/custom CRDT;
 *   these types must not lock us into any library.
 * - NO PRE-JOIN HISTORY by default (ADR required to change).
 * - Local timestamps are NOT trusted global time.
 * - Identity is Gate G: member/device references are LOCAL PLACEHOLDERS.
 * - Crypto is Gate F: no keys, no signatures.
 * - Endpoint Defense / anti-spyware is EXTERNALIZED: `endpoint_hook_ref` is a
 *   compatibility placeholder only, never active protection.
 */

import type { Brand } from "@freelayer/security";
import { InvalidRoomIdError, InvalidRoomRefError } from "./room-errors";

// ---------------------------------------------------------------------------
// Branded identifiers (local placeholders — Gate G owns real identity).
// ---------------------------------------------------------------------------

export type RoomId = Brand<string, "RoomId">;
export type RoomLocalId = Brand<string, "RoomLocalId">;
export type RoomMemberRef = Brand<string, "RoomMemberRef">;
export type RoomDeviceRef = Brand<string, "RoomDeviceRef">;
export type RoomOperationId = Brand<string, "RoomOperationId">;

/** Local IDs are non-sensitive slugs: no names, no keys, no timestamps. */
const LOCAL_ID_RE = /^[a-z0-9][a-z0-9_-]{2,63}$/;

let localIdSeq = 0;

/** Create a local room id. Sequence-based — encodes nothing sensitive. */
export function createRoomLocalId(input?: string): RoomLocalId {
  if (input !== undefined) {
    if (!LOCAL_ID_RE.test(input)) {
      throw new InvalidRoomIdError();
    }
    return input as RoomLocalId;
  }
  localIdSeq += 1;
  return `room-local-${localIdSeq}` as RoomLocalId;
}

export function validateRoomId(input: string): RoomId {
  if (!LOCAL_ID_RE.test(input)) {
    throw new InvalidRoomIdError();
  }
  return input as RoomId;
}

export function validateRoomMemberRef(input: string): RoomMemberRef {
  if (!LOCAL_ID_RE.test(input)) {
    throw new InvalidRoomRefError();
  }
  return input as RoomMemberRef;
}

export function validateRoomDeviceRef(input: string): RoomDeviceRef {
  if (!LOCAL_ID_RE.test(input)) {
    throw new InvalidRoomRefError();
  }
  return input as RoomDeviceRef;
}

// ---------------------------------------------------------------------------
// Lifecycle / kind / trust
// ---------------------------------------------------------------------------

export type RoomLifecycleState =
  | "draft"
  | "active_local"
  | "sealed_local"
  | "archived_local"
  | "emergency_locked"
  | "deleted_tombstone"
  | "unknown";

export const ROOM_LIFECYCLE_STATES: readonly RoomLifecycleState[] = [
  "draft",
  "active_local",
  "sealed_local",
  "archived_local",
  "emergency_locked",
  "deleted_tombstone",
  "unknown",
];

export type RoomKind =
  "conversation" | "workspace" | "capsule_room" | "decision_room" | "project_room" | "unknown";

export const ROOM_KINDS: readonly RoomKind[] = [
  "conversation",
  "workspace",
  "capsule_room",
  "decision_room",
  "project_room",
  "unknown",
];

/**
 * Trust is a PLACEHOLDER: `verified_placeholder` does NOT mean real identity
 * verification — verification ceremonies are Gate G design work.
 */
export type RoomTrustState =
  | "local_only"
  | "unverified_members"
  | "verified_placeholder"
  | "compromised_suspected"
  | "unknown";

// ---------------------------------------------------------------------------
// Object taxonomy — every object kind carries its data class + sensitivity.
// ---------------------------------------------------------------------------

export type RoomObjectKind =
  | "message"
  | "note"
  | "task"
  | "decision"
  | "poll"
  | "file_ref"
  | "room_setting"
  | "member_ref"
  | "audit_event"
  | "ai_memory_ref"
  | "endpoint_hook_ref"
  | "unknown";

export const ROOM_OBJECT_KINDS: readonly RoomObjectKind[] = [
  "message",
  "note",
  "task",
  "decision",
  "poll",
  "file_ref",
  "room_setting",
  "member_ref",
  "audit_event",
  "ai_memory_ref",
  "endpoint_hook_ref",
  "unknown",
];

export interface RoomObjectKindMeta {
  /** StorageDataClass string (mirror; storage owns the canonical union). */
  readonly dataClass: string;
  readonly sensitivity: "content" | "content_adjacent" | "relationship" | "sensitive" | "low";
  /** Content-bearing kinds must not be plaintext-persisted until Gates F/… */
  readonly contentBearing: boolean;
  readonly futureGate?: "gate_f_crypto" | "gate_g_identity" | "gate_i_ai" | "gate_r_endpoint";
}

export const ROOM_OBJECT_KIND_META: Readonly<Record<RoomObjectKind, RoomObjectKindMeta>> = {
  message: { dataClass: "message_content", sensitivity: "content", contentBearing: true },
  note: { dataClass: "message_content", sensitivity: "content", contentBearing: true },
  task: { dataClass: "materialized_room_state", sensitivity: "content", contentBearing: true },
  decision: { dataClass: "room_operation_log", sensitivity: "content", contentBearing: true },
  poll: { dataClass: "room_operation_log", sensitivity: "content", contentBearing: true },
  file_ref: {
    dataClass: "materialized_room_state",
    sensitivity: "content_adjacent",
    contentBearing: false, // reference/metadata only — never actual file storage
  },
  room_setting: { dataClass: "settings", sensitivity: "low", contentBearing: false },
  member_ref: {
    dataClass: "contact_aliases",
    sensitivity: "relationship",
    contentBearing: false,
    futureGate: "gate_g_identity",
  },
  audit_event: {
    dataClass: "logs",
    sensitivity: "sensitive",
    contentBearing: false, // redacted only
  },
  ai_memory_ref: {
    dataClass: "ai_output_cache",
    sensitivity: "content_adjacent",
    contentBearing: false,
    futureGate: "gate_i_ai",
  },
  endpoint_hook_ref: {
    dataClass: "endpoint_redaction_state",
    sensitivity: "sensitive",
    contentBearing: false,
    futureGate: "gate_r_endpoint", // EXTERNALIZED — hook-only, never active
  },
  unknown: { dataClass: "debug_artifact", sensitivity: "sensitive", contentBearing: false },
};

// ---------------------------------------------------------------------------
// Operation taxonomy — `_placeholder` marks features that are NOT implemented.
// ---------------------------------------------------------------------------

export type RoomOperationKind =
  | "room.create"
  | "room.rename"
  | "room.archive"
  | "room.lock"
  | "room.delete_tombstone"
  | "room.policy_update"
  | "member.add_placeholder"
  | "member.remove_placeholder"
  | "message.create_placeholder"
  | "note.create_placeholder"
  | "task.create_placeholder"
  | "decision.record_placeholder"
  | "poll.create_placeholder"
  | "file.attach_ref_placeholder"
  | "audit.append_redacted"
  | "ai.memory_ref_placeholder"
  | "endpoint.hook_ref_placeholder"
  | "unknown";

export const ROOM_OPERATION_KINDS: readonly RoomOperationKind[] = [
  "room.create",
  "room.rename",
  "room.archive",
  "room.lock",
  "room.delete_tombstone",
  "room.policy_update",
  "member.add_placeholder",
  "member.remove_placeholder",
  "message.create_placeholder",
  "note.create_placeholder",
  "task.create_placeholder",
  "decision.record_placeholder",
  "poll.create_placeholder",
  "file.attach_ref_placeholder",
  "audit.append_redacted",
  "ai.memory_ref_placeholder",
  "endpoint.hook_ref_placeholder",
  "unknown",
];

/** Content-bearing placeholder mutations (strict/emergency handling differs). */
export const CONTENT_BEARING_OPERATIONS: readonly RoomOperationKind[] = [
  "message.create_placeholder",
  "note.create_placeholder",
  "task.create_placeholder",
  "decision.record_placeholder",
  "poll.create_placeholder",
];

// ---------------------------------------------------------------------------
// Legacy locked-direction placeholders (kept from Prompt-03 scaffolding).
// ---------------------------------------------------------------------------

/** Local wall clock + logical order; `trusted` is literally `false` in v1. */
export interface RoomTimestampModel {
  readonly localWallClockMs: number;
  readonly logicalOrder: number;
  readonly trusted: false;
}

/** Pre-join history rule. Default is locked (ADR required to change). */
export type RoomHistoryPolicy = "no_pre_join_history" | "future_configurable_todo";

/** No signatures exist yet (Gate F): empty tuple keeps this unforgeable-by-accident. */
export interface ProofOfAgreementPlaceholder {
  readonly status: "unsigned_placeholder";
  readonly signatures: readonly never[];
}

/** Decision record placeholder — becomes signed/provable after Gate F. */
export interface DecisionRecordPlaceholder {
  readonly operationId: RoomOperationId;
  readonly summary: string;
  readonly recordedAt: RoomTimestampModel;
  readonly proof: ProofOfAgreementPlaceholder;
}
