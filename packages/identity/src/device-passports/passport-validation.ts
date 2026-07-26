/**
 * Device Passport command validation (TECH-ID-08). Fail-closed: exact schema
 * version + discriminator + fields; the caller can NOT supply approval /
 * signature / verification / valid / trusted / active status, key material,
 * hardware identifiers, DevicePosture, attestation, delegation, or remote-accept
 * flags. Future-gated commands (sign/issue/verify/remote-accept/QR) fail as
 * unavailable. Raw input never appears in errors. NOT a hostile-input parser
 * (Gate E) — an internal boundary validator.
 */

import {
  validateIdentityAuthorityEpoch,
  validateIdentityLocalRevision,
  validateIdentityPersonaId,
  validateLocalIdentityRootId,
  validatePairwiseRelationshipId,
  validateRoomIdentityBindingId,
} from "../identifiers";
import {
  DEVICE_IDENTITY_CAPABILITIES,
  DEVICE_KEY_PURPOSES,
  validateDeviceAuthorizationId,
  validateDeviceAuthorizationScopeV1,
  validateLocalDeviceRef,
  type DeviceAuthorizationScopeKindV1,
  type DeviceAuthorizationScopeV1,
  type DeviceIdentityCapabilityV1,
  type DeviceKeyPurposeV1,
} from "../devices";
import {
  DevicePassportAttestationConfusionError,
  DevicePassportIssuanceUnavailableError,
  DevicePassportValidationError,
} from "./passport-errors";
import { validateDeviceLinkRequestId, validateDevicePassportId } from "./passport-identifiers";
import {
  DEVICE_PASSPORT_FUTURE_GATED_COMMAND_NAMES,
  DEVICE_PASSPORT_MODEL_COMMAND_NAMES,
  type DevicePassportModelCommandNameV1,
  type DevicePassportModelCommandV1,
} from "./passport-commands";

const DANGEROUS_KEYS = ["__proto__", "prototype", "constructor"];
const ATTESTATION_FIELDS = ["attestation", "devicePosture", "screenShieldActive", "managedBunker"];
const FORBIDDEN_FIELDS = [
  "valid",
  "trusted",
  "verified",
  "active",
  "signed",
  "signature",
  "publicKey",
  "privateKey",
  "rootSecret",
  "recoveryKey",
  "historyKey",
  "hardwareId",
  "serialNumber",
  "imei",
  "hostname",
  "osBuild",
  "owner",
  "admin",
  "superuser",
  "wildcard",
  "delegationAllowed",
  "remoteAccepted",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function has(obj: Record<string, unknown>, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, k);
}
function assertSafeKeys(obj: Record<string, unknown>): void {
  for (const k of DANGEROUS_KEYS)
    if (has(obj, k)) throw new DevicePassportValidationError("dangerous_key");
  for (const k of ATTESTATION_FIELDS)
    if (has(obj, k)) throw new DevicePassportAttestationConfusionError(k);
  for (const k of FORBIDDEN_FIELDS)
    if (has(obj, k)) throw new DevicePassportValidationError("forbidden_field");
}
function assertExactKeys(obj: Record<string, unknown>, allowed: readonly string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) throw new DevicePassportValidationError("unexpected_field");
  }
}
function req<T>(fn: (s: string) => T, v: unknown): T {
  if (typeof v !== "string") throw new DevicePassportValidationError("bad_id");
  try {
    return fn(v);
  } catch {
    throw new DevicePassportValidationError("bad_id");
  }
}
function rev(v: unknown) {
  if (typeof v !== "number") throw new DevicePassportValidationError("missing_revision");
  try {
    return validateIdentityLocalRevision(v);
  } catch {
    throw new DevicePassportValidationError("bad_revision");
  }
}

function scopeId(fn: (s: string) => unknown, v: unknown): string {
  if (typeof v !== "string") throw new DevicePassportValidationError("bad_scope_id");
  try {
    fn(v);
  } catch {
    throw new DevicePassportValidationError("bad_scope_id");
  }
  return v;
}
function validateScopeInput(raw: unknown): DeviceAuthorizationScopeV1 {
  if (!isPlainObject(raw)) throw new DevicePassportValidationError("bad_scope");
  assertSafeKeys(raw);
  assertExactKeys(raw, [
    "kind",
    "rootId",
    "personaId",
    "relationshipId",
    "roomBindingId",
    "readOnly",
  ]);
  const scope: DeviceAuthorizationScopeV1 = {
    kind: raw["kind"] as DeviceAuthorizationScopeKindV1,
    rootId: scopeId(validateLocalIdentityRootId, raw["rootId"]) as never,
    ...(raw["personaId"] !== undefined
      ? { personaId: scopeId(validateIdentityPersonaId, raw["personaId"]) as never }
      : {}),
    ...(raw["relationshipId"] !== undefined
      ? { relationshipId: scopeId(validatePairwiseRelationshipId, raw["relationshipId"]) as never }
      : {}),
    ...(raw["roomBindingId"] !== undefined
      ? { roomBindingId: scopeId(validateRoomIdentityBindingId, raw["roomBindingId"]) as never }
      : {}),
    readOnly: raw["readOnly"] === true,
  };
  try {
    return validateDeviceAuthorizationScopeV1(scope);
  } catch {
    throw new DevicePassportValidationError("bad_scope");
  }
}
function validateCapabilities(raw: unknown): readonly DeviceIdentityCapabilityV1[] {
  if (!Array.isArray(raw) || raw.length > 32)
    throw new DevicePassportValidationError("bad_capabilities");
  const out: DeviceIdentityCapabilityV1[] = [];
  for (const c of raw) {
    if (
      typeof c !== "string" ||
      !DEVICE_IDENTITY_CAPABILITIES.includes(c as DeviceIdentityCapabilityV1)
    ) {
      throw new DevicePassportValidationError("unknown_capability");
    }
    out.push(c as DeviceIdentityCapabilityV1);
  }
  return out;
}
function validatePurposes(raw: unknown): readonly DeviceKeyPurposeV1[] {
  if (!Array.isArray(raw) || raw.length > 16)
    throw new DevicePassportValidationError("bad_purposes");
  const out: DeviceKeyPurposeV1[] = [];
  const seen = new Set<string>();
  for (const p of raw) {
    if (typeof p !== "string" || !DEVICE_KEY_PURPOSES.includes(p as DeviceKeyPurposeV1)) {
      throw new DevicePassportValidationError("unknown_purpose");
    }
    if (seen.has(p)) throw new DevicePassportValidationError("duplicate_purpose");
    seen.add(p);
    out.push(p as DeviceKeyPurposeV1);
  }
  return out;
}

