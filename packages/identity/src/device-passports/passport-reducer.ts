/**
 * Pure Device Passport reducer (TECH-ID-08). PURE: validate-before-mutate; no
 * storage/network/notification/AI/crypto/randomness; no signatures ever; no
 * operational device activation; injected ids + clock + process epoch + a
 * caller-resolved root/approver context only; source state/command never mutated;
 * deterministic; revisions +1; failure → no partial state. A prepared/approved
 * passport is `approved_local_unsigned` at most — it grants NO device authority
 * and NEVER becomes `issued_future_signed` / `accepted_future_verified`.
 */

import { FIRST_IDENTITY_REVISION, nextIdentityRevision } from "../identifiers";
import { localClockLabel, parseLocalClockMs } from "../ephemeral";
import { attenuateDeviceAuthorizationScopeV1, attenuateDeviceCapabilitiesV1 } from "../devices";
import {
  DeviceLinkRequestAlreadyApprovedError,
  DeviceLinkRequestExpiredError,
  DeviceLinkRequestRevisionMismatchError,
  DeviceLinkRequestValidationError,
  DevicePassportRevisionMismatchError,
  DevicePassportRootEpochMismatchError,
  DevicePassportScopeEscalationError,
  DevicePassportValidationError,
} from "./passport-errors";
import {
  assertDeviceLinkRequestTransitionV1,
  assertDevicePassportTransitionV1,
} from "./passport-lifecycle";
import { resolveDevicePassportGrantV1 } from "./passport-attenuation";
import { isDeadlinePassedV1 } from "./passport-validity";
import { DEVICE_LINK_REQUEST_LIMITS_V1, type DeviceLinkRequestV1 } from "./passport-link-requests";
import type { DevicePassportModelCommandV1 } from "./passport-commands";
import type { DevicePassportGeneratedIdsV1 } from "./passport-identifiers";
import type { DevicePassportPolicyV1 } from "./passport-policy";
import type {
  DevicePassportApproverContextV1,
  DevicePassportRootRefV1,
  DevicePassportStateV1,
  DevicePassportV1,
  LocalDevicePassportRevocationResultV1,
} from "./passport-types";
import type { DevicePassportKeySlotCommitmentV1 } from "./passport-claims";

export interface ReduceDevicePassportInputV1 {
  readonly state: DevicePassportStateV1;
  readonly command: DevicePassportModelCommandV1;
  readonly rootRef?: DevicePassportRootRefV1;
  readonly approver?: DevicePassportApproverContextV1;
  readonly policy?: DevicePassportPolicyV1;
  readonly generatedIds: DevicePassportGeneratedIdsV1;
  readonly clockValue: string;
  readonly processEpoch: string;
}

const REQUEST_PENDING: ReadonlySet<DeviceLinkRequestV1["lifecycle"]> = new Set([
  "draft_candidate_local",
  "pending_local_review",
  "approved_local_unsigned",
]);

function requireRootRef(ref: DevicePassportRootRefV1 | undefined): DevicePassportRootRefV1 {
  if (ref === undefined) throw new DevicePassportValidationError("missing_root_ref");
  if (!ref.rootActive) throw new DevicePassportValidationError("root_not_usable");
  return ref;
}
function requireApprover(
  a: DevicePassportApproverContextV1 | undefined,
): DevicePassportApproverContextV1 {
  if (a === undefined) throw new DevicePassportValidationError("missing_approver");
  if (!a.rootApprovalEligible) throw new DevicePassportValidationError("root_not_eligible");
  // A restricted / compromised / revoked device may never approve.
  if (
    a.approverDeviceAuthorization !== undefined &&
    a.approverDeviceAuthorization.lifecycle !== "active_local_unverified"
  ) {
    throw new DevicePassportValidationError("approver_not_operational");
  }
  return a;
}

