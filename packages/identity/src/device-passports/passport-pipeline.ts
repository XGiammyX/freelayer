/**
 * Device Passport pipeline (TECH-ID-08). The policy-gated entry point: validate →
 * resolve policy → require an authentic EXACT-SCOPE PolicyDecision → reduce
 * (pure; validates the caller-resolved root/approver context) → persist to a
 * current-process memory/null repository. Denial happens BEFORE mutation; failure
 * produces no partial state. A request/passport/device id, a root, a RoomOS role,
 * or DevicePosture NEVER authorizes; a local unsigned approval grants NO
 * operational device authority.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  DevicePassportDecisionMismatchError,
  DevicePassportPolicyDeniedError,
  DevicePassportValidationError,
} from "./passport-errors";
import { validateDevicePassportModelCommandV1 } from "./passport-validation";
import {
  devicePassportOperationForCommandV1,
  resolveDevicePassportPolicyV1,
} from "./passport-policy";
import { reduceDevicePassportModelCommandV1 } from "./passport-reducer";
import type { DevicePassportGeneratedIdsV1 } from "./passport-identifiers";
import type {
  DevicePassportRepositoryV1,
  DevicePassportRepositoryWriteResultV1,
} from "./passport-repository";
import type {
  DevicePassportApproverContextV1,
  DevicePassportRootRefV1,
  DevicePassportStateV1,
} from "./passport-types";

const SCOPE_FOR_COMMAND: Readonly<Record<string, PolicySideEffectScope>> = {
  "identity.device_link_request.create_local": "identity.device_link_request.create",
  "identity.device_link_request.submit_for_review": "identity.device_link_request.lifecycle",
  "identity.device_link_request.reject": "identity.device_link_request.lifecycle",
  "identity.device_link_request.expire": "identity.device_link_request.lifecycle",
  "identity.device_link_request.revoke": "identity.device_link_request.lifecycle",
  "identity.device_passport.prepare_draft": "identity.device_passport.prepare",
  "identity.device_passport.approve_local_unsigned": "identity.device_passport.approve_unsigned",
  "identity.device_passport.restrict_local": "identity.device_passport.restrict",
  "identity.device_passport.expire": "identity.device_passport.revoke",
  "identity.device_passport.revoke": "identity.device_passport.revoke",
};

export interface ApplyDevicePassportCommandInputV1 {
  readonly state: DevicePassportStateV1;
  readonly command: unknown;
  readonly mode: PrivacyMode;
  readonly decision: PolicyDecision;
  readonly rootRef?: DevicePassportRootRefV1;
  readonly approver?: DevicePassportApproverContextV1;
  readonly generatedIds: DevicePassportGeneratedIdsV1;
  readonly clockValue: string;
  readonly processEpoch: string;
  readonly repository: DevicePassportRepositoryV1;
}

export interface ApplyDevicePassportCommandResultV1 {
  readonly state: DevicePassportStateV1;
  readonly write: DevicePassportRepositoryWriteResultV1;
}

export function applyDevicePassportModelCommandV1(
  input: ApplyDevicePassportCommandInputV1,
): ApplyDevicePassportCommandResultV1 {
  const command = validateDevicePassportModelCommandV1(input.command);
  const operation = devicePassportOperationForCommandV1(command.command);
  if (operation === undefined) throw new DevicePassportValidationError("unmapped_operation");

  const policy = resolveDevicePassportPolicyV1({ mode: input.mode, operation });
  if (!policy.allowed) throw new DevicePassportPolicyDeniedError(policy.reasonCode);

  const requiredScope = SCOPE_FOR_COMMAND[command.command];
  if (
    requiredScope === undefined ||
    !isPolicyDecision(input.decision) ||
    input.decision.verdict !== "allowed" ||
    input.decision.sideEffect !== requiredScope
  ) {
    throw new DevicePassportDecisionMismatchError();
  }

  const next = reduceDevicePassportModelCommandV1({
    state: input.state,
    command,
    ...(input.rootRef !== undefined ? { rootRef: input.rootRef } : {}),
    ...(input.approver !== undefined ? { approver: input.approver } : {}),
    policy,
    generatedIds: input.generatedIds,
    clockValue: input.clockValue,
    processEpoch: input.processEpoch,
  });

  const write = input.repository.replace(next, input.decision);
  return { state: next, write };
}
