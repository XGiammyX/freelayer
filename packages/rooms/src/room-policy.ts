/**
 * RoomPolicy v1 + the room operation barrier (TECH-16).
 *
 * RoomOS operations are POLICY-CONTROLLED LOCAL STATE TRANSITIONS:
 * no network, no crypto, no sync, no persistence in strict modes, no metadata
 * side effects without policy, no anti-spyware implementation. Room policy can
 * tighten the device mode, never loosen it; strictest policy wins
 * (docs/SOVEREIGN_ROOMS.md, docs/POLICY_MATRIX.md).
 */

import {
  isPolicyDecision,
  type PolicyCapability,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  ForbiddenRoomPersistenceError,
  ForbiddenRoomSideEffectError,
  InvalidRoomObjectKindError,
  InvalidRoomOperationError,
  RoomBypassAttemptError,
  RoomDecisionMismatchError,
  RoomPolicyDeniedError,
} from "./room-errors";
import {
  CONTENT_BEARING_OPERATIONS,
  ROOM_KINDS,
  ROOM_OBJECT_KINDS,
  ROOM_OPERATION_KINDS,
  type RoomKind,
  type RoomLifecycleState,
  type RoomLocalId,
  type RoomObjectKind,
  type RoomOperationKind,
} from "./room-types";

// ---------------------------------------------------------------------------
// RoomPolicy
// ---------------------------------------------------------------------------

export type EndpointDefenseIntegration =
  "externalized" | "hook_only" | "future_gate" | "not_available";

export interface RoomPolicy {
  readonly mode: PrivacyMode;
  readonly roomKind: RoomKind;
  readonly lifecycle: RoomLifecycleState;
  readonly allowLocalContentMutation: boolean;
  readonly allowPersistentProjection: boolean;
  readonly allowOperationLogPersistence: boolean;
  readonly allowNetworkSync: boolean;
  readonly allowMetadataSignals: boolean;
  readonly allowNotifications: boolean;
  readonly allowLocalAI: boolean;
  /** Anti-spyware is EXTERNALIZED — "active" is not representable. */
  readonly endpointDefenseIntegration: EndpointDefenseIntegration;
  readonly strictestPolicyWins: true;
  /** Bunker (and stricter contexts) redact title/member display. */
  readonly redactTitles: boolean;
  readonly reason: string;
}

export interface RoomPolicyInput {
  readonly mode: PrivacyMode;
  readonly roomKind: RoomKind;
  readonly lifecycle?: RoomLifecycleState;
  readonly operation?: RoomOperationKind;
  readonly roomPolicy?: Partial<RoomPolicy>;
  readonly deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
  readonly endpointDefenseState?: "externalized" | "not_integrated" | "hook_only";
}

const KNOWN_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

export function resolveRoomPolicy(input: RoomPolicyInput): RoomPolicy {
  const { mode, roomKind } = input;
  const lifecycle = input.lifecycle ?? "active_local";

  const deny = (reason: string): RoomPolicy => ({
    mode,
    roomKind,
    lifecycle,
    allowLocalContentMutation: false,
    allowPersistentProjection: false,
    allowOperationLogPersistence: false,
    allowNetworkSync: false,
    allowMetadataSignals: false,
    allowNotifications: false,
    allowLocalAI: false,
    endpointDefenseIntegration: "externalized",
    strictestPolicyWins: true,
    redactTitles: true,
    reason,
  });

  // FAIL CLOSED: unknown mode/kind/lifecycle.
  if (
    !KNOWN_MODES.includes(mode) ||
    !ROOM_KINDS.includes(roomKind) ||
    roomKind === "unknown" ||
    lifecycle === "unknown"
  ) {
    return deny("unknown mode/room kind/lifecycle: fail closed");
  }

  // Emergency: normal room mutation denied (wipe/lock direction is a separate
  // lifecycle path modeled by the matrix, not a general mutation allowance).
  if (mode === "emergency") {
    return deny("emergency: normal room mutations denied");
  }
  // Locked/tombstoned rooms accept no normal mutations.
  if (lifecycle === "emergency_locked" || lifecycle === "deleted_tombstone") {
    return deny(`lifecycle "${lifecycle}": room is locked`);
  }

  const strict = mode === "ghost" || mode === "bunker";
  const risk = input.deviceRiskLevel ?? "unknown";

  let policy: RoomPolicy = {
    mode,
    roomKind,
    lifecycle,
    // Local, memory-only placeholder mutations are the v1 ceiling everywhere.
    allowLocalContentMutation: true,
    // v1 invariants: nothing persists (encrypted backend is Gate F),
    // nothing syncs (Gate H), no metadata/notification/AI side effects.
    allowPersistentProjection: false,
    allowOperationLogPersistence: false,
    allowNetworkSync: false,
    allowMetadataSignals: false,
    allowNotifications: false,
    allowLocalAI: false,
    endpointDefenseIntegration: "externalized",
    strictestPolicyWins: true,
    redactTitles: mode === "bunker" || risk === "critical",
    reason: strict
      ? `${mode}: memory/null-only local room state; nothing persists`
      : `${mode}: local memory-only room foundation; persistence/sync future-gated`,
  };

  // Room policy composition: TIGHTEN ONLY. A room may deny what the device
  // allows; every `allow*` flag can only go false-ward, redaction only on-ward.
  const room = input.roomPolicy;
  if (room !== undefined) {
    policy = {
      ...policy,
      allowLocalContentMutation:
        policy.allowLocalContentMutation && (room.allowLocalContentMutation ?? true),
      redactTitles: policy.redactTitles || (room.redactTitles ?? false),
      reason: `${policy.reason}; room policy composed (tighten-only)`,
    };
  }

  return policy;
}

