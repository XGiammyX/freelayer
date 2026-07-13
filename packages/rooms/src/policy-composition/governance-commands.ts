/**
 * Explicit room governance commands (TECH-22). TIGHTEN-ONLY: there is no
 * loosen / reset / enable-forbidden-feature / lower-device-posture /
 * disable-protection / vote command, no generic patch, no arbitrary property
 * path, no caller-supplied full-policy replacement. The validator rejects
 * unknown commands/fields, prototype-pollution keys, and unsupported versions.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLocalId } from "../room-types";
import { assertNoDangerousKeys, assertOnlyKeys, isPlainRecord } from "../objects";
import type { RoomMembershipId } from "../membership";
import { validateRoomMembershipId } from "../membership";
import { compositionFail } from "./policy-composition-errors";
import { MINIMUM_DEVICE_POSTURES, type MinimumDevicePostureV1 } from "./device-posture";
import {
  PROTECTED_CONTENT_REQUIREMENTS,
  type ProtectedContentRequirementV1,
} from "./protected-content";
import {
  ROOM_SENSITIVITIES,
  type RoomPolicyDocumentV1,
  type RoomPolicyRevision,
  type RoomSensitivityV1,
} from "./room-policy-document";

export type RoomGovernanceCommandName =
  | "room.policy.tighten"
  | "room.policy.increase_minimum_device_posture"
  | "room.policy.increase_sensitivity"
  | "room.policy.strengthen_protected_content"
  | "room.policy.disable_feature";

/** Toggleable room features (can only be turned OFF). */
export type RoomDisableableFeatureV1 =
  | "receipts"
  | "typing"
  | "presence"
  | "exact_counts"
  | "exact_timestamps"
  | "actor_refs"
  | "notifications"
  | "local_ai"
  | "network"
  | "direct_peer";

export const ROOM_DISABLEABLE_FEATURES: readonly RoomDisableableFeatureV1[] = [
  "receipts",
  "typing",
  "presence",
  "exact_counts",
  "exact_timestamps",
  "actor_refs",
  "notifications",
  "local_ai",
  "network",
  "direct_peer",
];

export interface RoomGovernanceCommandBaseV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly actorMembershipId: RoomMembershipId;
  readonly expectedPolicyRevision: RoomPolicyRevision;
  readonly mode: PrivacyMode;
  readonly reason: string;
}

export interface TightenRoomPolicyCommandV1 extends RoomGovernanceCommandBaseV1 {
  readonly command: "room.policy.tighten";
  readonly disableFeatures: readonly RoomDisableableFeatureV1[];
}
export interface IncreaseMinimumDevicePostureCommandV1 extends RoomGovernanceCommandBaseV1 {
  readonly command: "room.policy.increase_minimum_device_posture";
  readonly newMinimum: MinimumDevicePostureV1;
}
export interface IncreaseRoomSensitivityCommandV1 extends RoomGovernanceCommandBaseV1 {
  readonly command: "room.policy.increase_sensitivity";
  readonly newSensitivity: RoomSensitivityV1;
}
export interface StrengthenProtectedContentRequirementCommandV1 extends RoomGovernanceCommandBaseV1 {
  readonly command: "room.policy.strengthen_protected_content";
  readonly newRequirement: ProtectedContentRequirementV1;
}
export interface DisableRoomFeatureCommandV1 extends RoomGovernanceCommandBaseV1 {
  readonly command: "room.policy.disable_feature";
  readonly feature: RoomDisableableFeatureV1;
}

export type RoomGovernanceCommandV1 =
  | TightenRoomPolicyCommandV1
  | IncreaseMinimumDevicePostureCommandV1
  | IncreaseRoomSensitivityCommandV1
  | StrengthenProtectedContentRequirementCommandV1
  | DisableRoomFeatureCommandV1;

export const ROOM_GOVERNANCE_COMMAND_NAMES: readonly RoomGovernanceCommandName[] = [
  "room.policy.tighten",
  "room.policy.increase_minimum_device_posture",
  "room.policy.increase_sensitivity",
  "room.policy.strengthen_protected_content",
  "room.policy.disable_feature",
];

const REASON_RE = /^[a-z0-9_.:-]{1,64}$/;
const BASE_KEYS = [
  "schemaVersion",
  "command",
  "roomId",
  "actorMembershipId",
  "expectedPolicyRevision",
  "mode",
  "reason",
] as const;

function requireRevision(input: Record<string, unknown>): RoomPolicyRevision {
  const v = input["expectedPolicyRevision"];
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 1) compositionFail("invalid_field");
  return v as RoomPolicyRevision;
}

function requireFeatures(value: unknown): readonly RoomDisableableFeatureV1[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > ROOM_DISABLEABLE_FEATURES.length
  ) {
    compositionFail("invalid_field");
  }
  const seen = new Set<string>();
  const out: RoomDisableableFeatureV1[] = [];
  for (const v of value) {
    if (
      typeof v !== "string" ||
      !ROOM_DISABLEABLE_FEATURES.includes(v as RoomDisableableFeatureV1)
    ) {
      compositionFail("unknown_policy_input");
    }
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v as RoomDisableableFeatureV1);
    }
  }
  return Object.freeze(out);
}

