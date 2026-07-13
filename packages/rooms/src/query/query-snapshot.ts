/**
 * Immutable query snapshot boundary (TECH-19). Queries execute against ONE
 * frozen, defensively-cloned snapshot — never the live projection and never
 * the operation log. Snapshot creation performs no storage/network side
 * effect, appends no events, and creates no query history.
 */

import type { PolicyDecision } from "@freelayer/privacy";
import { cloneRoomProjection } from "../room-event-v1";
import type { RoomMaterializedState } from "../room-state";
import type { RoomKind, RoomLifecycleState, RoomLocalId } from "../room-types";
import type { RoomObjectProjectionV1, RoomObjectV1 } from "../objects";
import { RoomQueryRoomMismatchError } from "./query-errors";
import type { RoomQueryPolicy } from "./query-policy";

export interface RoomQuerySnapshotV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly roomKind: RoomKind;
  readonly lifecycle: RoomLifecycleState;
  readonly mode: string;
  readonly title?: string;
  readonly objects: readonly RoomObjectV1[];
}

/**
 * Build the immutable snapshot from the room state + the object projection.
 * (TECH-18 keeps full objects in `RoomObjectProjectionV1`, separate from the
 * content-free `RoomMaterializedState.objects` summaries — so both are needed.)
 */
export function createRoomQuerySnapshotV1(input: {
  roomState: RoomMaterializedState;
  objectProjection: RoomObjectProjectionV1;
  decision: PolicyDecision;
  policy: RoomQueryPolicy;
}): RoomQuerySnapshotV1 {
  const { roomState, objectProjection } = input;
  if (roomState.roomId !== objectProjection.roomId) {
    throw new RoomQueryRoomMismatchError();
  }
  // Defensive deep clone — the snapshot never shares references with the
  // live projection, so a query result can never mutate source state.
  const objects = cloneRoomProjection(objectProjection.objects) as RoomObjectV1[];
  const strict = roomState.mode === "bunker" || roomState.mode === "emergency";
  const snapshot: RoomQuerySnapshotV1 = {
    schemaVersion: 1,
    roomId: roomState.roomId,
    roomKind: roomState.kind,
    lifecycle: roomState.lifecycle,
    mode: roomState.mode,
    // `roomState.title` is already RoomPolicy-redacted (absent when redacted);
    // strict modes drop it from the snapshot entirely.
    ...(roomState.title !== undefined && !strict ? { title: roomState.title } : {}),
    objects: Object.freeze(objects),
  };
  return Object.freeze(snapshot);
}
