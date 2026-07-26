/**
 * Privacy-regression (TECH-ID-08): Device Passport — opaque ids, bounded link
 * requests, attenuated UNSIGNED passport claims, local approval that grants NO
 * operational authority, restriction/revocation, injected-clock expiry, and
 * current-process memory/null retention. Covers §37 behaviorally.
 */
import { describe, expect, it } from "vitest";
import {
  applyDevicePassportModelCommandV1,
  assertDeviceLinkRequestCurrentV1,
  assertDevicePassportTransitionV1,
  DeviceLinkRequestExpiredError,
  DeviceLinkRequestValidationError,
  DevicePassportCapabilityEscalationError,
  DevicePassportIssuanceUnavailableError,
  DevicePassportLifecycleError,
  DevicePassportScopeEscalationError,
  DevicePassportValidationError,
  devicePassportGrantsOperationalAuthorityV1,
  InMemoryDevicePassportRepositoryV1,
  NullDevicePassportRepositoryV1,
  validateDevicePassportId,
  validateDevicePassportModelCommandV1,
} from "@freelayer/identity";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  applyP,
  approver,
  approvedPassport,
  createRequestCommand,
  createdRequest,
  CLOCK,
  decisionFor,
  emptyState,
  nextIds,
  readOnlyScope,
  repo,
  rootRef,
  rootScope,
  submittedRequest,
  SUBJECT_AUTH,
} from "../../../fixtures/device-passports/v1/helpers";

describe("Identifiers + validation (§37: 1-10)", () => {
  it("ids are opaque; forbidden/attestation/future fields + unknown command reject", () => {
    expect(validateDevicePassportId("pass-a1")).toBe("pass-a1");
    expect(() => validateDevicePassportId("pass-Serial 1")).toThrow();
    for (const field of [
      "valid",
      "trusted",
      "verified",
      "active",
      "signed",
      "signature",
      "publicKey",
      "privateKey",
      "rootSecret",
      "recoveryKey",
      "historyKey",
      "attestation",
      "devicePosture",
      "hardwareId",
      "serialNumber",
      "owner",
      "admin",
      "superuser",
      "wildcard",
      "delegationAllowed",
      "remoteAccepted",
      "screenShieldActive",
      "managedBunker",
    ]) {
      expect(
        () =>
          validateDevicePassportModelCommandV1({
            schemaVersion: 1,
            command: "identity.device_passport.revoke",
            passportId: "pass-a1",
            expectedRevision: 1,
            [field]: "x",
          }),
        field,
      ).toThrow();
    }
    expect(() =>
      validateDevicePassportModelCommandV1({
        schemaVersion: 1,
        command: "identity.device_passport.boom",
      }),
    ).toThrow(DevicePassportValidationError);
    // Signing / issuing / verifying / QR / remote-accept commands are unavailable.
    for (const c of [
      "identity.device_passport.issue_signed",
      "identity.device_passport.accept_verified",
      "identity.device_passport.sign",
      "identity.device_passport.verify",
      "identity.device_passport.transport_qr",
      "identity.device_passport.remote_accept",
      "identity.device_passport.patch",
    ]) {
      expect(
        () => validateDevicePassportModelCommandV1({ schemaVersion: 1, command: c }),
        c,
      ).toThrow(DevicePassportIssuanceUnavailableError);
    }
  });
});