// ---------------------------------------------------------------------------
// Operation → side-effect scope / capability mapping
// ---------------------------------------------------------------------------

/** Room decisions are issued against the persistence capability (local state). */
export const ROOM_CAPABILITY: PolicyCapability = "persistence";

const LIFECYCLE_OPERATIONS: readonly RoomOperationKind[] = [
  "room.rename",
  "room.archive",
  "room.lock",
  "room.delete_tombstone",
];

export function expectedRoomScope(operation: RoomOperationKind): PolicySideEffectScope {
  if (operation === "room.create") return "room.create";
  if (operation === "room.policy_update") return "room.policy_update";
  if (operation === "audit.append_redacted") return "room.audit";
  if (LIFECYCLE_OPERATIONS.includes(operation)) return "room.lifecycle_update";
  return "room.mutate";
}

// ---------------------------------------------------------------------------
// The room operation request + barrier
// ---------------------------------------------------------------------------

export interface RoomOperationRequest {
  readonly operation: RoomOperationKind;
  readonly roomId?: RoomLocalId;
  readonly objectKind?: RoomObjectKind;
  readonly mode: PrivacyMode;
  /** Non-sensitive justification. Never a title/name/content. */
  readonly reason: string;
  /** NEVER logged, thrown, audited, or persisted without policy. */
  readonly payload?: unknown;
  readonly roomPolicy?: Partial<RoomPolicy>;
}

/**
 * Reject any room operation that is not authentically policy-approved and
 * scoped to exactly this operation. Runs BEFORE any state transition —
 * a denial here means no storage/metadata/network code is ever reached.
 */
export function assertRoomOperationAllowed(
  request: RoomOperationRequest,
  decision: PolicyDecision,
  roomPolicy: RoomPolicy,
): void {
  // ---- Request validity (fail closed) ----
  if (request.operation === "unknown" || !ROOM_OPERATION_KINDS.includes(request.operation)) {
    throw new InvalidRoomOperationError();
  }
  if (
    request.objectKind !== undefined &&
    (request.objectKind === "unknown" || !ROOM_OBJECT_KINDS.includes(request.objectKind))
  ) {
    throw new InvalidRoomObjectKindError();
  }
  if (roomPolicy.mode !== request.mode) {
    throw new RoomBypassAttemptError("room policy does not match the request mode");
  }

  // ---- Decision authenticity + integrity (WeakSet provenance in privacy) ----
  if (!isPolicyDecision(decision)) {
    throw new RoomBypassAttemptError("operation invoked without a valid PolicyDecision (ADR-0002)");
  }
  if (decision.verdict !== "allowed") {
    throw new RoomPolicyDeniedError({
      operation: request.operation,
      detail: "policy decision verdict is denied",
    });
  }
  if (decision.capability !== ROOM_CAPABILITY) {
    throw new RoomDecisionMismatchError(
      `decision capability "${decision.capability}" does not match required "${ROOM_CAPABILITY}"`,
    );
  }
  const scope = expectedRoomScope(request.operation);
  if (decision.sideEffect !== scope) {
    throw new RoomDecisionMismatchError(
      `decision side-effect "${decision.sideEffect}" does not match "${scope}"`,
    );
  }

  // ---- Policy verdict ----
  if (!roomPolicy.allowLocalContentMutation && request.operation !== "audit.append_redacted") {
    throw new RoomPolicyDeniedError({
      operation: request.operation,
      detail: roomPolicy.reason,
    });
  }
  if (CONTENT_BEARING_OPERATIONS.includes(request.operation) && roomPolicy.mode === "emergency") {
    throw new RoomPolicyDeniedError({
      operation: request.operation,
      detail: "emergency: content-bearing mutations denied",
    });
  }

  // ---- v1 side-effect gates: nothing persists, syncs, notifies, or infers ----
  if (roomPolicy.allowNetworkSync) {
    throw new ForbiddenRoomSideEffectError({
      operation: request.operation,
      detail: "network sync is future-gated (Gate H); no policy may enable it in v1",
    });
  }
  if (roomPolicy.allowPersistentProjection || roomPolicy.allowOperationLogPersistence) {
    throw new ForbiddenRoomPersistenceError({
      operation: request.operation,
      detail: "room persistence is future-gated (encrypted storage, Gate F)",
    });
  }
  if (roomPolicy.allowNotifications || roomPolicy.allowLocalAI) {
    throw new ForbiddenRoomSideEffectError({
      operation: request.operation,
      detail: "room notifications/AI are denied in v1",
    });
  }
  if ((roomPolicy.endpointDefenseIntegration as string) === "active") {
    throw new ForbiddenRoomSideEffectError({
      operation: request.operation,
      detail: "endpoint defense is externalized; active integration requires Gate R",
    });
  }
}
