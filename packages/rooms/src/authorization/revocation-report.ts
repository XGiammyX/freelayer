/**
 * Content-free local authorization-invalidation report (TECH-21). Informational
 * output only — NOT an authorization event, NOT a global revocation proof. It
 * carries no member ref, membership ID, room title, role, reason text, or
 * capability list; it never persists and produces no telemetry.
 */

import type { RoomLocalId } from "../room-types";

export type RoomAuthorizationInvalidationCauseV1 =
  | "membership_suspended"
  | "membership_removed"
  | "membership_role_changed"
  | "membership_reactivated"
  | "room_policy_changed"
  | "privacy_mode_changed"
  | "room_lifecycle_changed";

export interface LocalAuthorizationInvalidationReportV1 {
  readonly schemaVersion: 1;
  /** Optional and non-sensitive; omit unless policy explicitly permits. */
  readonly roomId?: RoomLocalId;
  readonly cause: RoomAuthorizationInvalidationCauseV1;
  readonly scope: "current_local_projection_only";
  readonly invalidatedRevision: number;
  readonly distributedRevocation: false;
  readonly redacted: true;
}

/** Build a redacted invalidation report. Never include a member/role/reason. */
export function buildLocalAuthorizationInvalidationReportV1(input: {
  cause: RoomAuthorizationInvalidationCauseV1;
  invalidatedRevision: number;
  includeRoomId?: RoomLocalId;
}): LocalAuthorizationInvalidationReportV1 {
  return Object.freeze({
    schemaVersion: 1,
    cause: input.cause,
    scope: "current_local_projection_only",
    invalidatedRevision: input.invalidatedRevision,
    distributedRevocation: false,
    redacted: true,
    ...(input.includeRoomId !== undefined ? { roomId: input.includeRoomId } : {}),
  });
}
