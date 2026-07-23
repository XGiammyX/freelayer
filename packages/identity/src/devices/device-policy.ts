/**
 * Device-key-model policy (TECH-ID-07). Pure, deterministic, fail-closed,
 * strictest-wins. Everything is memory/null (never persistent plaintext). Real
 * keys / device addition / device passport / remote revocation / hardware
 * attestation / network / notifications / telemetry / AI are structurally
 * unavailable. DevicePosture may RESTRICT operations but can never activate or
 * authorize a device. Unknown operations deny.
 */

import type { PrivacyMode } from "@freelayer/privacy";

export type DeviceKeyModelOperationV1 =
  | "bootstrap"
  | "restrict"
  | "mark_compromised"
  | "revoke"
  | "label.set"
  | "label.clear"
  | "summary.list"
  | "summary.detail"
  | "key_slots.read_redacted"
  | "add_device_future"
  | "issue_passport_future";

export const DEVICE_KEY_MODEL_OPERATIONS: readonly DeviceKeyModelOperationV1[] = [
  "bootstrap",
  "restrict",
  "mark_compromised",
  "revoke",
  "label.set",
  "label.clear",
  "summary.list",
  "summary.detail",
  "key_slots.read_redacted",
  "add_device_future",
  "issue_passport_future",
];

const FUTURE: ReadonlySet<DeviceKeyModelOperationV1> = new Set([
  "add_device_future",
  "issue_passport_future",
]);
const READS: ReadonlySet<DeviceKeyModelOperationV1> = new Set([
  "summary.list",
  "summary.detail",
  "key_slots.read_redacted",
]);
const EMERGENCY_ALLOWED: ReadonlySet<DeviceKeyModelOperationV1> = new Set([
  "restrict",
  "mark_compromised",
  "revoke",
  "label.clear",
  "summary.list",
  "summary.detail",
  "key_slots.read_redacted",
]);

export interface DeviceKeyModelPolicyV1 {
  readonly mode: PrivacyMode;
  readonly operation: DeviceKeyModelOperationV1;
  readonly allowed: boolean;

  readonly retention: "memory_only" | "null";
  readonly maximumActiveDevicePlaceholders: number;
  readonly labelsAllowed: boolean;
  readonly exactCountsAllowed: boolean;
  readonly exactTimestampsAllowed: boolean;
  readonly scopeDetailsAllowed: boolean;

  readonly realKeysAvailable: false;
  readonly deviceAdditionAvailable: false;
  readonly devicePassportAvailable: false;
  readonly remoteRevocationAvailable: false;
  readonly hardwareAttestationAvailable: false;
  readonly persistentPlaintextAllowed: false;
  readonly networkAllowed: false;
  readonly notificationAllowed: false;
  readonly telemetryAllowed: false;
  readonly aiAllowed: false;

  readonly reasonCode: string;
}

interface Cfg {
  readonly retention: "memory_only" | "null";
  readonly denyExpansive: boolean;
  readonly emergencyOnly: boolean;
  readonly bootstrapAllowed: boolean;
  readonly labelsAllowed: boolean;
  readonly exactCountsAllowed: boolean;
  readonly exactTimestampsAllowed: boolean;
  readonly scopeDetailsAllowed: boolean;
  readonly maximumActiveDevicePlaceholders: number;
}

