/**
 * Local RoomOS object-event logs (TECH-18): InMemory + Null ONLY.
 *
 * Structurally parallel to the TECH-17 operation log: a mutation and a log
 * append are SEPARATE side effects; each log method requires its OWN
 * PolicyDecision with the exact object-log scope. Nothing persists (encrypted
 * backend is Gate F); the memory log dies with the process; the null log
 * retains nothing.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
} from "@freelayer/privacy";
import { ROOM_CAPABILITY } from "../room-policy";
import { cloneRoomProjection } from "../room-event-v1";
import type { RoomLocalId } from "../room-types";
import { RoomObjectAuthorizationError, RoomObjectConcurrencyError } from "./object-errors";
import type { RoomObjectEventV1 } from "./object-events";

export type RoomObjectLogRetention = "memory_only" | "null";

export interface RoomObjectLogStatus {
  readonly roomId: RoomLocalId;
  readonly retention: RoomObjectLogRetention;
  readonly retainedEventCount: number;
  readonly lastLocalSequence: number;
  readonly replayAvailable: boolean;
}

export type RoomObjectLogAppendResult =
  | { readonly outcome: "appended_memory"; readonly retained: true; readonly localSequence: number }
  | {
      readonly outcome: "discarded_by_null_policy";
      readonly retained: false;
      readonly localSequence: number;
    };

export interface RoomObjectLog {
  readonly roomId: RoomLocalId;
  readonly retention: RoomObjectLogRetention;
  append(event: RoomObjectEventV1, storageDecision: PolicyDecision): RoomObjectLogAppendResult;
  readAll(storageDecision: PolicyDecision): readonly RoomObjectEventV1[];
  clear(storageDecision: PolicyDecision): { readonly removedEventCount: number };
  status(): RoomObjectLogStatus;
  /** Next contiguous local sequence (1-based). Metadata only. */
  nextLocalSequence(): number;
}

function assertObjectLogDecision(decision: PolicyDecision, scope: PolicySideEffectScope): void {
  if (!isPolicyDecision(decision)) {
    throw new RoomObjectAuthorizationError("decision_missing");
  }
  if (decision.verdict !== "allowed") {
    throw new RoomObjectAuthorizationError("policy_denied");
  }
  if (decision.capability !== ROOM_CAPABILITY || decision.sideEffect !== scope) {
    throw new RoomObjectAuthorizationError("decision_mismatch");
  }
}

export class InMemoryRoomObjectLog implements RoomObjectLog {
  readonly roomId: RoomLocalId;
  readonly retention = "memory_only" as const;
  readonly #events: RoomObjectEventV1[] = [];

  constructor(roomId: RoomLocalId) {
    this.roomId = roomId;
  }

  append(event: RoomObjectEventV1, storageDecision: PolicyDecision): RoomObjectLogAppendResult {
    assertObjectLogDecision(storageDecision, "room.object_log.append");
    if (event.roomId !== this.roomId) throw new RoomObjectAuthorizationError("room_mismatch");
    const expected = this.#events.length + 1;
    if (event.localSequence !== expected) {
      throw new RoomObjectConcurrencyError("invalid_lifecycle_transition");
    }
    this.#events.push(cloneRoomProjection(event));
    return { outcome: "appended_memory", retained: true, localSequence: event.localSequence };
  }

  readAll(storageDecision: PolicyDecision): readonly RoomObjectEventV1[] {
    assertObjectLogDecision(storageDecision, "room.object_log.read");
    return this.#events.map((event) => cloneRoomProjection(event));
  }

  clear(storageDecision: PolicyDecision): { readonly removedEventCount: number } {
    assertObjectLogDecision(storageDecision, "room.object_log.clear");
    const removed = this.#events.length;
    this.#events.length = 0;
    return { removedEventCount: removed };
  }

  status(): RoomObjectLogStatus {
    return {
      roomId: this.roomId,
      retention: this.retention,
      retainedEventCount: this.#events.length,
      lastLocalSequence: this.#events.length,
      replayAvailable: this.#events.length > 0,
    };
  }

  nextLocalSequence(): number {
    return this.#events.length + 1;
  }
}

export class NullRoomObjectLog implements RoomObjectLog {
  readonly roomId: RoomLocalId;
  readonly retention = "null" as const;
  #lastSequence = 0;

  constructor(roomId: RoomLocalId) {
    this.roomId = roomId;
  }

  append(event: RoomObjectEventV1, storageDecision: PolicyDecision): RoomObjectLogAppendResult {
    assertObjectLogDecision(storageDecision, "room.object_log.append");
    if (event.roomId !== this.roomId) throw new RoomObjectAuthorizationError("room_mismatch");
    this.#lastSequence = event.localSequence;
    return {
      outcome: "discarded_by_null_policy",
      retained: false,
      localSequence: event.localSequence,
    };
  }

  readAll(storageDecision: PolicyDecision): readonly RoomObjectEventV1[] {
    assertObjectLogDecision(storageDecision, "room.object_log.read");
    return [];
  }

  clear(storageDecision: PolicyDecision): { readonly removedEventCount: number } {
    assertObjectLogDecision(storageDecision, "room.object_log.clear");
    return { removedEventCount: 0 };
  }

  status(): RoomObjectLogStatus {
    return {
      roomId: this.roomId,
      retention: this.retention,
      retainedEventCount: 0,
      lastLocalSequence: this.#lastSequence,
      replayAvailable: false,
    };
  }

  nextLocalSequence(): number {
    return this.#lastSequence + 1;
  }
}
