/**
 * Local identity command validation (TECH-ID-03). Validates command SHAPE only
 * (cross-reference + lifecycle checks happen in the reducer, which holds state).
 * Fail-closed: explicit schema version + discriminator, EXACT fields (no broad
 * spreading), bounded strings, dangerous keys reject, authority/secret caller
 * fields reject (never mass-assigned), unknown states/commands/versions reject.
 * NOT a hostile-input parser (Gate E) — an internal boundary validator.
 */

import { IdentitySchemaVersionError, IdentityValidationError } from "./identity-errors";
import {
  LOCAL_IDENTITY_COMMAND_NAMES,
  type LocalIdentityCommandNameV1,
  type LocalIdentityCommandV1,
} from "./identity-commands";
import {
  validateIdentityLocalRevision,
  validateIdentityPersonaId,
  validateLocalIdentityRootId,
  validatePairwiseRelationshipId,
  validateRoomIdentityBindingId,
  validateRoomLocalIdRef,
  validateRoomMembershipIdRef,
} from "./identifiers";

const DANGEROUS_KEYS = ["__proto__", "prototype", "constructor"];

/** Authority/secret-like caller fields that must NEVER be mass-assigned. */
const FORBIDDEN_FIELDS = [
  "verified",
  "trusted",
  "authenticated",
  "publicKey",
  "privateKey",
  "secretKey",
  "seed",
  "seedPhrase",
  "mnemonic",
  "recoveryPhrase",
  "recoveryKey",
  "password",
  "passkey",
  "email",
  "phone",
  "phoneNumber",
  "username",
  "globalUsername",
  "did",
  "deviceSafe",
  "devicePosture",
  "deviceFingerprint",
  "hardwareId",
  "attestation",
  "accessToken",
  "refreshToken",
  "isOwner",
  "isAdmin",
  "permissions",
  "capabilities",
];

const MAX_LOCAL_LABEL = 64;

/** True if the string contains a control character (U+0000..U+001F or U+007F). */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNoDangerousOrForbiddenKeys(obj: Record<string, unknown>): void {
  for (const key of DANGEROUS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      throw new IdentityValidationError("dangerous_key");
    }
  }
  for (const key of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      throw new IdentityValidationError("forbidden_field");
    }
  }
}

function assertExactKeys(obj: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new IdentityValidationError("unexpected_field");
  }
}

function validateLocalLabel(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new IdentityValidationError("bad_local_label");
  if (value.length < 1 || value.length > MAX_LOCAL_LABEL) {
    throw new IdentityValidationError("bad_local_label");
  }
  // A local label is sensitive metadata, never normalized into a public username.
  if (hasControlChar(value)) throw new IdentityValidationError("bad_local_label");
  return value;
}

/**
 * Validate an unknown value into a well-formed local identity command. Throws a
 * content-free error on any violation. Never echoes raw input.
 */
export function validateLocalIdentityCommandV1(input: unknown): LocalIdentityCommandV1 {
  if (!isPlainObject(input)) throw new IdentityValidationError("not_an_object");
  assertNoDangerousOrForbiddenKeys(input);

  if (input["schemaVersion"] !== 1) throw new IdentitySchemaVersionError("unsupported_version");

  const command = input["command"];
  if (typeof command !== "string" || !LOCAL_IDENTITY_COMMAND_NAMES.includes(command as never)) {
    throw new IdentityValidationError("unknown_command");
  }
  const name = command as LocalIdentityCommandNameV1;

  const rev = (): ReturnType<typeof validateIdentityLocalRevision> => {
    if (typeof input["expectedRevision"] !== "number") {
      throw new IdentityValidationError("missing_expected_revision");
    }
    return validateIdentityLocalRevision(input["expectedRevision"]);
  };

  switch (name) {
    case "identity.root.create_local":
      assertExactKeys(input, ["schemaVersion", "command"]);
      return { schemaVersion: 1, command: name };

    case "identity.root.activate_local":
    case "identity.root.lock_local":
    case "identity.root.mark_compromised":
    case "identity.root.tombstone": {
      assertExactKeys(input, ["schemaVersion", "command", "rootId", "expectedRevision"]);
      const rootId = validateLocalIdentityRootId(String(input["rootId"]));
      return { schemaVersion: 1, command: name, rootId, expectedRevision: rev() };
    }

    case "identity.persona.create_local": {
      assertExactKeys(input, ["schemaVersion", "command", "rootId", "localLabel"]);
      const rootId = validateLocalIdentityRootId(String(input["rootId"]));
      const localLabel = validateLocalLabel(input["localLabel"]);
      return localLabel === undefined
        ? { schemaVersion: 1, command: name, rootId }
        : { schemaVersion: 1, command: name, rootId, localLabel };
    }

    case "identity.persona.archive_local":
    case "identity.persona.tombstone": {
      assertExactKeys(input, ["schemaVersion", "command", "personaId", "expectedRevision"]);
      const personaId = validateIdentityPersonaId(String(input["personaId"]));
      return { schemaVersion: 1, command: name, personaId, expectedRevision: rev() };
    }

    case "identity.relationship.create_placeholder": {
      assertExactKeys(input, ["schemaVersion", "command", "rootId", "personaId"]);
      const rootId = validateLocalIdentityRootId(String(input["rootId"]));
      const personaId = validateIdentityPersonaId(String(input["personaId"]));
      return { schemaVersion: 1, command: name, rootId, personaId };
    }

    case "identity.relationship.block_local":
    case "identity.relationship.mark_compromised":
    case "identity.relationship.tombstone": {
      assertExactKeys(input, ["schemaVersion", "command", "relationshipId", "expectedRevision"]);
      const relationshipId = validatePairwiseRelationshipId(String(input["relationshipId"]));
      return { schemaVersion: 1, command: name, relationshipId, expectedRevision: rev() };
    }

    case "identity.room_binding.create_placeholder": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "roomId",
        "rootId",
        "personaId",
        "membershipId",
      ]);
      const roomId = validateRoomLocalIdRef(String(input["roomId"]));
      const rootId = validateLocalIdentityRootId(String(input["rootId"]));
      const personaId = validateIdentityPersonaId(String(input["personaId"]));
      const membershipId =
        input["membershipId"] === undefined
          ? undefined
          : validateRoomMembershipIdRef(String(input["membershipId"]));
      return membershipId === undefined
        ? { schemaVersion: 1, command: name, roomId, rootId, personaId }
        : { schemaVersion: 1, command: name, roomId, rootId, personaId, membershipId };
    }

    case "identity.room_binding.suspend_local":
    case "identity.room_binding.tombstone": {
      assertExactKeys(input, ["schemaVersion", "command", "bindingId", "expectedRevision"]);
      const bindingId = validateRoomIdentityBindingId(String(input["bindingId"]));
      return { schemaVersion: 1, command: name, bindingId, expectedRevision: rev() };
    }

    default: {
      // Exhaustiveness: every command name is handled above.
      const _never: never = name;
      throw new IdentityValidationError(`unhandled_command:${String(_never)}`);
    }
  }
}
