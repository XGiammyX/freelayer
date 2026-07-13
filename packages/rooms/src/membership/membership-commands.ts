/**
 * Explicit RoomOS membership mutation commands (TECH-20).
 *
 * No generic membership patch, no invite command, no identity-verification
 * command, no remote-acceptance command. The validator rejects unknown
 * commands/roles/states, prototype-pollution keys, and any CALLER-CONTROLLED
 * authority field (`isAdmin`/`isOwner`/`verified`/`capabilities`/`permissions`/
 * `trustedDevice`/`endpointSafe` are simply unexpected keys → reject). Accepted
 * fields are copied explicitly; unvalidated input is never spread.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLocalId, RoomMemberRef } from "../room-types";
import { validateRoomMemberRef } from "../room-types";
import { assertNoDangerousKeys, assertOnlyKeys, isPlainRecord } from "../objects";
import { membershipFail } from "./membership-errors";
import {
  ROOM_MEMBERSHIP_SCHEMA_VERSION,
  validateRoomMembershipId,
  validateRoomMembershipRevision,
  type RoomMembershipId,
  type RoomMembershipRevision,
} from "./membership-ids";
import { ROOM_MEMBERSHIP_ROLES, type RoomMembershipRoleV1 } from "./membership-roles";

export type RoomMembershipCommandName =
  | "membership.bootstrap_local_owner_placeholder"
  | "membership.add_local_placeholder"
  | "membership.change_role"
  | "membership.suspend_local"
  | "membership.reactivate_local"
  | "membership.remove_tombstone";

export interface RoomMembershipCommandBaseV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly mode: PrivacyMode;
  readonly reason: string;
}

export interface BootstrapLocalOwnerPlaceholderCommandV1 extends RoomMembershipCommandBaseV1 {
  readonly command: "membership.bootstrap_local_owner_placeholder";
  readonly memberRef: RoomMemberRef;
}
export interface AddLocalMemberPlaceholderCommandV1 extends RoomMembershipCommandBaseV1 {
  readonly command: "membership.add_local_placeholder";
  readonly memberRef: RoomMemberRef;
  readonly role: RoomMembershipRoleV1;
}
export interface ChangeLocalMemberRoleCommandV1 extends RoomMembershipCommandBaseV1 {
  readonly command: "membership.change_role";
  readonly membershipId: RoomMembershipId;
  readonly newRole: RoomMembershipRoleV1;
  readonly expectedRevision: RoomMembershipRevision;
}
export interface SuspendLocalMembershipCommandV1 extends RoomMembershipCommandBaseV1 {
  readonly command: "membership.suspend_local";
  readonly membershipId: RoomMembershipId;
  readonly expectedRevision: RoomMembershipRevision;
}
export interface ReactivateLocalMembershipCommandV1 extends RoomMembershipCommandBaseV1 {
  readonly command: "membership.reactivate_local";
  readonly membershipId: RoomMembershipId;
  readonly expectedRevision: RoomMembershipRevision;
}
export interface RemoveLocalMembershipTombstoneCommandV1 extends RoomMembershipCommandBaseV1 {
  readonly command: "membership.remove_tombstone";
  readonly membershipId: RoomMembershipId;
  readonly expectedRevision: RoomMembershipRevision;
}

export type RoomMembershipCommandV1 =
  | BootstrapLocalOwnerPlaceholderCommandV1
  | AddLocalMemberPlaceholderCommandV1
  | ChangeLocalMemberRoleCommandV1
  | SuspendLocalMembershipCommandV1
  | ReactivateLocalMembershipCommandV1
  | RemoveLocalMembershipTombstoneCommandV1;

export const ROOM_MEMBERSHIP_COMMAND_NAMES: readonly RoomMembershipCommandName[] = [
  "membership.bootstrap_local_owner_placeholder",
  "membership.add_local_placeholder",
  "membership.change_role",
  "membership.suspend_local",
  "membership.reactivate_local",
  "membership.remove_tombstone",
];

const REASON_RE = /^[a-z0-9_.:-]{1,64}$/;
const BASE_KEYS = ["schemaVersion", "command", "roomId", "mode", "reason"] as const;

function validateRole(input: unknown): RoomMembershipRoleV1 {
  if (typeof input !== "string" || !ROOM_MEMBERSHIP_ROLES.includes(input as RoomMembershipRoleV1)) {
    membershipFail("unknown_role");
  }
  return input as RoomMembershipRoleV1;
}

function validateMemberRef(input: unknown): RoomMemberRef {
  if (typeof input !== "string") membershipFail("invalid_member_ref");
  try {
    return validateRoomMemberRef(input);
  } catch {
    membershipFail("invalid_member_ref");
  }
}

export function validateRoomMembershipCommandV1(input: unknown): RoomMembershipCommandV1 {
  if (!isPlainRecord(input)) membershipFail("invalid_field");
  assertNoDangerousKeys(input);
  if (input["schemaVersion"] !== ROOM_MEMBERSHIP_SCHEMA_VERSION) {
    membershipFail("unsupported_schema_version");
  }
  const command = input["command"];
  if (typeof command !== "string" || !ROOM_MEMBERSHIP_COMMAND_NAMES.includes(command as never)) {
    membershipFail("unknown_command");
  }
  if (typeof input["roomId"] !== "string") membershipFail("room_mismatch");
  const roomId = input["roomId"] as RoomLocalId;
  if (typeof input["mode"] !== "string") membershipFail("invalid_field");
  const mode = input["mode"] as PrivacyMode;
  if (typeof input["reason"] !== "string" || !REASON_RE.test(input["reason"]))
    membershipFail("invalid_field");
  const base = { schemaVersion: 1 as const, roomId, mode, reason: input["reason"] };

  const name = command as RoomMembershipCommandName;
  switch (name) {
    case "membership.bootstrap_local_owner_placeholder":
      assertOnlyKeys(input, [...BASE_KEYS, "memberRef"]);
      return { ...base, command: name, memberRef: validateMemberRef(input["memberRef"]) };
    case "membership.add_local_placeholder":
      assertOnlyKeys(input, [...BASE_KEYS, "memberRef", "role"]);
      return {
        ...base,
        command: name,
        memberRef: validateMemberRef(input["memberRef"]),
        role: validateRole(input["role"]),
      };
    case "membership.change_role":
      assertOnlyKeys(input, [...BASE_KEYS, "membershipId", "newRole", "expectedRevision"]);
      return {
        ...base,
        command: name,
        membershipId: validateRoomMembershipId(input["membershipId"] as string),
        newRole: validateRole(input["newRole"]),
        expectedRevision: validateRoomMembershipRevision(input["expectedRevision"] as number),
      };
    case "membership.suspend_local":
    case "membership.reactivate_local":
    case "membership.remove_tombstone":
      assertOnlyKeys(input, [...BASE_KEYS, "membershipId", "expectedRevision"]);
      return {
        ...base,
        command: name,
        membershipId: validateRoomMembershipId(input["membershipId"] as string),
        expectedRevision: validateRoomMembershipRevision(input["expectedRevision"] as number),
      };
    default: {
      const unreachable: never = name;
      membershipFail("unknown_command", String(unreachable));
    }
  }
}
