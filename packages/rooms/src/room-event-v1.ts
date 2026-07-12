/**
 * RoomOS log-grade event schema V1 (TECH-17).
 *
 * The deterministic envelope for the LOCAL operation log: explicit schema/
 * projection versions, branded event ids, and a LOCAL sequence.
 *
 *   localSequence is valid only inside one local RoomOS operation log.
 *   It is not a distributed ordering mechanism.
 *
 * NOT here (gated): signatures/MACs/hashes (Gate F), trusted timestamps,
 * global sequences / vector clocks / Lamport clocks (Gate H), remote peer
 * identity or transport metadata (Gate E). `validateRoomOperationEventV1`
 * checks INTERNAL invariants over trusted local/fixture data — it is NOT a
 * hostile-input parser (external ingestion is Gate E).
 */

import type { Brand } from "@freelayer/security";
import type { PolicyDecision, PrivacyMode } from "@freelayer/privacy";
import {
  RoomEventCloneError,
  RoomEventValidationError,
  RoomEventVersionUnsupportedError,
} from "./room-log-errors";
import {
  assertRoomOperationAllowed,
  type RoomOperationRequest,
  type RoomPolicy,
} from "./room-policy";
import {
  ROOM_KINDS,
  ROOM_LIFECYCLE_STATES,
  ROOM_OBJECT_KINDS,
  ROOM_OPERATION_KINDS,
  type RoomKind,
  type RoomLifecycleState,
  type RoomLocalId,
  type RoomMemberRef,
  type RoomObjectKind,
  type RoomOperationKind,
} from "./room-types";

export const ROOM_EVENT_SCHEMA_VERSION = 1 as const;
export const ROOM_PROJECTION_VERSION = 1 as const;

export type RoomEventSchemaVersion = typeof ROOM_EVENT_SCHEMA_VERSION;
export type RoomEventId = Brand<string, "RoomEventId">;
export type RoomLocalSequence = Brand<number, "RoomLocalSequence">;

/** Injected boundaries — replay/reduction never touch clock or id generation. */
export interface RoomLocalClock {
  nowLocalIso(): string;
}
export interface RoomEventIdGenerator {
  nextRoomEventId(): RoomEventId;
}

// ---------------------------------------------------------------------------
// Operation-specific payload schemas (v1). NO real content anywhere: no
// message text, note bodies, task/decision/poll titles, filenames, AI or
// endpoint-monitoring data. Content-bearing functionality is future work.
// ---------------------------------------------------------------------------

export interface RoomCreatedPayloadV1 {
  readonly kind: RoomKind;
  /** Optional; already policy-redacted at creation (absent under redaction). */
  readonly title?: string;
}
export interface RoomRenamedPayloadV1 {
  readonly title: string;
}
export interface RoomLifecyclePayloadV1 {
  readonly target: RoomLifecycleState;
}
export interface RoomMemberAddedPayloadV1 {
  readonly memberRef: RoomMemberRef;
  readonly role: "owner_placeholder" | "member_placeholder" | "viewer_placeholder";
}
export interface RoomMemberRemovedPayloadV1 {
  readonly memberRef: RoomMemberRef;
}
export interface RoomObjectPlaceholderCreatedPayloadV1 {
  readonly objectId: string;
  readonly kind: RoomObjectKind;
  readonly redacted: true;
  readonly sensitivity: string;
}
export interface RoomPolicyRevisionPayloadV1 {
  readonly policyRevision: number;
  readonly requestedMode?: PrivacyMode;
}
export interface RoomAuditPayloadV1 {
  readonly reasonCode: string;
}

export type RoomOperationPayloadV1 =
  | { readonly operation: "room.create"; readonly payload: RoomCreatedPayloadV1 }
  | { readonly operation: "room.rename"; readonly payload: RoomRenamedPayloadV1 }
  | { readonly operation: "room.archive"; readonly payload: RoomLifecyclePayloadV1 }
  | { readonly operation: "room.lock"; readonly payload: RoomLifecyclePayloadV1 }
  | { readonly operation: "room.delete_tombstone"; readonly payload: RoomLifecyclePayloadV1 }
  | { readonly operation: "room.policy_update"; readonly payload: RoomPolicyRevisionPayloadV1 }
  | { readonly operation: "member.add_placeholder"; readonly payload: RoomMemberAddedPayloadV1 }
  | {
      readonly operation: "member.remove_placeholder";
      readonly payload: RoomMemberRemovedPayloadV1;
    }
  | {
      readonly operation:
        | "message.create_placeholder"
        | "note.create_placeholder"
        | "task.create_placeholder"
        | "decision.record_placeholder"
        | "poll.create_placeholder"
        | "file.attach_ref_placeholder"
        | "ai.memory_ref_placeholder"
        | "endpoint.hook_ref_placeholder";
      readonly payload: RoomObjectPlaceholderCreatedPayloadV1;
    }
  | { readonly operation: "audit.append_redacted"; readonly payload: RoomAuditPayloadV1 };