const MODE_CONFIG: Readonly<Record<PrivacyMode, Cfg>> = {
  standard: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    bootstrapAllowed: true,
    labelsAllowed: true,
    exactCountsAllowed: true,
    exactTimestampsAllowed: true,
    scopeDetailsAllowed: true,
    maximumActiveDevicePlaceholders: 1,
  },
  private: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    bootstrapAllowed: true,
    labelsAllowed: false,
    exactCountsAllowed: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    maximumActiveDevicePlaceholders: 1,
  },
  ghost: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    bootstrapAllowed: true,
    labelsAllowed: false,
    exactCountsAllowed: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    maximumActiveDevicePlaceholders: 1,
  },
  offline_capsule: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    bootstrapAllowed: true,
    labelsAllowed: true,
    exactCountsAllowed: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    maximumActiveDevicePlaceholders: 1,
  },
  sovereign_room: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    bootstrapAllowed: true,
    labelsAllowed: true,
    exactCountsAllowed: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    maximumActiveDevicePlaceholders: 1,
  },
  bunker: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: false,
    bootstrapAllowed: false,
    labelsAllowed: false,
    exactCountsAllowed: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    maximumActiveDevicePlaceholders: 1,
  },
  emergency: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: true,
    bootstrapAllowed: false,
    labelsAllowed: false,
    exactCountsAllowed: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    maximumActiveDevicePlaceholders: 0,
  },
};

export function resolveDeviceKeyModelPolicyV1(input: {
  mode: PrivacyMode;
  operation: DeviceKeyModelOperationV1;
}): DeviceKeyModelPolicyV1 {
  const { mode, operation } = input;
  const cfg = MODE_CONFIG[mode];
  const off = {
    mode,
    operation,
    realKeysAvailable: false as const,
    deviceAdditionAvailable: false as const,
    devicePassportAvailable: false as const,
    remoteRevocationAvailable: false as const,
    hardwareAttestationAvailable: false as const,
    persistentPlaintextAllowed: false as const,
    networkAllowed: false as const,
    notificationAllowed: false as const,
    telemetryAllowed: false as const,
    aiAllowed: false as const,
  };

  if (cfg === undefined || !DEVICE_KEY_MODEL_OPERATIONS.includes(operation)) {
    return {
      ...off,
      allowed: false,
      retention: "null",
      maximumActiveDevicePlaceholders: 0,
      labelsAllowed: false,
      exactCountsAllowed: false,
      exactTimestampsAllowed: false,
      scopeDetailsAllowed: false,
      reasonCode: "unknown_input",
    };
  }

  let allowed: boolean;
  let reasonCode = "device_local";
  if (FUTURE.has(operation)) {
    allowed = false;
    reasonCode = "future_gated";
  } else if (cfg.emergencyOnly) {
    allowed = EMERGENCY_ALLOWED.has(operation);
    reasonCode = allowed ? "emergency_restrictive_only" : "emergency_mode";
  } else if (operation === "bootstrap") {
    allowed = cfg.bootstrapAllowed && !cfg.denyExpansive;
    if (!allowed) reasonCode = "bootstrap_denied";
  } else if (operation === "label.set") {
    allowed = cfg.labelsAllowed && !cfg.denyExpansive;
    if (!allowed) reasonCode = "device_label_denied";
  } else if (READS.has(operation)) {
    allowed = true;
  } else {
    // restrict, mark_compromised, revoke, label.clear — restrictive, always allowed.
    allowed = true;
  }

  return {
    ...off,
    allowed,
    retention: cfg.retention,
    maximumActiveDevicePlaceholders: cfg.maximumActiveDevicePlaceholders,
    labelsAllowed: cfg.labelsAllowed,
    exactCountsAllowed: cfg.exactCountsAllowed,
    exactTimestampsAllowed: cfg.exactTimestampsAllowed,
    scopeDetailsAllowed: cfg.scopeDetailsAllowed,
    reasonCode,
  };
}

export function deviceKeyModelOperationForCommandV1(
  command: string,
): DeviceKeyModelOperationV1 | undefined {
  const map: Readonly<Record<string, DeviceKeyModelOperationV1>> = {
    "identity.device.bootstrap_current_installation_placeholder": "bootstrap",
    "identity.device.restrict": "restrict",
    "identity.device.mark_compromised": "mark_compromised",
    "identity.device.revoke": "revoke",
    "identity.device.label.set": "label.set",
    "identity.device.label.clear": "label.clear",
  };
  return map[command];
}
