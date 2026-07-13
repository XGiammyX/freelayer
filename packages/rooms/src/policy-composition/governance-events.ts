/**
 * Room governance events (TECH-22). Versioned, local, unsigned, unencrypted.
 * Payloads carry only non-sensitive field codes + previous/resulting enum
 * values + revisions — never device details, posture evidence, provider IDs,
 * room title, member ref, user reason, or object content.
 */

import type { RoomLocalId } from "../room-types";
import type { RoomLocalClock } from "../room-event-v1";
import type { RoomMembershipId } from "../membership";
import type { RoomGovernanceCommandName, RoomGovernanceCommandV1 } from "./governance-commands";
import type { RoomPolicyDocumentV1, RoomPolicyRevision } from "./room-policy-document";

export type RoomGovernanceEventOperation =
  | "room.policy.tightened.v1"
  | "room.policy.minimum_posture_increased.v1"
  | "room.policy.sensitivity_increased.v1"
  | "room.policy.protected_content_strengthened.v1"
  | "room.policy.feature_disabled.v1";

const COMMAND_TO_EVENT: Readonly<Record<RoomGovernanceCommandName, RoomGovernanceEventOperation>> =
  {
    "room.policy.tighten": "room.policy.tightened.v1",
    "room.policy.increase_minimum_device_posture": "room.policy.minimum_posture_increased.v1",
    "room.policy.increase_sensitivity": "room.policy.sensitivity_increased.v1",
    "room.policy.strengthen_protected_content": "room.policy.protected_content_strengthened.v1",
    "room.policy.disable_feature": "room.policy.feature_disabled.v1",
  };

export function governanceCommandToEventOperation(
  command: RoomGovernanceCommandName,
): RoomGovernanceEventOperation {
  return COMMAND_TO_EVENT[command];
}

export interface RoomGovernanceEventV1 {
  readonly schemaVersion: 1;
  readonly projectionVersion: 1;
  readonly governanceEventId: string;
  readonly roomId: RoomLocalId;
  readonly actorMembershipId: RoomMembershipId;
  readonly operation: RoomGovernanceEventOperation;
  readonly localSequence: number;
  readonly createdAtLocal: string;
  readonly previousRevision: RoomPolicyRevision;
  readonly resultingRevision: RoomPolicyRevision;
  /** Non-sensitive code for the changed field/feature. */
  readonly changedFieldCode: string;
  /** The resulting policy document (local, unsigned). */
  readonly resultingPolicy: RoomPolicyDocumentV1;
}

function changedFieldCode(command: RoomGovernanceCommandV1): string {
  switch (command.command) {
    case "room.policy.tighten":
      return `disable:${command.disableFeatures.join("+")}`;
    case "room.policy.increase_minimum_device_posture":
      return `min_posture:${command.newMinimum}`;
    case "room.policy.increase_sensitivity":
      return `sensitivity:${command.newSensitivity}`;
    case "room.policy.strengthen_protected_content":
      return `protected:${command.newRequirement}`;
    case "room.policy.disable_feature":
      return `disable:${command.feature}`;
    default:
      return "unknown";
  }
}

export function createAcceptedRoomGovernanceEventV1(input: {
  command: RoomGovernanceCommandV1;
  previous: RoomPolicyDocumentV1;
  resulting: RoomPolicyDocumentV1;
  governanceEventId: string;
  localSequence: number;
  clock: RoomLocalClock;
}): RoomGovernanceEventV1 {
  const now = input.clock.nowLocalIso();
  const createdAtLocal = now.startsWith("local:") ? now : `local:${now}`;
  return Object.freeze<RoomGovernanceEventV1>({
    schemaVersion: 1,
    projectionVersion: 1,
    governanceEventId: input.governanceEventId,
    roomId: input.resulting.roomId,
    actorMembershipId: input.command.actorMembershipId,
    operation: governanceCommandToEventOperation(input.command.command),
    localSequence: input.localSequence,
    createdAtLocal,
    previousRevision: input.previous.revision,
    resultingRevision: input.resulting.revision,
    changedFieldCode: changedFieldCode(input.command),
    resultingPolicy: input.resulting,
  });
}
