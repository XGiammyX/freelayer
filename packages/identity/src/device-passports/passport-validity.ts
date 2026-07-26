/**
 * Device link request + passport draft stale-context invalidation (TECH-ID-08).
 * These are ENGINEERING checks over an injected local clock + process epoch —
 * NOT cryptographic freshness and NOT replay-proof. Everything fails CLOSED: a
 * changed root epoch/revision, a changed candidate/scope, a passed deadline, a
 * backward/unparseable clock, a process restart, a stricter policy, or an
 * at-risk DevicePosture all invalidate. Stale state is NEVER silently refreshed.
 */

import { parseLocalClockMs } from "../ephemeral";
import {
  DeviceLinkRequestExpiredError,
  DeviceLinkRequestRevisionMismatchError,
  DeviceLinkRequestValidationError,
  DevicePassportCandidateMismatchError,
  DevicePassportRevisionMismatchError,
  DevicePassportRootEpochMismatchError,
  DevicePassportValidationError,
} from "./passport-errors";
import type { DeviceLinkRequestV1 } from "./passport-link-requests";
import type {
  DevicePassportApproverContextV1,
  DevicePassportRootRefV1,
  DevicePassportV1,
} from "./passport-types";

/** True if the deadline has passed OR the clock is backward/unparseable (fail closed). */
export function isDeadlinePassedV1(nowLocal: string, expiresAtLocal: string): boolean {
  const now = parseLocalClockMs(nowLocal);
  const deadline = parseLocalClockMs(expiresAtLocal);
  if (now === null || deadline === null) return true; // unparseable → fail closed
  return now >= deadline;
}

const REQUEST_OPERATIONAL: ReadonlySet<DeviceLinkRequestV1["lifecycle"]> = new Set([
  "draft_candidate_local",
  "pending_local_review",
  "approved_local_unsigned",
]);

export function assertDeviceLinkRequestCurrentV1(input: {
  current: DeviceLinkRequestV1;
  rootRef: DevicePassportRootRefV1;
  nowLocal: string;
  currentProcessEpoch: string;
  storedProcessEpoch: string;
  expectedRevision?: number;
  expectedCandidateDeviceRef?: string;
  postureAtRisk?: boolean;
  policyStricter?: boolean;
}): void {
  const { current, rootRef } = input;

  if (input.currentProcessEpoch !== input.storedProcessEpoch) {
    throw new DeviceLinkRequestExpiredError("process_restart");
  }
  if (!rootRef.rootActive) throw new DeviceLinkRequestValidationError("root_not_usable");
  if ((current.rootId as string) !== (rootRef.rootId as string)) {
    throw new DeviceLinkRequestValidationError("root_mismatch");
  }
  if ((current.rootAuthorityEpoch as number) !== (rootRef.rootAuthorityEpoch as number)) {
    throw new DevicePassportRootEpochMismatchError();
  }
  if (
    input.expectedRevision !== undefined &&
    (current.revision as number) !== input.expectedRevision
  ) {
    throw new DeviceLinkRequestRevisionMismatchError();
  }
  if (
    input.expectedCandidateDeviceRef !== undefined &&
    (current.candidateDeviceRef as string) !== input.expectedCandidateDeviceRef
  ) {
    throw new DevicePassportCandidateMismatchError();
  }
  if (!REQUEST_OPERATIONAL.has(current.lifecycle)) {
    throw new DeviceLinkRequestValidationError("request_not_current");
  }
  if (isDeadlinePassedV1(input.nowLocal, current.validity.expiresAtLocal)) {
    throw new DeviceLinkRequestExpiredError("deadline_passed");
  }
  if (input.postureAtRisk === true || input.policyStricter === true) {
    throw new DeviceLinkRequestValidationError("tightened_by_posture_or_policy");
  }
}

const PASSPORT_OPERATIONAL: ReadonlySet<DevicePassportV1["lifecycle"]> = new Set([
  "draft_local",
  "approved_local_unsigned",
  "restricted_local",
]);

export function assertDevicePassportDraftCurrentV1(input: {
  current: DevicePassportV1;
  approver: DevicePassportApproverContextV1;
  nowLocal: string;
  currentProcessEpoch: string;
  storedProcessEpoch: string;
  expectedRevision?: number;
  expectedCandidateDeviceRef?: string;
  postureAtRisk?: boolean;
  policyStricter?: boolean;
}): void {
  const { current, approver } = input;

  if (input.currentProcessEpoch !== input.storedProcessEpoch) {
    throw new DevicePassportValidationError("process_restart");
  }
  if (!approver.rootApprovalEligible) {
    throw new DevicePassportValidationError("root_not_eligible");
  }
  if ((current.claims.issuerRootId as string) !== (approver.rootId as string)) {
    throw new DevicePassportValidationError("root_mismatch");
  }
  if ((current.claims.issuerAuthorityEpoch as number) !== (approver.rootAuthorityEpoch as number)) {
    throw new DevicePassportRootEpochMismatchError();
  }
  if (
    input.expectedRevision !== undefined &&
    (current.revision as number) !== input.expectedRevision
  ) {
    throw new DevicePassportRevisionMismatchError();
  }
  if (
    input.expectedCandidateDeviceRef !== undefined &&
    (current.claims.subjectDeviceRef as string) !== input.expectedCandidateDeviceRef
  ) {
    throw new DevicePassportCandidateMismatchError();
  }
  if (!PASSPORT_OPERATIONAL.has(current.lifecycle)) {
    throw new DevicePassportValidationError("passport_not_current");
  }
  const expiresAtLocal = current.claims.validity.expiresAtLocal;
  if (expiresAtLocal !== undefined && isDeadlinePassedV1(input.nowLocal, expiresAtLocal)) {
    throw new DevicePassportValidationError("deadline_passed");
  }
  if (input.postureAtRisk === true || input.policyStricter === true) {
    throw new DevicePassportValidationError("tightened_by_posture_or_policy");
  }
}
