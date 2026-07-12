/**
 * Room factory (TECH-16). The ONLY sanctioned way to create local room state:
 * requires an authentic, exactly-scoped PolicyDecision, applies RoomPolicy,
 * performs no persistence, no network, no identity, no crypto.
 */

import type { PolicyDecision, PrivacyMode } from "@freelayer/privacy";
import { assertRoomOperationAllowed, resolveRoomPolicy, type RoomPolicy } from "./room-policy";
import { createRoomOperationEvent, type RoomOperationEvent } from "./room-events";
import { createRoomLocalId, type RoomKind } from "./room-types";
import type { RoomMaterializedState } from "./room-state";

export function createLocalRoom(input: {
  readonly kind: RoomKind;
  readonly mode: PrivacyMode;
  readonly title?: string;
  readonly decision: PolicyDecision;
  readonly roomPolicy?: Partial<RoomPolicy>;
}): { state: RoomMaterializedState; event: RoomOperationEvent } {
  const policy = resolveRoomPolicy({
    mode: input.mode,
    roomKind: input.kind,
    lifecycle: "draft",
    operation: "room.create",
    ...(input.roomPolicy !== undefined ? { roomPolicy: input.roomPolicy } : {}),
  });

  // The barrier runs BEFORE any state exists — a denial creates nothing.
  assertRoomOperationAllowed(
    {
      operation: "room.create",
      mode: input.mode,
      reason: "create local room",
      ...(input.roomPolicy !== undefined ? { roomPolicy: input.roomPolicy } : {}),
    },
    input.decision,
    policy,
  );

  const roomId = createRoomLocalId();
  const includeTitle = input.title !== undefined && !policy.redactTitles;

  const event = createRoomOperationEvent({
    roomId,
    operation: "room.create",
    payloadClass: "placeholder",
  });

  const state: RoomMaterializedState = {
    roomId,
    kind: input.kind,
    lifecycle: "active_local",
    mode: input.mode,
    titleRedacted: !includeTitle && input.title !== undefined,
    ...(includeTitle ? { title: input.title } : {}),
    members: [],
    objects: [],
    lastLocalUpdateAt: event.createdAtLocal,
    policy,
  };

  return { state, event };
}
