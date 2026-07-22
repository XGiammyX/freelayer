/**
 * Local identity policy (TECH-ID-03). A pure, deterministic, fail-closed
 * resolver: strictest behavior wins, everything is memory/null (no persistent
 * plaintext identity), and network/notification/AI/identity-proofing/crypto/
 * recovery are structurally unavailable. DevicePosture may only TIGHTEN via the
 * canonical policy-composition layer — it NEVER grants an identity operation.
 * Identity here is local, non-cryptographic scaffolding.
 */

import type { PrivacyMode } from "@freelayer/privacy";

export type IdentityOperationV1 =
  | "root.create"
  | "root.activate"
  | "root.lock"
  | "root.mark_compromised"
  | "root.tombstone"
  | "persona.create"
  | "persona.archive"
  | "persona.tombstone"
  | "relationship.create_placeholder"
  | "relationship.block"
  | "relationship.mark_compromised"
  | "relationship.tombstone"
  | "room_binding.create_placeholder"
  | "room_binding.suspend"
  | "room_binding.tombstone"
  | "identity.summary.read";

export const IDENTITY_OPERATIONS: readonly IdentityOperationV1[] = [
  "root.create",
  "root.activate",
  "root.lock",
  "root.mark_compromised",
  "root.tombstone",
  "persona.create",
  "persona.archive",
  "persona.tombstone",
  "relationship.create_placeholder",
  "relationship.block",
  "relationship.mark_compromised",
  "relationship.tombstone",
  "room_binding.create_placeholder",
  "room_binding.suspend",
  "room_binding.tombstone",
  "identity.summary.read",
];

/** Expansive (creation/activation) operations that strict modes deny. */
const EXPANSIVE_OPERATIONS: ReadonlySet<IdentityOperationV1> = new Set([
  "root.create",
  "root.activate",
  "persona.create",
  "relationship.create_placeholder",
  "room_binding.create_placeholder",
]);

export interface LocalIdentityPolicyV1 {
  readonly mode: PrivacyMode;
  readonly operation: IdentityOperationV1;
  readonly allowed: boolean;
  readonly persistence: "memory_only" | "null";
  readonly summaryAllowed: boolean;
  readonly exactCountsAllowed: boolean;
  readonly timestampsAllowed: boolean;
  readonly localLabelsAllowed: boolean;
  readonly auditAllowed: boolean;
  readonly networkAllowed: false;
  readonly notificationAllowed: false;
  readonly aiAllowed: false;
  readonly identityProofingAvailable: false;
  readonly cryptoAvailable: false;
  readonly recoveryAvailable: false;
  readonly reasonCode: string;
}

interface ModeConfigV1 {
  readonly persistence: "memory_only" | "null";
  readonly denyExpansive: boolean;
  readonly summaryAllowed: boolean;
  readonly exactCountsAllowed: boolean;
  readonly timestampsAllowed: boolean;
  readonly localLabelsAllowed: boolean;
  readonly auditAllowed: boolean;
}

const MODE_CONFIG: Readonly<Record<PrivacyMode, ModeConfigV1>> = {
  standard: {
    persistence: "memory_only",
    denyExpansive: false,
    summaryAllowed: true,
    exactCountsAllowed: true,
    timestampsAllowed: true,
    localLabelsAllowed: true,
    auditAllowed: true,
  },
  private: {
    persistence: "memory_only",
    denyExpansive: false,
    summaryAllowed: true,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
    auditAllowed: false,
  },
  ghost: {
    persistence: "null",
    denyExpansive: false,
    summaryAllowed: false,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
    auditAllowed: false,
  },
  bunker: {
    persistence: "null",
    denyExpansive: true,
    summaryAllowed: true,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
    auditAllowed: false,
  },
  offline_capsule: {
    persistence: "memory_only",
    denyExpansive: false,
    summaryAllowed: true,
    exactCountsAllowed: true,
    timestampsAllowed: false,
    localLabelsAllowed: false,
    auditAllowed: true,
  },
  emergency: {
    persistence: "null",
    denyExpansive: true,
    summaryAllowed: false,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
    auditAllowed: false,
  },
  sovereign_room: {
    persistence: "memory_only",
    denyExpansive: false,
    summaryAllowed: true,
    exactCountsAllowed: false,
    timestampsAllowed: false,
    localLabelsAllowed: false,
    auditAllowed: false,
  },
};

/**
 * Resolve the local identity policy for a mode + operation. Fail-closed:
 * unknown mode/operation denies; strict modes deny expansive creation; nothing
 * persists as plaintext.
 */
export function resolveLocalIdentityPolicyV1(input: {
  mode: PrivacyMode;
  operation: IdentityOperationV1;
}): LocalIdentityPolicyV1 {
  const { mode, operation } = input;
  const config = MODE_CONFIG[mode];

  const base = {
    mode,
    operation,
    networkAllowed: false as const,
    notificationAllowed: false as const,
    aiAllowed: false as const,
    identityProofingAvailable: false as const,
    cryptoAvailable: false as const,
    recoveryAvailable: false as const,
  };

  // Fail closed on unknown mode or operation.
  if (config === undefined || !IDENTITY_OPERATIONS.includes(operation)) {
    return {
      ...base,
      allowed: false,
      persistence: "null",
      summaryAllowed: false,
      exactCountsAllowed: false,
      timestampsAllowed: false,
      localLabelsAllowed: false,
      auditAllowed: false,
      reasonCode: "unknown_input",
    };
  }

  const expansiveDenied = config.denyExpansive && EXPANSIVE_OPERATIONS.has(operation);
  const allowed = !expansiveDenied;

  return {
    ...base,
    allowed,
    persistence: config.persistence,
    summaryAllowed: config.summaryAllowed,
    exactCountsAllowed: config.exactCountsAllowed,
    timestampsAllowed: config.timestampsAllowed,
    localLabelsAllowed: config.localLabelsAllowed,
    auditAllowed: config.auditAllowed,
    reasonCode: allowed ? "identity_scaffolding_local" : "restrictive_mode_expansive_denied",
  };
}

/** Map a command name to its policy operation (single source of truth). */
export function identityOperationForCommandV1(command: string): IdentityOperationV1 | undefined {
  const map: Readonly<Record<string, IdentityOperationV1>> = {
    "identity.root.create_local": "root.create",
    "identity.root.activate_local": "root.activate",
    "identity.root.lock_local": "root.lock",
    "identity.root.mark_compromised": "root.mark_compromised",
    "identity.root.tombstone": "root.tombstone",
    "identity.persona.create_local": "persona.create",
    "identity.persona.archive_local": "persona.archive",
    "identity.persona.tombstone": "persona.tombstone",
    "identity.relationship.create_placeholder": "relationship.create_placeholder",
    "identity.relationship.block_local": "relationship.block",
    "identity.relationship.mark_compromised": "relationship.mark_compromised",
    "identity.relationship.tombstone": "relationship.tombstone",
    "identity.room_binding.create_placeholder": "room_binding.create_placeholder",
    "identity.room_binding.suspend_local": "room_binding.suspend",
    "identity.room_binding.tombstone": "room_binding.tombstone",
  };
  return map[command];
}
