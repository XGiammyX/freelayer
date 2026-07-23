/**
 * Device authorization snapshot + stale-context invalidation + capability
 * attenuation (TECH-ID-07). A snapshot is a point-in-time view a caller captured
 * to authorize a later operation. It is re-checked against the AUTHORITATIVE
 * current record immediately before execution; any drift fails CLOSED. Stale
 * authorization is NEVER silently refreshed. Capabilities may only be REMOVED.
 * `cryptographicallyAuthorized` is always false — a snapshot is not a proof.
 */

import type { IdentityLocalRevision, LocalIdentityRootId } from "../identifiers";
import {
  DeviceAuthorizationLifecycleError,
  DeviceAuthorizationRevisionMismatchError,
  DeviceAuthorizationScopeError,
  DeviceCapabilityAttenuationError,
  DeviceKeyModelValidationError,
} from "./device-errors";
import type { DeviceAuthorizationId, LocalDeviceRef } from "./device-identifiers";
import { isDeviceOperationalLifecycleV1 } from "./device-lifecycle";
import { deviceScopeContainsV1, type DeviceAuthorizationScopeV1 } from "./device-scopes";
import { DEVICE_IDENTITY_CAPABILITIES } from "./device-types";
import type {
  DeviceAuthorizationLifecycleV1,
  DeviceAuthorizationRecordV1,
  DeviceIdentityCapabilityV1,
  DeviceRootRefV1,
} from "./device-types";

export type DeviceAuthorizationRevision = IdentityLocalRevision;

export interface DeviceAuthorizationSnapshotV1 {
  readonly schemaVersion: 1;
  readonly rootId: LocalIdentityRootId;
  readonly deviceRef: LocalDeviceRef;
  readonly authorizationId: DeviceAuthorizationId;
  readonly revision: DeviceAuthorizationRevision;
  readonly lifecycle: DeviceAuthorizationLifecycleV1;
  readonly scope: DeviceAuthorizationScopeV1;
  readonly capabilities: readonly DeviceIdentityCapabilityV1[];
  readonly cryptographicallyAuthorized: false;
}

/** Build a snapshot from an authoritative record (never fabricates authority). */
export function deviceAuthorizationSnapshotV1(
  record: DeviceAuthorizationRecordV1,
): DeviceAuthorizationSnapshotV1 {
  return {
    schemaVersion: 1,
    rootId: record.rootId,
    deviceRef: record.deviceRef,
    authorizationId: record.authorizationId,
    revision: record.revision,
    lifecycle: record.lifecycle,
    scope: record.scope,
    capabilities: [...record.capabilities],
    cryptographicallyAuthorized: false,
  };
}

/**
 * Assert a captured snapshot still authorizes an operation against the current
 * authoritative record + root state. Fails closed on any drift. DevicePosture /
 * room policy may only TIGHTEN (never authorize): `postureTightens:true` denies.
 */
export function assertDeviceAuthorizationSnapshotCurrentV1(input: {
  snapshot: DeviceAuthorizationSnapshotV1;
  current: DeviceAuthorizationRecordV1;
  rootRef: DeviceRootRefV1;
  requiredCapability?: DeviceIdentityCapabilityV1;
  requiredScope?: DeviceAuthorizationScopeV1;
  postureTightens?: boolean;
}): void {
  const { snapshot, current, rootRef } = input;

  // Identity of the record must match across snapshot / current / root.
  if (
    snapshot.rootId !== current.rootId ||
    snapshot.deviceRef !== current.deviceRef ||
    snapshot.authorizationId !== current.authorizationId ||
    current.rootId !== rootRef.rootId
  ) {
    throw new DeviceKeyModelValidationError("snapshot_identity_mismatch");
  }

  // Root must be usable; root revocation/compromise invalidates child devices.
  if (!rootRef.rootActive || rootRef.rootCompromised) {
    throw new DeviceAuthorizationLifecycleError("root_not_usable");
  }

  // Revision must not have moved.
  if ((snapshot.revision as number) !== (current.revision as number)) {
    throw new DeviceAuthorizationRevisionMismatchError();
  }

  // Lifecycle must still permit ordinary operations.
  if (!isDeviceOperationalLifecycleV1(current.lifecycle)) {
    throw new DeviceAuthorizationLifecycleError("not_operational");
  }

  // DevicePosture / room policy may only tighten (never grant).
  if (input.postureTightens === true) {
    throw new DeviceAuthorizationLifecycleError("tightened_by_posture_or_policy");
  }

  // Capability must still be present in BOTH snapshot and current record.
  if (input.requiredCapability !== undefined) {
    if (
      !snapshot.capabilities.includes(input.requiredCapability) ||
      !current.capabilities.includes(input.requiredCapability)
    ) {
      throw new DeviceCapabilityAttenuationError("capability_removed");
    }
  }

  // Scope must still cover the requested operation in BOTH snapshot and current.
  if (input.requiredScope !== undefined) {
    if (
      !deviceScopeContainsV1(snapshot.scope, input.requiredScope) ||
      !deviceScopeContainsV1(current.scope, input.requiredScope)
    ) {
      throw new DeviceAuthorizationScopeError("scope_no_longer_covers");
    }
  }
}

/**
 * Attenuate capabilities: `requested` must be a subset of `current` (dedup,
 * known values only). Capabilities may only be REMOVED — no re-expansion.
 */
export function attenuateDeviceCapabilitiesV1(
  current: readonly DeviceIdentityCapabilityV1[],
  requested: readonly DeviceIdentityCapabilityV1[],
): readonly DeviceIdentityCapabilityV1[] {
  const currentSet = new Set(current);
  const out: DeviceIdentityCapabilityV1[] = [];
  const seen = new Set<DeviceIdentityCapabilityV1>();
  for (const cap of requested) {
    if (!DEVICE_IDENTITY_CAPABILITIES.includes(cap)) {
      throw new DeviceCapabilityAttenuationError("unknown_capability");
    }
    if (!currentSet.has(cap)) {
      throw new DeviceCapabilityAttenuationError("capability_expansion_forbidden");
    }
    if (!seen.has(cap)) {
      seen.add(cap);
      out.push(cap);
    }
  }
  return out;
}
