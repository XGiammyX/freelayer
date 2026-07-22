/**
 * Ephemeral identity command validation (TECH-ID-04). Fail-closed: exact schema
 * version + discriminator + fields, bounded duration, dangerous keys reject, and
 * authority/secret/promotion/anonymity caller fields reject (never mass-assigned).
 * Cross-reference + lifetime + expiry checks happen in the reducer/pipeline.
 * NOT a hostile-input parser (Gate E). Raw input never appears in errors.
 */

import { EphemeralIdentityValidationError } from "./ephemeral-errors";
import { EPHEMERAL_IDENTITY_LIMITS_V1 } from "./ephemeral-clock";
import {
  validateIdentityLocalRevision,
  validateIdentityPersonaId,
  validateLocalIdentityRootId,
  validatePairwiseRelationshipId,
  validateRoomLocalIdRef,
  validateRoomMembershipIdRef,
} from "../identifiers";
import {
  EPHEMERAL_IDENTITY_COMMAND_NAMES,
  type EphemeralIdentityCommandNameV1,
  type EphemeralIdentityCommandV1,
} from "./ephemeral-commands";

const DANGEROUS_KEYS = ["__proto__", "prototype", "constructor"];

/** Caller fields that must NEVER be mass-assigned onto an ephemeral command. */
const FORBIDDEN_FIELDS = [
  "persistent",
  "recoverable",
  "recovery",
  "parentRootId",
  "longLivedRootId",
  "promote",
  "exportable",
  "synchronized",
  "trusted",
  "verified",
  "anonymous",
  "unlinkable",
  "publicKey",
  "privateKey",
  "secretKey",
  "seed",
  "mnemonic",
  "recoveryPhrase",
  "email",
  "phone",
  "phoneNumber",
  "username",
  "did",
  "devicePosture",
  "screenShieldActive",
];

const MAX_LOCAL_LABEL = 64;
const { minimumDurationMs, maximumDurationMs } = EPHEMERAL_IDENTITY_LIMITS_V1;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function assertSafeKeys(obj: Record<string, unknown>): void {
  for (const k of DANGEROUS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      throw new EphemeralIdentityValidationError("dangerous_key");
    }
  }
  for (const k of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      throw new EphemeralIdentityValidationError("forbidden_field");
    }
  }
}

function assertExactKeys(obj: Record<string, unknown>, allowed: readonly string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) throw new EphemeralIdentityValidationError("unexpected_field");
  }
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

function validateLocalLabel(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length < 1 || value.length > MAX_LOCAL_LABEL) {
    throw new EphemeralIdentityValidationError("bad_local_label");
  }
  if (hasControlChar(value)) throw new EphemeralIdentityValidationError("bad_local_label");
  return value;
}

function validateDurationMs(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimumDurationMs ||
    value > maximumDurationMs
  ) {
    throw new EphemeralIdentityValidationError("bad_duration");
  }
  return value;
}

export function validateEphemeralIdentityCommandV1(input: unknown): EphemeralIdentityCommandV1 {
  if (!isPlainObject(input)) throw new EphemeralIdentityValidationError("not_an_object");
  assertSafeKeys(input);
  if (input["schemaVersion"] !== 1) throw new EphemeralIdentityValidationError("bad_version");

  const command = input["command"];
  if (typeof command !== "string" || !EPHEMERAL_IDENTITY_COMMAND_NAMES.includes(command as never)) {
    throw new EphemeralIdentityValidationError("unknown_command");
  }
  const name = command as EphemeralIdentityCommandNameV1;
  const rev = (): ReturnType<typeof validateIdentityLocalRevision> => {
    if (typeof input["expectedRevision"] !== "number") {
      throw new EphemeralIdentityValidationError("missing_expected_revision");
    }
    return validateIdentityLocalRevision(input["expectedRevision"]);
  };

  switch (name) {
    case "identity.ephemeral.create": {
      assertExactKeys(input, ["schemaVersion", "command", "lifetimeMode", "durationMs"]);
      const lifetimeMode = input["lifetimeMode"];
      if (
        lifetimeMode !== "current_process" &&
        lifetimeMode !== "current_process_with_local_deadline"
      ) {
        throw new EphemeralIdentityValidationError("bad_lifetime_mode");
      }
      const durationMs =
        input["durationMs"] === undefined ? undefined : validateDurationMs(input["durationMs"]);
      return durationMs === undefined
        ? { schemaVersion: 1, command: name, lifetimeMode }
        : { schemaVersion: 1, command: name, lifetimeMode, durationMs };
    }

    case "identity.ephemeral.activate":
    case "identity.ephemeral.mark_compromised":
    case "identity.ephemeral.expire":
    case "identity.ephemeral.destroy": {
      assertExactKeys(input, ["schemaVersion", "command", "rootId", "expectedRevision"]);
      const rootId = validateLocalIdentityRootId(String(input["rootId"]));
      return { schemaVersion: 1, command: name, rootId, expectedRevision: rev() };
    }

    case "identity.ephemeral.shorten_lifetime": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "rootId",
        "expectedRevision",
        "newDurationMs",
      ]);
      const rootId = validateLocalIdentityRootId(String(input["rootId"]));
      const newDurationMs = validateDurationMs(input["newDurationMs"]);
      return { schemaVersion: 1, command: name, rootId, expectedRevision: rev(), newDurationMs };
    }

    case "identity.ephemeral.persona.create": {
      assertExactKeys(input, ["schemaVersion", "command", "rootId", "localLabel"]);
      const rootId = validateLocalIdentityRootId(String(input["rootId"]));
      const localLabel = validateLocalLabel(input["localLabel"]);
      return localLabel === undefined
        ? { schemaVersion: 1, command: name, rootId }
        : { schemaVersion: 1, command: name, rootId, localLabel };
    }

    case "identity.ephemeral.relationship.create_placeholder": {
      assertExactKeys(input, ["schemaVersion", "command", "rootId", "personaId"]);
      const rootId = validateLocalIdentityRootId(String(input["rootId"]));
      const personaId = validateIdentityPersonaId(String(input["personaId"]));
      return { schemaVersion: 1, command: name, rootId, personaId };
    }

    case "identity.ephemeral.relationship.block": {
      assertExactKeys(input, ["schemaVersion", "command", "relationshipId", "expectedRevision"]);
      const relationshipId = validatePairwiseRelationshipId(String(input["relationshipId"]));
      return { schemaVersion: 1, command: name, relationshipId, expectedRevision: rev() };
    }

    case "identity.ephemeral.room_binding.create_placeholder": {
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

    default: {
      const _never: never = name;
      throw new EphemeralIdentityValidationError(`unhandled:${String(_never)}`);
    }
  }
}
