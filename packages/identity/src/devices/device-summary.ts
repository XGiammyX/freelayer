/**
 * Safe device summaries + redacted audit (TECH-ID-07). Summaries never expose
 * hardware/model/OS data, key-slot ids in ordinary summaries, room/relationship
 * ids, DevicePosture, key material, attestation, or network endpoints. Trust
 * flags are always false. Strict modes omit the device reference, label, scope
 * details, capability count, and exact device count. A read requires its OWN
 * `identity.device.summary.read` (or key-slots) decision. A summary is never a
 * proof of authorization.
 */

import { isPolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { DeviceAuthorizationDecisionMismatchError } from "./device-errors";
import type { DeviceKeyModelPolicyV1 } from "./device-policy";
import type { DeviceKeySlotV1, DeviceKeySlotLifecycleV1 } from "./device-key-slots";
import type { DeviceKeyPurposeV1 } from "./device-key-purposes";
import type {
  DeviceAuthorizationRecordV1,
  DeviceKeyModelStateV1,
  LocalDeviceLabelV1,
  LocalDeviceSummaryV1,
} from "./device-types";

export type DeviceAuthorizationAuditCategoryV1 =
  | "device_bootstrap"
  | "device_restriction"
  | "device_compromise"
  | "device_revocation"
  | "device_summary";

export interface DeviceAuthorizationAuditEventV1 {
  readonly schemaVersion: 1;
  readonly operationCategory: DeviceAuthorizationAuditCategoryV1;
  readonly outcome: "allowed" | "denied";
  readonly mode: PrivacyMode;
  readonly reasonCode: string;
  readonly redacted: true;
}

export function buildDeviceAuthorizationAuditEventV1(input: {
  operationCategory: DeviceAuthorizationAuditCategoryV1;
  outcome: "allowed" | "denied";
  mode: PrivacyMode;
  reasonCode: string;
}): DeviceAuthorizationAuditEventV1 {
  return { schemaVersion: 1, ...input, redacted: true };
}

export function assertDeviceSummaryDecisionV1(decision: PolicyDecision): void {
  if (
    !isPolicyDecision(decision) ||
    decision.verdict !== "allowed" ||
    decision.sideEffect !== "identity.device.summary.read"
  ) {
    throw new DeviceAuthorizationDecisionMismatchError();
  }
}

function labelFor(state: DeviceKeyModelStateV1, deviceRef: string): LocalDeviceLabelV1 | undefined {
  return state.labels.find((l) => (l.deviceRef as string) === deviceRef);
}

export function buildLocalDeviceSummaryV1(input: {
  record: DeviceAuthorizationRecordV1;
  label?: LocalDeviceLabelV1;
  policy: DeviceKeyModelPolicyV1;
}): LocalDeviceSummaryV1 {
  const { record, label, policy } = input;
  const redacted = !policy.scopeDetailsAllowed;
  return {
    schemaVersion: 1,
    ...(redacted ? {} : { deviceRef: record.deviceRef }),
    lifecycle: record.lifecycle,
    deviceClass: record.deviceClass,
    scopeKind: record.scope.kind,
    ...(policy.exactCountsAllowed ? { capabilityCount: record.capabilities.length } : {}),
    ...(!redacted && policy.labelsAllowed && label !== undefined
      ? { localLabel: label.normalizedLabel }
      : {}),
    cryptographicallyAuthorized: false,
    hardwareAttested: false,
    postureVerified: false,
    remotelySynchronized: false,
    redacted,
  };
}

export function listLocalDeviceSummariesV1(input: {
  state: DeviceKeyModelStateV1;
  policy: DeviceKeyModelPolicyV1;
}): readonly LocalDeviceSummaryV1[] {
  return input.state.authorizations.map((record) =>
    buildLocalDeviceSummaryV1({
      record,
      ...(labelFor(input.state, record.deviceRef as string) !== undefined
        ? { label: labelFor(input.state, record.deviceRef as string)! }
        : {}),
      policy: input.policy,
    }),
  );
}

/** A redacted key-slot view: purpose + lifecycle only, NEVER slot ids or material. */
export interface RedactedKeySlotViewV1 {
  readonly schemaVersion: 1;
  readonly purpose: DeviceKeyPurposeV1;
  readonly lifecycle: DeviceKeySlotLifecycleV1;
  readonly algorithm: "not_selected_gate_f";
  readonly publicMaterialPresent: false;
  readonly privateMaterialPresent: false;
}

export function readRedactedKeySlotsV1(
  slots: readonly DeviceKeySlotV1[],
): readonly RedactedKeySlotViewV1[] {
  return slots.map((s) => ({
    schemaVersion: 1,
    purpose: s.purpose,
    lifecycle: s.lifecycle,
    algorithm: "not_selected_gate_f",
    publicMaterialPresent: false,
    privateMaterialPresent: false,
  }));
}
