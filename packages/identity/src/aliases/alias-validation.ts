/**
 * Per-contact alias command validation (TECH-ID-05). Fail-closed: exact schema
 * version + discriminator + fields; text validated through the canonical
 * normalizer; dangerous keys reject; authority/verification/public-directory/
 * secret caller fields reject; the caller may NOT set security assessment or
 * sharing/authentication state. Raw input never appears in errors. NOT a hostile-
 * input parser (Gate E) — an internal boundary validator.
 */

import { ContactAliasValidationError } from "./alias-errors";
import { normalizeContactAliasDisplayTextV1 } from "./alias-normalization";
import { validateContactAliasId, validateLocalPeerLabelId } from "./alias-identifiers";
import {
  validateIdentityLocalRevision,
  validateIdentityPersonaId,
  validateLocalIdentityRootId,
  validatePairwiseRelationshipId,
} from "../identifiers";
import {
  CONTACT_ALIAS_COMMAND_NAMES,
  type ContactAliasCommandNameV1,
  type ContactAliasCommandV1,
} from "./alias-commands";

const DANGEROUS_KEYS = ["__proto__", "prototype", "constructor"];

const FORBIDDEN_FIELDS = [
  "verified",
  "trusted",
  "authenticated",
  "public",
  "global",
  "searchable",
  "uniqueUsername",
  "handle",
  "phone",
  "email",
  "did",
  "publicKey",
  "privateKey",
  "relationshipKey",
  "rootPublicId",
  "devicePosture",
  "roomRole",
  "isOwner",
  "isAdmin",
  "capabilities",
  "screenShieldActive",
  "peerShared",
  "securityAssessment",
  "sharingState",
  "authenticatedBinding",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function assertSafeKeys(obj: Record<string, unknown>): void {
  for (const k of DANGEROUS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k))
      throw new ContactAliasValidationError("dangerous_key");
  }
  for (const k of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, k))
      throw new ContactAliasValidationError("forbidden_field");
  }
}
function assertExactKeys(obj: Record<string, unknown>, allowed: readonly string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) throw new ContactAliasValidationError("unexpected_field");
  }
}
/** Validate raw display text by normalizing it (throws on invalid). */
function assertNormalizableText(value: unknown): string {
  if (typeof value !== "string") throw new ContactAliasValidationError("bad_text");
  normalizeContactAliasDisplayTextV1(value); // throws on any violation
  return value;
}

export function validateContactAliasCommandV1(input: unknown): ContactAliasCommandV1 {
  if (!isPlainObject(input)) throw new ContactAliasValidationError("not_an_object");
  assertSafeKeys(input);
  if (input["schemaVersion"] !== 1) throw new ContactAliasValidationError("bad_version");

  const command = input["command"];
  if (typeof command !== "string" || !CONTACT_ALIAS_COMMAND_NAMES.includes(command as never)) {
    throw new ContactAliasValidationError("unknown_command");
  }
  const name = command as ContactAliasCommandNameV1;
  const relRef = () => ({
    relationshipId: validatePairwiseRelationshipId(String(input["relationshipId"])),
    rootId: validateLocalIdentityRootId(String(input["rootId"])),
    personaId: validateIdentityPersonaId(String(input["personaId"])),
  });
  const rev = () => {
    if (typeof input["expectedRevision"] !== "number")
      throw new ContactAliasValidationError("missing_revision");
    return validateIdentityLocalRevision(input["expectedRevision"]);
  };

  switch (name) {
    case "identity.alias.presentation.create": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "relationshipId",
        "rootId",
        "personaId",
        "displayText",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        ...relRef(),
        displayText: assertNormalizableText(input["displayText"]),
      };
    }
    case "identity.alias.presentation.activate":
    case "identity.alias.presentation.retire": {
      assertExactKeys(input, ["schemaVersion", "command", "aliasId", "expectedRevision"]);
      return {
        schemaVersion: 1,
        command: name,
        aliasId: validateContactAliasId(String(input["aliasId"])),
        expectedRevision: rev(),
      };
    }
    case "identity.alias.presentation.rotate": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "relationshipId",
        "rootId",
        "personaId",
        "currentAliasId",
        "currentExpectedRevision",
        "newDisplayText",
      ]);
      if (typeof input["currentExpectedRevision"] !== "number")
        throw new ContactAliasValidationError("missing_revision");
      return {
        schemaVersion: 1,
        command: name,
        ...relRef(),
        currentAliasId: validateContactAliasId(String(input["currentAliasId"])),
        currentExpectedRevision: validateIdentityLocalRevision(input["currentExpectedRevision"]),
        newDisplayText: assertNormalizableText(input["newDisplayText"]),
      };
    }
    case "identity.alias.local_peer_label.set": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "relationshipId",
        "rootId",
        "personaId",
        "labelText",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        ...relRef(),
        labelText: assertNormalizableText(input["labelText"]),
      };
    }
    case "identity.alias.local_peer_label.replace": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "labelId",
        "expectedRevision",
        "labelText",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        labelId: validateLocalPeerLabelId(String(input["labelId"])),
        expectedRevision: rev(),
        labelText: assertNormalizableText(input["labelText"]),
      };
    }
    case "identity.alias.local_peer_label.clear": {
      assertExactKeys(input, ["schemaVersion", "command", "labelId", "expectedRevision"]);
      return {
        schemaVersion: 1,
        command: name,
        labelId: validateLocalPeerLabelId(String(input["labelId"])),
        expectedRevision: rev(),
      };
    }
    default: {
      const _never: never = name;
      throw new ContactAliasValidationError(`unhandled:${String(_never)}`);
    }
  }
}
