/**
 * Device-key-model command validation (TECH-ID-07). Fail-closed: exact schema
 * version + discriminator + fields; key material / hardware identifiers /
 * DevicePosture / authority-boolean caller fields reject with specific errors;
 * scope + capability + key-purpose shapes are validated exhaustively; the caller
 * can NOT set proof / trust / key / synchronization state directly. Future-gated
 * device commands (add/link/import/passport/attestation) fail as unavailable.
 * Raw input never appears in errors. NOT a hostile-input parser (Gate E).
 */

import { normalizeContactAliasDisplayTextV1 } from "../aliases";
import {
  validateIdentityLocalRevision,
  validateIdentityPersonaId,
  validateLocalIdentityRootId,
  validatePairwiseRelationshipId,
  validateRoomIdentityBindingId,
} from "../identifiers";
import {
  DeviceAdditionUnavailableError,
  DeviceAuthorizationScopeError,
  DeviceKeyMaterialForbiddenError,
  DeviceKeyModelValidationError,
  DeviceKeyPurposeError,
  DevicePassportUnavailableError,
  DevicePostureAuthorityError,
  HardwareIdentifierForbiddenError,
} from "./device-errors";
import { validateDeviceAuthorizationId, validateLocalDeviceRef } from "./device-identifiers";
import { DEVICE_KEY_PURPOSES, type DeviceKeyPurposeV1 } from "./device-key-purposes";
import {
  validateDeviceAuthorizationScopeV1,
  type DeviceAuthorizationScopeKindV1,
  type DeviceAuthorizationScopeV1,
} from "./device-scopes";
import {
  DEVICE_IDENTITY_CAPABILITIES,
  DEVICE_UNAVAILABLE_CAPABILITIES,
  type DeviceIdentityCapabilityV1,
} from "./device-types";
import {
  DEVICE_FUTURE_GATED_COMMAND_NAMES,
  DEVICE_KEY_MODEL_COMMAND_NAMES,
  type DeviceKeyModelCommandNameV1,
  type DeviceKeyModelCommandV1,
} from "./device-commands";

const DANGEROUS_KEYS = ["__proto__", "prototype", "constructor"];
const KEY_MATERIAL_FIELDS = [
  "publicKey",
  "privateKey",
  "secretKey",
  "seed",
  "mnemonic",
  "signature",
  "certificate",
];
const HARDWARE_FIELDS = [
  "hardwareId",
  "serialNumber",
  "imei",
  "macAddress",
  "advertisingId",
  "hostname",
  "osBuild",
  "attestation",
];
const POSTURE_FIELDS = ["devicePosture", "screenShieldActive"];
const OTHER_FORBIDDEN = [
  "trusted",
  "verified",
  "primary",
  "owner",
  "admin",
  "superuser",
  "linked",
  "passport",
  "remote",
  "synchronized",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function has(obj: Record<string, unknown>, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, k);
}
function assertSafeKeys(obj: Record<string, unknown>): void {
  for (const k of DANGEROUS_KEYS)
    if (has(obj, k)) throw new DeviceKeyModelValidationError("dangerous_key");
  for (const k of KEY_MATERIAL_FIELDS)
    if (has(obj, k)) throw new DeviceKeyMaterialForbiddenError(k);
  for (const k of HARDWARE_FIELDS) if (has(obj, k)) throw new HardwareIdentifierForbiddenError(k);
  for (const k of POSTURE_FIELDS) if (has(obj, k)) throw new DevicePostureAuthorityError(k);
  for (const k of OTHER_FORBIDDEN)
    if (has(obj, k)) throw new DeviceKeyModelValidationError("forbidden_field");
}
function assertExactKeys(obj: Record<string, unknown>, allowed: readonly string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) throw new DeviceKeyModelValidationError("unexpected_field");
  }
}
function req<T>(fn: (s: string) => T, v: unknown): T {
  if (typeof v !== "string") throw new DeviceKeyModelValidationError("bad_id");
  try {
    return fn(v);
  } catch {
    throw new DeviceKeyModelValidationError("bad_id");
  }
}
function revNum(v: unknown): number {
  if (typeof v !== "number") throw new DeviceKeyModelValidationError("missing_revision");
  try {
    validateIdentityLocalRevision(v);
  } catch {
    throw new DeviceKeyModelValidationError("bad_revision");
  }
  return v;
}
function assertLabelText(v: unknown): string {
  if (typeof v !== "string") throw new DeviceKeyModelValidationError("bad_label");
  try {
    normalizeContactAliasDisplayTextV1(v);
  } catch {
    throw new DeviceKeyModelValidationError("bad_label");
  }
  return v;
}

function scopeId(fn: (s: string) => unknown, v: unknown): string {
  if (typeof v !== "string") throw new DeviceAuthorizationScopeError("bad_scope_id");
  try {
    fn(v);
  } catch {
    throw new DeviceAuthorizationScopeError("bad_scope_id");
  }
  return v;
}

