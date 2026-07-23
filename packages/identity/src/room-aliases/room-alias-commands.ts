/**
 * Room presentation alias command union (TECH-ID-06). Explicit + discriminated —
 * NO generic profile/alias patch. Every mutation carries the expected revisions
 * canonical authorization needs (binding + current alias); rotation names the
 * previous active alias explicitly. Visible text is validated through the shared
 * TECH-ID-05 normalizer. The caller cannot set collision/disambiguation/
 * assurance/sharing/authentication state.
 */

import type { IdentityLocalRevision } from "../identifiers";
import type { ContactAliasDisplayText } from "../aliases";
import type { RoomPresentationAliasId } from "./room-alias-identifiers";

/** Fields shared by binding-scoped write commands. Ids are branded refs. */
interface RoomAliasBindingScopeV1 {
  readonly roomId: string;
  readonly bindingId: string;
  readonly rootId: string;
  readonly personaId: string;
  readonly membershipId?: string;
  readonly expectedBindingRevision: number;
}

export interface CreateRoomPresentationAliasCommandV1 extends RoomAliasBindingScopeV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.room_alias.create";
  readonly displayText: string;
}

export interface ActivateRoomPresentationAliasCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.room_alias.activate";
  readonly aliasId: RoomPresentationAliasId;
  readonly expectedRevision: IdentityLocalRevision;
}

export interface RetireRoomPresentationAliasCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.room_alias.retire";
  readonly aliasId: RoomPresentationAliasId;
  readonly expectedRevision: IdentityLocalRevision;
}

export interface RotateRoomPresentationAliasCommandV1 extends RoomAliasBindingScopeV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.room_alias.rotate";
  readonly currentAliasId: RoomPresentationAliasId;
  readonly currentExpectedRevision: IdentityLocalRevision;
  readonly newDisplayText: string;
}

export type RoomAliasCommandV1 =
  | CreateRoomPresentationAliasCommandV1
  | ActivateRoomPresentationAliasCommandV1
  | RotateRoomPresentationAliasCommandV1
  | RetireRoomPresentationAliasCommandV1;

export type RoomAliasCommandNameV1 = RoomAliasCommandV1["command"];

export const ROOM_ALIAS_COMMAND_NAMES: readonly RoomAliasCommandNameV1[] = [
  "identity.room_alias.create",
  "identity.room_alias.activate",
  "identity.room_alias.rotate",
  "identity.room_alias.retire",
];

/** Convenience: a normalized display value carried on a created alias record. */
export type RoomAliasNormalizedValue = ContactAliasDisplayText;
