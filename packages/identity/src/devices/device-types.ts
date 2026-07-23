/**
 * Device-key domain types (TECH-ID-07). A device authorization record is a LOCAL,
 * NON-CRYPTOGRAPHIC relationship between ONE identity root and ONE local device
 * reference. It is not a key, not a cryptographic proof, not identity, not
 * DevicePosture, not a RoomOS member. A device is not a person; a device
 * reference is not a hardware identifier; a device label is not authority.
 * `cryptographicallyAuthorized` is always false until TECH-ID-08 + Gate F.
 *
 * RoomOS role/state and DevicePosture are never embedded; they never authorize a
 * device. The Identity Firewall never imports @freelayer/rooms.
 */

import type { IdentityLocalRevision, LocalIdentityRootId } from "../identifiers";
import type { LocalIdentityRootKindV1 } from "../identity-types";
import type { DeviceAuthorizationId, LocalDeviceRef } from "./device-identifiers";
import type { DeviceAuthorizationScopeV1, DeviceAuthorizationScopeKindV1 } from "./device-scopes";
import type { DeviceKeySlotV1 } from "./device-key-slots";

// ---------------------------------------------------------------------------
// Class + lifecycle
// ---------------------------------------------------------------------------

export type LocalDeviceClassV1 =
  | "current_installation_placeholder"
  | "linked_device_future"
  | "temporary_device_future"
  | "read_only_device_future"
  | "cold_authorizer_future";

export const LOCAL_DEVICE_CLASSES: readonly LocalDeviceClassV1[] = [
  "current_installation_placeholder",
  "linked_device_future",
  "temporary_device_future",
  "read_only_device_future",
  "cold_authorizer_future",
];

export type DeviceAuthorizationLifecycleV1 =
  | "draft_local"
  | "active_local_unverified"
  | "restricted_local"
  | "compromised_suspected"
  | "revoked_tombstone";

export const DEVICE_AUTHORIZATION_LIFECYCLES: readonly DeviceAuthorizationLifecycleV1[] = [
  "draft_local",
  "active_local_unverified",
  "restricted_local",
  "compromised_suspected",
  "revoked_tombstone",
];

// ---------------------------------------------------------------------------
// Capabilities (local constraints, never proof; separate from RoomOS roles)
// ---------------------------------------------------------------------------

export type DeviceIdentityCapabilityV1 =
  | "identity.summary.read"
  | "identity.persona.use"
  | "identity.relationship.use"
  | "identity.room_binding.use"
  | "identity.device.list_redacted"
  | "identity.device.restrict"
  | "identity.device.mark_compromised"
  | "identity.device.revoke"
  | "identity.device.add_future"
  | "identity.recovery.approve_future";

export const DEVICE_IDENTITY_CAPABILITIES: readonly DeviceIdentityCapabilityV1[] = [
  "identity.summary.read",
  "identity.persona.use",
  "identity.relationship.use",
  "identity.room_binding.use",
  "identity.device.list_redacted",
  "identity.device.restrict",
  "identity.device.mark_compromised",
  "identity.device.revoke",
  "identity.device.add_future",
  "identity.recovery.approve_future",
];

/** Capabilities that are structurally UNAVAILABLE in TECH-ID-07 (future-gated). */
export const DEVICE_UNAVAILABLE_CAPABILITIES: readonly DeviceIdentityCapabilityV1[] = [
  "identity.device.add_future",
  "identity.recovery.approve_future",
];

// ---------------------------------------------------------------------------
// Caller-resolved root reference (decouples the model from a specific vault)
// ---------------------------------------------------------------------------

export interface DeviceRootRefV1 {
  readonly rootId: LocalIdentityRootId;
  readonly rootKind: LocalIdentityRootKindV1;
  readonly rootRevision: IdentityLocalRevision;
  /** Caller asserts the root is usable (active + ephemeral process epoch valid). */
  readonly rootActive: boolean;
  /** Caller asserts the root is compromised/revoked (invalidates child devices). */
  readonly rootCompromised: boolean;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface DeviceAuthorizationRecordV1 {
  readonly schemaVersion: 1;
  readonly authorizationId: DeviceAuthorizationId;
  readonly deviceRef: LocalDeviceRef;
  readonly rootId: LocalIdentityRootId;
  readonly rootKind: LocalIdentityRootKindV1;
  readonly revision: IdentityLocalRevision;

  readonly deviceClass: LocalDeviceClassV1;
  readonly lifecycle: DeviceAuthorizationLifecycleV1;
  readonly scope: DeviceAuthorizationScopeV1;
  readonly capabilities: readonly DeviceIdentityCapabilityV1[];

  readonly origin: "local_root_bootstrap_placeholder" | "device_passport_future";
  readonly authorizationProofState:
    "local_unverified_placeholder" | "not_implemented_tech_id_08_gate_f";

  readonly cryptographicallyAuthorized: false;
  readonly remotelySynchronized: false;
  readonly hardwareAttested: false;

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
  readonly persistenceClass: "memory_only" | "null";
}

export interface LocalDeviceLabelV1 {
  readonly schemaVersion: 1;
  readonly deviceRef: LocalDeviceRef;
  readonly normalizedLabel: string;
  readonly visibility: "local_only";
  readonly peerShared: false;
  readonly authority: "none";
  readonly postureEvidence: false;
}

/** The local aggregate for one caller scope. Memory/null only. */
export interface DeviceKeyModelStateV1 {
  readonly schemaVersion: 1;
  readonly authorizations: readonly DeviceAuthorizationRecordV1[];
  readonly keySlots: readonly DeviceKeySlotV1[];
  readonly labels: readonly LocalDeviceLabelV1[];
  readonly persistenceClass: "memory_only" | "null";
}

// ---------------------------------------------------------------------------
// Summary + revocation result
// ---------------------------------------------------------------------------

export interface LocalDeviceSummaryV1 {
  readonly schemaVersion: 1;
  readonly deviceRef?: LocalDeviceRef;
  readonly lifecycle: DeviceAuthorizationLifecycleV1;
  readonly deviceClass: LocalDeviceClassV1;
  readonly scopeKind: DeviceAuthorizationScopeKindV1;
  readonly capabilityCount?: number;
  readonly localLabel?: string;

  readonly cryptographicallyAuthorized: false;
  readonly hardwareAttested: false;
  readonly postureVerified: false;
  readonly remotelySynchronized: false;
  readonly redacted: boolean;
}

export interface LocalDeviceRevocationResultV1 {
  readonly schemaVersion: 1;
  readonly revokedLocally: true;
  readonly localSnapshotsInvalidated: true;
  readonly remoteDevicesAffected: false;
  readonly remoteSessionsAffected: false;
  readonly messageKeysRotated: false;
  readonly roomKeysRotated: false;
  readonly deviceDataErased: false;
  readonly cryptographicRevocationPerformed: false;
  readonly redacted: true;
}
