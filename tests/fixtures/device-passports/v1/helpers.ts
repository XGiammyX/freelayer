/**
 * Device Passport test helpers (TECH-ID-08). SYNTHETIC only — no real keys,
 * signatures, hardware ids, or secrets. Deterministic ids + injected clock +
 * process epoch. Everything is current-process memory/null.
 */

import {
  issuePolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  applyDevicePassportModelCommandV1,
  emptyDevicePassportStateV1,
  InMemoryDevicePassportRepositoryV1,
  validateDeviceAuthorizationId,
  validateDeviceKeySlotId,
  validateDeviceLinkChallengeId,
  validateDeviceLinkRequestId,
  validateDevicePassportId,
  validateIdentityPersonaId,
  validateLocalDeviceRef,
  validateLocalIdentityRootId,
  type DeviceAuthorizationScopeV1,
  type DevicePassportApproverContextV1,
  type DevicePassportGeneratedIdsV1,
  type DevicePassportRepositoryV1,
  type DevicePassportRootRefV1,
  type DevicePassportStateV1,
} from "@freelayer/identity";

export const PASSPORT_SENTINEL = "FREELAYER_DEVICE_PASSPORT_SENTINEL_DO_NOT_LEAK";
export const PROC = "proc-1";
export const CLOCK = "local:1000";

export const ROOT = validateLocalIdentityRootId("idr-pp-1");
export const PERSONA = validateIdentityPersonaId("idp-pp-1");
export const CANDIDATE = validateLocalDeviceRef("dev-pp-1");
export const SUBJECT_AUTH = validateDeviceAuthorizationId("devauth-pp-1");

const CAPS = [
  "identity.summary.read",
  "identity.persona.use",
  "identity.relationship.use",
  "identity.room_binding.use",
];

export function rootScope(): DeviceAuthorizationScopeV1 {
  return { kind: "identity_root", rootId: ROOT, readOnly: false };
}
export function personaScope(): DeviceAuthorizationScopeV1 {
  return { kind: "persona", rootId: ROOT, personaId: PERSONA, readOnly: false };
}
export function readOnlyScope(): DeviceAuthorizationScopeV1 {
  return { kind: "read_only", rootId: ROOT, readOnly: true };
}

export function rootRef(over?: Partial<DevicePassportRootRefV1>): DevicePassportRootRefV1 {
  return {
    rootId: ROOT,
    rootKind: "long_lived_local",
    rootRevision: 1 as DevicePassportRootRefV1["rootRevision"],
    rootAuthorityEpoch: 1 as DevicePassportRootRefV1["rootAuthorityEpoch"],
    rootActive: true,
    rootApprovalEligible: true,
    ...over,
  };
}

export function approver(
  over?: Partial<DevicePassportApproverContextV1>,
): DevicePassportApproverContextV1 {
  return {
    rootId: ROOT,
    rootRevision: 1 as DevicePassportApproverContextV1["rootRevision"],
    rootAuthorityEpoch: 1 as DevicePassportApproverContextV1["rootAuthorityEpoch"],
    approverSource: "local_root_controller_placeholder",
    maximumScope: personaScope(),
    maximumCapabilities: CAPS as never,
    rootApprovalEligible: true,
    cryptographicRootControlProven: false,
    ...over,
  };
}

let seq = 0;
export function nextIds(slotCount = 1): Required<DevicePassportGeneratedIdsV1> {
  seq += 1;
  const keySlotIds = Array.from({ length: slotCount }, (_v, i) =>
    validateDeviceKeySlotId(`devslot-pp${seq}-${i + 1}`),
  );
  return {
    requestId: validateDeviceLinkRequestId(`lreq-a${seq}`),
    challengeId: validateDeviceLinkChallengeId(`lchal-a${seq}`),
    passportId: validateDevicePassportId(`pass-a${seq}`),
    keySlotIds,
  };
}

export function emptyState(
  pc: "current_process_memory" | "null" = "current_process_memory",
): DevicePassportStateV1 {
  return emptyDevicePassportStateV1(PROC, pc);
}
export function repo(): DevicePassportRepositoryV1 {
  return new InMemoryDevicePassportRepositoryV1();
}
export function decisionFor(scope: PolicySideEffectScope, mode: PrivacyMode = "standard") {
  return issuePolicyDecision("persistence", "allowed", mode, scope);
}

