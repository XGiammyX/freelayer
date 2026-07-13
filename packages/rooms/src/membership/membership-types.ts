/**
 * RoomOS membership record v1 + lifecycle (TECH-20).
 *
 * A membership is ONE local, UNVERIFIED room-member relationship (relationship
 * metadata). It carries NO display name/email/phone/public key/device key/
 * avatar/presence/last-seen/online status/IP/location/fingerprint/contact data/
 * endpoint-risk report — those are Gates G/H/R. Records are never persistently
 * stored in plaintext.
 */

import type { RoomLocalId, RoomMemberRef } from "../room-types";
import { RoomMembershipLifecycleError } from "./membership-errors";
import type { RoomMembershipId, RoomMembershipRevision } from "./membership-ids";
import type { RoomMembershipRoleV1 } from "./membership-roles";

export type RoomMembershipStateV1 =
  "active_local_unverified" | "suspended_local" | "removed_tombstone";

export const ROOM_MEMBERSHIP_STATES: readonly RoomMembershipStateV1[] = [
  "active_local_unverified",
  "suspended_local",
  "removed_tombstone",
];

export type RoomMembershipOriginV1 = "local_room_bootstrap" | "local_added_placeholder";

export const ROOM_MEMBERSHIP_ORIGINS: readonly RoomMembershipOriginV1[] = [
  "local_room_bootstrap",
  "local_added_placeholder",
];

export interface RoomMembershipRecordV1 {
  readonly schemaVersion: 1;
  readonly membershipId: RoomMembershipId;
  readonly roomId: RoomLocalId;
  readonly memberRef: RoomMemberRef;
  readonly role: RoomMembershipRoleV1;
  readonly state: RoomMembershipStateV1;
  readonly revision: RoomMembershipRevision;
  readonly origin: RoomMembershipOriginV1;
  /** Always literally unverified — Gate G owns real verification. */
  readonly verification: "unverified_placeholder";
  /** LOCAL labels only ("local:" prefix). Never trusted time. */
  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
}

// ---------------------------------------------------------------------------
// Lifecycle state machine (no invite/remote/verified states; tombstone terminal)
// ---------------------------------------------------------------------------

const TRANSITIONS: Readonly<Record<RoomMembershipStateV1, readonly RoomMembershipStateV1[]>> = {
  active_local_unverified: ["suspended_local", "removed_tombstone"],
  suspended_local: ["active_local_unverified", "removed_tombstone"],
  removed_tombstone: [],
};

export function assertMembershipTransition(
  from: RoomMembershipStateV1,
  to: RoomMembershipStateV1,
): void {
  if (from === "removed_tombstone") {
    throw new RoomMembershipLifecycleError("membership_terminal");
  }
  if (from === to || !TRANSITIONS[from].includes(to)) {
    throw new RoomMembershipLifecycleError("invalid_lifecycle_transition");
  }
}

export function isActiveOwner(record: RoomMembershipRecordV1): boolean {
  return record.state === "active_local_unverified" && record.role === "owner_placeholder";
}