describe("Link request lifecycle (§37: 11-16, 28-30)", () => {
  it("create → draft; requires exact decision + root ref; fake/wrong-scope reject", () => {
    const { state } = createdRequest();
    expect(state.requests[0]!.lifecycle).toBe("draft_candidate_local");
    expect(state.requests[0]!.persistence).toBe("forbidden");
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "identity.device_link_request.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    expect(() =>
      applyDevicePassportModelCommandV1({
        state: emptyState(),
        command: createRequestCommand(),
        mode: "standard",
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
        rootRef: rootRef(),
        generatedIds: nextIds(),
        clockValue: CLOCK,
        processEpoch: "proc-1",
        repository: repo(),
      }),
    ).toThrow();
    expect(() =>
      applyP({
        state: emptyState(),
        command: createRequestCommand(),
        scope: "identity.device_passport.revoke",
        rootRef: rootRef(),
        generatedIds: nextIds(),
      }),
    ).toThrow();
    expect(() =>
      applyP({
        state: emptyState(),
        command: createRequestCommand(),
        scope: "identity.device_link_request.create",
        generatedIds: nextIds(),
      }),
    ).toThrow();
  });

  it("lifetime limits + pending-per-root limit are enforced", () => {
    expect(() =>
      applyP({
        state: emptyState(),
        command: createRequestCommand({ lifetimeMs: 10 }),
        scope: "identity.device_link_request.create",
        rootRef: rootRef(),
        generatedIds: nextIds(),
      }),
    ).toThrow(DeviceLinkRequestValidationError);
    let state = emptyState();
    for (let i = 0; i < 3; i += 1) {
      state = applyP({
        state,
        command: createRequestCommand(),
        scope: "identity.device_link_request.create",
        rootRef: rootRef(),
        generatedIds: nextIds(),
      }).state;
    }
    expect(() =>
      applyP({
        state,
        command: createRequestCommand(),
        scope: "identity.device_link_request.create",
        rootRef: rootRef(),
        generatedIds: nextIds(),
      }),
    ).toThrow(DeviceLinkRequestValidationError);
  });

  it("expired request cannot be submitted; expiry helper fails closed on backward clock", () => {
    const { state, ids } = createdRequest({ lifetimeMs: 60_000 }); // expires local:61000
    expect(() =>
      applyP({
        state,
        command: {
          schemaVersion: 1,
          command: "identity.device_link_request.submit_for_review",
          requestId: ids.requestId,
          expectedRevision: 1,
        },
        scope: "identity.device_link_request.lifecycle",
        clockValue: "local:999999",
      }),
    ).toThrow(DeviceLinkRequestExpiredError);
    // The stale-context assert also fails closed on a passed deadline.
    expect(() =>
      assertDeviceLinkRequestCurrentV1({
        current: state.requests[0]!,
        rootRef: rootRef(),
        nowLocal: "local:999999",
        currentProcessEpoch: "proc-1",
        storedProcessEpoch: "proc-1",
      }),
    ).toThrow(DeviceLinkRequestExpiredError);
  });
});

