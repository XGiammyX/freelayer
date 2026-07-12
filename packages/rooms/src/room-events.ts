/**
 * Room operation events (TECH-16) — the LOCAL, versioned operation-log
 * placeholder. Event-sourced direction preserved: state derives from events.
 * No crypto signatures, no CRDT/causal metadata (Gate F/H), no trusted time.
 * Persistence of the log follows StoragePolicy — and in v1 the log NEVER
 * persists (Ghost/Bunker deny; Standard's encrypted backend is Gate F).
 */

import { InvalidRoomOperationError } from "./room-errors";
import {
  ROOM_OPERATION_KINDS,
  type RoomLocalId,
  type RoomMemberRef,
  type RoomObjectKind,
  type RoomOperationKind,
} from "./room-types";

export type RoomEventPayloadClass = "none" | "redacted" | "placeholder" | "content";

export interface RoomOperationEvent {
  readonly version: 1;
  /** Sequence-based — encodes NOTHING sensitive (no payload, no timestamps). */
  readonly id: string;
  readonly roomId: RoomLocalId;
  readonly operation: RoomOperationKind;
  readonly objectKind?: RoomObjectKind;
  /** LOCAL wall-clock label, prefixed "local:" — never a trusted-time claim. */
  readonly createdAtLocal: string;
  readonly actor: RoomMemberRef | "local_unknown";
  readonly redacted: boolean;
  readonly payloadClass: RoomEventPayloadClass;
  /** Content payloads live in memory only; never in audit/log persistence. */
  readonly payload?: unknown;
}

let eventSeq = 0;

export function createRoomOperationEvent(input: {
  readonly roomId: RoomLocalId;
  readonly operation: RoomOperationKind;
  readonly objectKind?: RoomObjectKind;
  readonly actor?: RoomMemberRef;
  readonly payloadClass?: RoomEventPayloadClass;
  readonly payload?: unknown;
}): RoomOperationEvent {
  if (input.operation === "unknown" || !ROOM_OPERATION_KINDS.includes(input.operation)) {
    throw new InvalidRoomOperationError();
  }
  eventSeq += 1;
  const payloadClass = input.payloadClass ?? "none";
  return {
    version: 1,
    id: `revt-${eventSeq}`,
    roomId: input.roomId,
    operation: input.operation,
    ...(input.objectKind !== undefined ? { objectKind: input.objectKind } : {}),
    createdAtLocal: `local:${new Date().toISOString()}`,
    actor: input.actor ?? "local_unknown",
    redacted: payloadClass !== "content",
    payloadClass,
    ...(input.payload !== undefined && payloadClass === "content"
      ? { payload: input.payload }
      : {}),
  };
}