export interface RoomOperationEventBaseV1 {
  readonly schemaVersion: 1;
  readonly projectionVersion: 1;
  readonly eventId: RoomEventId;
  readonly roomId: RoomLocalId;
  readonly localSequence: RoomLocalSequence;
  readonly operation: RoomOperationKind;
  readonly objectKind?: RoomObjectKind;
  readonly actor: RoomMemberRef | "local_unknown";
  /** LOCAL wall-clock label ("local:" prefix). Never used for ordering. */
  readonly createdAtLocal: string;
  readonly payloadClass: "none" | "redacted" | "placeholder" | "content";
}

export type RoomOperationEventV1 = RoomOperationEventBaseV1 & RoomOperationPayloadV1;

// ---------------------------------------------------------------------------
// Payload validators — small, explicit, fail-closed. No schema library.
// ---------------------------------------------------------------------------

const LOCAL_ID_RE = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const EVENT_ID_RE = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const ROLES = ["owner_placeholder", "member_placeholder", "viewer_placeholder"] as const;
const SAFE_SLUG = /^[a-z0-9_.:-]{1,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
}

function fail(code: RoomEventValidationError["code"]): never {
  throw new RoomEventValidationError(code);
}

function validatePayloadFor(operation: RoomOperationKind, payload: unknown): void {
  if (!isRecord(payload)) {
    fail("invalid_payload");
  }
  switch (operation) {
    case "room.create": {
      if (!hasOnlyKeys(payload, ["kind", "title"])) fail("invalid_payload");
      if (!ROOM_KINDS.includes(payload["kind"] as RoomKind) || payload["kind"] === "unknown") {
        fail("invalid_payload");
      }
      if (payload["title"] !== undefined && typeof payload["title"] !== "string") {
        fail("invalid_payload");
      }
      return;
    }
    case "room.rename": {
      if (!hasOnlyKeys(payload, ["title"]) || typeof payload["title"] !== "string") {
        fail("invalid_payload");
      }
      return;
    }
    case "room.archive":
    case "room.lock":
    case "room.delete_tombstone": {
      if (!hasOnlyKeys(payload, ["target"])) fail("invalid_payload");
      const target = payload["target"] as RoomLifecycleState;
      if (!ROOM_LIFECYCLE_STATES.includes(target) || target === "unknown") {
        fail("invalid_payload");
      }
      return;
    }
    case "room.policy_update": {
      if (!hasOnlyKeys(payload, ["policyRevision", "requestedMode"])) fail("invalid_payload");
      const revision = payload["policyRevision"];
      if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) {
        fail("invalid_payload");
      }
      return;
    }
    case "member.add_placeholder": {
      if (!hasOnlyKeys(payload, ["memberRef", "role"])) fail("invalid_payload");
      if (typeof payload["memberRef"] !== "string" || !LOCAL_ID_RE.test(payload["memberRef"])) {
        fail("invalid_payload");
      }
      if (!ROLES.includes(payload["role"] as (typeof ROLES)[number])) fail("invalid_payload");
      return;
    }
    case "member.remove_placeholder": {
      if (
        !hasOnlyKeys(payload, ["memberRef"]) ||
        typeof payload["memberRef"] !== "string" ||
        !LOCAL_ID_RE.test(payload["memberRef"])
      ) {
        fail("invalid_payload");
      }
      return;
    }
    case "audit.append_redacted": {
      if (
        !hasOnlyKeys(payload, ["reasonCode"]) ||
        typeof payload["reasonCode"] !== "string" ||
        !SAFE_SLUG.test(payload["reasonCode"])
      ) {
        fail("invalid_payload");
      }
      return;
    }
    default: {
      // Placeholder object creation family.
      if (!hasOnlyKeys(payload, ["objectId", "kind", "redacted", "sensitivity"])) {
        fail("invalid_payload");
      }
      if (typeof payload["objectId"] !== "string" || !EVENT_ID_RE.test(payload["objectId"])) {
        fail("invalid_payload");
      }
      const kind = payload["kind"] as RoomObjectKind;
      if (!ROOM_OBJECT_KINDS.includes(kind) || kind === "unknown") {
        fail("unknown_object_kind");
      }
      if (payload["redacted"] !== true) fail("invalid_payload");
      if (typeof payload["sensitivity"] !== "string" || !SAFE_SLUG.test(payload["sensitivity"])) {
        fail("invalid_payload");
      }
      return;
    }
  }
}

