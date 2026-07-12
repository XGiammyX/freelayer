/**
 * Local RoomOS operation logs (TECH-17): InMemory + Null ONLY.
 *
 * A room mutation and a log append are SEPARATE side effects: the room
 * barrier authorizes the mutation; each log method requires its OWN
 * PolicyDecision with the exact log scope ("room.operation_log.append" /
 * ".read" / ".clear"). One decision never authorizes two side-effect classes.
 *
 * No persistent implementation exists (encrypted backend is Gate F); the
 * memory log dies with the process; the null log retains nothing — an
 * ephemeral projection may still exist in the current process, but it cannot
 * be rebuilt after the event is discarded.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
} from "@freelayer/privacy";
import {
  RoomBypassAttemptError,
  RoomDecisionMismatchError,
  RoomPolicyDeniedError,
} from "./room-errors";
import {
  RoomDuplicateEventError,
  RoomEventOrderError,
  RoomEventRoomMismatchError,
  RoomSequenceConflictError,
  RoomSequenceGapError,
} from "./room-log-errors";
import {
  cloneRoomEvent,
  validateRoomOperationEventV1,
  type RoomOperationEventV1,
} from "./room-event-v1";
import { ROOM_CAPABILITY } from "./room-policy";
import type { RoomLocalId } from "./room-types";

export type RoomOperationLogRetention = "memory_only" | "null";

export interface RoomOperationLogStatus {
  readonly roomId: RoomLocalId;
  readonly retention: RoomOperationLogRetention;
  readonly retainedEventCount: number;
  readonly lastLocalSequence: number;
  readonly replayAvailable: boolean;
}

export type RoomLogAppendResult =
  | { readonly outcome: "appended_memory"; readonly retained: true; readonly localSequence: number }
  | {
      readonly outcome: "discarded_by_null_policy";
      readonly retained: false;
      readonly localSequence: number;
    };

export interface RoomLogClearResult {
  readonly outcome: "cleared";
  readonly removedEventCount: number;
}

export interface RoomOperationLog {
  readonly roomId: RoomLocalId;
  readonly retention: RoomOperationLogRetention;
  append(event: RoomOperationEventV1, storageDecision: PolicyDecision): RoomLogAppendResult;
  readAll(storageDecision: PolicyDecision): readonly RoomOperationEventV1[];
  clear(storageDecision: PolicyDecision): RoomLogClearResult;
  status(): RoomOperationLogStatus;
}

function assertLogDecision(decision: PolicyDecision, scope: PolicySideEffectScope): void {
  if (!isPolicyDecision(decision)) {
    throw new RoomBypassAttemptError("log operation invoked without a valid PolicyDecision");
  }
  if (decision.verdict !== "allowed") {
    throw new RoomPolicyDeniedError({
      operation: scope,
      detail: "log policy decision verdict is denied",
    });
  }
  if (decision.capability !== ROOM_CAPABILITY) {
    throw new RoomDecisionMismatchError(
      `log decision capability "${decision.capability}" does not match required "${ROOM_CAPABILITY}"`,
    );
  }
  if (decision.sideEffect !== scope) {
    throw new RoomDecisionMismatchError(
      `log decision side-effect "${decision.sideEffect}" does not match "${scope}"`,
    );
  }
}

/** Memory-only log. Nothing persists; instances share no state. */
export class InMemoryRoomOperationLog implements RoomOperationLog {
  readonly roomId: RoomLocalId;
  readonly retention = "memory_only" as const;
  readonly #events: RoomOperationEventV1[] = [];
  readonly #eventIds = new Set<string>();

  constructor(roomId: RoomLocalId) {
    this.roomId = roomId;
  }

  append(event: RoomOperationEventV1, storageDecision: PolicyDecision): RoomLogAppendResult {
    assertLogDecision(storageDecision, "room.operation_log.append");
    const validated = validateRoomOperationEventV1(event); // clones defensively
    if (validated.roomId !== this.roomId) {
      throw new RoomEventRoomMismatchError();
    }
    if (this.#eventIds.has(validated.eventId)) {
      throw new RoomDuplicateEventError();
    }
    const sequence = validated.localSequence as number;
    const last =
      this.#events.length > 0
        ? (this.#events[this.#events.length - 1]!.localSequence as number)
        : 0;
    if (sequence === last) throw new RoomSequenceConflictError();
    if (sequence < last) throw new RoomEventOrderError();
    if (sequence !== last + 1) throw new RoomSequenceGapError();

    this.#events.push(validated);
    this.#eventIds.add(validated.eventId);
    return { outcome: "appended_memory", retained: true, localSequence: sequence };
  }

  readAll(storageDecision: PolicyDecision): readonly RoomOperationEventV1[] {
    assertLogDecision(storageDecision, "room.operation_log.read");
    // Clone on read — internal array/entries are never exposed.
    return this.#events.map((event) => cloneRoomEvent(event));
  }

  clear(storageDecision: PolicyDecision): RoomLogClearResult {
    assertLogDecision(storageDecision, "room.operation_log.clear");
    const removed = this.#events.length;
    this.#events.length = 0;
    this.#eventIds.clear();
    return { outcome: "cleared", removedEventCount: removed };
  }

  status(): RoomOperationLogStatus {
    // Metadata only — never payloads.
    return {
      roomId: this.roomId,
      retention: this.retention,
      retainedEventCount: this.#events.length,
      lastLocalSequence:
        this.#events.length > 0
          ? (this.#events[this.#events.length - 1]!.localSequence as number)
          : 0,
      replayAvailable: this.#events.length > 0,
    };
  }
}

/** Null log: validates policy + invariants, retains NOTHING, replay unavailable. */
export class NullRoomOperationLog implements RoomOperationLog {
  readonly roomId: RoomLocalId;
  readonly retention = "null" as const;
  #lastSequence = 0;

  constructor(roomId: RoomLocalId) {
    this.roomId = roomId;
  }

  append(event: RoomOperationEventV1, storageDecision: PolicyDecision): RoomLogAppendResult {
    assertLogDecision(storageDecision, "room.operation_log.append");
    const validated = validateRoomOperationEventV1(event);
    if (validated.roomId !== this.roomId) {
      throw new RoomEventRoomMismatchError();
    }
    this.#lastSequence = validated.localSequence as number;
    // Explicit discard — nothing retained, nothing logged, nothing serialized.
    return {
      outcome: "discarded_by_null_policy",
      retained: false,
      localSequence: this.#lastSequence,
    };
  }

  readAll(storageDecision: PolicyDecision): readonly RoomOperationEventV1[] {
    assertLogDecision(storageDecision, "room.operation_log.read");
    return [];
  }

  clear(storageDecision: PolicyDecision): RoomLogClearResult {
    assertLogDecision(storageDecision, "room.operation_log.clear");
    return { outcome: "cleared", removedEventCount: 0 };
  }

  status(): RoomOperationLogStatus {
    return {
      roomId: this.roomId,
      retention: this.retention,
      retainedEventCount: 0,
      lastLocalSequence: this.#lastSequence,
      replayAvailable: false,
    };
  }
}
