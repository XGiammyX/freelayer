/**
 * Device-key-model command union (TECH-ID-07). Explicit + discriminated — NO
 * generic device patch. Every mutation carries the expected root and/or device-
 * authorization revisions canonical authorization needs. Restriction may only
 * narrow scope + capabilities; revocation is terminal. There is NO command to add
 * a second device, link, import, approve a QR, copy a root secret, issue a
 * passport, or verify attestation — those are future-gated (TECH-ID-08 / Gate
 * E/F/H) and simply do not exist here.
 */

import type { IdentityLocalRevision } from "../identifiers";
import type { DeviceAuthorizationId, LocalDeviceRef } from "./device-identifiers";
import type { DeviceKeyPurposeV1 } from "./device-key-purposes";
import type { DeviceAuthorizationScopeV1 } from "./device-scopes";
import type { DeviceIdentityCapabilityV1 } from "./device-types";

export interface BootstrapCurrentDevicePlaceholderCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.device.bootstrap_current_installation_placeholder";
  readonly rootId: string;
  readonly expectedRootRevision: number;
  readonly scope: DeviceAuthorizationScopeV1;
  readonly capabilities: readonly DeviceIdentityCapabilityV1[];
  readonly keySlotPurposes: readonly DeviceKeyPurposeV1[];
}

export interface RestrictDeviceAuthorizationCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.device.restrict";
  readonly authorizationId: DeviceAuthorizationId;
  readonly expectedRevision: IdentityLocalRevision;
  readonly requestedScope?: DeviceAuthorizationScopeV1;
  readonly requestedCapabilities?: readonly DeviceIdentityCapabilityV1[];
}

export interface MarkDeviceAuthorizationCompromisedCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.device.mark_compromised";
  readonly authorizationId: DeviceAuthorizationId;
  readonly expectedRevision: IdentityLocalRevision;
}

export interface RevokeDeviceAuthorizationCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.device.revoke";
  readonly authorizationId: DeviceAuthorizationId;
  readonly expectedRevision: IdentityLocalRevision;
}

export interface SetLocalDeviceLabelCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.device.label.set";
  readonly deviceRef: LocalDeviceRef;
  readonly expectedRevision: IdentityLocalRevision;
  readonly labelText: string;
}

export interface ClearLocalDeviceLabelCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.device.label.clear";
  readonly deviceRef: LocalDeviceRef;
  readonly expectedRevision: IdentityLocalRevision;
}

export type DeviceKeyModelCommandV1 =
  | BootstrapCurrentDevicePlaceholderCommandV1
  | RestrictDeviceAuthorizationCommandV1
  | MarkDeviceAuthorizationCompromisedCommandV1
  | RevokeDeviceAuthorizationCommandV1
  | SetLocalDeviceLabelCommandV1
  | ClearLocalDeviceLabelCommandV1;

export type DeviceKeyModelCommandNameV1 = DeviceKeyModelCommandV1["command"];

export const DEVICE_KEY_MODEL_COMMAND_NAMES: readonly DeviceKeyModelCommandNameV1[] = [
  "identity.device.bootstrap_current_installation_placeholder",
  "identity.device.restrict",
  "identity.device.mark_compromised",
  "identity.device.revoke",
  "identity.device.label.set",
  "identity.device.label.clear",
];

/** Production commands that MUST NOT exist / are future-gated (TECH-ID-08 + Gate E/F/H). */
export const DEVICE_FUTURE_GATED_COMMAND_NAMES: readonly string[] = [
  "identity.device.add_remote",
  "identity.device.link",
  "identity.device.approve_qr",
  "identity.device.import",
  "identity.device.copy_root_secret",
  "identity.device.issue_passport",
  "identity.device.verify_attestation",
];
