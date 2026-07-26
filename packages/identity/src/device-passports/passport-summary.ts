/**
 * Safe Device Passport summaries + redacted audit (TECH-ID-08). A summary never
 * says "trusted / valid / verified / active" generically — it reports the exact
 * lifecycle + authenticity, with every crypto/operational/attestation flag false.
 * Strict modes omit scope, counts, deadlines, references, and root epoch. It
 * never exposes the root/device graph, room/relationship ids, key-slot ids,
 * DevicePosture, attestation, or raw request claims. A read requires its OWN
 * `identity.device_passport.summary.read` decision.
 */

import { isPolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { DevicePassportDecisionMismatchError } from "./passport-errors";
import type { DevicePassportPolicyV1 } from "./passport-policy";
import type {
  DevicePassportAuthenticityV1,
  DevicePassportSummaryV1,
  DevicePassportV1,
} from "./passport-types";

export type DevicePassportAuditCategoryV1 =
  | "link_request_lifecycle"
  | "passport_preparation"
  | "passport_local_approval"
  | "passport_restriction"
  | "passport_revocation"
  | "passport_summary";

export interface DevicePassportAuditEventV1 {
  readonly schemaVersion: 1;
  readonly operationCategory: DevicePassportAuditCategoryV1;
  readonly outcome: "allowed" | "denied";
  readonly mode: PrivacyMode;
  readonly reasonCode: string;
  readonly redacted: true;
}

export function buildDevicePassportAuditEventV1(input: {
  operationCategory: DevicePassportAuditCategoryV1;
  outcome: "allowed" | "denied";
  mode: PrivacyMode;
  reasonCode: string;
}): DevicePassportAuditEventV1 {
  return { schemaVersion: 1, ...input, redacted: true };
}

export function assertDevicePassportSummaryDecisionV1(decision: PolicyDecision): void {
  if (
    !isPolicyDecision(decision) ||
    decision.verdict !== "allowed" ||
    decision.sideEffect !== "identity.device_passport.summary.read"
  ) {
    throw new DevicePassportDecisionMismatchError();
  }
}

/** Map a passport lifecycle to its authenticity — never future-signed in production. */
export function devicePassportAuthenticityV1(
  passport: DevicePassportV1,
): DevicePassportAuthenticityV1 {
  switch (passport.lifecycle) {
    case "approved_local_unsigned":
    case "restricted_local":
      return "local_policy_approved_unsigned";
    default:
      return "local_draft_untrusted";
  }
}

export function buildDevicePassportSummaryV1(input: {
  passport: DevicePassportV1;
  policy: DevicePassportPolicyV1;
}): DevicePassportSummaryV1 {
  const { passport, policy } = input;
  const redacted = !policy.scopeDetailsAllowed;
  return {
    schemaVersion: 1,
    lifecycle: passport.lifecycle,
    authenticity: devicePassportAuthenticityV1(passport),
    ...(policy.scopeDetailsAllowed ? { scopeKind: passport.claims.grantedScope.kind } : {}),
    ...(policy.capabilityDetailsAllowed
      ? { capabilityCount: passport.claims.grantedCapabilities.length }
      : {}),
    ...(policy.capabilityDetailsAllowed
      ? { keyPurposeCount: passport.claims.keySlotCommitments.length }
      : {}),
    cryptographicallyIssued: false,
    cryptographicallyVerified: false,
    operationalAuthority: false,
    remotelyAccepted: false,
    hardwareAttested: false,
    postureVerified: false,
    ...(policy.exactTimestampsAllowed && passport.claims.validity.expiresAtLocal !== undefined
      ? { expiresAtLocal: passport.claims.validity.expiresAtLocal }
      : {}),
    redacted,
  };
}
