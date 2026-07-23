/**
 * Opaque local room-alias identifiers (TECH-ID-06). A LOCAL record reference,
 * NOT a visible name, NOT a member handle, NOT a directory key. It encodes no
 * display text, no root/persona/binding/membership id, no room id, no phone/
 * email/username, no role, no timestamp, no device info, and no key material. An
 * id grants NO authority and proves NO identity. Injected generation only (never
 * randomness in a reducer). No id is derived from private root material.
 */

import { RoomAliasValidationError } from "./room-alias-errors";

export type RoomPresentationAliasId = string & {
  readonly __roomPresentationAliasId: unique symbol;
};

const ID_BODY_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/;

function validateOpaque(input: unknown, prefix: string): string {
  if (typeof input !== "string" || input.length < 4 || input.length > 128) {
    throw new RoomAliasValidationError("bad_id_length");
  }
  if (!input.startsWith(`${prefix}-`) || !ID_BODY_RE.test(input) || input.includes("@")) {
    throw new RoomAliasValidationError("bad_id_format");
  }
  return input;
}

export function validateRoomPresentationAliasId(input: string): RoomPresentationAliasId {
  return validateOpaque(input, "ralias") as RoomPresentationAliasId;
}

/** Pre-generated ids passed INTO the reducer for create/rotate commands. */
export interface RoomAliasGeneratedIdsV1 {
  readonly aliasId?: RoomPresentationAliasId;
}
