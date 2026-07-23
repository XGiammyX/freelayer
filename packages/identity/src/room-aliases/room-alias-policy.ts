/**
 * Per-room alias policy (TECH-ID-06). Pure, deterministic, fail-closed,
 * strictest-wins. Everything is memory/null (never persistent plaintext); remote
 * sharing / public directory / global username / authenticated binding /
 * notifications / telemetry / AI are structurally unavailable. Room policy and
 * DevicePosture may only TIGHTEN; neither turns an alias into authority or
 * identity proof. Unknown operations deny.
 */

import type { PrivacyMode } from "@freelayer/privacy";

export type RoomAliasOperationV1 =
  | "create"
  | "activate"
  | "rotate"
  | "retire"
  | "display_context.read"
  | "collision_assessment.read"
  | "reuse_assessment.read";

export const ROOM_ALIAS_OPERATIONS: readonly RoomAliasOperationV1[] = [
  "create",
  "activate",
  "rotate",
  "retire",
  "display_context.read",
  "collision_assessment.read",
  "reuse_assessment.read",
];

const WRITE_EXPANSIVE: ReadonlySet<RoomAliasOperationV1> = new Set([
  "create",
  "activate",
  "rotate",
]);
const EMERGENCY_ALLOWED: ReadonlySet<RoomAliasOperationV1> = new Set([
  "retire",
  "display_context.read",
]);

export interface RoomAliasPolicyV1 {
  readonly mode: PrivacyMode;
  readonly operation: RoomAliasOperationV1;
  readonly allowed: boolean;

  readonly retention: "memory_only" | "null";
  readonly aliasCreationAllowed: boolean;
  readonly aliasRotationAllowed: boolean;
  readonly collisionAssessmentAllowed: boolean;
  readonly crossRoomReuseAssessmentAllowed: boolean;
  readonly displayContextAllowed: boolean;
  readonly exactTimestampsAllowed: boolean;

  readonly networkSharingAllowed: false;
  readonly authenticatedBindingAvailable: false;
  readonly publicDirectoryAllowed: false;
  readonly globalUsernameAllowed: false;
  readonly persistentPlaintextAllowed: false;
  readonly notificationAllowed: false;
  readonly telemetryAllowed: false;
  readonly aiAllowed: false;

  readonly reasonCode: string;
}

interface Cfg {
  readonly retention: "memory_only" | "null";
  readonly denyExpansive: boolean;
  readonly emergencyOnly: boolean;
  readonly aliasCreationAllowed: boolean;
  readonly aliasRotationAllowed: boolean;
  readonly collisionAssessmentAllowed: boolean;
  readonly crossRoomReuseAssessmentAllowed: boolean;
  readonly displayContextAllowed: boolean;
  readonly exactTimestampsAllowed: boolean;
}

const FULL = {
  retention: "memory_only",
  denyExpansive: false,
  emergencyOnly: false,
  aliasCreationAllowed: true,
  aliasRotationAllowed: true,
  collisionAssessmentAllowed: true,
  crossRoomReuseAssessmentAllowed: true,
  displayContextAllowed: true,
} as const;

const MODE_CONFIG: Readonly<Record<PrivacyMode, Cfg>> = {
  standard: { ...FULL, exactTimestampsAllowed: true },
  private: { ...FULL, exactTimestampsAllowed: false },
  ghost: { ...FULL, exactTimestampsAllowed: false },
  offline_capsule: { ...FULL, exactTimestampsAllowed: false },
  sovereign_room: { ...FULL, exactTimestampsAllowed: false },
  bunker: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: false,
    aliasCreationAllowed: false,
    aliasRotationAllowed: false,
    collisionAssessmentAllowed: false,
    crossRoomReuseAssessmentAllowed: false,
    displayContextAllowed: true,
    exactTimestampsAllowed: false,
  },
  emergency: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: true,
    aliasCreationAllowed: false,
    aliasRotationAllowed: false,
    collisionAssessmentAllowed: false,
    crossRoomReuseAssessmentAllowed: false,
    displayContextAllowed: true,
    exactTimestampsAllowed: false,
  },
};

export function resolveRoomAliasPolicyV1(input: {
  mode: PrivacyMode;
  operation: RoomAliasOperationV1;
}): RoomAliasPolicyV1 {
  const { mode, operation } = input;
  const cfg = MODE_CONFIG[mode];
  const off = {
    mode,
    operation,
    networkSharingAllowed: false as const,
    authenticatedBindingAvailable: false as const,
    publicDirectoryAllowed: false as const,
    globalUsernameAllowed: false as const,
    persistentPlaintextAllowed: false as const,
    notificationAllowed: false as const,
    telemetryAllowed: false as const,
    aiAllowed: false as const,
  };

  if (cfg === undefined || !ROOM_ALIAS_OPERATIONS.includes(operation)) {
    return {
      ...off,
      allowed: false,
      retention: "null",
      aliasCreationAllowed: false,
      aliasRotationAllowed: false,
      collisionAssessmentAllowed: false,
      crossRoomReuseAssessmentAllowed: false,
      displayContextAllowed: false,
      exactTimestampsAllowed: false,
      reasonCode: "unknown_input",
    };
  }

  let allowed: boolean;
  let reasonCode = "room_alias_local";
  if (cfg.emergencyOnly) {
    allowed = EMERGENCY_ALLOWED.has(operation);
    reasonCode = allowed ? "emergency_restrictive_only" : "emergency_mode";
  } else if (WRITE_EXPANSIVE.has(operation)) {
    const base = operation === "rotate" ? cfg.aliasRotationAllowed : cfg.aliasCreationAllowed;
    allowed = base && !cfg.denyExpansive;
    if (!allowed) reasonCode = "expansive_alias_denied";
  } else if (operation === "collision_assessment.read") {
    allowed = cfg.collisionAssessmentAllowed;
    if (!allowed) reasonCode = "collision_assessment_denied";
  } else if (operation === "reuse_assessment.read") {
    allowed = cfg.crossRoomReuseAssessmentAllowed;
    if (!allowed) reasonCode = "reuse_assessment_denied";
  } else if (operation === "display_context.read") {
    allowed = cfg.displayContextAllowed;
    if (!allowed) reasonCode = "display_context_denied";
  } else {
    // retire — restrictive, always available.
    allowed = true;
  }

  return {
    ...off,
    allowed,
    retention: cfg.retention,
    aliasCreationAllowed: cfg.aliasCreationAllowed,
    aliasRotationAllowed: cfg.aliasRotationAllowed,
    collisionAssessmentAllowed: cfg.collisionAssessmentAllowed,
    crossRoomReuseAssessmentAllowed: cfg.crossRoomReuseAssessmentAllowed,
    displayContextAllowed: cfg.displayContextAllowed,
    exactTimestampsAllowed: cfg.exactTimestampsAllowed,
    reasonCode,
  };
}

export function roomAliasOperationForCommandV1(command: string): RoomAliasOperationV1 | undefined {
  const map: Readonly<Record<string, RoomAliasOperationV1>> = {
    "identity.room_alias.create": "create",
    "identity.room_alias.activate": "activate",
    "identity.room_alias.rotate": "rotate",
    "identity.room_alias.retire": "retire",
  };
  return map[command];
}