/**
 * Validate INTERNAL RoomOS event invariants over trusted local/fixture data.
 * NOT a hostile-input parser (Gate E). Fail closed; no coercion, no silent
 * defaults, no sorting, no repair; errors never include the event.
 */
export function validateRoomOperationEventV1(event: unknown): RoomOperationEventV1 {
  if (!isRecord(event)) fail("invalid_payload");
  if (event["schemaVersion"] !== ROOM_EVENT_SCHEMA_VERSION) {
    throw new RoomEventVersionUnsupportedError("unsupported_schema_version");
  }
  if (event["projectionVersion"] !== ROOM_PROJECTION_VERSION) {
    throw new RoomEventVersionUnsupportedError("unsupported_projection_version");
  }
  if (typeof event["eventId"] !== "string" || !EVENT_ID_RE.test(event["eventId"])) {
    fail("invalid_event_id");
  }
  if (typeof event["roomId"] !== "string" || !LOCAL_ID_RE.test(event["roomId"])) {
    fail("invalid_room_id");
  }
  const sequence = event["localSequence"];
  if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 1) {
    fail("invalid_local_sequence");
  }
  const operation = event["operation"] as RoomOperationKind;
  if (operation === "unknown" || !ROOM_OPERATION_KINDS.includes(operation)) {
    fail("unknown_operation");
  }
  if (event["objectKind"] !== undefined) {
    const kind = event["objectKind"] as RoomObjectKind;
    if (kind === "unknown" || !ROOM_OBJECT_KINDS.includes(kind)) {
      fail("unknown_object_kind");
    }
  }
  if (
    typeof event["actor"] !== "string" ||
    (event["actor"] !== "local_unknown" && !LOCAL_ID_RE.test(event["actor"]))
  ) {
    fail("invalid_payload");
  }
  if (
    typeof event["createdAtLocal"] !== "string" ||
    !event["createdAtLocal"].startsWith("local:")
  ) {
    fail("invalid_payload");
  }
  if (!["none", "redacted", "placeholder", "content"].includes(event["payloadClass"] as string)) {
    fail("invalid_payload");
  }
  validatePayloadFor(operation, event["payload"]);
  return cloneRoomEvent(event as unknown as RoomOperationEventV1);
}

// ---------------------------------------------------------------------------
// Defensive cloning
// ---------------------------------------------------------------------------

export function cloneRoomEvent<T>(event: T): T {
  try {
    return structuredClone(event);
  } catch {
    throw new RoomEventCloneError();
  }
}

export function cloneRoomProjection<T>(projection: T): T {
  try {
    return structuredClone(projection);
  } catch {
    throw new RoomEventCloneError();
  }
}

// ---------------------------------------------------------------------------
// Event creation boundary (injected clock + id; never inside the projector)
// ---------------------------------------------------------------------------

export function createAcceptedRoomOperationEventV1(input: {
  readonly request: RoomOperationRequest & { readonly roomId: RoomLocalId };
  readonly roomPolicy: RoomPolicy;
  readonly roomDecision: PolicyDecision;
  readonly eventId: RoomEventId;
  readonly localSequence: RoomLocalSequence;
  readonly clock: RoomLocalClock;
  readonly typedPayload: RoomOperationPayloadV1["payload"];
  readonly actor?: RoomMemberRef;
  readonly payloadClass?: RoomOperationEventBaseV1["payloadClass"];
}): RoomOperationEventV1 {
  // Room-operation authorization runs FIRST — a denial creates nothing.
  assertRoomOperationAllowed(input.request, input.roomDecision, input.roomPolicy);

  const now = input.clock.nowLocalIso();
  const createdAtLocal = now.startsWith("local:") ? now : `local:${now}`;

  const draft = {
    schemaVersion: ROOM_EVENT_SCHEMA_VERSION,
    projectionVersion: ROOM_PROJECTION_VERSION,
    eventId: input.eventId,
    roomId: input.request.roomId,
    localSequence: input.localSequence,
    operation: input.request.operation,
    ...(input.request.objectKind !== undefined ? { objectKind: input.request.objectKind } : {}),
    actor: input.actor ?? "local_unknown",
    createdAtLocal,
    payloadClass: input.payloadClass ?? "placeholder",
    payload: input.typedPayload,
  };

  // Full structural validation + defensive clone before the event is accepted.
  const accepted = validateRoomOperationEventV1(draft);
  return Object.freeze(accepted);
}
