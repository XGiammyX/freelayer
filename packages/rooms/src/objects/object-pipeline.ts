/**
 * The single policy-gated local object mutation pipeline (TECH-18).
 *
 * All validation happens BEFORE any side effect: a failure produces no event,
 * no log entry, and no projection change (logical all-or-nothing at the local
 * in-memory boundary — NOT a crash-safe database transaction). A room mutation
 * decision and a storage (object-log) decision are SEPARATE and each exact-
 * scoped. No network, notification, link preview, AI, or endpoint call occurs.
 */

import { evaluatePolicyMatrix, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import type { RoomLocalClock } from "../room-event-v1";
import type { RoomPolicy } from "../room-policy";
import {
  RoomObjectConcurrencyError,
  RoomObjectError,
  RoomObjectValidationError,
} from "./object-errors";
import {
  validateRoomObjectMutationCommandV1,
  type RoomObjectMutationCommandV1,
} from "./object-commands";
import {
  buildResultingObject,
  createAcceptedRoomObjectEventV1,
  type RoomObjectEventV1,
} from "./object-events";
import {
  assertRoomObjectMutationAllowed,
  objectMutationClass,
  resolveRoomObjectMutationPolicy,
} from "./object-policy";
import type { RoomObjectLog } from "./object-log";
import { applyObjectEventToProjectionV1, type RoomObjectProjectionV1 } from "./object-reducer";
import { summarizeRoomObjectV1 } from "./object-redaction";
import type { RoomObjectSummaryV1, RoomObjectV1 } from "./object-types";

export interface ApplyRoomObjectMutationResultV1 {
  readonly event: RoomObjectEventV1;
  readonly nextProjection: RoomObjectProjectionV1;
  readonly objectSummary: RoomObjectSummaryV1;
  readonly retained: "memory" | "null";
}

export interface ApplyRoomObjectMutationInputV1 {
  readonly projection: RoomObjectProjectionV1;
  /** Untrusted command — validated internally; never spread unvalidated. */
  readonly command: unknown;
  readonly roomPolicy: RoomPolicy;
  readonly mutationDecision: PolicyDecision;
  readonly storageDecision: PolicyDecision;
  readonly objectEventId: string;
  readonly clock: RoomLocalClock;
  readonly objectLog: RoomObjectLog;
  readonly deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
}

/** Cross-check the Policy Matrix agrees the object mutation stays local. */
function assertMatrixLocal(mode: PrivacyMode, cls: string): void {
  const op =
    cls === "create"
      ? "room.object.create"
      : cls === "redact"
        ? "room.object.redact"
        : cls === "archive"
          ? "room.object.archive"
          : cls === "tombstone"
            ? "room.object.tombstone"
            : "room.object.update";
  const decision = evaluatePolicyMatrix({ mode, domain: "room", operation: op });
  // "memory_only" is the only allowing effect for object mutation; anything
  // else (deny/future_gate) means the matrix forbids it in this mode.
  if (decision.effect !== "memory_only") {
    throw new RoomObjectError("policy_denied", decision.effect);
  }
}

function findCurrent(
  projection: RoomObjectProjectionV1,
  objectId: string,
): RoomObjectV1 | undefined {
  return projection.objects.find((o) => o.objectId === objectId);
}

/** Verify same-room existence of a referenced object (reply/supersede). */
function assertReferenceInRoom(
  projection: RoomObjectProjectionV1,
  refId: string,
  requiredKind?: RoomObjectV1["kind"],
): void {
  const target = findCurrent(projection, refId);
  if (target === undefined) throw new RoomObjectError("cross_object_reference");
  if (requiredKind !== undefined && target.kind !== requiredKind) {
    throw new RoomObjectError("cross_object_reference");
  }
}

function assertRevisionMatch(
  command: RoomObjectMutationCommandV1,
  current: RoomObjectV1 | undefined,
): void {
  const cls = objectMutationClass(command.command);
  if (cls === "create") {
    if (current !== undefined) {
      // An object with this id already exists — reject before any side effect.
      throw new RoomObjectConcurrencyError("invalid_lifecycle_transition");
    }
    return;
  }
  if (current === undefined) throw new RoomObjectError("object_not_found");
  const expected = command.expectedRevision;
  if (expected === undefined) throw new RoomObjectValidationError("missing_expected_revision");
  const cur = current.revision as number;
  const exp = expected as number;
  if (exp < cur) throw new RoomObjectConcurrencyError("stale_revision");
  if (exp > cur) throw new RoomObjectConcurrencyError("future_revision");
}

export function applyLocalRoomObjectMutationV1(
  input: ApplyRoomObjectMutationInputV1,
): ApplyRoomObjectMutationResultV1 {
  const { projection, roomPolicy, mutationDecision, storageDecision, clock, objectLog } = input;

  // 1. Validate command structure (fail-closed; content-free errors).
  const command = validateRoomObjectMutationCommandV1(input.command);

  // 2-3. Room/object relationship.
  if (command.roomId !== projection.roomId) throw new RoomObjectError("room_mismatch");
  if (objectLog.roomId !== projection.roomId) throw new RoomObjectError("room_mismatch");
  const current = findCurrent(projection, command.objectId);

  // Cross-object references must be same-room (per-room projection).
  if (command.command === "message.create" && command.replyToObjectId !== undefined) {
    assertReferenceInRoom(projection, command.replyToObjectId);
  }
  if (command.command === "decision.resolve" && command.supersedesObjectId !== undefined) {
    assertReferenceInRoom(projection, command.supersedesObjectId, "decision");
  }

  // 4-5. Resolve policies.
  const objectKind = current?.kind ?? kindFromCreate(command);
  const cls = objectMutationClass(command.command);
  const policy = resolveRoomObjectMutationPolicy({
    mode: command.mode,
    command: command.command,
    objectKind,
    roomPolicy,
    objectSensitivity: current?.sensitivity ?? "content",
    ...(input.deviceRiskLevel !== undefined ? { deviceRiskLevel: input.deviceRiskLevel } : {}),
  });

  // 6. Cross-check the Policy Matrix (defence in depth).
  assertMatrixLocal(command.mode, cls);

  // 7. Exact-scope mutation authorization (object id/actor confer no authority).
  assertRoomObjectMutationAllowed(command, mutationDecision, policy, current);

  // 8. Lifecycle + revision (optimistic concurrency) BEFORE any side effect.
  assertRevisionMatch(command, current);

  // 9. Build the operation-specific event (injected clock; enforces status).
  const built = buildResultingObject({ current, command, nowLocal: nowLocal(clock) });
  const localSequence = objectLog.nextLocalSequence();
  const event = createAcceptedRoomObjectEventV1({
    command,
    built,
    objectEventId: input.objectEventId,
    localSequence,
    clock,
  });

  // 10-12. Separate storage decision → append to the memory/null object log.
  const append = objectLog.append(event, storageDecision);

  // 13. Deterministic pure projection update.
  const nextProjection = applyObjectEventToProjectionV1(projection, event);

  // 14. Metadata-only summary (no content ever). Strict modes (Ghost/Bunker/
  // Emergency) suppress even local activity signals (revision/content-present);
  // this is independent of metadata-SINK emission (policy.metadataAllowed).
  const summarized = nextProjection.objects.find((o) => o.objectId === command.objectId)!;
  const strict =
    command.mode === "ghost" || command.mode === "bunker" || command.mode === "emergency";
  const objectSummary = summarizeRoomObjectV1(summarized, { metadataAllowed: !strict });

  // 15. No audit/notification/network side effect is emitted here.
  return {
    event,
    nextProjection,
    objectSummary,
    retained: append.retained ? "memory" : "null",
  };
}

function nowLocal(clock: RoomLocalClock): string {
  const now = clock.nowLocalIso();
  return now.startsWith("local:") ? now : `local:${now}`;
}

function kindFromCreate(command: RoomObjectMutationCommandV1): RoomObjectV1["kind"] {
  switch (command.command) {
    case "message.create":
      return "message";
    case "note.create":
      return "note";
    case "task.create":
      return "task";
    case "decision.create":
      return "decision";
    case "poll.create":
      return "poll";
    case "file_ref.create_placeholder":
      return "file_ref";
    default:
      // Non-create against a missing object — surfaced as object_not_found later.
      return "message";
  }
}
