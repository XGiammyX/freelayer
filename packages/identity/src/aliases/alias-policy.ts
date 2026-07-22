/**
 * Per-contact alias policy (TECH-ID-05). Pure, deterministic, fail-closed,
 * strictest-wins. Everything is memory/null (never persistent plaintext); remote
 * sharing / public directory / global username / authentication / cryptographic
 * binding / notifications / telemetry / AI are structurally unavailable.
 * DevicePosture may only tighten; room policy does not authorize alias ops.
 */

import type { PrivacyMode } from "@freelayer/privacy";

export type ContactAliasOperationV1 =
  | "presentation.create"
  | "presentation.activate"
  | "presentation.rotate"
  | "presentation.retire"
  | "local_peer_label.set"
  | "local_peer_label.replace"
  | "local_peer_label.clear"
  | "display_context.read"
  | "reuse_assessment.read";

export const CONTACT_ALIAS_OPERATIONS: readonly ContactAliasOperationV1[] = [
  "presentation.create",
  "presentation.activate",
  "presentation.rotate",
  "presentation.retire",
  "local_peer_label.set",
  "local_peer_label.replace",
  "local_peer_label.clear",
  "display_context.read",
  "reuse_assessment.read",
];

const PRESENTATION_WRITE: ReadonlySet<ContactAliasOperationV1> = new Set([
  "presentation.create",
  "presentation.activate",
  "presentation.rotate",
]);
const LABEL_WRITE: ReadonlySet<ContactAliasOperationV1> = new Set([
  "local_peer_label.set",
  "local_peer_label.replace",
]);
const EMERGENCY_ALLOWED: ReadonlySet<ContactAliasOperationV1> = new Set([
  "presentation.retire",
  "local_peer_label.clear",
  "display_context.read",
]);

export interface ContactAliasPolicyV1 {
  readonly mode: PrivacyMode;
  readonly operation: ContactAliasOperationV1;
  readonly allowed: boolean;
  readonly retention: "memory_only" | "null";
  readonly presentationAliasAllowed: boolean;
  readonly localPeerLabelAllowed: boolean;
  readonly aliasReuseAssessmentAllowed: boolean;
  readonly displayContextAllowed: boolean;
  readonly exactAliasTimestampsAllowed: boolean;
  readonly networkSharingAllowed: false;
  readonly publicDirectoryAllowed: false;
  readonly globalUsernameAllowed: false;
  readonly authenticationAvailable: false;
  readonly cryptographicBindingAvailable: false;
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
  readonly presentationAliasAllowed: boolean;
  readonly localPeerLabelAllowed: boolean;
  readonly aliasReuseAssessmentAllowed: boolean;
  readonly displayContextAllowed: boolean;
  readonly exactAliasTimestampsAllowed: boolean;
}

const MODE_CONFIG: Readonly<Record<PrivacyMode, Cfg>> = {
  standard: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    presentationAliasAllowed: true,
    localPeerLabelAllowed: true,
    aliasReuseAssessmentAllowed: true,
    displayContextAllowed: true,
    exactAliasTimestampsAllowed: true,
  },
  private: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    presentationAliasAllowed: true,
    localPeerLabelAllowed: true,
    aliasReuseAssessmentAllowed: true,
    displayContextAllowed: true,
    exactAliasTimestampsAllowed: false,
  },
  ghost: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    presentationAliasAllowed: true,
    localPeerLabelAllowed: false,
    aliasReuseAssessmentAllowed: true,
    displayContextAllowed: true,
    exactAliasTimestampsAllowed: false,
  },
  bunker: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: false,
    presentationAliasAllowed: false,
    localPeerLabelAllowed: false,
    aliasReuseAssessmentAllowed: false,
    displayContextAllowed: true,
    exactAliasTimestampsAllowed: false,
  },
  offline_capsule: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    presentationAliasAllowed: true,
    localPeerLabelAllowed: true,
    aliasReuseAssessmentAllowed: true,
    displayContextAllowed: true,
    exactAliasTimestampsAllowed: false,
  },
  emergency: {
    retention: "null",
    denyExpansive: true,
    emergencyOnly: true,
    presentationAliasAllowed: false,
    localPeerLabelAllowed: false,
    aliasReuseAssessmentAllowed: false,
    displayContextAllowed: true,
    exactAliasTimestampsAllowed: false,
  },
  sovereign_room: {
    retention: "memory_only",
    denyExpansive: false,
    emergencyOnly: false,
    presentationAliasAllowed: true,
    localPeerLabelAllowed: true,
    aliasReuseAssessmentAllowed: true,
    displayContextAllowed: true,
    exactAliasTimestampsAllowed: false,
  },
};

