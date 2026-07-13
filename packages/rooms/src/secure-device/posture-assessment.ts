/**
 * Normalized, transient DevicePosture ASSESSMENT (TECH-23).
 *
 * This is the ONLY posture data core consumes — a privacy-minimized result, NOT
 * raw Evidence. It carries NO device identifier, serial, OS/build fingerprint,
 * installed-app inventory, measurement log, or assessment history; those fields
 * are structurally forbidden and rejected on sight. An assessment is a POLICY
 * INPUT, never proof of identity/ownership/authorization.
 *
 * Provenance is enforced by a module-PRIVATE registry (same pattern as
 * PolicyDecision): only assessments this module actually issued pass
 * `isAcceptedDevicePostureAssessmentV1`. This is genuinely unforgeable within
 * the JS object-capability model but is NOT cryptographic (Gate F) — it does not
 * defend against same-realm reflection on a real assessment. The only production
 * factory produces `unverified` (or `at_risk` tightening); there is NO
 * production `basic+`/`high_assurance` factory.
 */

import {
  resolveEffectiveDevicePostureV1,
  type DevicePosture,
} from "../policy-composition/device-posture";
import type { SecureDeviceProviderLifecycleV1 } from "./secure-device-provider";

export type DevicePostureAssessmentFreshnessV1 = "unknown" | "current_process_only" | "stale";

export type DevicePostureAssessmentSourceV1 =
  "no_provider" | "untrusted_local" | "secure_device_future_provider";

export interface DevicePostureAssessmentV1 {
  readonly schemaVersion: 1;
  readonly contractVersion: 1;
  readonly assessmentRevision: number;
  readonly reportedPosture: DevicePosture;
  readonly effectivePosture: DevicePosture;
  readonly source: DevicePostureAssessmentSourceV1;
  readonly providerLifecycle: SecureDeviceProviderLifecycleV1;
  readonly freshness: DevicePostureAssessmentFreshnessV1;
  /** Structural literals — an assessment is never trusted for elevation. */
  readonly trustedForElevation: false;
  readonly mayTighten: true;
  readonly rawEvidenceIncluded: false;
  readonly deviceIdentifiersIncluded: false;
  readonly deviceManagementPerformed: false;
  readonly telemetryEmitted: false;
  readonly reasonCodes: readonly string[];
}

/**
 * Module-private provenance registry. No other code holds a reference, so no
 * other code can add to it — a hand-crafted look-alike is not a member and is
 * rejected. Bounded by the exact structural checks below, not by cryptography.
 */
const issuedAssessments = new WeakSet<DevicePostureAssessmentV1>();

/** Field names that MUST NEVER appear on a posture assessment (raw evidence / identifiers). */
export const FORBIDDEN_ASSESSMENT_FIELDS: readonly string[] = [
  "rawEvidence",
  "evidence",
  "attestation",
  "attestationToken",
  "measurementLog",
  "measurements",
  "deviceId",
  "deviceIdentifier",
  "serial",
  "serialNumber",
  "imei",
  "androidId",
  "hardwareId",
  "osBuild",
  "osFingerprint",
  "buildFingerprint",
  "installedApps",
  "appInventory",
  "packages",
  "packageList",
  "assessmentHistory",
  "history",
  "nonce",
  "certificateChain",
  "signature",
];

function hasForbiddenField(value: object): boolean {
  return FORBIDDEN_ASSESSMENT_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(value, f));
}

/** Positive safe integer revision, else `null`. */
function safeRevision(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/**
 * Structural validation independent of provenance — used to reject forged /
 * evidence-bearing objects BEFORE they can influence policy. Returns `true`
 * only for a well-formed, evidence-free assessment shape.
 */
export function isStructurallyValidAssessmentV1(
  value: unknown,
): value is DevicePostureAssessmentV1 {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  if (hasForbiddenField(a)) return false;
  if (a["schemaVersion"] !== 1 || a["contractVersion"] !== 1) return false;
  if (safeRevision(a["assessmentRevision"]) === null) return false;
  if (typeof a["reportedPosture"] !== "string" || typeof a["effectivePosture"] !== "string") {
    return false;
  }
  if (
    a["trustedForElevation"] !== false ||
    a["mayTighten"] !== true ||
    a["rawEvidenceIncluded"] !== false ||
    a["deviceIdentifiersIncluded"] !== false ||
    a["deviceManagementPerformed"] !== false ||
    a["telemetryEmitted"] !== false
  ) {
    return false;
  }
  if (!Array.isArray(a["reasonCodes"])) return false;
  return true;
}

/**
 * Provenance + structure check used before an assessment is trusted as a policy
 * input: it must be an object THIS module issued AND still structurally valid.
 * Forged look-alikes and evidence-bearing objects fail by construction.
 */
export function isAcceptedDevicePostureAssessmentV1(
  value: unknown,
): value is DevicePostureAssessmentV1 {
  return (
    isStructurallyValidAssessmentV1(value) &&
    issuedAssessments.has(value as DevicePostureAssessmentV1)
  );
}

function register(assessment: DevicePostureAssessmentV1): DevicePostureAssessmentV1 {
  issuedAssessments.add(assessment);
  return assessment;
}

/**
 * The canonical production assessment factory. Because no provider is
 * integrated, the effective posture is resolved fail-closed to `unverified`
 * (default) or `at_risk` (untrusted tightening) — it can NEVER be elevated.
 * The result is registered for provenance and is TRANSIENT (never persisted).
 */
export function resolveDevicePostureAssessmentV1(input?: {
  reportedPosture?: DevicePosture;
  source?: DevicePostureAssessmentSourceV1;
  assessmentRevision?: number;
  freshness?: DevicePostureAssessmentFreshnessV1;
}): DevicePostureAssessmentV1 {
  const reported = input?.reportedPosture ?? "unverified";
  // Reuse the fail-closed TECH-22 resolver: untrusted input may only tighten.
  const effective = resolveEffectiveDevicePostureV1({
    schemaVersion: 1,
    reportedPosture: reported,
    source:
      input?.source === "secure_device_future_provider"
        ? "secure_device_future_provider"
        : input?.source === "untrusted_local"
          ? "untrusted_local"
          : "none",
    providerIntegration: "not_integrated",
    signalRevision: safeRevision(input?.assessmentRevision) ?? 1,
  });

  const revision = safeRevision(input?.assessmentRevision) ?? 1;
  const source: DevicePostureAssessmentSourceV1 = input?.source ?? "no_provider";
  const freshness: DevicePostureAssessmentFreshnessV1 = input?.freshness ?? "current_process_only";

  return register({
    schemaVersion: 1,
    contractVersion: 1,
    assessmentRevision: revision,
    reportedPosture: reported,
    effectivePosture: effective.effectivePosture, // unverified or at_risk only
    source,
    providerLifecycle: "not_integrated",
    freshness,
    trustedForElevation: false,
    mayTighten: true,
    rawEvidenceIncluded: false,
    deviceIdentifiersIncluded: false,
    deviceManagementPerformed: false,
    telemetryEmitted: false,
    reasonCodes: [effective.reasonCode],
  });
}

/** The default assessment when there is no provider at all: unverified, revision 1. */
export function noProviderAssessmentV1(): DevicePostureAssessmentV1 {
  return resolveDevicePostureAssessmentV1({
    reportedPosture: "unverified",
    source: "no_provider",
    assessmentRevision: 1,
    freshness: "current_process_only",
  });
}
