/**
 * Device Passport claims + validity + key-slot commitments (TECH-ID-08). The
 * claims are the EXACT root, device, scope, capabilities, epoch, and key-purpose
 * commitments a FUTURE Gate F signature would authorize. They carry NO root
 * secret, NO device private key, NO hardware/model/OS, NO DevicePosture, NO
 * attestation, NO alias/contact/room graph, NO history data, NO wildcard
 * capability, and NO recursive delegation. A key-slot commitment holds NO key
 * material (Gate F). Nothing here is signed or verified in TECH-ID-08.
 */

import type {
  IdentityAuthorityEpoch,
  IdentityLocalRevision,
  LocalIdentityRootId,
} from "../identifiers";
import type { DeviceAuthorizationId, DeviceKeySlotId, LocalDeviceRef } from "../devices";
import type { DeviceKeyPurposeV1 } from "../devices";
import type { DeviceAuthorizationScopeV1, DeviceIdentityCapabilityV1 } from "../devices";
import type {
  DeviceLinkChallengeId,
  DeviceLinkRequestId,
  DevicePassportId,
} from "./passport-identifiers";

/** A non-cryptographic placeholder for one requested future key purpose. */
export interface DevicePassportKeySlotCommitmentV1 {
  readonly slotId: DeviceKeySlotId;
  readonly purpose: DeviceKeyPurposeV1;
  readonly candidatePublicMaterial: "not_present_gate_f";
  readonly algorithm: "not_selected_gate_f";
  readonly commitmentBinding: "not_implemented_gate_f";
}

export interface DevicePassportValidityV1 {
  readonly issuedAtLocal: string;
  readonly expiresAtLocal?: string;
  readonly rootAuthorityEpoch: IdentityAuthorityEpoch;
  readonly minimumDeviceAuthorizationRevision: IdentityLocalRevision;
  readonly trustedTimeAvailable: false;
  readonly cryptographicFreshnessAvailable: false;
  readonly crossRestartDraftValidity: false;
}

export interface DevicePassportClaimsV1 {
  readonly schemaVersion: 1;
  readonly passportId: DevicePassportId;

  readonly issuerRootId: LocalIdentityRootId;
  readonly issuerAuthorityEpoch: IdentityAuthorityEpoch;

  readonly subjectDeviceRef: LocalDeviceRef;
  readonly subjectAuthorizationId: DeviceAuthorizationId;

  readonly grantedScope: DeviceAuthorizationScopeV1;
  readonly grantedCapabilities: readonly DeviceIdentityCapabilityV1[];

  readonly keySlotCommitments: readonly DevicePassportKeySlotCommitmentV1[];

  readonly originatingRequestId: DeviceLinkRequestId;
  readonly originatingChallengeId: DeviceLinkChallengeId;

  readonly issuanceRevision: IdentityLocalRevision;
  readonly validity: DevicePassportValidityV1;

  readonly delegationAllowed: false;
  readonly recoveryAuthorityGranted: false;
  readonly rootSecretTransferAllowed: false;
  readonly historyTransferIncluded: false;
  readonly devicePostureClaimIncluded: false;
  readonly attestationClaimIncluded: false;
}
