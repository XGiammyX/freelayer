/**
 * Opaque local Device Passport identifiers (TECH-ID-08). Each is a LOCAL,
 * opaque reference — encoding no hardware data, no public key material, no root/
 * room/relationship data, no device model/OS, no timestamp-as-authority, no
 * DevicePosture, and no global-discovery meaning. `DeviceLinkChallengeId` is an
 * opaque correlation-resistant identifier ONLY — until Gate F it is NOT a
 * cryptographic nonce and provides NO replay-proof guarantee. Injected
 * generation only.
 */

import type { DeviceKeySlotId } from "../devices";
import { DeviceLinkRequestValidationError } from "./passport-errors";

export type DevicePassportId = string & { readonly __devicePassportId: unique symbol };
export type DeviceLinkRequestId = string & { readonly __deviceLinkRequestId: unique symbol };
export type DeviceLinkChallengeId = string & { readonly __deviceLinkChallengeId: unique symbol };

const ID_BODY_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/;

function validateOpaque(input: unknown, prefix: string): string {
  if (typeof input !== "string" || input.length < 4 || input.length > 128) {
    throw new DeviceLinkRequestValidationError("bad_id_length");
  }
  if (!input.startsWith(`${prefix}-`) || !ID_BODY_RE.test(input) || input.includes("@")) {
    throw new DeviceLinkRequestValidationError("bad_id_format");
  }
  return input;
}

export function validateDevicePassportId(input: string): DevicePassportId {
  return validateOpaque(input, "pass") as DevicePassportId;
}
export function validateDeviceLinkRequestId(input: string): DeviceLinkRequestId {
  return validateOpaque(input, "lreq") as DeviceLinkRequestId;
}
export function validateDeviceLinkChallengeId(input: string): DeviceLinkChallengeId {
  return validateOpaque(input, "lchal") as DeviceLinkChallengeId;
}

/** Pre-generated ids passed INTO the reducer for create/prepare commands. */
export interface DevicePassportGeneratedIdsV1 {
  readonly requestId?: DeviceLinkRequestId;
  readonly challengeId?: DeviceLinkChallengeId;
  readonly passportId?: DevicePassportId;
  readonly keySlotIds?: readonly DeviceKeySlotId[];
}