export function validateRoomGovernanceCommandV1(input: unknown): RoomGovernanceCommandV1 {
  if (!isPlainRecord(input)) compositionFail("invalid_field");
  assertNoDangerousKeys(input);
  if (input["schemaVersion"] !== 1) compositionFail("unsupported_schema_version");
  const command = input["command"];
  if (typeof command !== "string" || !ROOM_GOVERNANCE_COMMAND_NAMES.includes(command as never)) {
    compositionFail("unknown_command");
  }
  if (typeof input["roomId"] !== "string") compositionFail("room_mismatch");
  const roomId = input["roomId"] as RoomLocalId;
  const actorMembershipId = validateRoomMembershipId(input["actorMembershipId"] as string);
  if (typeof input["mode"] !== "string") compositionFail("invalid_field");
  const mode = input["mode"] as PrivacyMode;
  if (typeof input["reason"] !== "string" || !REASON_RE.test(input["reason"]))
    compositionFail("invalid_field");
  const base = {
    schemaVersion: 1 as const,
    roomId,
    actorMembershipId,
    expectedPolicyRevision: requireRevision(input),
    mode,
    reason: input["reason"],
  };
  const name = command as RoomGovernanceCommandName;
  switch (name) {
    case "room.policy.tighten":
      assertOnlyKeys(input, [...BASE_KEYS, "disableFeatures"]);
      return { ...base, command: name, disableFeatures: requireFeatures(input["disableFeatures"]) };
    case "room.policy.increase_minimum_device_posture":
      assertOnlyKeys(input, [...BASE_KEYS, "newMinimum"]);
      if (!MINIMUM_DEVICE_POSTURES.includes(input["newMinimum"] as MinimumDevicePostureV1)) {
        compositionFail("unknown_policy_input");
      }
      return { ...base, command: name, newMinimum: input["newMinimum"] as MinimumDevicePostureV1 };
    case "room.policy.increase_sensitivity":
      assertOnlyKeys(input, [...BASE_KEYS, "newSensitivity"]);
      if (!ROOM_SENSITIVITIES.includes(input["newSensitivity"] as RoomSensitivityV1)) {
        compositionFail("unknown_policy_input");
      }
      return {
        ...base,
        command: name,
        newSensitivity: input["newSensitivity"] as RoomSensitivityV1,
      };
    case "room.policy.strengthen_protected_content":
      assertOnlyKeys(input, [...BASE_KEYS, "newRequirement"]);
      if (
        !PROTECTED_CONTENT_REQUIREMENTS.includes(
          input["newRequirement"] as ProtectedContentRequirementV1,
        )
      ) {
        compositionFail("unknown_policy_input");
      }
      return {
        ...base,
        command: name,
        newRequirement: input["newRequirement"] as ProtectedContentRequirementV1,
      };
    case "room.policy.disable_feature": {
      assertOnlyKeys(input, [...BASE_KEYS, "feature"]);
      const feature = input["feature"];
      if (
        typeof feature !== "string" ||
        !ROOM_DISABLEABLE_FEATURES.includes(feature as RoomDisableableFeatureV1)
      ) {
        compositionFail("unknown_policy_input");
      }
      return { ...base, command: name, feature: feature as RoomDisableableFeatureV1 };
    }
    default: {
      const unreachable: never = name;
      compositionFail("unknown_command", String(unreachable));
    }
  }
}

/** Apply a disableable-feature toggle to a policy document (turn OFF only). */
function withFeatureDisabled(
  policy: RoomPolicyDocumentV1,
  feature: RoomDisableableFeatureV1,
): RoomPolicyDocumentV1 {
  switch (feature) {
    case "receipts":
      return { ...policy, metadata: { ...policy.metadata, receiptsAllowed: false } };
    case "typing":
      return { ...policy, metadata: { ...policy.metadata, typingAllowed: false } };
    case "presence":
      return { ...policy, metadata: { ...policy.metadata, presenceAllowed: false } };
    case "exact_counts":
      return { ...policy, metadata: { ...policy.metadata, exactCountsAllowed: false } };
    case "exact_timestamps":
      return { ...policy, metadata: { ...policy.metadata, exactTimestampsAllowed: false } };
    case "actor_refs":
      return { ...policy, metadata: { ...policy.metadata, actorRefsAllowed: false } };
    case "notifications":
      return { ...policy, notifications: { ...policy.notifications, notificationAllowed: false } };
    case "local_ai":
      return { ...policy, ai: { ...policy.ai, localAiAllowed: false } };
    case "network":
      return { ...policy, network: { ...policy.network, networkAllowed: false } };
    case "direct_peer":
      return { ...policy, network: { ...policy.network, directPeerAllowed: false } };
    default: {
      const unreachable: never = feature;
      compositionFail("unknown_policy_input", String(unreachable));
    }
  }
}

/**
 * Build the CANDIDATE policy by applying a validated tightening command. The
 * revision is bumped; monotonic comparison is enforced by the pipeline.
 */
export function buildCandidateRoomPolicyV1(
  current: RoomPolicyDocumentV1,
  command: RoomGovernanceCommandV1,
): RoomPolicyDocumentV1 {
  const nextRevision = ((current.revision as number) + 1) as RoomPolicyRevision;
  const withRev = (p: RoomPolicyDocumentV1): RoomPolicyDocumentV1 => ({
    ...p,
    revision: nextRevision,
  });
  switch (command.command) {
    case "room.policy.tighten": {
      let p = current;
      for (const f of command.disableFeatures) p = withFeatureDisabled(p, f);
      return withRev(p);
    }
    case "room.policy.increase_minimum_device_posture":
      return withRev({ ...current, minimumDevicePosture: command.newMinimum });
    case "room.policy.increase_sensitivity":
      return withRev({ ...current, sensitivity: command.newSensitivity });
    case "room.policy.strengthen_protected_content":
      return withRev({ ...current, protectedContentRequirement: command.newRequirement });
    case "room.policy.disable_feature":
      return withRev(withFeatureDisabled(current, command.feature));
    default: {
      const unreachable: never = command;
      compositionFail("unknown_command", String(unreachable));
    }
  }
}