export function resolveContactAliasPolicyV1(input: {
  mode: PrivacyMode;
  operation: ContactAliasOperationV1;
}): ContactAliasPolicyV1 {
  const { mode, operation } = input;
  const cfg = MODE_CONFIG[mode];
  const off = {
    mode,
    operation,
    networkSharingAllowed: false as const,
    publicDirectoryAllowed: false as const,
    globalUsernameAllowed: false as const,
    authenticationAvailable: false as const,
    cryptographicBindingAvailable: false as const,
    persistentPlaintextAllowed: false as const,
    notificationAllowed: false as const,
    telemetryAllowed: false as const,
    aiAllowed: false as const,
  };

  if (cfg === undefined || !CONTACT_ALIAS_OPERATIONS.includes(operation)) {
    return {
      ...off,
      allowed: false,
      retention: "null",
      presentationAliasAllowed: false,
      localPeerLabelAllowed: false,
      aliasReuseAssessmentAllowed: false,
      displayContextAllowed: false,
      exactAliasTimestampsAllowed: false,
      reasonCode: "unknown_input",
    };
  }

  let allowed: boolean;
  let reasonCode = "alias_local";
  if (cfg.emergencyOnly) {
    allowed = EMERGENCY_ALLOWED.has(operation);
    reasonCode = allowed ? "emergency_restrictive_only" : "emergency_mode";
  } else if (PRESENTATION_WRITE.has(operation)) {
    allowed = cfg.presentationAliasAllowed && !cfg.denyExpansive;
    if (!allowed) reasonCode = "presentation_alias_denied";
  } else if (LABEL_WRITE.has(operation)) {
    allowed = cfg.localPeerLabelAllowed && !cfg.denyExpansive;
    if (!allowed) reasonCode = "local_peer_label_denied";
  } else if (operation === "reuse_assessment.read") {
    allowed = cfg.aliasReuseAssessmentAllowed;
    if (!allowed) reasonCode = "reuse_assessment_denied";
  } else if (operation === "display_context.read") {
    allowed = cfg.displayContextAllowed;
    if (!allowed) reasonCode = "display_context_denied";
  } else {
    // presentation.retire, local_peer_label.clear — restrictive, always allowed.
    allowed = true;
  }

  return {
    ...off,
    allowed,
    retention: cfg.retention,
    presentationAliasAllowed: cfg.presentationAliasAllowed,
    localPeerLabelAllowed: cfg.localPeerLabelAllowed,
    aliasReuseAssessmentAllowed: cfg.aliasReuseAssessmentAllowed,
    displayContextAllowed: cfg.displayContextAllowed,
    exactAliasTimestampsAllowed: cfg.exactAliasTimestampsAllowed,
    reasonCode,
  };
}

export function contactAliasOperationForCommandV1(
  command: string,
): ContactAliasOperationV1 | undefined {
  const map: Readonly<Record<string, ContactAliasOperationV1>> = {
    "identity.alias.presentation.create": "presentation.create",
    "identity.alias.presentation.activate": "presentation.activate",
    "identity.alias.presentation.rotate": "presentation.rotate",
    "identity.alias.presentation.retire": "presentation.retire",
    "identity.alias.local_peer_label.set": "local_peer_label.set",
    "identity.alias.local_peer_label.replace": "local_peer_label.replace",
    "identity.alias.local_peer_label.clear": "local_peer_label.clear",
  };
  return map[command];
}
