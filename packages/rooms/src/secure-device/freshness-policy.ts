/**
 * Posture freshness model (TECH-23). FreeLayer core has NO trusted clock, NO
 * cryptographic nonces, and NO epoch verification (Gate F). An assessment is
 * therefore valid ONLY within the current process and current revision; it is
 * never persisted; a restart invalidates it; a revision rollback is rejected;
 * local timestamps are diagnostic only; there is NO replay-resistance claim.
 * Provider recovery requires a fresh assessment AND a fresh admission.
 */

import type { DevicePostureAssessmentV1 } from "./posture-assessment";

export interface DevicePostureFreshnessPolicyV1 {
  readonly acceptedFreshness: "current_process_only";
  readonly trustedClockAvailable: false;
  readonly nonceVerificationAvailable: false;
  readonly epochVerificationAvailable: false;
  readonly crossRestartValidity: false;
}

export const DEVICE_POSTURE_FRESHNESS_POLICY_V1: DevicePostureFreshnessPolicyV1 = {
  acceptedFreshness: "current_process_only",
  trustedClockAvailable: false,
  nonceVerificationAvailable: false,
  epochVerificationAvailable: false,
  crossRestartValidity: false,
};

export type FreshnessCheckResultV1 =
  | { readonly fresh: true; readonly reasonCode: "current_process_only" }
  | {
      readonly fresh: false;
      readonly reasonCode: "stale" | "unknown_freshness" | "revision_rollback";
    };

/**
 * Decide whether an assessment is fresh enough to gate content NOW, given the
 * last-seen revision (if any) in the current process. Rollback (a revision lower
 * than one already seen) is REJECTED — never silently accepted.
 */
export function checkAssessmentFreshnessV1(input: {
  assessment: DevicePostureAssessmentV1;
  /** The highest revision already observed in this process (rollback guard). */
  priorRevision?: number;
}): FreshnessCheckResultV1 {
  const { assessment, priorRevision } = input;
  if (priorRevision !== undefined && assessment.assessmentRevision < priorRevision) {
    return { fresh: false, reasonCode: "revision_rollback" };
  }
  if (assessment.freshness === "stale") {
    return { fresh: false, reasonCode: "stale" };
  }
  if (assessment.freshness === "current_process_only") {
    return { fresh: true, reasonCode: "current_process_only" };
  }
  return { fresh: false, reasonCode: "unknown_freshness" };
}