export function validateDevicePassportModelCommandV1(input: unknown): DevicePassportModelCommandV1 {
  if (!isPlainObject(input)) throw new DevicePassportValidationError("not_an_object");
  assertSafeKeys(input);
  if (input["schemaVersion"] !== 1) throw new DevicePassportValidationError("bad_version");

  const command = input["command"];
  if (typeof command !== "string") throw new DevicePassportValidationError("unknown_command");
  if (DEVICE_PASSPORT_FUTURE_GATED_COMMAND_NAMES.includes(command)) {
    throw new DevicePassportIssuanceUnavailableError("future_gated");
  }
  if (!DEVICE_PASSPORT_MODEL_COMMAND_NAMES.includes(command as never)) {
    throw new DevicePassportValidationError("unknown_command");
  }
  const name = command as DevicePassportModelCommandNameV1;

  switch (name) {
    case "identity.device_link_request.create_local": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "rootId",
        "expectedRootAuthorityEpoch",
        "candidateDeviceRef",
        "requestedScope",
        "requestedCapabilities",
        "requestedKeySlotPurposes",
        "lifetimeMs",
      ]);
      if (typeof input["expectedRootAuthorityEpoch"] !== "number")
        throw new DevicePassportValidationError("missing_epoch");
      validateIdentityAuthorityEpoch(input["expectedRootAuthorityEpoch"]);
      if (input["lifetimeMs"] !== undefined && typeof input["lifetimeMs"] !== "number") {
        throw new DevicePassportValidationError("bad_lifetime");
      }
      return {
        schemaVersion: 1,
        command: name,
        rootId: req(validateLocalIdentityRootId, input["rootId"]) as unknown as string,
        expectedRootAuthorityEpoch: input["expectedRootAuthorityEpoch"],
        candidateDeviceRef: req(
          validateLocalDeviceRef,
          input["candidateDeviceRef"],
        ) as unknown as string,
        requestedScope: validateScopeInput(input["requestedScope"]),
        requestedCapabilities: validateCapabilities(input["requestedCapabilities"]),
        requestedKeySlotPurposes: validatePurposes(input["requestedKeySlotPurposes"]),
        ...(input["lifetimeMs"] !== undefined ? { lifetimeMs: input["lifetimeMs"] as number } : {}),
      };
    }
    case "identity.device_link_request.submit_for_review":
    case "identity.device_link_request.reject":
    case "identity.device_link_request.expire":
    case "identity.device_link_request.revoke": {
      assertExactKeys(input, ["schemaVersion", "command", "requestId", "expectedRevision"]);
      return {
        schemaVersion: 1,
        command: name,
        requestId: validateDeviceLinkRequestId(String(input["requestId"])),
        expectedRevision: rev(input["expectedRevision"]),
      };
    }
    case "identity.device_passport.prepare_draft": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "requestId",
        "expectedRequestRevision",
        "subjectAuthorizationId",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        requestId: validateDeviceLinkRequestId(String(input["requestId"])),
        expectedRequestRevision: rev(input["expectedRequestRevision"]),
        subjectAuthorizationId: validateDeviceAuthorizationId(
          String(input["subjectAuthorizationId"]),
        ),
      };
    }
    case "identity.device_passport.restrict_local": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "passportId",
        "expectedRevision",
        "requestedScope",
        "requestedCapabilities",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        passportId: validateDevicePassportId(String(input["passportId"])),
        expectedRevision: rev(input["expectedRevision"]),
        ...(input["requestedScope"] !== undefined
          ? { requestedScope: validateScopeInput(input["requestedScope"]) }
          : {}),
        ...(input["requestedCapabilities"] !== undefined
          ? { requestedCapabilities: validateCapabilities(input["requestedCapabilities"]) }
          : {}),
      };
    }
    case "identity.device_passport.approve_local_unsigned":
    case "identity.device_passport.expire":
    case "identity.device_passport.revoke": {
      assertExactKeys(input, ["schemaVersion", "command", "passportId", "expectedRevision"]);
      return {
        schemaVersion: 1,
        command: name,
        passportId: validateDevicePassportId(String(input["passportId"])),
        expectedRevision: rev(input["expectedRevision"]),
      };
    }
    default: {
      const _never: never = name;
      throw new DevicePassportValidationError(`unhandled:${String(_never)}`);
    }
  }
}
