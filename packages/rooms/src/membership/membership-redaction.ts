/**
 * Redacted membership views (TECH-20). Views NEVER expose identity proof,
 * contact info, presence, device state, endpoint risk, a capability descriptor,
 * or raw audit history. Strict modes suppress the membership ID, revision, and
 * timestamps. The member ref is relationship metadata — suppressed unless
 * relationship metadata is explicitly allowed.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomMemberRef } from "../room-types";
import type { RoomMembershipId, RoomMembershipRevision } from "./membership-ids";
import type { RoomMembershipRoleV1 } from "./membership-roles";
import type { RoomMembershipRecordV1, RoomMembershipStateV1 } from "./membership-types";

export interface RoomMembershipSummaryViewV1 {
  readonly schemaVersion: 1;
  readonly membershipId?: RoomMembershipId;
  /** Only present when relationship metadata is allowed (Standard/Offline/Sovereign). */
  readonly memberRef?: RoomMemberRef;
  readonly role: RoomMembershipRoleV1;
  readonly state: RoomMembershipStateV1;
  readonly verification: "unverified_placeholder";
  readonly revision?: RoomMembershipRevision;
  readonly createdAtLocal?: string;
  readonly updatedAtLocal?: string;
}

export function redactMembershipRecordForQuery(
  record: RoomMembershipRecordV1,
  mode: PrivacyMode,
): RoomMembershipSummaryViewV1 {
  const strict =
    mode === "ghost" || mode === "bunker" || mode === "emergency" || mode === "private";
  const relationshipAllowed =
    mode === "standard" || mode === "offline_capsule" || mode === "sovereign_room";
  return {
    schemaVersion: 1,
    role: record.role,
    state: record.state,
    verification: "unverified_placeholder",
    ...(strict ? {} : { membershipId: record.membershipId }),
    ...(relationshipAllowed ? { memberRef: record.memberRef } : {}),
    ...(strict ? {} : { revision: record.revision }),
    ...(relationshipAllowed
      ? { createdAtLocal: record.createdAtLocal, updatedAtLocal: record.updatedAtLocal }
      : {}),
  };
}
