/**
 * RoomOS object mutation policy (TECH-18).
 *
 * Deny-by-default, per-operation authorization. A mutation is authorized only
 * by an authentic PolicyDecision scoped to EXACTLY its side-effect class; an
 * object ID or actor ref never confers authority. Strictest policy wins; room
 * policy tightens the device mode but never loosens it. No network, no
 * notification, no AI, no active endpoint defense is ever representable.
 */

import {
  isPolicyDecision,
  type PolicyCapability,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import { ROOM_CAPABILITY, type RoomPolicy } from "../room-policy";
import { RoomObjectAuthorizationError, RoomObjectConcurrencyError } from "./object-errors";
import type { ObjectMutationClass } from "./object-lifecycle";
import type { RoomObjectCommandName, RoomObjectMutationCommandV1 } from "./object-commands";
import type { RoomObjectSensitivity, RoomObjectV1 } from "./object-types";

/** Object mutations are issued against the persistence capability (local state). */
export const ROOM_OBJECT_CAPABILITY: PolicyCapability = ROOM_CAPABILITY;

export type ObjectSideEffectScope = Extract<PolicySideEffectScope, `room.object.${string}`>;

/** Map a command to its exact mutation side-effect scope. */
export function objectMutationScope(command: RoomObjectCommandName): ObjectSideEffectScope {
  if (command === "object.redact" || command === "message.redact") return "room.object.redact";
  if (command === "object.archive") return "room.object.archive";
  if (command === "object.tombstone") return "room.object.tombstone";
  if (command.endsWith(".create") || command === "file_ref.create_placeholder") {
    return "room.object.create";
  }
  return "room.object.update";
}

export function objectMutationClass(command: RoomObjectCommandName): ObjectMutationClass {
  if (command === "object.redact" || command === "message.redact") return "redact";
  if (command === "object.archive") return "archive";
  if (command === "object.tombstone") return "tombstone";
  if (command.endsWith(".create") || command === "file_ref.create_placeholder") return "create";
  return "content_update";
}

export interface RoomObjectMutationPolicy {
  readonly mode: PrivacyMode;
  readonly command: RoomObjectCommandName;
  readonly objectKind: RoomObjectV1["kind"];
  readonly allowed: boolean;
  readonly contentInMemoryAllowed: boolean;
  readonly persistentContentAllowed: boolean;
  readonly operationLogRetention: "memory_only" | "null";
  readonly projectionRetention: "memory_only" | "null";
  readonly metadataAllowed: boolean;
  readonly auditAllowed: boolean;
  readonly networkAllowed: false;
  readonly notificationAllowed: false;
  readonly aiAllowed: boolean;
  readonly endpointDefenseState: "externalized" | "hook_only" | "not_integrated";
  readonly reasonCode: string;
}

export function resolveRoomObjectMutationPolicy(input: {
  mode: PrivacyMode;
  command: RoomObjectCommandName;
  objectKind: RoomObjectV1["kind"];
  roomPolicy: RoomPolicy;
  objectSensitivity: RoomObjectSensitivity;
  deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
}): RoomObjectMutationPolicy {
  const { mode, command, objectKind, roomPolicy } = input;
  const cls = objectMutationClass(command);
  // Safe-direction ops (redact/tombstone) stay allowed even in Emergency.
  const safeDirection = cls === "redact" || cls === "tombstone";

  const base: RoomObjectMutationPolicy = {
    mode,
    command,
    objectKind,
    allowed: true,
    contentInMemoryAllowed: true,
    persistentContentAllowed: false, // Gate F — never in v1
    operationLogRetention: "memory_only",
    projectionRetention: "memory_only",
    metadataAllowed: roomPolicy.allowMetadataSignals,
    auditAllowed: true,
    networkAllowed: false,
    notificationAllowed: false,
    aiAllowed: false,
    endpointDefenseState: "externalized",
    reasonCode: "default_deny",
  };

  const deny = (reasonCode: string): RoomObjectMutationPolicy => ({
    ...base,
    allowed: false,
    contentInMemoryAllowed: false,
    operationLogRetention: "null",
    projectionRetention: "null",
    metadataAllowed: false,
    auditAllowed: safeDirection, // redact/tombstone may still be audited
    reasonCode,
  });

  // Emergency: ordinary create/edit/update denied; only safe direction survives.
  if (mode === "emergency") {
    return safeDirection
      ? {
          ...base,
          contentInMemoryAllowed: false,
          metadataAllowed: false,
          reasonCode: "emergency_mode",
        }
      : deny("emergency_mode");
  }

  // Room policy denies content mutation → deny content-bearing ops.
  if (!roomPolicy.allowLocalContentMutation && !safeDirection) {
    return deny("room_policy_stricter");
  }

  // Ghost/Bunker: memory-only, null-preferred retention, no metadata.
  if (mode === "ghost" || mode === "bunker") {
    return {
      ...base,
      // Bunker: content-bearing ops keep NO retention (null); redact/tombstone allowed.
      operationLogRetention: mode === "bunker" ? "null" : "memory_only",
      projectionRetention: "memory_only",
      metadataAllowed: false,
      reasonCode: "strict_mode",
    };
  }

  // Offline Capsule: local memory only, no network/remote refs.
  if (mode === "offline_capsule") {
    return { ...base, metadataAllowed: false, reasonCode: "offline_capsule_mode" };
  }

  // Standard / Private / Sovereign Room: local in-memory content allowed.
  return {
    ...base,
    metadataAllowed: mode === "standard" ? roomPolicy.allowMetadataSignals : false,
    reasonCode: "default_deny",
  };
}

/**
 * Authorize a single object mutation. Runs BEFORE any event/log/projection
 * side effect; a denial means no state is touched. Object ID/actor ref are
 * NOT treated as authorization proof.
 */
export function assertRoomObjectMutationAllowed(
  command: RoomObjectMutationCommandV1,
  decision: PolicyDecision,
  policy: RoomObjectMutationPolicy,
  currentObject?: RoomObjectV1,
): void {
  // ---- Decision authenticity + exact scope (WeakSet provenance) ----
  if (!isPolicyDecision(decision)) {
    throw new RoomObjectAuthorizationError("decision_missing");
  }
  if (decision.verdict !== "allowed") {
    throw new RoomObjectAuthorizationError("policy_denied");
  }
  if (decision.capability !== ROOM_OBJECT_CAPABILITY) {
    throw new RoomObjectAuthorizationError("decision_mismatch");
  }
  const scope = objectMutationScope(command.command);
  if (decision.sideEffect !== scope) {
    throw new RoomObjectAuthorizationError("decision_mismatch");
  }

  // ---- Command/policy agreement ----
  if (policy.command !== command.command) {
    throw new RoomObjectAuthorizationError("decision_mismatch");
  }
  if (!policy.allowed) {
    throw new RoomObjectAuthorizationError("policy_denied", policy.reasonCode);
  }
  if (policy.persistentContentAllowed) {
    // Defence in depth: v1 must never request persistent plaintext content.
    throw new RoomObjectAuthorizationError("content_persistence_forbidden");
  }
  if (policy.networkAllowed || policy.notificationAllowed || policy.aiAllowed) {
    throw new RoomObjectAuthorizationError("forbidden_side_effect");
  }
  if ((policy.endpointDefenseState as string) === "active") {
    throw new RoomObjectAuthorizationError("forbidden_side_effect");
  }

  // ---- Target relationship (room match; no cross-room mutation) ----
  if (currentObject !== undefined) {
    if (currentObject.roomId !== command.roomId) {
      throw new RoomObjectAuthorizationError("room_mismatch");
    }
    if (currentObject.objectId !== command.objectId) {
      throw new RoomObjectAuthorizationError("cross_object_reference");
    }
    if (currentObject.lifecycle === "deleted_tombstone") {
      throw new RoomObjectConcurrencyError("object_is_terminal");
    }
  }
}
