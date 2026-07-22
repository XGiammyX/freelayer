/**
 * Ephemeral identity policy (TECH-ID-04). Pure, deterministic, fail-closed,
 * strictest-wins. Everything is current-process memory or null (never persistent);
 * recovery/promotion/export/synchronization/persistence/network/notification/AI
 * are structurally unavailable. DevicePosture may only RESTRICT (never grants).
 * Ghost is the primary intended mode. Emergency denies expansive operations but
 * permits explicit restrictive ones (mark-compromised/expire/destroy/block).
 */

import type { PrivacyMode } from "@freelayer/privacy";
import { EPHEMERAL_IDENTITY_LIMITS_V1 } from "./ephemeral-clock";

export type EphemeralIdentityOperationV1 =
  | "create"
  | "activate"
  | "shorten_lifetime"
  | "mark_compromised"
  | "expire"
  | "destroy"
  | "persona.create"
  | "relationship.create_placeholder"
  | "relationship.block"
  | "room_binding.create_placeholder"
  | "summary.read";

export const EPHEMERAL_IDENTITY_OPERATIONS: readonly EphemeralIdentityOperationV1[] = [
  "create",
  "activate",
  "shorten_lifetime",
  "mark_compromised",
  "expire",
  "destroy",
  "persona.create",
  "relationship.create_placeholder",
  "relationship.block",
  "room_binding.create_placeholder",
  "summary.read",
];

const EXPANSIVE: ReadonlySet<EphemeralIdentityOperationV1> = new Set([
  "create",
  "activate",
  "persona.create",
  "relationship.create_placeholder",
  "room_binding.create_placeholder",
]);

/** Restrictive operations permitted even in Emergency. */
const EMERGENCY_ALLOWED: ReadonlySet<EphemeralIdentityOperationV1> = new Set([
  "mark_compromised",
  "expire",
  "destroy",
  "relationship.block",
]);

export interface EphemeralIdentityPolicyV1 {
  readonly mode: PrivacyMode;
  readonly operation: EphemeralIdentityOperationV1;
  readonly allowed: boolean;
  readonly retention: "current_process_memory" | "null";
  readonly maximumLifetimeMs: number;
  readonly maximumActiveRoots: number;
  readonly localLabelsAllowed: boolean;
  readonly exactCountsAllowed: boolean;
  readonly timestampsAllowed: boolean;
  readonly summaryAllowed: boolean;
  readonly recoveryAllowed: false;
  readonly promotionAllowed: false;
  readonly exportAllowed: false;
  readonly synchronizationAllowed: false;
  readonly persistentStorageAllowed: false;
  readonly networkAllowed: false;
  readonly notificationAllowed: false;
  readonly aiAllowed: false;
  readonly reasonCode: string;
}

interface ModeCfg {
  readonly retention: "current_process_memory" | "null";
  readonly denyExpansive: boolean;
  readonly emergencyOnly: boolean;
  readonly maximumLifetimeMs: number;
  readonly maximumActiveRoots: number;
  readonly summaryAllowed: boolean;
  readonly exactCountsAllowed: boolean;
  readonly timestampsAllowed: boolean;
  readonly localLabelsAllowed: boolean;
}

const MAX = EPHEMERAL_IDENTITY_LIMITS_V1.maximumDurationMs;
const HOUR = 3_600_000;

const MODE_CONFIG: Readonly<Record<PrivacyMode, ModeCfg>> = {
  standard: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    maximumLifetimeMs: MAX,
    maximumActiveRoots: 8,
    summaryAllowed: true,
    exactCountsAllowed: true,
    timestampsAllowed: true,
    localLabelsAllowed: true,
  },
  private: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    maximumLifetimeMs: HOUR,
    maximumActiveRoots: 4,
    summaryAllowed: true,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
  },
  ghost: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    maximumLifetimeMs: HOUR,
    maximumActiveRoots: 4,
    summaryAllowed: false,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
  },
  bunker: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: false,
    maximumLifetimeMs: HOUR,
    maximumActiveRoots: 2,
    summaryAllowed: true,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
  },
  offline_capsule: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    maximumLifetimeMs: HOUR,
    maximumActiveRoots: 4,
    summaryAllowed: true,
    exactCountsAllowed: true,
    timestampsAllowed: false,
    localLabelsAllowed: false,
  },
  emergency: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: true,
    maximumLifetimeMs: 0,
    maximumActiveRoots: 0,
    summaryAllowed: false,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
  },
  sovereign_room: {
    retention: "current_process_memory",
    denyExpansive: false,
    emergencyOnly: false,
    maximumLifetimeMs: HOUR,
    maximumActiveRoots: 4,
    summaryAllowed: true,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
  },
};

export function resolveEphemeralIdentityPolicyV1(input: {
  mode: PrivacyMode;
  operation: EphemeralIdentityOperationV1;
}): EphemeralIdentityPolicyV1 {
  const { mode, operation } = input;
  const cfg = MODE_CONFIG[mode];
  const constFalse = {
    mode,
    operation,
    recoveryAllowed: false as const,
    promotionAllowed: false as const,
    exportAllowed: false as const,
    synchronizationAllowed: false as const,
    persistentStorageAllowed: false as const,
    networkAllowed: false as const,
    notificationAllowed: false as const,
    aiAllowed: false as const,
  };

  if (cfg === undefined || !EPHEMERAL_IDENTITY_OPERATIONS.includes(operation)) {
    return {
      ...constFalse,
      allowed: false,
      retention: "null",
      maximumLifetimeMs: 0,
      maximumActiveRoots: 0,
      localLabelsAllowed: false,
      exactCountsAllowed: false,
      timestampsAllowed: false,
      summaryAllowed: false,
      reasonCode: "unknown_input",
    };
  }

  let allowed: boolean;
  let reasonCode: string;
  if (cfg.emergencyOnly) {
    allowed = EMERGENCY_ALLOWED.has(operation);
    reasonCode = allowed ? "emergency_restrictive_only" : "emergency_mode";
  } else if (cfg.denyExpansive && EXPANSIVE.has(operation)) {
    allowed = false;
    reasonCode = "restrictive_mode_expansive_denied";
  } else {
    allowed = true;
    reasonCode = "ephemeral_scaffolding_local";
  }

  return {
    ...constFalse,
    allowed,
    retention: cfg.retention,
    maximumLifetimeMs: cfg.maximumLifetimeMs,
    maximumActiveRoots: cfg.maximumActiveRoots,
    localLabelsAllowed: cfg.localLabelsAllowed,
    exactCountsAllowed: cfg.exactCountsAllowed,
    timestampsAllowed: cfg.timestampsAllowed,
    summaryAllowed: cfg.summaryAllowed,
    reasonCode,
  };
}

export function ephemeralOperationForCommandV1(
  command: string,
): EphemeralIdentityOperationV1 | undefined {
  const map: Readonly<Record<string, EphemeralIdentityOperationV1>> = {
    "identity.ephemeral.create": "create",
    "identity.ephemeral.activate": "activate",
    "identity.ephemeral.shorten_lifetime": "shorten_lifetime",
    "identity.ephemeral.mark_compromised": "mark_compromised",
    "identity.ephemeral.expire": "expire",
    "identity.ephemeral.destroy": "destroy",
    "identity.ephemeral.persona.create": "persona.create",
    "identity.ephemeral.relationship.create_placeholder": "relationship.create_placeholder",
    "identity.ephemeral.relationship.block": "relationship.block",
    "identity.ephemeral.room_binding.create_placeholder": "room_binding.create_placeholder",
  };
  return map[command];
}
