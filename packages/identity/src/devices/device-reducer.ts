/**
 * Pure device-key-model reducer (TECH-ID-07). PURE: validate-before-mutate; no
 * storage/network/notification/AI/crypto/randomness; no key material ever; no
 * RoomOS/Secure-Device calls; injected ids + clock + a validated root ref only;
 * source state/command never mutated; deterministic; revisions +1; failure → no
 * partial state. Bootstrap creates ONE local unverified placeholder + reserved
 * (empty) key slots for a root with no existing device record. Restriction only
 * narrows; revocation is a terminal local tombstone that marks the device's key
 * slots operationally revoked and performs NO remote/cryptographic action.
 */

import { FIRST_IDENTITY_REVISION, nextIdentityRevision } from "../identifiers";
import { normalizeContactAliasDisplayTextV1 } from "../aliases";
import {
  DeviceAdditionUnavailableError,
  DeviceAuthorizationLifecycleError,
  DeviceAuthorizationNotFoundError,
  DeviceAuthorizationRevisionMismatchError,
  DeviceKeyModelValidationError,
} from "./device-errors";
import { assertDeviceAuthorizationTransitionV1 } from "./device-lifecycle";
import { attenuateDeviceCapabilitiesV1 } from "./device-authorization-context";
import { attenuateDeviceAuthorizationScopeV1 } from "./device-scopes";
import type { DeviceGeneratedIdsV1 } from "./device-identifiers";
import type { DeviceKeySlotV1 } from "./device-key-slots";
import type { DeviceKeyModelCommandV1 } from "./device-commands";
import type {
  DeviceAuthorizationRecordV1,
  DeviceKeyModelStateV1,
  DeviceRootRefV1,
  LocalDeviceLabelV1,
  LocalDeviceRevocationResultV1,
} from "./device-types";

export interface ReduceDeviceKeyModelInputV1 {
  readonly state: DeviceKeyModelStateV1;
  readonly command: DeviceKeyModelCommandV1;
  /** Resolved + validated root (required for bootstrap). */
  readonly rootRef?: DeviceRootRefV1;
  readonly generatedIds: DeviceGeneratedIdsV1;
  readonly clockValue: string;
}

function requireRootRef(ref: DeviceRootRefV1 | undefined): DeviceRootRefV1 {
  if (ref === undefined) throw new DeviceKeyModelValidationError("missing_root_ref");
  if (!ref.rootActive || ref.rootCompromised) {
    throw new DeviceAuthorizationLifecycleError("root_not_usable");
  }
  return ref;
}

function findAuth(state: DeviceKeyModelStateV1, authorizationId: string): number {
  return state.authorizations.findIndex((a) => (a.authorizationId as string) === authorizationId);
}
function findAuthByDevice(state: DeviceKeyModelStateV1, deviceRef: string): number {
  return state.authorizations.findIndex((a) => (a.deviceRef as string) === deviceRef);
}