export function reduceDevicePassportModelCommandV1(
  input: ReduceDevicePassportInputV1,
): DevicePassportStateV1 {
  const { state, command, generatedIds, clockValue: now } = input;
  if (state.processEpoch !== input.processEpoch) {
    throw new DevicePassportValidationError("process_restart");
  }
  const reqIndex = (id: string): number =>
    state.requests.findIndex((r) => (r.requestId as string) === id);
  const passIndex = (id: string): number =>
    state.passports.findIndex((p) => (p.passportId as string) === id);

  switch (command.command) {
    case "identity.device_link_request.create_local": {
      const ref = requireRootRef(input.rootRef);
      if ((ref.rootId as string) !== command.rootId)
        throw new DevicePassportValidationError("root_mismatch");
      if ((ref.rootAuthorityEpoch as number) !== command.expectedRootAuthorityEpoch) {
        throw new DevicePassportRootEpochMismatchError();
      }
      const pending = state.requests.filter(
        (r) => (r.rootId as string) === command.rootId && REQUEST_PENDING.has(r.lifecycle),
      ).length;
      if (pending >= DEVICE_LINK_REQUEST_LIMITS_V1.maximumPendingRequestsPerRoot) {
        throw new DeviceLinkRequestValidationError("pending_limit");
      }
      const requestId = generatedIds.requestId;
      const challengeId = generatedIds.challengeId;
      if (requestId === undefined || challengeId === undefined)
        throw new DevicePassportValidationError("missing_generated_id");
      if (state.requests.some((r) => r.requestId === requestId || r.challengeId === challengeId)) {
        throw new DeviceLinkRequestValidationError("duplicate_id");
      }
      const lifetimeMs = command.lifetimeMs ?? DEVICE_LINK_REQUEST_LIMITS_V1.defaultLifetimeMs;
      if (
        lifetimeMs < DEVICE_LINK_REQUEST_LIMITS_V1.minimumLifetimeMs ||
        lifetimeMs > DEVICE_LINK_REQUEST_LIMITS_V1.maximumLifetimeMs
      ) {
        throw new DeviceLinkRequestValidationError("bad_lifetime");
      }
      const nowMs = parseLocalClockMs(now);
      if (nowMs === null) throw new DeviceLinkRequestValidationError("bad_clock");
      const slotIds = generatedIds.keySlotIds ?? [];
      if (slotIds.length !== command.requestedKeySlotPurposes.length) {
        throw new DevicePassportValidationError("key_slot_id_count_mismatch");
      }
      const requestedKeySlots: DevicePassportKeySlotCommitmentV1[] =
        command.requestedKeySlotPurposes.map((purpose, i) => ({
          slotId: slotIds[i]!,
          purpose,
          candidatePublicMaterial: "not_present_gate_f",
          algorithm: "not_selected_gate_f",
          commitmentBinding: "not_implemented_gate_f",
        }));
      const request: DeviceLinkRequestV1 = {
        schemaVersion: 1,
        requestId,
        challengeId,
        rootId: ref.rootId,
        candidateDeviceRef: command.candidateDeviceRef as never,
        requestedScope: command.requestedScope,
        requestedCapabilities: [...command.requestedCapabilities],
        requestedKeySlots,
        rootAuthorityEpoch: ref.rootAuthorityEpoch,
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "draft_candidate_local",
        validity: {
          createdAtLocal: now,
          expiresAtLocal: localClockLabel(nowMs + lifetimeMs),
          maximumLifetimeMs: lifetimeMs,
          currentProcessOnly: true,
          crossRestartValidity: false,
          cryptographicFreshnessAvailable: false,
          oneTimeCryptographicEnforcementAvailable: false,
        },
        candidateBinding: "local_placeholder_unverified",
        transport: "not_implemented_gate_e",
        qrRepresentation: "not_implemented_gate_e",
        createdAtLocal: now,
        updatedAtLocal: now,
        persistence: "forbidden",
      };
      return { ...state, requests: [...state.requests, request] };
    }

    case "identity.device_link_request.submit_for_review":
    case "identity.device_link_request.reject":
    case "identity.device_link_request.expire":
    case "identity.device_link_request.revoke": {
      const index = reqIndex(command.requestId as string);
      if (index < 0) throw new DeviceLinkRequestValidationError("not_found");
      const current = state.requests[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new DeviceLinkRequestRevisionMismatchError();
      }
      const target =
        command.command === "identity.device_link_request.submit_for_review"
          ? "pending_local_review"
          : command.command === "identity.device_link_request.reject"
            ? "rejected_tombstone"
            : command.command === "identity.device_link_request.expire"
              ? "expired_tombstone"
              : "revoked_tombstone";
      // Submitting for review rechecks the (injected-clock) deadline; reject /
      // expire / revoke stay available for an already-expired request.
      if (
        command.command === "identity.device_link_request.submit_for_review" &&
        isDeadlinePassedV1(now, current.validity.expiresAtLocal)
      ) {
        throw new DeviceLinkRequestExpiredError("deadline_passed");
      }
      assertDeviceLinkRequestTransitionV1(
        current.lifecycle,
        target as DeviceLinkRequestV1["lifecycle"],
      );
      const next = {
        ...current,
        lifecycle: target as DeviceLinkRequestV1["lifecycle"],
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const list = state.requests.slice();
      list[index] = next;
      return { ...state, requests: list };
    }

    case "identity.device_passport.prepare_draft": {
      const approver = requireApprover(input.approver);
      if (input.policy === undefined) throw new DevicePassportValidationError("missing_policy");
      const index = reqIndex(command.requestId as string);
      if (index < 0) throw new DeviceLinkRequestValidationError("not_found");
      const request = state.requests[index]!;
      if ((request.revision as number) !== (command.expectedRequestRevision as number)) {
        throw new DeviceLinkRequestRevisionMismatchError();
      }
      if (request.lifecycle !== "pending_local_review") {
        throw new DeviceLinkRequestValidationError("request_not_pending");
      }
      if (isDeadlinePassedV1(now, request.validity.expiresAtLocal)) {
        throw new DeviceLinkRequestExpiredError("deadline_passed");
      }
      if ((request.rootId as string) !== (approver.rootId as string))
        throw new DevicePassportValidationError("root_mismatch");
      if ((request.rootAuthorityEpoch as number) !== (approver.rootAuthorityEpoch as number)) {
        throw new DevicePassportRootEpochMismatchError();
      }
      // One draft per originating request.
      if (
        state.passports.some(
          (p) => (p.claims.originatingRequestId as string) === (request.requestId as string),
        )
      ) {
        throw new DevicePassportValidationError("draft_already_exists");
      }
      const passportId = generatedIds.passportId;
      if (passportId === undefined) throw new DevicePassportValidationError("missing_generated_id");
      const grant = resolveDevicePassportGrantV1({ request, approver, policy: input.policy });
      const passport: DevicePassportV1 = {
        schemaVersion: 1,
        passportId,
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "draft_local",
        claims: {
          schemaVersion: 1,
          passportId,
          issuerRootId: approver.rootId,
          issuerAuthorityEpoch: approver.rootAuthorityEpoch,
          subjectDeviceRef: request.candidateDeviceRef,
          subjectAuthorizationId: command.subjectAuthorizationId,
          grantedScope: grant.grantedScope,
          grantedCapabilities: grant.grantedCapabilities,
          keySlotCommitments: request.requestedKeySlots,
          originatingRequestId: request.requestId,
          originatingChallengeId: request.challengeId,
          issuanceRevision: FIRST_IDENTITY_REVISION,
          validity: {
            issuedAtLocal: now,
            rootAuthorityEpoch: approver.rootAuthorityEpoch,
            minimumDeviceAuthorizationRevision: FIRST_IDENTITY_REVISION,
            trustedTimeAvailable: false,
            cryptographicFreshnessAvailable: false,
            crossRestartDraftValidity: false,
          },
          delegationAllowed: false,
          recoveryAuthorityGranted: false,
          rootSecretTransferAllowed: false,
          historyTransferIncluded: false,
          devicePostureClaimIncluded: false,
          attestationClaimIncluded: false,
        },
        approvalState: "not_reviewed",
        signatureState: "not_implemented_gate_f",
        verificationState: "not_verified_no_crypto",
        operationalAuthority: "none",
        remotelyAccepted: false,
        cryptographicallyIssued: false,
        cryptographicallyVerified: false,
        createdAtLocal: now,
        updatedAtLocal: now,
        persistence: "forbidden",
      };
      return { ...state, passports: [...state.passports, passport] };
    }

    case "identity.device_passport.approve_local_unsigned": {
      const approver = requireApprover(input.approver);
      const index = passIndex(command.passportId as string);
      if (index < 0) throw new DevicePassportValidationError("not_found");
      const current = state.passports[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new DevicePassportRevisionMismatchError();
      }
      if ((current.claims.issuerRootId as string) !== (approver.rootId as string))
        throw new DevicePassportValidationError("root_mismatch");
      if (
        (current.claims.issuerAuthorityEpoch as number) !== (approver.rootAuthorityEpoch as number)
      ) {
        throw new DevicePassportRootEpochMismatchError();
      }
      assertDevicePassportTransitionV1(current.lifecycle, "approved_local_unsigned");
      // Approve the originating request too (double-approval guarded).
      const rIndex = state.requests.findIndex(
        (r) => (r.requestId as string) === (current.claims.originatingRequestId as string),
      );
      const requests = state.requests.slice();
      if (rIndex >= 0) {
        const r = requests[rIndex]!;
        if (r.lifecycle === "approved_local_unsigned")
          throw new DeviceLinkRequestAlreadyApprovedError();
        if (r.lifecycle === "pending_local_review") {
          requests[rIndex] = {
            ...r,
            lifecycle: "approved_local_unsigned",
            revision: nextIdentityRevision(r.revision),
            updatedAtLocal: now,
          };
        }
      }
      const next: DevicePassportV1 = {
        ...current,
        lifecycle: "approved_local_unsigned",
        approvalState: "approved_local_policy_only",
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const passports = state.passports.slice();
      passports[index] = next;
      return { ...state, requests, passports };
    }

    case "identity.device_passport.restrict_local": {
      const index = passIndex(command.passportId as string);
      if (index < 0) throw new DevicePassportValidationError("not_found");
      const current = state.passports[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new DevicePassportRevisionMismatchError();
      }
      assertDevicePassportTransitionV1(current.lifecycle, "restricted_local");
      let grantedScope = current.claims.grantedScope;
      if (command.requestedScope !== undefined) {
        try {
          grantedScope = attenuateDeviceAuthorizationScopeV1({
            current: current.claims.grantedScope,
            requested: command.requestedScope,
          });
        } catch {
          throw new DevicePassportScopeEscalationError();
        }
      }
      const grantedCapabilities =
        command.requestedCapabilities !== undefined
          ? attenuateDeviceCapabilitiesV1(
              current.claims.grantedCapabilities,
              command.requestedCapabilities,
            )
          : current.claims.grantedCapabilities;
      const next: DevicePassportV1 = {
        ...current,
        lifecycle: "restricted_local",
        claims: { ...current.claims, grantedScope, grantedCapabilities },
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const passports = state.passports.slice();
      passports[index] = next;
      return { ...state, passports };
    }

    case "identity.device_passport.expire":
    case "identity.device_passport.revoke": {
      const index = passIndex(command.passportId as string);
      if (index < 0) throw new DevicePassportValidationError("not_found");
      const current = state.passports[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new DevicePassportRevisionMismatchError();
      }
      const target =
        command.command === "identity.device_passport.expire"
          ? "expired_tombstone"
          : "revoked_tombstone";
      assertDevicePassportTransitionV1(current.lifecycle, target);
      const next: DevicePassportV1 = {
        ...current,
        lifecycle: target,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const passports = state.passports.slice();
      passports[index] = next;
      return { ...state, passports };
    }

    default: {
      const _never: never = command;
      throw new DevicePassportValidationError(`unhandled:${String(_never)}`);
    }
  }
}

/** Hard boundary: a local passport NEVER grants operational device authority. */
export function devicePassportGrantsOperationalAuthorityV1(_passport: DevicePassportV1): false {
  return false;
}

export const DEVICE_PASSPORT_REVOCATION_RESULT_V1: LocalDevicePassportRevocationResultV1 = {
  schemaVersion: 1,
  passportRevokedLocally: true,
  localApprovalInvalidated: true,
  remoteDeviceAffected: false,
  deviceAuthorizationAffected: false,
  messageKeysRotated: false,
  roomKeysRotated: false,
  deviceDataErased: false,
  cryptographicRevocationPerformed: false,
  redacted: true,
};

export function emptyDevicePassportStateV1(
  processEpoch: string,
  persistenceClass: "current_process_memory" | "null" = "current_process_memory",
): DevicePassportStateV1 {
  return { schemaVersion: 1, processEpoch, requests: [], passports: [], persistenceClass };
}
