/**
 * RoomOS local capability taxonomy + non-authoritative descriptor (TECH-20).
 *
 * A capability descriptor is a POLICY INPUT and scope description — NOT a
 * capability token, NOT unforgeable, NOT a bearer credential. It does not
 * authorize a side effect. An operation must still carry an authentic,
 * exact-scope PolicyDecision. Descriptors are never serialized, delegated, or
 * persisted. There is NO wildcard capability.
 */

import type { RoomLocalId, RoomMemberRef } from "../room-types";
import type { RoomObjectId, RoomObjectV1 } from "../objects";
import type { RoomQueryViewClass } from "../query";
import type { RoomMembershipId, RoomMembershipRevision } from "./membership-ids";
import type { RoomMembershipRoleV1 } from "./membership-roles";

export type RoomCapabilityNameV1 =
  | "room.summary.read"
  | "room.object.list"
  | "room.object.detail.read"
  | "room.object.search_local"
  | "room.object.create"
  | "room.object.update"
  | "room.object.redact"
  | "room.object.archive"
  | "room.object.tombstone"
  | "room.membership.list_redacted"
  | "room.membership.detail_redacted"
  | "room.membership.add_placeholder"
  | "room.membership.change_role"
  | "room.membership.suspend"
  | "room.membership.reactivate"
  | "room.membership.remove_tombstone"
  | "room.policy.tighten"
  | "room.lifecycle.update"
  | "room.audit.read_redacted";

export const ROOM_CAPABILITY_NAMES: readonly RoomCapabilityNameV1[] = [
  "room.summary.read",
  "room.object.list",
  "room.object.detail.read",
  "room.object.search_local",
  "room.object.create",
  "room.object.update",
  "room.object.redact",
  "room.object.archive",
  "room.object.tombstone",
  "room.membership.list_redacted",
  "room.membership.detail_redacted",
  "room.membership.add_placeholder",
  "room.membership.change_role",
  "room.membership.suspend",
  "room.membership.reactivate",
  "room.membership.remove_tombstone",
  "room.policy.tighten",
  "room.lifecycle.update",
  "room.audit.read_redacted",
];

/**
 * A narrow, non-authoritative description of what a current local membership
 * is ELIGIBLE for. The literal fields `authoritative: false`,
 * `serialization: "forbidden"`, `delegation: "not_implemented"`, and
 * `persistence: "forbidden"` are structural reminders — the descriptor is
 * never a credential.
 */
export interface RoomLocalCapabilityDescriptorV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly memberRef: RoomMemberRef;
  readonly membershipId: RoomMembershipId;
  readonly membershipRevision: RoomMembershipRevision;
  readonly capability: RoomCapabilityNameV1;
  readonly objectKinds?: readonly RoomObjectV1["kind"][];
  readonly exactObjectId?: RoomObjectId;
  readonly maximumView?: RoomQueryViewClass;
  readonly sourceRole: RoomMembershipRoleV1;
  readonly authoritative: false;
  readonly serialization: "forbidden";
  readonly delegation: "not_implemented";
  readonly persistence: "forbidden";
}
