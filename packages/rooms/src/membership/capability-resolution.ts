/**
 * RoomOS local capability resolution (TECH-20). Default-deny, side-effect-free.
 * Role eligibility is NECESSARY but never SUFFICIENT: the current membership
 * must be active, privacy mode + room policy can only TIGHTEN, and the result
 * is a NON-AUTHORITATIVE descriptor — it authorizes nothing on its own. No
 * logs, no cache, no persistence. Endpoint/device-risk can tighten, never grant.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomPolicy } from "../room-policy";
import type { RoomObjectId, RoomObjectV1 } from "../objects";
import type { RoomQueryViewClass } from "../query";
import { roleIsEligibleFor } from "./membership-roles";
import type { RoomCapabilityNameV1, RoomLocalCapabilityDescriptorV1 } from "./capability-types";
import { ROOM_CAPABILITY_NAMES } from "./capability-types";
import type { RoomMembershipRecordV1 } from "./membership-types";

export interface RoomCapabilityResolutionInputV1 {
  readonly membership: RoomMembershipRecordV1;
  readonly requestedCapability: RoomCapabilityNameV1;
  readonly mode: PrivacyMode;
  readonly roomPolicy: RoomPolicy;
  readonly objectKind?: RoomObjectV1["kind"];
  readonly objectId?: RoomObjectId;
  readonly requestedView?: RoomQueryViewClass;
  readonly deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
}

export type RoomCapabilityResolutionV1 =
  | {
      readonly allowed: true;
      readonly descriptor: RoomLocalCapabilityDescriptorV1;
      readonly reasonCode: string;
    }
  | { readonly allowed: false; readonly reasonCode: string };

const MUTATION_CAPS: readonly RoomCapabilityNameV1[] = [
  "room.object.create",
  "room.object.update",
  "room.object.redact",
  "room.object.archive",
  "room.object.tombstone",
];
const MEMBERSHIP_MGMT_CAPS: readonly RoomCapabilityNameV1[] = [
  "room.membership.add_placeholder",
  "room.membership.change_role",
  "room.membership.suspend",
  "room.membership.reactivate",
  "room.membership.remove_tombstone",
];
const ADMIN_CAPS: readonly RoomCapabilityNameV1[] = [
  "room.policy.tighten",
  "room.lifecycle.update",
];
/** Capabilities that survive Bunker (redacted, read-only, no content detail). */
const BUNKER_CAPS: readonly RoomCapabilityNameV1[] = [
  "room.summary.read",
  "room.object.list",
  "room.membership.list_redacted",
  "room.membership.detail_redacted",
  "room.audit.read_redacted",
];

function isMutation(cap: RoomCapabilityNameV1): boolean {
  return (
    MUTATION_CAPS.includes(cap) || MEMBERSHIP_MGMT_CAPS.includes(cap) || ADMIN_CAPS.includes(cap)
  );
}

export function resolveRoomLocalCapabilityV1(
  input: RoomCapabilityResolutionInputV1,
): RoomCapabilityResolutionV1 {
  const { membership, requestedCapability: cap, mode, roomPolicy } = input;

  // Unknown capability → deny.
  if (!ROOM_CAPABILITY_NAMES.includes(cap))
    return { allowed: false, reasonCode: "unknown_capability" };

  // Membership must be current and active.
  if (membership.state !== "active_local_unverified") {
    return { allowed: false, reasonCode: "membership_not_active" };
  }

  // Role eligibility (necessary, not sufficient).
  if (!roleIsEligibleFor(membership.role, cap)) {
    return { allowed: false, reasonCode: "role_not_eligible" };
  }

  // Privacy-mode tightening.
  if (mode === "emergency") return { allowed: false, reasonCode: "emergency_mode" };
  if (mode === "bunker" && !BUNKER_CAPS.includes(cap)) {
    return { allowed: false, reasonCode: "strict_mode" };
  }
  if ((mode === "ghost" || mode === "private") && cap === "room.audit.read_redacted") {
    // Redacted audit read is allowed; nothing extra to tighten here.
  }

  // Room policy can only tighten: content mutations require the room flag.
  if (isMutation(cap) && !roomPolicy.allowLocalContentMutation) {
    return { allowed: false, reasonCode: "room_policy_stricter" };
  }

  // Device-risk placeholder TIGHTENS only (never grants). Critical risk drops
  // mutation/management/admin capabilities. This is NOT a safety attestation.
  if (input.deviceRiskLevel === "critical" && isMutation(cap)) {
    return { allowed: false, reasonCode: "device_risk_tighten" };
  }

  const descriptor: RoomLocalCapabilityDescriptorV1 = {
    schemaVersion: 1,
    roomId: membership.roomId,
    memberRef: membership.memberRef,
    membershipId: membership.membershipId,
    membershipRevision: membership.revision,
    capability: cap,
    sourceRole: membership.role,
    authoritative: false,
    serialization: "forbidden",
    delegation: "not_implemented",
    persistence: "forbidden",
    ...(input.objectKind !== undefined ? { objectKinds: Object.freeze([input.objectKind]) } : {}),
    ...(input.objectId !== undefined ? { exactObjectId: input.objectId } : {}),
    ...(input.requestedView !== undefined ? { maximumView: input.requestedView } : {}),
  };
  return { allowed: true, descriptor: Object.freeze(descriptor), reasonCode: "default_deny" };
}
