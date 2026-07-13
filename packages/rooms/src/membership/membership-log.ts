/**
 * Local RoomOS membership-event logs (TECH-20): InMemory + Null ONLY. A
 * membership mutation and a log append are SEPARATE side effects; each log
 * method requires its OWN PolicyDecision (exact `room.membership_log.*` scope).
 * Nothing persists (Gate F); the memory log dies with the process; the null log
 * (Ghost/Bunker) retains nothing.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
} from "@freelayer/privacy";
import { ROOM_CAPABILITY } from "../room-policy";
import { cloneRoomProjection } from "../room-event-v1";
import type { RoomLocalId } from "../room-types";
import {
  RoomMembershipDecisionMismatchError,
  RoomMembershipPolicyDeniedError,
} from "./membership-errors";
import type { RoomMembershipEventV1 } from "./membership-events";

export type RoomMembershipLogRetention = "memory_only" | "null";

export interface RoomMembershipLogStatus {
  readonly roomId: RoomLocalId;
  readonly retention: RoomMembershipLogRetention;
  readonly retainedEventCount: number;
  readonly lastLocalSequence: number;
  readonly replayAvailable: boolean;
}

export type RoomMembershipLogAppendResult =
  | { readonly outcome: "appended_memory"; readonly retained: true; readonly localSequence: number }
  | {
      readonly outcome: "discarded_by_null_policy";
      readonly retained: false;
      readonly localSequence: number;
    };

export interface RoomMembershipLog {
  readonly roomId: RoomLocalId;
  readonly retention: RoomMembershipLogRetention;
  append(
    event: RoomMembershipEventV1,
    storageDecision: PolicyDecision,
  ): RoomMembershipLogAppendResult;
  readAll(storageDecision: PolicyDecision): readonly RoomMembershipEventV1[];
  status(): RoomMembershipLogStatus;
  nextLocalSequence(): number;
}

function assertLogDecision(decision: PolicyDecision, scope: PolicySideEffectScope): void {
  if (!isPolicyDecision(decision))
    throw new RoomMembershipDecisionMismatchError("decision_missing");
  if (decision.verdict !== "allowed") throw new RoomMembershipPolicyDeniedError("verdict_denied");
  if (decision.capability !== ROOM_CAPABILITY || decision.sideEffect !== scope) {
    throw new RoomMembershipDecisionMismatchError();
  }
}

export class InMemoryRoomMembershipLog implements RoomMembershipLog {
  readonly roomId: RoomLocalId;
  readonly retention = "memory_only" as const;
  readonly #events: RoomMembershipEventV1[] = [];

  constructor(roomId: RoomLocalId) {
    this.roomId = roomId;
  }

  append(
    event: RoomMembershipEventV1,
    storageDecision: PolicyDecision,
  ): RoomMembershipLogAppendResult {
    assertLogDecision(storageDecision, "room.membership_log.append");
    if (event.roomId !== this.roomId)
      throw new RoomMembershipDecisionMismatchError("room_mismatch");
    if (event.localSequence !== this.#events.length + 1) {
      throw new RoomMembershipDecisionMismatchError("sequence");
    }
    this.#events.push(cloneRoomProjection(event));
    return { outcome: "appended_memory", retained: true, localSequence: event.localSequence };
  }

  readAll(storageDecision: PolicyDecision): readonly RoomMembershipEventV1[] {
    assertLogDecision(storageDecision, "room.membership_log.read");
    return this.#events.map((e) => cloneRoomProjection(e));
  }

  status(): RoomMembershipLogStatus {
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

export class NullRoomMembershipLog implements RoomMembershipLog {
  readonly roomId: RoomLocalId;
  readonly retention = "null" as const;
  #lastSequence = 0;

  constructor(roomId: RoomLocalId) {
    this.roomId = roomId;
  }

  append(
    event: RoomMembershipEventV1,
    storageDecision: PolicyDecision,
  ): RoomMembershipLogAppendResult {
    assertLogDecision(storageDecision, "room.membership_log.append");
    if (event.roomId !== this.roomId)
      throw new RoomMembershipDecisionMismatchError("room_mismatch");
    this.#lastSequence = event.localSequence;
    return {
      outcome: "discarded_by_null_policy",
      retained: false,
      localSequence: event.localSequence,
    };
  }

  readAll(storageDecision: PolicyDecision): readonly RoomMembershipEventV1[] {
    assertLogDecision(storageDecision, "room.membership_log.read");
    return [];
  }

  status(): RoomMembershipLogStatus {
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
