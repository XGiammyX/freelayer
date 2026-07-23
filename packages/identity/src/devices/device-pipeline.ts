/**
 * Device-key-model pipeline (TECH-ID-07). The policy-gated entry point:
 * validate → resolve policy → require an authentic EXACT-SCOPE PolicyDecision →
 * reduce (pure; validates the caller-resolved root ref) → persist to a memory/
 * null repository. Denial happens BEFORE mutation; failure produces no partial
 * state. A device id / label / RoomOS role / DevicePosture NEVER authorizes; a
 * local authorization record is never a cryptographic proof.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  DeviceAuthorizationDecisionMismatchError,
  DeviceAuthorizationPolicyDeniedError,
  DeviceKeyModelValidationError,
} from "./device-errors";
import { validateDeviceKeyModelCommandV1 } from "./device-validation";
import {
  deviceKeyModelOperationForCommandV1,
  resolveDeviceKeyModelPolicyV1,
} from "./device-policy";
import { reduceDeviceKeyModelCommandV1 } from "./device-reducer";
import type { DeviceGeneratedIdsV1 } from "./device-identifiers";
import type {
  DeviceKeyModelRepositoryV1,
  DeviceRepositoryWriteResultV1,
} from "./device-repository";
import type { DeviceKeyModelStateV1, DeviceRootRefV1 } from "./device-types";

const SCOPE_FOR_COMMAND: Readonly<Record<string, PolicySideEffectScope>> = {
  "identity.device.bootstrap_current_installation_placeholder": "identity.device.bootstrap",
  "identity.device.restrict": "identity.device.restrict",
  "identity.device.mark_compromised": "identity.device.mark_compromised",
  "identity.device.revoke": "identity.device.revoke",
  "identity.device.label.set": "identity.device.label.write",
  "identity.device.label.clear": "identity.device.label.clear",
};

export interface ApplyDeviceKeyModelCommandInputV1 {
  readonly state: DeviceKeyModelStateV1;
  readonly command: unknown;
  readonly mode: PrivacyMode;
  readonly decision: PolicyDecision;
  readonly rootRef?: DeviceRootRefV1;
  readonly generatedIds: DeviceGeneratedIdsV1;
  readonly clockValue: string;
  readonly repository: DeviceKeyModelRepositoryV1;
}

export interface ApplyDeviceKeyModelCommandResultV1 {
  readonly state: DeviceKeyModelStateV1;
  readonly write: DeviceRepositoryWriteResultV1;
}

export function applyDeviceKeyModelCommandV1(
  input: ApplyDeviceKeyModelCommandInputV1,
): ApplyDeviceKeyModelCommandResultV1 {
  const command = validateDeviceKeyModelCommandV1(input.command);
  const operation = deviceKeyModelOperationForCommandV1(command.command);
  if (operation === undefined) throw new DeviceKeyModelValidationError("unmapped_operation");

  const policy = resolveDeviceKeyModelPolicyV1({ mode: input.mode, operation });
  if (!policy.allowed) throw new DeviceAuthorizationPolicyDeniedError(policy.reasonCode);

  const requiredScope = SCOPE_FOR_COMMAND[command.command];
  if (
    requiredScope === undefined ||
    !isPolicyDecision(input.decision) ||
    input.decision.verdict !== "allowed" ||
    input.decision.sideEffect !== requiredScope
  ) {
    throw new DeviceAuthorizationDecisionMismatchError();
  }

  const next = reduceDeviceKeyModelCommandV1({
    state: input.state,
    command,
    ...(input.rootRef !== undefined ? { rootRef: input.rootRef } : {}),
    generatedIds: input.generatedIds,
    clockValue: input.clockValue,
  });

  const write = input.repository.replace(next, input.decision);
  return { state: next, write };
}