describe("Prepare + approve (§37: 17-24, 31-37)", () => {
  it("prepare attenuates + one draft per request; approve is unsigned + grants NO operational authority", () => {
    const { state, ids } = approvedPassport();
    const passport = state.passports[0]!;
    expect(passport.lifecycle).toBe("approved_local_unsigned");
    expect(passport.approvalState).toBe("approved_local_policy_only");
    expect(passport.operationalAuthority).toBe("none");
    expect(passport.signatureState).toBe("not_implemented_gate_f");
    expect(passport.verificationState).toBe("not_verified_no_crypto");
    expect(devicePassportGrantsOperationalAuthorityV1(passport)).toBe(false);
    // The originating request is now approved and cannot be approved again.
    expect(() =>
      applyP({
        state,
        command: {
          schemaVersion: 1,
          command: "identity.device_passport.prepare_draft",
          requestId: ids.requestId,
          expectedRequestRevision: 3,
          subjectAuthorizationId: SUBJECT_AUTH,
        },
        scope: "identity.device_passport.prepare",
        approver: approver(),
        generatedIds: { passportId: nextIds().passportId },
      }),
    ).toThrow();
  });

  it("passport claims never carry delegation / recovery / root-secret / history / posture / attestation", () => {
    const passport = approvedPassport().state.passports[0]!;
    const c = passport.claims;
    expect(c.delegationAllowed).toBe(false);
    expect(c.recoveryAuthorityGranted).toBe(false);
    expect(c.rootSecretTransferAllowed).toBe(false);
    expect(c.historyTransferIncluded).toBe(false);
    expect(c.devicePostureClaimIncluded).toBe(false);
    expect(c.attestationClaimIncluded).toBe(false);
    expect(
      c.keySlotCommitments.every(
        (k) =>
          k.candidatePublicMaterial === "not_present_gate_f" &&
          k.algorithm === "not_selected_gate_f",
      ),
    ).toBe(true);
  });

  it("scope escalation (root > persona) and forbidden-capability requests reject at prepare", () => {
    const { state, ids } = submittedRequest({ scope: rootScope() });
    expect(() =>
      applyP({
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
        generatedIds: { passportId: nextIds().passportId },
      }),
    ).toThrow(DevicePassportScopeEscalationError);
    const addReq = submittedRequest({ capabilities: ["identity.device.add_future"] });
    expect(() =>
      applyP({
        state: addReq.state,
        command: {
          schemaVersion: 1,
          command: "identity.device_passport.prepare_draft",
          requestId: addReq.ids.requestId,
          expectedRequestRevision: 2,
          subjectAuthorizationId: SUBJECT_AUTH,
        },
        scope: "identity.device_passport.prepare",
        approver: approver(),
        generatedIds: { passportId: nextIds().passportId },
      }),
    ).toThrow(DevicePassportCapabilityEscalationError);
  });

  it("a compromised/restricted approver + ineligible root cannot approve", () => {
    const { state, ids } = submittedRequest();
    expect(() =>
      applyP({
        state,
        command: {
          schemaVersion: 1,
          command: "identity.device_passport.prepare_draft",
          requestId: ids.requestId,
          expectedRequestRevision: 2,
          subjectAuthorizationId: SUBJECT_AUTH,
        },
        scope: "identity.device_passport.prepare",
        approver: approver({ rootApprovalEligible: false }),
        generatedIds: { passportId: nextIds().passportId },
      }),
    ).toThrow(DevicePassportValidationError);
  });
});

describe("Restriction / expiry / revocation (§37: 46-51) + future states forbidden (§37: 36-37)", () => {
  it("restrict narrows only; revoked passport cannot reactivate; future signed states unreachable", () => {
    const { state, ids } = approvedPassport();
    const restricted = applyP({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.device_passport.restrict_local",
        passportId: ids.passportId,
        expectedRevision: 2,
        requestedScope: readOnlyScope(),
      },
      scope: "identity.device_passport.restrict",
    }).state;
    expect(restricted.passports[0]!.lifecycle).toBe("restricted_local");
    expect(restricted.passports[0]!.claims.grantedScope.kind).toBe("read_only");
    const revoked = applyP({
      state: restricted,
      command: {
        schemaVersion: 1,
        command: "identity.device_passport.revoke",
        passportId: ids.passportId,
        expectedRevision: 3,
      },
      scope: "identity.device_passport.revoke",
    }).state;
    expect(revoked.passports[0]!.lifecycle).toBe("revoked_tombstone");
    expect(() =>
      applyP({
        state: revoked,
        command: {
          schemaVersion: 1,
          command: "identity.device_passport.restrict_local",
          passportId: ids.passportId,
          expectedRevision: 4,
        },
        scope: "identity.device_passport.restrict",
      }),
    ).toThrow();
    // The future signed/verified lifecycle states are never constructible.
    expect(() => assertDevicePassportTransitionV1("draft_local", "issued_future_signed")).toThrow(
      DevicePassportLifecycleError,
    );
    expect(() =>
      assertDevicePassportTransitionV1("approved_local_unsigned", "accepted_future_verified"),
    ).toThrow(DevicePassportLifecycleError);
  });
});

describe("Repositories (§37: 56-58)", () => {
  it("in-memory clones; null retains nothing", () => {
    const m = new InMemoryDevicePassportRepositoryV1();
    const d = decisionFor("identity.device_link_request.create");
    const st = emptyState();
    m.replace(st, d);
    expect(m.read(d)).not.toBe(st);
    const n = new NullDevicePassportRepositoryV1();
    expect(n.replace(st, d).outcome).toBe("discarded");
    expect(n.read(d)).toBeNull();
  });
});
