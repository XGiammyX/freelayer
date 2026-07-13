/**
 * RoomOS placeholder role model + role→capability ELIGIBILITY table (TECH-20).
 *
 * Roles are conservative placeholders — NOT admin/superadmin/root/wildcard,
 * NOT verified/authenticated. A role is ONE attribute in ABAC; role eligibility
 * is NECESSARY but never SUFFICIENT — privacy mode, room policy, membership
 * state, and an authentic exact-scope PolicyDecision all still apply. The table
 * is explicit (no scattered `if (role === ...)` authorization checks).
 */

import { ROOM_CAPABILITY_NAMES, type RoomCapabilityNameV1 } from "./capability-types";

export type RoomMembershipRoleV1 =
  "owner_placeholder" | "editor_placeholder" | "viewer_placeholder" | "auditor_placeholder";

export const ROOM_MEMBERSHIP_ROLES: readonly RoomMembershipRoleV1[] = [
  "owner_placeholder",
  "editor_placeholder",
  "viewer_placeholder",
  "auditor_placeholder",
];

const EDITOR_CAPS: readonly RoomCapabilityNameV1[] = [
  "room.summary.read",
  "room.object.list",
  "room.object.detail.read",
  "room.object.search_local",
  "room.object.create",
  "room.object.update",
  "room.object.redact",
  "room.object.archive",
  "room.object.tombstone",
];

const VIEWER_CAPS: readonly RoomCapabilityNameV1[] = [
  "room.summary.read",
  "room.object.list",
  "room.object.detail.read",
];

const AUDITOR_CAPS: readonly RoomCapabilityNameV1[] = [
  "room.summary.read",
  "room.object.list",
  "room.membership.list_redacted",
  "room.membership.detail_redacted",
  "room.audit.read_redacted",
];

/** Owner placeholder is eligible for ALL defined capabilities (still policy-gated). */
const OWNER_CAPS: readonly RoomCapabilityNameV1[] = ROOM_CAPABILITY_NAMES;

export const ROLE_CAPABILITY_ELIGIBILITY: Readonly<
  Record<RoomMembershipRoleV1, readonly RoomCapabilityNameV1[]>
> = {
  owner_placeholder: OWNER_CAPS,
  editor_placeholder: EDITOR_CAPS,
  viewer_placeholder: VIEWER_CAPS,
  auditor_placeholder: AUDITOR_CAPS,
};

/** Whether a role is ELIGIBLE (necessary, not sufficient) for a capability. */
export function roleIsEligibleFor(
  role: RoomMembershipRoleV1,
  capability: RoomCapabilityNameV1,
): boolean {
  return ROLE_CAPABILITY_ELIGIBILITY[role].includes(capability);
}