export function reduceDeviceKeyModelCommandV1(
  input: ReduceDeviceKeyModelInputV1,
): DeviceKeyModelStateV1 {
  const { state, command, generatedIds, clockValue: now } = input;

  switch (command.command) {
    case "identity.device.bootstrap_current_installation_placeholder": {
      const ref = requireRootRef(input.rootRef);
      if ((ref.rootId as string) !== command.rootId) {
        throw new DeviceKeyModelValidationError("root_mismatch");
      }
      if ((ref.rootRevision as number) !== command.expectedRootRevision) {
        throw new DeviceAuthorizationRevisionMismatchError("root_revision");
      }
      // Bootstrap only for a root with NO existing device authorization record.
      if (state.authorizations.some((a) => (a.rootId as string) === command.rootId)) {
        throw new DeviceAdditionUnavailableError("device_already_exists");
      }
      const deviceRef = generatedIds.deviceRef;
      const authorizationId = generatedIds.authorizationId;
      if (deviceRef === undefined || authorizationId === undefined) {
        throw new DeviceKeyModelValidationError("missing_generated_id");
      }
      const slotIds = generatedIds.keySlotIds ?? [];
      if (slotIds.length !== command.keySlotPurposes.length) {
        throw new DeviceKeyModelValidationError("key_slot_id_count_mismatch");
      }
      const record: DeviceAuthorizationRecordV1 = {
        schemaVersion: 1,
        authorizationId,
        deviceRef,
        rootId: ref.rootId,
        rootKind: ref.rootKind,
        revision: FIRST_IDENTITY_REVISION,
        deviceClass: "current_installation_placeholder",
        lifecycle: "active_local_unverified",
        scope: command.scope,
        capabilities: [...command.capabilities],
        origin: "local_root_bootstrap_placeholder",
        authorizationProofState: "local_unverified_placeholder",
        cryptographicallyAuthorized: false,
        remotelySynchronized: false,
        hardwareAttested: false,
        createdAtLocal: now,
        updatedAtLocal: now,
        persistenceClass: state.persistenceClass,
      };
      const slots: DeviceKeySlotV1[] = command.keySlotPurposes.map((purpose, i) => ({
        schemaVersion: 1,
        slotId: slotIds[i]!,
        deviceRef,
        authorizationId,
        purpose,
        lifecycle: "reserved_not_generated",
        revision: FIRST_IDENTITY_REVISION,
        algorithm: "not_selected_gate_f",
        publicMaterialPresent: false,
        privateMaterialPresent: false,
        hardwareBacked: "unknown_not_assessed",
        exportability: "not_applicable_no_material",
        keyReuseAcrossPurposes: "forbidden",
        createdAtLocal: now,
        updatedAtLocal: now,
      }));
      return {
        ...state,
        authorizations: [...state.authorizations, record],
        keySlots: [...state.keySlots, ...slots],
      };
    }

    case "identity.device.restrict": {
      const index = findAuth(state, command.authorizationId as string);
      if (index < 0) throw new DeviceAuthorizationNotFoundError();
      const current = state.authorizations[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new DeviceAuthorizationRevisionMismatchError();
      }
      assertDeviceAuthorizationTransitionV1(current.lifecycle, "restricted_local");
      const scope =
        command.requestedScope !== undefined
          ? attenuateDeviceAuthorizationScopeV1({
              current: current.scope,
              requested: command.requestedScope,
            })
          : current.scope;
      const capabilities =
        command.requestedCapabilities !== undefined
          ? attenuateDeviceCapabilitiesV1(current.capabilities, command.requestedCapabilities)
          : current.capabilities;
      const next: DeviceAuthorizationRecordV1 = {
        ...current,
        lifecycle: "restricted_local",
        scope,
        capabilities,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const list = state.authorizations.slice();
      list[index] = next;
      return { ...state, authorizations: list };
    }

    case "identity.device.mark_compromised": {
      const index = findAuth(state, command.authorizationId as string);
      if (index < 0) throw new DeviceAuthorizationNotFoundError();
      const current = state.authorizations[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new DeviceAuthorizationRevisionMismatchError();
      }
      assertDeviceAuthorizationTransitionV1(current.lifecycle, "compromised_suspected");
      const next = {
        ...current,
        lifecycle: "compromised_suspected" as const,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const list = state.authorizations.slice();
      list[index] = next;
      return { ...state, authorizations: list };
    }

    case "identity.device.revoke": {
      const index = findAuth(state, command.authorizationId as string);
      if (index < 0) throw new DeviceAuthorizationNotFoundError();
      const current = state.authorizations[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new DeviceAuthorizationRevisionMismatchError();
      }
      assertDeviceAuthorizationTransitionV1(current.lifecycle, "revoked_tombstone");
      const next = {
        ...current,
        lifecycle: "revoked_tombstone" as const,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const list = state.authorizations.slice();
      list[index] = next;
      // Mark the device's key slots operationally revoked (no crypto erase).
      const keySlots = state.keySlots.map((s) =>
        (s.authorizationId as string) === (current.authorizationId as string) &&
        s.lifecycle !== "revoked_tombstone"
          ? {
              ...s,
              lifecycle: "revoked_tombstone" as const,
              revision: nextIdentityRevision(s.revision),
              updatedAtLocal: now,
            }
          : s,
      );
      return { ...state, authorizations: list, keySlots };
    }

    case "identity.device.label.set": {
      const index = findAuthByDevice(state, command.deviceRef as string);
      if (index < 0) throw new DeviceAuthorizationNotFoundError();
      const auth = state.authorizations[index]!;
      if ((auth.revision as number) !== (command.expectedRevision as number)) {
        throw new DeviceAuthorizationRevisionMismatchError();
      }
      if (auth.lifecycle === "revoked_tombstone")
        throw new DeviceAuthorizationLifecycleError("revoked");
      const label: LocalDeviceLabelV1 = {
        schemaVersion: 1,
        deviceRef: command.deviceRef,
        normalizedLabel: normalizeContactAliasDisplayTextV1(command.labelText).normalizedValue,
        visibility: "local_only",
        peerShared: false,
        authority: "none",
        postureEvidence: false,
      };
      const others = state.labels.filter(
        (l) => (l.deviceRef as string) !== (command.deviceRef as string),
      );
      return { ...state, labels: [...others, label] };
    }

    case "identity.device.label.clear": {
      const index = findAuthByDevice(state, command.deviceRef as string);
      if (index < 0) throw new DeviceAuthorizationNotFoundError();
      const auth = state.authorizations[index]!;
      if ((auth.revision as number) !== (command.expectedRevision as number)) {
        throw new DeviceAuthorizationRevisionMismatchError();
      }
      return {
        ...state,
        labels: state.labels.filter(
          (l) => (l.deviceRef as string) !== (command.deviceRef as string),
        ),
      };
    }

    default: {
      const _never: never = command;
      throw new DeviceKeyModelValidationError(`unhandled:${String(_never)}`);
    }
  }
}

export const DEVICE_REVOCATION_RESULT_V1: LocalDeviceRevocationResultV1 = {
  schemaVersion: 1,
  revokedLocally: true,
  localSnapshotsInvalidated: true,
  remoteDevicesAffected: false,
  remoteSessionsAffected: false,
  messageKeysRotated: false,
  roomKeysRotated: false,
  deviceDataErased: false,
  cryptographicRevocationPerformed: false,
  redacted: true,
};

export function emptyDeviceKeyModelStateV1(
  persistenceClass: "memory_only" | "null" = "memory_only",
): DeviceKeyModelStateV1 {
  return { schemaVersion: 1, authorizations: [], keySlots: [], labels: [], persistenceClass };
}
