/**
 * Device link request (TECH-ID-08). A bounded request from a candidate local
 * device context for FUTURE authorization. A request grants NO authority. It
 * carries NO hardware id, phone/email/account, root secret, device private key,
 * DevicePosture, attestation, room title, local device label, history-transfer
 * material, or network endpoint. Validity is an ENGINEERING lifetime (injected
 * clock, current-process only) — NOT cryptographic freshness. Never persisted.
 */

import type {
  IdentityAuthorityEpoch,
  IdentityLocalRevision,
  LocalIdentityRootId,
} from "../identifiers";
import type {
  DeviceAuthorizationScopeV1,
  DeviceIdentityCapabilityV1,
  LocalDeviceRef,
} from "../devices";
import type { DevicePassportKeySlotCommitmentV1 } from "./passport-claims";
import type { DeviceLinkChallengeId, DeviceLinkRequestId } from "./passport-identifiers";

export type DeviceLinkRequestLifecycleV1 =
  | "draft_candidate_local"
  | "pending_local_review"
  | "approved_local_unsigned"
  | "rejected_tombstone"
  | "expired_tombstone"
  | "consumed_future"
  | "revoked_tombstone";

export const DEVICE_LINK_REQUEST_LIFECYCLES: readonly DeviceLinkRequestLifecycleV1[] = [
  "draft_candidate_local",
  "pending_local_review",
  "approved_local_unsigned",
  "rejected_tombstone",
  "expired_tombstone",
  "consumed_future",
  "revoked_tombstone",
];

export interface DeviceLinkRequestValidityV1 {
  readonly createdAtLocal: string;
  readonly expiresAtLocal: string;
  readonly maximumLifetimeMs: number;
  readonly currentProcessOnly: true;
  readonly crossRestartValidity: false;
  readonly cryptographicFreshnessAvailable: false;
  readonly oneTimeCryptographicEnforcementAvailable: false;
}

export const DEVICE_LINK_REQUEST_LIMITS_V1 = {
  minimumLifetimeMs: 60_000,
  defaultLifetimeMs: 300_000,
  maximumLifetimeMs: 900_000,
  maximumPendingRequestsPerRoot: 3,
} as const;

export interface DeviceLinkRequestV1 {
  readonly schemaVersion: 1;
  readonly requestId: DeviceLinkRequestId;
  readonly challengeId: DeviceLinkChallengeId;

  readonly rootId: LocalIdentityRootId;
  readonly candidateDeviceRef: LocalDeviceRef;

  readonly requestedScope: DeviceAuthorizationScopeV1;
  readonly requestedCapabilities: readonly DeviceIdentityCapabilityV1[];
  readonly requestedKeySlots: readonly DevicePassportKeySlotCommitmentV1[];

  readonly rootAuthorityEpoch: IdentityAuthorityEpoch;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: DeviceLinkRequestLifecycleV1;
  readonly validity: DeviceLinkRequestValidityV1;

  readonly candidateBinding: "local_placeholder_unverified";
  readonly transport: "not_implemented_gate_e";
  readonly qrRepresentation: "not_implemented_gate_e";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
  readonly persistence: "forbidden";
}
