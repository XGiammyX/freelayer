/**
 * Device Passport policy (TECH-ID-08). Pure, deterministic, fail-closed,
 * strictest-wins. Everything is current-process memory / null. Cryptographic
 * issuance / remote acceptance / QR transport / history transfer / DevicePosture
 * claim / attestation claim / persistence / network / notification / telemetry /
 * AI are structurally unavailable. Labels are never allowed. DevicePosture may
 * restrict but never issue/validate a passport. Unknown operations deny.
 */

import type { PrivacyMode } from "@freelayer/privacy";

export type DevicePassportOperationV1 =
  | "link_request.create"
  | "link_request.submit"
  | "link_request.reject"
  | "link_request.expire"
  | "link_request.revoke"
  | "passport.prepare"
  | "passport.approve_unsigned"
  | "passport.restrict"
  | "passport.expire"
  | "passport.revoke"
  | "passport.summary.read"
  | "passport.issue_signed_future"
  | "passport.accept_verified_future";

export const DEVICE_PASSPORT_OPERATIONS: readonly DevicePassportOperationV1[] = [
  "link_request.create",
  "link_request.submit",
  "link_request.reject",
  "link_request.expire",
  "link_request.revoke",
  "passport.prepare",
  "passport.approve_unsigned",
  "passport.restrict",
  "passport.expire",
  "passport.revoke",
  "passport.summary.read",
  "passport.issue_signed_future",
  "passport.accept_verified_future",
];

const FUTURE: ReadonlySet<DevicePassportOperationV1> = new Set([
  "passport.issue_signed_future",
  "passport.accept_verified_future",
]);
const EXPANSIVE: ReadonlySet<DevicePassportOperationV1> = new Set([
  "link_request.create",
  "link_request.submit",
  "passport.prepare",
  "passport.approve_unsigned",
]);
const EMERGENCY_ALLOWED: ReadonlySet<DevicePassportOperationV1> = new Set([
  "link_request.reject",
  "link_request.expire",
  "link_request.revoke",
  "passport.restrict",
  "passport.expire",
  "passport.revoke",
  "passport.summary.read",
]);

export interface DevicePassportPolicyV1 {
  readonly mode: PrivacyMode;
  readonly operation: DevicePassportOperationV1;
  readonly allowed: boolean;

  readonly retention: "current_process_memory" | "null";
  readonly maximumPendingRequests: number;
  readonly maximumRequestLifetimeMs: number;
  readonly labelsAllowed: false;
  readonly exactTimestampsAllowed: boolean;
  readonly scopeDetailsAllowed: boolean;
  readonly capabilityDetailsAllowed: boolean;

  readonly localUnsignedApprovalAvailable: boolean;
  readonly cryptographicIssuanceAvailable: false;
  readonly remoteAcceptanceAvailable: false;
  readonly qrTransportAvailable: false;
  readonly historyTransferAvailable: false;
  readonly devicePostureClaimAllowed: false;
  readonly attestationClaimAllowed: false;
  readonly persistentStorageAllowed: false;
  readonly networkAllowed: false;
  readonly notificationAllowed: false;
  readonly telemetryAllowed: false;
  readonly aiAllowed: false;

  readonly reasonCode: string;
}

interface Cfg {
  readonly retention: "current_process_memory" | "null";
  readonly denyExpansive: boolean;
  readonly emergencyOnly: boolean;
  readonly exactTimestampsAllowed: boolean;
  readonly scopeDetailsAllowed: boolean;
  readonly capabilityDetailsAllowed: boolean;
}

const MODE_CONFIG: Readonly<Record<PrivacyMode, Cfg>> = {
  standard: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    exactTimestampsAllowed: true,
    scopeDetailsAllowed: true,
    capabilityDetailsAllowed: true,
  },
  private: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    capabilityDetailsAllowed: false,
  },
  ghost: {
    retention: "null",
    denyExpansive: false,
    emergencyOnly: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    capabilityDetailsAllowed: false,
  },
  offline_capsule: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    capabilityDetailsAllowed: false,
  },
  sovereign_room: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    capabilityDetailsAllowed: false,
  },
  bunker: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: false,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    capabilityDetailsAllowed: false,
  },
  emergency: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: true,
    exactTimestampsAllowed: false,
    scopeDetailsAllowed: false,
    capabilityDetailsAllowed: false,
  },
};

export function resolveDevicePassportPolicyV1(input: {
  mode: PrivacyMode;
  operation: DevicePassportOperationV1;
}): DevicePassportPolicyV1 {
  const { mode, operation } = input;
  const cfg = MODE_CONFIG[mode];
  const off = {
    mode,
    operation,
    labelsAllowed: false as const,
    cryptographicIssuanceAvailable: false as const,
    remoteAcceptanceAvailable: false as const,
    qrTransportAvailable: false as const,
    historyTransferAvailable: false as const,
    devicePostureClaimAllowed: false as const,
    attestationClaimAllowed: false as const,
    persistentStorageAllowed: false as const,
    networkAllowed: false as const,
    notificationAllowed: false as const,
    telemetryAllowed: false as const,
    aiAllowed: false as const,
    maximumPendingRequests: 3,
    maximumRequestLifetimeMs: 900_000,
  };

  if (cfg === undefined || !DEVICE_PASSPORT_OPERATIONS.includes(operation)) {
    return {
      ...off,
      allowed: false,
      retention: "null",
      exactTimestampsAllowed: false,
      scopeDetailsAllowed: false,
      capabilityDetailsAllowed: false,
      localUnsignedApprovalAvailable: false,
      reasonCode: "unknown_input",
    };
  }

  const localUnsignedApprovalAvailable = !cfg.denyExpansive && !cfg.emergencyOnly;
  let allowed: boolean;
  let reasonCode = "passport_local";
  if (FUTURE.has(operation)) {
    allowed = false;
    reasonCode = "future_gated";
  } else if (cfg.emergencyOnly) {
    allowed = EMERGENCY_ALLOWED.has(operation);
    reasonCode = allowed ? "emergency_restrictive_only" : "emergency_mode";
  } else if (EXPANSIVE.has(operation)) {
    allowed = !cfg.denyExpansive;
    if (!allowed) reasonCode = "expansive_denied";
  } else {
    // restrictive + summary reads — always available.
    allowed = true;
  }

  return {
    ...off,
    allowed,
    retention: cfg.retention,
    exactTimestampsAllowed: cfg.exactTimestampsAllowed,
    scopeDetailsAllowed: cfg.scopeDetailsAllowed,
    capabilityDetailsAllowed: cfg.capabilityDetailsAllowed,
    localUnsignedApprovalAvailable,
    reasonCode,
  };
}

export function devicePassportOperationForCommandV1(
  command: string,
): DevicePassportOperationV1 | undefined {
  const map: Readonly<Record<string, DevicePassportOperationV1>> = {
    "identity.device_link_request.create_local": "link_request.create",
    "identity.device_link_request.submit_for_review": "link_request.submit",
    "identity.device_link_request.reject": "link_request.reject",
    "identity.device_link_request.expire": "link_request.expire",
    "identity.device_link_request.revoke": "link_request.revoke",
    "identity.device_passport.prepare_draft": "passport.prepare",
    "identity.device_passport.approve_local_unsigned": "passport.approve_unsigned",
    "identity.device_passport.restrict_local": "passport.restrict",
    "identity.device_passport.expire": "passport.expire",
    "identity.device_passport.revoke": "passport.revoke",
  };
  return map[command];
}
