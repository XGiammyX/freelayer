/**
 * Local room governance update pipeline (TECH-22). TIGHTEN-ONLY: validate →
 * load actor → check policy revision → verify governance capability + execution-
 * time authorization revalidation → compose current policy → build candidate →
 * monotonic comparison (only `stricter` succeeds; equal/looser/incomparable/
 * unknown deny) → versioned event → SEPARATE storage decision → memory/null log
 * → pure policy reducer. No partial effects on failure. Local, unsigned.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
} from "@freelayer/privacy";
import { cloneRoomProjection } from "../room-event-v1";
import type { RoomLocalClock, RoomEventId, RoomLocalSequence } from "../room-event-v1";
import { ROOM_CAPABILITY, type RoomPolicy } from "../room-policy";
import type { RoomMaterializedState } from "../room-state";
import type { PreparedRoomAuthorizationV1 } from "../authorization";
import { assertPreparedRoomAuthorizationCurrentV1 } from "../authorization";
import type { EffectiveDevicePostureV1 } from "./device-posture";
import {
  RoomGovernanceDeniedError,
  RoomGovernanceLoosenError,
  RoomPolicyCompositionError,
  RoomGovernancePolicyRevisionMismatchError,
} from "./policy-composition-errors";
import {
  buildCandidateRoomPolicyV1,
  validateRoomGovernanceCommandV1,
  type RoomGovernanceCommandV1,
} from "./governance-commands";
import { compareRoomPoliciesV1 } from "./policy-comparison";
import {
  createAcceptedRoomGovernanceEventV1,
  type RoomGovernanceEventV1,
} from "./governance-events";
import type { RoomPolicyDocumentV1, RoomPolicyRevision } from "./room-policy-document";

// ---------------------------------------------------------------------------
// Governance event log (memory/null) — separate storage decision required.
// ---------------------------------------------------------------------------

export interface RoomGovernanceLog {
  readonly retention: "memory_only" | "null";
  append(
    event: RoomGovernanceEventV1,
    storageDecision: PolicyDecision,
  ): { retained: boolean; localSequence: number };
  nextLocalSequence(): number;
}

function assertLogDecision(decision: PolicyDecision, scope: PolicySideEffectScope): void {
  if (!isPolicyDecision(decision)) throw new RoomGovernanceDeniedError("decision_missing");
  if (decision.verdict !== "allowed") throw new RoomGovernanceDeniedError("verdict_denied");
  if (decision.capability !== ROOM_CAPABILITY || decision.sideEffect !== scope) {
    throw new RoomGovernanceDeniedError("decision_mismatch");
  }
}

export class InMemoryRoomGovernanceLog implements RoomGovernanceLog {
  readonly retention = "memory_only" as const;
  readonly #events: RoomGovernanceEventV1[] = [];
  append(event: RoomGovernanceEventV1, storageDecision: PolicyDecision) {
    assertLogDecision(storageDecision, "room.governance_log.append");
    this.#events.push(cloneRoomProjection(event));
    return { retained: true, localSequence: event.localSequence };
  }
  nextLocalSequence(): number {
    return this.#events.length + 1;
  }
  get count(): number {
    return this.#events.length;
  }
}

export class NullRoomGovernanceLog implements RoomGovernanceLog {
  readonly retention = "null" as const;
  #last = 0;
  append(event: RoomGovernanceEventV1, storageDecision: PolicyDecision) {
    assertLogDecision(storageDecision, "room.governance_log.append");
    this.#last = event.localSequence;
    return { retained: false, localSequence: event.localSequence };
  }
  nextLocalSequence(): number {
    return this.#last + 1;
  }
}

// ---------------------------------------------------------------------------
// Pure policy reducer
// ---------------------------------------------------------------------------

export function reduceRoomGovernanceEventV1(
  current: RoomPolicyDocumentV1,
  event: RoomGovernanceEventV1,
): RoomPolicyDocumentV1 {
  if ((current.revision as number) !== (event.previousRevision as number)) {
    throw new RoomGovernancePolicyRevisionMismatchError();
  }
  if (current.roomId !== event.roomId) throw new RoomPolicyCompositionError("room_mismatch");
  return cloneRoomProjection(event.resultingPolicy);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface ApplyRoomGovernanceUpdateResultV1 {
  readonly event: RoomGovernanceEventV1;
  readonly nextState: RoomMaterializedState;
  readonly nextRoomPolicy: RoomPolicyDocumentV1;
  readonly previousRevision: RoomPolicyRevision;
  readonly resultingRevision: RoomPolicyRevision;
  readonly retained: "memory" | "null";
}

export function applyLocalRoomGovernanceUpdateV1(input: {
  roomState: RoomMaterializedState;
  currentPolicy: RoomPolicyDocumentV1;
  command: unknown;
  preparedAuthorization: PreparedRoomAuthorizationV1;
  decision: PolicyDecision;
  storageDecision: PolicyDecision;
  roomPolicy: RoomPolicy;
  effectiveDevicePosture: EffectiveDevicePostureV1;
  eventId: RoomEventId;
  localSequence: RoomLocalSequence;
  clock: RoomLocalClock;
  operationLog: RoomGovernanceLog;
  currentDevicePostureSignal?: import("./device-posture").DevicePostureSignalV1;
}): ApplyRoomGovernanceUpdateResultV1 {
  const { roomState, currentPolicy, roomPolicy } = input;

  // 1. Validate command. 2. Load actor. 3. Current policy revision.
  const command: RoomGovernanceCommandV1 = validateRoomGovernanceCommandV1(input.command);
  if (command.roomId !== roomState.roomId) throw new RoomPolicyCompositionError("room_mismatch");
  const actor = (roomState.membershipRecords ?? []).find(
    (r) => r.membershipId === command.actorMembershipId,
  );
  if (actor === undefined) throw new RoomGovernanceDeniedError("actor_not_found");
  if ((command.expectedPolicyRevision as number) !== (currentPolicy.revision as number)) {
    throw new RoomGovernancePolicyRevisionMismatchError();
  }

  // 4-7. Governance capability + execution-time authorization revalidation.
  assertPreparedRoomAuthorizationCurrentV1({
    prepared: input.preparedAuthorization,
    currentRoomState: roomState,
    currentMembership: actor,
    currentRoomPolicy: roomPolicy,
    decision: input.decision,
    actualRequiredCapability: "room.policy.tighten",
    actualSideEffect: "room.governance.update",
    ...(input.currentDevicePostureSignal !== undefined
      ? { currentDevicePostureSignal: input.currentDevicePostureSignal }
      : {}),
  });

  // 8. Build candidate. 9-10. Monotonic comparison (only `stricter` succeeds).
  const candidate = buildCandidateRoomPolicyV1(currentPolicy, command);
  const direction = compareRoomPoliciesV1({ current: currentPolicy, candidate });
  if (direction !== "stricter") {
    throw new RoomGovernanceLoosenError(direction);
  }

  // 11. Dry-run reducer. 12. Event.
  const event = createAcceptedRoomGovernanceEventV1({
    command,
    previous: currentPolicy,
    resulting: candidate,
    governanceEventId: input.eventId as unknown as string,
    localSequence: input.operationLog.nextLocalSequence(),
    clock: input.clock,
  });
  reduceRoomGovernanceEventV1(currentPolicy, event); // dry-run (throws on mismatch)

  // 13-15. Separate storage decision → append to memory/null log.
  const append = input.operationLog.append(event, input.storageDecision);

  // 16. Apply pure reducer → next policy + state.
  const nextRoomPolicy = reduceRoomGovernanceEventV1(currentPolicy, event);
  const nextState: RoomMaterializedState = {
    ...roomState,
    policyDocument: nextRoomPolicy,
    policyRevision: nextRoomPolicy.revision as number,
  };

  return {
    event,
    nextState,
    nextRoomPolicy,
    previousRevision: currentPolicy.revision,
    resultingRevision: nextRoomPolicy.revision,
    retained: append.retained ? "memory" : "null",
  };
}
