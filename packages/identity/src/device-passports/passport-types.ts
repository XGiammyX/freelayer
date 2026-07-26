/**
 * Device Passport domain types (TECH-ID-08). A passport draft / local approval is
 * LOCAL, NON-CRYPTOGRAPHIC and grants NO operational device authority: it is not
 * a signature, not a verified credential, not identity, not DevicePosture, not
 * attestation. `issued_future_signed` + `accepted_future_verified` are NOT
 * constructible in production. In-process provenance is not a signature, is not
 * portable, and is never accepted as remote device authorization.
 */

import type {
  IdentityAuthorityEpoch,
  IdentityLocalRevision,
  LocalIdentityRootId,
} from "../identifiers";
import type { LocalIdentityRootKindV1 } from "../identity-types";
import type {
  DeviceAuthorizationScopeKindV1,
  DeviceAuthorizationScopeV1,
  DeviceAuthorizationSnapshotV1,
  DeviceIdentityCapabilityV1,
} from "../devices";
import type { DevicePassportClaimsV1 } from "./passport-claims";
import type { DeviceLinkRequestV1 } from "./passport-link-requests";
import type { DevicePassportId } from "./passport-identifiers";

// ---------------------------------------------------------------------------
// Lifecycle + authenticity
// ---------------------------------------------------------------------------

export type DevicePassportLifecycleV1 =
  | "draft_local"
  | "approved_local_unsigned"
  | "issued_future_signed"
  | "accepted_future_verified"
  | "restricted_local"
  | "expired_tombstone"
  | "revoked_tombstone";

export const DEVICE_PASSPORT_LIFECYCLES: readonly DevicePassportLifecycleV1[] = [
  "draft_local",
  "approved_local_unsigned",
  "issued_future_signed",
  "accepted_future_verified",
  "restricted_local",
  "expired_tombstone",
  "revoked_tombstone",
];

/** Lifecycles a caller may NEVER construct in production (Gate F). */
export const DEVICE_PASSPORT_FORBIDDEN_PRODUCTION_LIFECYCLES: readonly DevicePassportLifecycleV1[] =
  ["issued_future_signed", "accepted_future_verified"];

export type DevicePassportAuthenticityV1 =
  | "local_draft_untrusted"
  | "local_policy_approved_unsigned"
  | "future_signed_unverified"
  | "future_signed_verified";

// ---------------------------------------------------------------------------
// Caller-resolved root + approver context
// ---------------------------------------------------------------------------

export interface DevicePassportRootRefV1 {
  readonly rootId: LocalIdentityRootId;
  readonly rootKind: LocalIdentityRootKindV1;
  readonly rootRevision: IdentityLocalRevision;
  readonly rootAuthorityEpoch: IdentityAuthorityEpoch;
  /** Caller asserts the root is usable (active + ephemeral epoch valid). */
  readonly rootActive: boolean;
  /** Caller asserts the root may APPROVE (active, not revoked/compromised/
   *  recovered-reverification-required). Never true for a compromised root. */
  readonly rootApprovalEligible: boolean;
}

export interface DevicePassportApproverContextV1 {
  readonly rootId: LocalIdentityRootId;
  readonly rootRevision: IdentityLocalRevision;
  readonly rootAuthorityEpoch: IdentityAuthorityEpoch;

  readonly approverDeviceAuthorization?: DeviceAuthorizationSnapshotV1;
  readonly approverSource: "local_root_controller_placeholder" | "existing_device_future";

  readonly maximumScope: DeviceAuthorizationScopeV1;
  readonly maximumCapabilities: readonly DeviceIdentityCapabilityV1[];

  /** Caller asserts the root may approve (see DevicePassportRootRefV1). */
  readonly rootApprovalEligible: boolean;
  readonly cryptographicRootControlProven: false;
}

// ---------------------------------------------------------------------------
// Passport record
// ---------------------------------------------------------------------------

export interface DevicePassportV1 {
  readonly schemaVersion: 1;
  readonly passportId: DevicePassportId;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: DevicePassportLifecycleV1;

  readonly claims: DevicePassportClaimsV1;

  readonly approvalState: "not_reviewed" | "approved_local_policy_only" | "rejected";
  readonly signatureState: "not_implemented_gate_f";
  readonly verificationState: "not_verified_no_crypto";
  readonly operationalAuthority: "none";

  readonly remotelyAccepted: false;
  readonly cryptographicallyIssued: false;
  readonly cryptographicallyVerified: false;

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
  readonly persistence: "forbidden";
}

// ---------------------------------------------------------------------------
// Summary + revocation result
// ---------------------------------------------------------------------------

export interface DevicePassportSummaryV1 {
  readonly schemaVersion: 1;
  readonly lifecycle: DevicePassportLifecycleV1;
  readonly authenticity: DevicePassportAuthenticityV1;

  readonly scopeKind?: DeviceAuthorizationScopeKindV1;
  readonly capabilityCount?: number;
  readonly keyPurposeCount?: number;

  readonly cryptographicallyIssued: false;
  readonly cryptographicallyVerified: false;
  readonly operationalAuthority: false;
  readonly remotelyAccepted: false;
  readonly hardwareAttested: false;
  readonly postureVerified: false;

  readonly expiresAtLocal?: string;
  readonly redacted: boolean;
}

export interface LocalDevicePassportRevocationResultV1 {
  readonly schemaVersion: 1;
  readonly passportRevokedLocally: true;
  readonly localApprovalInvalidated: true;
  readonly remoteDeviceAffected: false;
  readonly deviceAuthorizationAffected: false;
  readonly messageKeysRotated: false;
  readonly roomKeysRotated: false;
  readonly deviceDataErased: false;
  readonly cryptographicRevocationPerformed: false;
  readonly redacted: true;
}

// ---------------------------------------------------------------------------
// Aggregate (current-process memory / null only)
// ---------------------------------------------------------------------------

export interface DevicePassportStateV1 {
  readonly schemaVersion: 1;
  /** The process epoch this aggregate was created in. A change means restart. */
  readonly processEpoch: string;
  readonly requests: readonly DeviceLinkRequestV1[];
  readonly passports: readonly DevicePassportV1[];
  readonly persistenceClass: "current_process_memory" | "null";
}
