/**
 * Explicit role capability-SET comparison + membership-change direction
 * (TECH-21). Authority is compared by actual capability SETS, not role names —
 * incomparable transitions deny unless explicitly designed. No wildcard; no
 * implicit hierarchy. Auditor is not automatically above/below viewer.
 */

import {
  ROLE_CAPABILITY_ELIGIBILITY,
  type RoomCapabilityNameV1,
  type RoomMembershipCommandV1,
  type RoomMembershipRecordV1,
  type RoomMembershipRoleV1,
} from "../membership";

export function getRoleCapabilitiesV1(
  role: RoomMembershipRoleV1,
): ReadonlySet<RoomCapabilityNameV1> {
  return new Set(ROLE_CAPABILITY_ELIGIBILITY[role]);
}

function isSubset(
  a: ReadonlySet<RoomCapabilityNameV1>,
  b: ReadonlySet<RoomCapabilityNameV1>,
): boolean {
  for (const c of a) if (!b.has(c)) return false;
  return true;
}

/** Compare authority by capability SET containment (name-agnostic). */
export function compareRoleAuthorityV1(
  from: RoomMembershipRoleV1,
  to: RoomMembershipRoleV1,
): "narrower" | "wider" | "equal" | "incomparable" {
  const a = getRoleCapabilitiesV1(from);
  const b = getRoleCapabilitiesV1(to);
  const aSubB = isSubset(a, b);
  const bSubA = isSubset(b, a);
  if (aSubB && bSubA) return "equal";
  if (bSubA) return "narrower"; // to ⊂ from → moving to `to` is narrower
  if (aSubB) return "wider"; // from ⊂ to → moving to `to` is wider
  return "incomparable";
}

export type MembershipChangeDirectionV1 = "restrictive" | "expansive" | "neutral" | "unknown";

/**
 * Classify a membership command's direction against the current record.
 * Restrictive = strictly reduces authority (suspend/remove/downgrade).
 * Expansive = restores/adds authority (reactivate/add/elevate). Incomparable
 * role changes are `unknown` → callers must deny unless explicitly designed.
 */
export function classifyMembershipChangeDirectionV1(
  command: RoomMembershipCommandV1,
  current?: RoomMembershipRecordV1,
): MembershipChangeDirectionV1 {
  switch (command.command) {
    case "membership.bootstrap_local_owner_placeholder":
    case "membership.add_local_placeholder":
      return "expansive";
    case "membership.suspend_local":
      return "restrictive";
    case "membership.remove_tombstone":
      return "restrictive";
    case "membership.reactivate_local":
      return "expansive";
    case "membership.change_role": {
      if (current === undefined) return "unknown";
      const dir = compareRoleAuthorityV1(current.role, command.newRole);
      if (dir === "narrower") return "restrictive";
      if (dir === "wider") return "expansive";
      if (dir === "equal") return "neutral";
      return "unknown"; // incomparable → deny unless explicitly designed
    }
    default:
      return "unknown";
  }
}
