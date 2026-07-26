/**
 * Device Passport command unions (TECH-ID-08). Explicit + discriminated — NO
 * generic passport patch. Every mutation carries the expected revisions needed
 * for optimistic concurrency. Approval produces only an `approved_local_unsigned`
 * passport that grants NO operational authority. There is NO command to sign,
 * issue, remotely accept, transport, or activate a passport — those are future-
 * gated (Gate F/E/H) and simply do not exist here.
 */

import type { IdentityLocalRevision } from "../identifiers";
import type {
  DeviceAuthorizationId,
  DeviceAuthorizationScopeV1,
  DeviceIdentityCapabilityV1,
  DeviceKeyPurposeV1,
} from "../devices";
import type { DeviceLinkRequestId, DevicePassportId } from "./passport-identifiers";

// ---- Link request commands ----

export interface CreateDeviceLinkRequestCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.device_link_request.create_local";
  readonly rootId: string;
  readonly expectedRootAuthorityEpoch: number;
  readonly candidateDeviceRef: string;
  readonly requestedScope: DeviceAuthorizationScopeV1;
  readonly requestedCapabilities: readonly DeviceIdentityCapabilityV1[];
  readonly requestedKeySlotPurposes: readonly DeviceKeyPurposeV1[];
  readonly lifetimeMs?: number;
}

interface RequestLifecycleCommandBaseV1 {
  readonly schemaVersion: 1;
  readonly requestId: DeviceLinkRequestId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface SubmitDeviceLinkRequestCommandV1 extends RequestLifecycleCommandBaseV1 {
  readonly command: "identity.device_link_request.submit_for_review";
}
export interface RejectDeviceLinkRequestCommandV1 extends RequestLifecycleCommandBaseV1 {
  readonly command: "identity.device_link_request.reject";
}
export interface ExpireDeviceLinkRequestCommandV1 extends RequestLifecycleCommandBaseV1 {
  readonly command: "identity.device_link_request.expire";
}
export interface RevokeDeviceLinkRequestCommandV1 extends RequestLifecycleCommandBaseV1 {
  readonly command: "identity.device_link_request.revoke";
}

// ---- Passport commands ----

export interface PrepareDevicePassportDraftCommandV1 {
  readonly schemaVersion: 1;
  readonly command: "identity.device_passport.prepare_draft";
  readonly requestId: DeviceLinkRequestId;
  readonly expectedRequestRevision: IdentityLocalRevision;
  readonly subjectAuthorizationId: DeviceAuthorizationId;
}

interface PassportLifecycleCommandBaseV1 {
  readonly schemaVersion: 1;
  readonly passportId: DevicePassportId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface ApproveDevicePassportUnsignedCommandV1 extends PassportLifecycleCommandBaseV1 {
  readonly command: "identity.device_passport.approve_local_unsigned";
}
export interface RestrictDevicePassportCommandV1 extends PassportLifecycleCommandBaseV1 {
  readonly command: "identity.device_passport.restrict_local";
  readonly requestedScope?: DeviceAuthorizationScopeV1;
  readonly requestedCapabilities?: readonly DeviceIdentityCapabilityV1[];
}
export interface ExpireDevicePassportCommandV1 extends PassportLifecycleCommandBaseV1 {
  readonly command: "identity.device_passport.expire";
}
export interface RevokeDevicePassportCommandV1 extends PassportLifecycleCommandBaseV1 {
  readonly command: "identity.device_passport.revoke";
}

export type DeviceLinkRequestCommandV1 =
  | CreateDeviceLinkRequestCommandV1
  | SubmitDeviceLinkRequestCommandV1
  | RejectDeviceLinkRequestCommandV1
  | ExpireDeviceLinkRequestCommandV1
  | RevokeDeviceLinkRequestCommandV1;

export type DevicePassportCommandV1 =
  | PrepareDevicePassportDraftCommandV1
  | ApproveDevicePassportUnsignedCommandV1
  | RestrictDevicePassportCommandV1
  | ExpireDevicePassportCommandV1
  | RevokeDevicePassportCommandV1;

export type DevicePassportModelCommandV1 = DeviceLinkRequestCommandV1 | DevicePassportCommandV1;

export type DevicePassportModelCommandNameV1 = DevicePassportModelCommandV1["command"];

export const DEVICE_PASSPORT_MODEL_COMMAND_NAMES: readonly DevicePassportModelCommandNameV1[] = [
  "identity.device_link_request.create_local",
  "identity.device_link_request.submit_for_review",
  "identity.device_link_request.reject",
  "identity.device_link_request.expire",
  "identity.device_link_request.revoke",
  "identity.device_passport.prepare_draft",
  "identity.device_passport.approve_local_unsigned",
  "identity.device_passport.restrict_local",
  "identity.device_passport.expire",
  "identity.device_passport.revoke",
];

/** Production commands that MUST NOT exist / are future-gated (Gate F/E/H). */
export const DEVICE_PASSPORT_FUTURE_GATED_COMMAND_NAMES: readonly string[] = [
  "identity.device_passport.issue_signed",
  "identity.device_passport.accept_verified",
  "identity.device_passport.sign",
  "identity.device_passport.verify",
  "identity.device_passport.transport_qr",
  "identity.device_passport.remote_accept",
  "identity.device_passport.patch",
];
