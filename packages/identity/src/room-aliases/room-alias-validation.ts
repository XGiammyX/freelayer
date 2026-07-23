/**
 * Room presentation alias command validation (TECH-ID-06). Fail-closed: exact
 * schema version + discriminator + fields; visible text validated through the
 * shared TECH-ID-05 normalizer; dangerous prototype keys reject; authority/role/
 * membership/public-directory/secret/copy-from caller fields reject; the caller
 * may NOT set collision/disambiguation/assurance/sharing/authentication state.
 * Raw input never appears in errors. NOT a hostile-input parser (Gate E) — an
 * internal boundary validator.
 */

import { RoomAliasValidationError } from "./room-alias-errors";
import { normalizeContactAliasDisplayTextV1 } from "../aliases";
import {
  validateIdentityLocalRevision,
  validateIdentityPersonaId,
  validateLocalIdentityRootId,
  validateRoomIdentityBindingId,
  validateRoomLocalIdRef,
  validateRoomMembershipIdRef,
} from "../identifiers";
import { validateRoomPresentationAliasId } from "./room-alias-identifiers";
import {
  ROOM_ALIAS_COMMAND_NAMES,
  type RoomAliasCommandNameV1,
  type RoomAliasCommandV1,
} from "./room-alias-commands";

const DANGEROUS_KEYS = ["__proto__", "prototype", "constructor"];

const FORBIDDEN_FIELDS = [
  "verified",
  "trusted",
  "authenticated",
  "owner",
  "moderator",
  "admin",
  "role",
  "permissions",
  "capabilities",
  "global",
  "public",
  "searchable",
  "username",
  "phone",
  "email",
  "did",
  "rootPublicId",
  "publicKey",
  "privateKey",
  "contactAliasId",
  "copyFromContact",
  "copyFromRoom",
  "devicePosture",
  "screenShieldActive",
  "peerShared",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function assertSafeKeys(obj: Record<string, unknown>): void {
  for (const k of DANGEROUS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k))
      throw new RoomAliasValidationError("dangerous_key");
  }
  for (const k of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, k))
      throw new RoomAliasValidationError("forbidden_field");
  }
}
function assertExactKeys(obj: Record<string, unknown>, allowed: readonly string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) throw new RoomAliasValidationError("unexpected_field");
  }
}
function req<T>(fn: (s: string) => T, v: unknown): T {
  if (typeof v !== "string") throw new RoomAliasValidationError("bad_id");
  try {
    return fn(v);
  } catch {
    throw new RoomAliasValidationError("bad_id");
  }
}
function assertNormalizableText(value: unknown): string {
  if (typeof value !== "string") throw new RoomAliasValidationError("bad_text");
  try {
    normalizeContactAliasDisplayTextV1(value); // throws on any violation
  } catch {
    throw new RoomAliasValidationError("bad_text");
  }
  return value;
}
function revNum(v: unknown): number {
  if (typeof v !== "number") throw new RoomAliasValidationError("missing_revision");
  try {
    validateIdentityLocalRevision(v);
  } catch {
    throw new RoomAliasValidationError("bad_revision");
  }
  return v;
}

export function validateRoomAliasCommandV1(input: unknown): RoomAliasCommandV1 {
  if (!isPlainObject(input)) throw new RoomAliasValidationError("not_an_object");
  assertSafeKeys(input);
  if (input["schemaVersion"] !== 1) throw new RoomAliasValidationError("bad_version");

  const command = input["command"];
  if (typeof command !== "string" || !ROOM_ALIAS_COMMAND_NAMES.includes(command as never)) {
    throw new RoomAliasValidationError("unknown_command");
  }
  const name = command as RoomAliasCommandNameV1;

  const bindingScope = () => ({
    roomId: req(validateRoomLocalIdRef, input["roomId"]) as unknown as string,
    bindingId: req(validateRoomIdentityBindingId, input["bindingId"]) as unknown as string,
    rootId: req(validateLocalIdentityRootId, input["rootId"]) as unknown as string,
    personaId: req(validateIdentityPersonaId, input["personaId"]) as unknown as string,
    ...(input["membershipId"] !== undefined
      ? {
          membershipId: req(
            validateRoomMembershipIdRef,
            input["membershipId"],
          ) as unknown as string,
        }
      : {}),
    expectedBindingRevision: revNum(input["expectedBindingRevision"]),
  });

  switch (name) {
    case "identity.room_alias.create": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "roomId",
        "bindingId",
        "rootId",
        "personaId",
        "membershipId",
        "expectedBindingRevision",
        "displayText",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        ...bindingScope(),
        displayText: assertNormalizableText(input["displayText"]),
      };
    }
    case "identity.room_alias.activate":
    case "identity.room_alias.retire": {
      assertExactKeys(input, ["schemaVersion", "command", "aliasId", "expectedRevision"]);
      return {
        schemaVersion: 1,
        command: name,
        aliasId: validateRoomPresentationAliasId(String(input["aliasId"])),
        expectedRevision: validateIdentityLocalRevision(revNum(input["expectedRevision"])),
      };
    }
    case "identity.room_alias.rotate": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "roomId",
        "bindingId",
        "rootId",
        "personaId",
        "membershipId",
        "expectedBindingRevision",
        "currentAliasId",
        "currentExpectedRevision",
        "newDisplayText",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        ...bindingScope(),
        currentAliasId: validateRoomPresentationAliasId(String(input["currentAliasId"])),
        currentExpectedRevision: validateIdentityLocalRevision(
          revNum(input["currentExpectedRevision"]),
        ),
        newDisplayText: assertNormalizableText(input["newDisplayText"]),
      };
    }
    default: {
      const _never: never = name;
      throw new RoomAliasValidationError(`unhandled:${String(_never)}`);
    }
  }
}
