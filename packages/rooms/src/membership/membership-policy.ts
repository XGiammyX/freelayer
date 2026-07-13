/**
 * RoomOS membership policy (TECH-20). Deny-by-default; strictest policy wins;
 * room policy tightens the device mode but never loosens it. Membership is
 * never persistently stored; no network/notification; identity verification is
 * never available; endpoint integration can never be "active".
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomPolicy } from "../room-policy";
import type { RoomMembershipCommandName } from "./membership-commands";
import type { RoomMembershipRoleV1 } from "./membership-roles";
import type { RoomMembershipStateV1 } from "./membership-types";

export interface RoomMembershipPolicyV1 {
  readonly mode: PrivacyMode;
  readonly command: RoomMembershipCommandName;
  readonly allowed: boolean;
  readonly relationshipMetadataAllowed: boolean;
  readonly persistentMembershipAllowed: false;
  readonly operationLogRetention: "memory_only" | "null";
  readonly projectionRetention: "memory_only" | "null";
  readonly membershipListAllowed: boolean;
  readonly membershipCountAllowed: boolean;
  readonly auditAllowed: boolean;
  readonly networkAllowed: false;
  readonly notificationAllowed: false;
  readonly identityVerificationAvailable: false;
  readonly endpointIntegration: "externalized" | "not_integrated" | "hook_only";
  readonly reasonCode: string;
}

/** Restrictive/safety-direction commands survive strict modes. */
const RESTRICTIVE: readonly RoomMembershipCommandName[] = [
  "membership.suspend_local",
  "membership.remove_tombstone",
];
const EXPANSION: readonly RoomMembershipCommandName[] = [
  "membership.add_local_placeholder",
  "membership.reactivate_local",
  "membership.change_role",
];

export function resolveRoomMembershipPolicyV1(input: {
  mode: PrivacyMode;
  command: RoomMembershipCommandName;
  currentRole?: RoomMembershipRoleV1;
  targetRole?: RoomMembershipRoleV1;
  roomPolicy: RoomPolicy;
  membershipState?: RoomMembershipStateV1;
  activeOwnerCount?: number;
  deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
}): RoomMembershipPolicyV1 {
  const { mode, command, roomPolicy } = input;
  const restrictive = RESTRICTIVE.includes(command);
  const expansion = EXPANSION.includes(command);
  const strict = mode === "ghost" || mode === "bunker";

  const base: RoomMembershipPolicyV1 = {
    mode,
    command,
    allowed: true,
    relationshipMetadataAllowed:
      mode === "standard" || mode === "offline_capsule" || mode === "sovereign_room",
    persistentMembershipAllowed: false,
    operationLogRetention: strict ? "null" : "memory_only",
    projectionRetention: "memory_only",
    membershipListAllowed: mode !== "bunker" && mode !== "emergency",
    membershipCountAllowed:
      mode === "standard" || mode === "offline_capsule" || mode === "sovereign_room",
    auditAllowed: true,
    networkAllowed: false,
    notificationAllowed: false,
    identityVerificationAvailable: false,
    endpointIntegration: "externalized",
    reasonCode: "default_deny",
  };

  const deny = (reasonCode: string): RoomMembershipPolicyV1 => ({
    ...base,
    allowed: false,
    relationshipMetadataAllowed: false,
    membershipListAllowed: false,
    membershipCountAllowed: false,
    auditAllowed: restrictive,
    reasonCode,
  });

  // Room policy denies content mutation → deny expansion commands.
  if (expansion && !roomPolicy.allowLocalContentMutation) {
    return deny("room_policy_stricter");
  }

  switch (mode) {
    case "emergency":
      // Only restrictive suspend/remove, and only if policy explicitly permits
      // (room policy allowLocalContentMutation is false in emergency by default).
      return restrictive
        ? {
            ...base,
            relationshipMetadataAllowed: false,
            membershipListAllowed: false,
            membershipCountAllowed: false,
            reasonCode: "emergency_mode",
          }
        : deny("emergency_mode");

    case "bunker":
      // Bootstrap during creation + restrictive ops only; expansion/list/count denied.
      if (command === "membership.bootstrap_local_owner_placeholder" || restrictive) {
        return {
          ...base,
          relationshipMetadataAllowed: false,
          membershipListAllowed: false,
          membershipCountAllowed: false,
          reasonCode: "strict_mode",
        };
      }
      return deny("strict_mode");

    case "ghost":
      return { ...base, reasonCode: "strict_mode" };

    case "private":
      return { ...base, membershipCountAllowed: false, reasonCode: "default_deny" };

    case "offline_capsule":
      return { ...base, reasonCode: "offline_capsule_mode" };

    case "standard":
    case "sovereign_room":
      return { ...base, reasonCode: "default_deny" };

    default:
      return deny("unknown_input");
  }
}
