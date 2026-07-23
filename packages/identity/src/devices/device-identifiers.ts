/**
 * Opaque local device identifiers (TECH-ID-07). A LOCAL reference for one client
 * installation context — NOT an OS device id, hardware serial, advertising id,
 * browser fingerprint, hostname, model name, or attestation identity. It encodes
 * no hardware/OS data, no root/persona/room/member data, no timestamp, no public
 * key/fingerprint, no posture, and no authority. It has no public-discovery
 * meaning and is never derived from a (future) public key. Injected generation
 * only (never randomness in a reducer).
 */

import { DeviceKeyModelValidationError } from "./device-errors";

export type LocalDeviceRef = string & { readonly __localDeviceRef: unique symbol };
export type DeviceAuthorizationId = string & { readonly __deviceAuthorizationId: unique symbol };
export type DeviceKeySlotId = string & { readonly __deviceKeySlotId: unique symbol };

const ID_BODY_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/;

function validateOpaque(input: unknown, prefix: string): string {
  if (typeof input !== "string" || input.length < 4 || input.length > 128) {
    throw new DeviceKeyModelValidationError("bad_id_length");
  }
  if (!input.startsWith(`${prefix}-`) || !ID_BODY_RE.test(input) || input.includes("@")) {
    throw new DeviceKeyModelValidationError("bad_id_format");
  }
  return input;
}

export function validateLocalDeviceRef(input: string): LocalDeviceRef {
  return validateOpaque(input, "dev") as LocalDeviceRef;
}
export function validateDeviceAuthorizationId(input: string): DeviceAuthorizationId {
  return validateOpaque(input, "devauth") as DeviceAuthorizationId;
}
export function validateDeviceKeySlotId(input: string): DeviceKeySlotId {
  return validateOpaque(input, "devslot") as DeviceKeySlotId;
}

/** Pre-generated ids passed INTO the reducer for bootstrap. */
export interface DeviceGeneratedIdsV1 {
  readonly deviceRef?: LocalDeviceRef;
  readonly authorizationId?: DeviceAuthorizationId;
  readonly keySlotIds?: readonly DeviceKeySlotId[];
}
