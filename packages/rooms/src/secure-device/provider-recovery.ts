/**
 * Provider failure + recovery model (TECH-23). Fail-closed everywhere:
 * `not_integrated`/`unavailable`/`failed` → effective `unverified`; a future
 * ready provider becoming unavailable/failed INVALIDATES; any posture → `at_risk`
 * INVALIDATES; stale INVALIDATES; a revision rollback is REJECTED. Recovery NEVER
 * restores an old session, NEVER auto-reveals content, and emits NO background
 * notification — it requires a fresh assessment, a fresh admission decision, and
 * fresh authorization. Pure description; no side effects.
 */

import type { DevicePosture } from "../policy-composition/device-posture";
import type { DevicePostureAssessmentFreshnessV1 } from "./posture-assessment";
import type { SecureDeviceProviderLifecycleV1 } from "./secure-device-provider";

export type ProviderTransitionEffectV1 =
  "reduce_to_unverified" | "invalidate_admission" | "reject_rollback" | "no_change";

export interface ProviderRecoveryRequirementV1 {
  readonly requiresFreshAssessment: true;
  readonly requiresFreshAdmission: true;
  readonly requiresFreshAuthorization: true;
  readonly restoresOldSession: false;
  readonly autoRevealsContent: false;
  readonly emitsBackgroundNotification: false;
}

export const PROVIDER_RECOVERY_REQUIREMENT_V1: ProviderRecoveryRequirementV1 = {
  requiresFreshAssessment: true,
  requiresFreshAdmission: true,
  requiresFreshAuthorization: true,
  restoresOldSession: false,
  autoRevealsContent: false,
  emitsBackgroundNotification: false,
};

/**
 * Classify what a change to provider/posture/freshness/revision means for an
 * active admission. Deterministic and content-free.
 */
export function classifyProviderTransitionV1(input: {
  lifecycle: SecureDeviceProviderLifecycleV1;
  effectivePosture: DevicePosture;
  freshness: DevicePostureAssessmentFreshnessV1;
  previousRevision?: number;
  nextRevision?: number;
}): { readonly effect: ProviderTransitionEffectV1; readonly reasonCode: string } {
  const { lifecycle, effectivePosture, freshness, previousRevision, nextRevision } = input;

  if (
    previousRevision !== undefined &&
    nextRevision !== undefined &&
    nextRevision < previousRevision
  ) {
    return { effect: "reject_rollback", reasonCode: "assessment_revision_rollback" };
  }
  if (effectivePosture === "at_risk") {
    return { effect: "invalidate_admission", reasonCode: "device_at_risk" };
  }
  if (lifecycle === "unavailable" || lifecycle === "failed") {
    return { effect: "invalidate_admission", reasonCode: "provider_unavailable" };
  }
  if (freshness === "stale") {
    return { effect: "invalidate_admission", reasonCode: "assessment_stale" };
  }
  if (lifecycle === "not_integrated") {
    return { effect: "reduce_to_unverified", reasonCode: "no_provider" };
  }
  return { effect: "no_change", reasonCode: "unchanged" };
}