export function createRequestCommand(over?: {
  scope?: DeviceAuthorizationScopeV1;
  capabilities?: readonly string[];
  purposes?: readonly string[];
  rootId?: string;
  candidateDeviceRef?: string;
  expectedRootAuthorityEpoch?: number;
  lifetimeMs?: number;
}) {
  return {
    schemaVersion: 1,
    command: "identity.device_link_request.create_local",
    rootId: over?.rootId ?? (ROOT as unknown as string),
    expectedRootAuthorityEpoch: over?.expectedRootAuthorityEpoch ?? 1,
    candidateDeviceRef: over?.candidateDeviceRef ?? (CANDIDATE as unknown as string),
    requestedScope: over?.scope ?? personaScope(),
    requestedCapabilities: over?.capabilities ?? ["identity.summary.read", "identity.persona.use"],
    requestedKeySlotPurposes: over?.purposes ?? ["pairwise_messaging_future"],
    ...(over?.lifetimeMs !== undefined ? { lifetimeMs: over.lifetimeMs } : {}),
  };
}

export function applyP(input: {
  state: DevicePassportStateV1;
  command: unknown;
  scope: PolicySideEffectScope;
  mode?: PrivacyMode;
  rootRef?: DevicePassportRootRefV1;
  approver?: DevicePassportApproverContextV1;
  generatedIds?: DevicePassportGeneratedIdsV1;
  clockValue?: string;
  processEpoch?: string;
  repository?: DevicePassportRepositoryV1;
}) {
  return applyDevicePassportModelCommandV1({
    state: input.state,
    command: input.command,
    mode: input.mode ?? "standard",
    decision: decisionFor(input.scope, input.mode ?? "standard"),
    ...(input.rootRef !== undefined ? { rootRef: input.rootRef } : {}),
    ...(input.approver !== undefined ? { approver: input.approver } : {}),
    generatedIds: input.generatedIds ?? {},
    clockValue: input.clockValue ?? CLOCK,
    processEpoch: input.processEpoch ?? PROC,
    repository: input.repository ?? repo(),
  });
}

/** Create a draft candidate request; returns state + ids. */
export function createdRequest(over?: Parameters<typeof createRequestCommand>[0]) {
  const ids = nextIds((over?.purposes ?? ["pairwise_messaging_future"]).length);
  const state = applyP({
    state: emptyState(),
    command: createRequestCommand(over),
    scope: "identity.device_link_request.create",
    rootRef: rootRef(),
    generatedIds: ids,
  }).state;
  return { state, ids };
}

/** Create + submit a request (pending_local_review). */
export function submittedRequest(over?: Parameters<typeof createRequestCommand>[0]) {
  const { state, ids } = createdRequest(over);
  const submitted = applyP({
    state,
    command: {
      schemaVersion: 1,
      command: "identity.device_link_request.submit_for_review",
      requestId: ids.requestId,
      expectedRevision: 1,
    },
    scope: "identity.device_link_request.lifecycle",
  }).state;
  return { state: submitted, ids };
}

/** Create + submit + prepare draft (draft_local passport). */
export function preparedDraft(over?: Parameters<typeof createRequestCommand>[0]) {
  const { state, ids } = submittedRequest(over);
  const prepared = applyP({
    state,
    command: {
      schemaVersion: 1,
      command: "identity.device_passport.prepare_draft",
      requestId: ids.requestId,
      expectedRequestRevision: 2,
      subjectAuthorizationId: SUBJECT_AUTH,
    },
    scope: "identity.device_passport.prepare",
    approver: approver(),
    generatedIds: { passportId: ids.passportId },
  }).state;
  return { state: prepared, ids };
}

/** Full flow to an approved_local_unsigned passport. */
export function approvedPassport(over?: Parameters<typeof createRequestCommand>[0]) {
  const { state, ids } = preparedDraft(over);
  const approved = applyP({
    state,
    command: {
      schemaVersion: 1,
      command: "identity.device_passport.approve_local_unsigned",
      passportId: ids.passportId,
      expectedRevision: 1,
    },
    scope: "identity.device_passport.approve_unsigned",
    approver: approver(),
  }).state;
  return { state: approved, ids };
}