function validateScopeInput(raw: unknown): DeviceAuthorizationScopeV1 {
  if (!isPlainObject(raw)) throw new DeviceAuthorizationScopeError("not_an_object");
  assertSafeKeys(raw);
  assertExactKeys(raw, [
    "kind",
    "rootId",
    "personaId",
    "relationshipId",
    "roomBindingId",
    "readOnly",
  ]);
  const kind = raw["kind"] as DeviceAuthorizationScopeKindV1;
  const scope: DeviceAuthorizationScopeV1 = {
    kind,
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
  return validateDeviceAuthorizationScopeV1(scope);
}

function validateCapabilities(
  raw: unknown,
  allowUnavailable: boolean,
): readonly DeviceIdentityCapabilityV1[] {
  if (!Array.isArray(raw)) throw new DeviceKeyModelValidationError("bad_capabilities");
  const out: DeviceIdentityCapabilityV1[] = [];
  for (const c of raw) {
    if (
      typeof c !== "string" ||
      !DEVICE_IDENTITY_CAPABILITIES.includes(c as DeviceIdentityCapabilityV1)
    ) {
      throw new DeviceKeyModelValidationError("unknown_capability");
    }
    if (
      !allowUnavailable &&
      DEVICE_UNAVAILABLE_CAPABILITIES.includes(c as DeviceIdentityCapabilityV1)
    ) {
      throw new DeviceKeyModelValidationError("capability_unavailable");
    }
    out.push(c as DeviceIdentityCapabilityV1);
  }
  return out;
}

function validateKeySlotPurposes(raw: unknown): readonly DeviceKeyPurposeV1[] {
  if (!Array.isArray(raw)) throw new DeviceKeyPurposeError("bad_purposes");
  const out: DeviceKeyPurposeV1[] = [];
  const seen = new Set<string>();
  for (const p of raw) {
    if (typeof p !== "string" || !DEVICE_KEY_PURPOSES.includes(p as DeviceKeyPurposeV1)) {
      throw new DeviceKeyPurposeError("unknown_purpose");
    }
    if (seen.has(p)) throw new DeviceKeyPurposeError("duplicate_purpose"); // one purpose per slot
    seen.add(p);
    out.push(p as DeviceKeyPurposeV1);
  }
  return out;
}

export function validateDeviceKeyModelCommandV1(input: unknown): DeviceKeyModelCommandV1 {
  if (!isPlainObject(input)) throw new DeviceKeyModelValidationError("not_an_object");
  assertSafeKeys(input);
  if (input["schemaVersion"] !== 1) throw new DeviceKeyModelValidationError("bad_version");

  const command = input["command"];
  if (typeof command !== "string") throw new DeviceKeyModelValidationError("unknown_command");
  if (DEVICE_FUTURE_GATED_COMMAND_NAMES.includes(command)) {
    if (
      command === "identity.device.issue_passport" ||
      command === "identity.device.verify_attestation"
    ) {
      throw new DevicePassportUnavailableError("future_gated");
    }
    throw new DeviceAdditionUnavailableError("future_gated");
  }
  if (!DEVICE_KEY_MODEL_COMMAND_NAMES.includes(command as never)) {
    throw new DeviceKeyModelValidationError("unknown_command");
  }
  const name = command as DeviceKeyModelCommandNameV1;

  switch (name) {
    case "identity.device.bootstrap_current_installation_placeholder": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "rootId",
        "expectedRootRevision",
        "scope",
        "capabilities",
        "keySlotPurposes",
      ]);
      const rootId = req(validateLocalIdentityRootId, input["rootId"]);
      const scope = validateScopeInput(input["scope"]);
      if ((scope.rootId as string) !== (rootId as string)) {
        throw new DeviceAuthorizationScopeError("scope_root_mismatch");
      }
      return {
        schemaVersion: 1,
        command: name,
        rootId: rootId as unknown as string,
        expectedRootRevision: revNum(input["expectedRootRevision"]),
        scope,
        capabilities: validateCapabilities(input["capabilities"], false),
        keySlotPurposes: validateKeySlotPurposes(input["keySlotPurposes"]),
      };
    }
    case "identity.device.restrict": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "authorizationId",
        "expectedRevision",
        "requestedScope",
        "requestedCapabilities",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        authorizationId: validateDeviceAuthorizationId(String(input["authorizationId"])),
        expectedRevision: validateIdentityLocalRevision(revNum(input["expectedRevision"])),
        ...(input["requestedScope"] !== undefined
          ? { requestedScope: validateScopeInput(input["requestedScope"]) }
          : {}),
        ...(input["requestedCapabilities"] !== undefined
          ? { requestedCapabilities: validateCapabilities(input["requestedCapabilities"], false) }
          : {}),
      };
    }
    case "identity.device.mark_compromised":
    case "identity.device.revoke": {
      assertExactKeys(input, ["schemaVersion", "command", "authorizationId", "expectedRevision"]);
      return {
        schemaVersion: 1,
        command: name,
        authorizationId: validateDeviceAuthorizationId(String(input["authorizationId"])),
        expectedRevision: validateIdentityLocalRevision(revNum(input["expectedRevision"])),
      };
    }
    case "identity.device.label.set": {
      assertExactKeys(input, [
        "schemaVersion",
        "command",
        "deviceRef",
        "expectedRevision",
        "labelText",
      ]);
      return {
        schemaVersion: 1,
        command: name,
        deviceRef: validateLocalDeviceRef(String(input["deviceRef"])),
        expectedRevision: validateIdentityLocalRevision(revNum(input["expectedRevision"])),
        labelText: assertLabelText(input["labelText"]),
      };
    }
    case "identity.device.label.clear": {
      assertExactKeys(input, ["schemaVersion", "command", "deviceRef", "expectedRevision"]);
      return {
        schemaVersion: 1,
        command: name,
        deviceRef: validateLocalDeviceRef(String(input["deviceRef"])),
        expectedRevision: validateIdentityLocalRevision(revNum(input["expectedRevision"])),
      };
    }
    default: {
      const _never: never = name;
      throw new DeviceKeyModelValidationError(`unhandled:${String(_never)}`);
    }
  }
}
