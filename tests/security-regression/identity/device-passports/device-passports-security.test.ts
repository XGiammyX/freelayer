/**
 * Security-regression (TECH-ID-08 §37/§39): Device Passport boundary proofs.
 *
 *  - Sentinel + redaction: no leak sentinel escapes into errors, audit events,
 *    revocation results, or summaries.
 *  - Side-effect scope traps: every write needs an AUTHENTIC exact-scope decision;
 *    forged / wrong-scope / denied decisions reject; the repository refuses a
 *    non-passport scope (incl. another identity domain's scope).
 *  - Matrix ↔ policy agreement across 13 passport ops × 7 modes.
 *  - Structural absence proofs: signed issuance / verification / remote acceptance
 *    / QR / history / attestation / persistence / network / notification /
 *    telemetry / AI are false in EVERY mode; always-forbidden specs never allowed.
 *  - Guardrail: shipped passport code passes the bypass guard; the fixture fails.
 *  - Not-crypto / not-authority proofs: a local approval never grants operational
 *    authority; summaries never claim issued/verified/attested.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyDevicePassportModelCommandV1,
  buildDevicePassportAuditEventV1,
  buildDevicePassportSummaryV1,
  DEVICE_PASSPORT_OPERATIONS,
  DEVICE_PASSPORT_REVOCATION_RESULT_V1,
  devicePassportGrantsOperationalAuthorityV1,
  DevicePassportDecisionMismatchError,
  DevicePassportPolicyDeniedError,
  InMemoryDevicePassportRepositoryV1,
  resolveDevicePassportPolicyV1,
  validateDevicePassportModelCommandV1,
  type DevicePassportOperationV1,
} from "@freelayer/identity";
import { issuePolicyDecision, POLICY_MATRIX_RULES, type PrivacyMode } from "@freelayer/privacy";
import {
  applyP,
  approver,
  approvedPassport,
  createRequestCommand,
  CLOCK,
  emptyState,
  nextIds,
  PASSPORT_SENTINEL,
  preparedDraft,
  repo,
  rootRef,
} from "../../../fixtures/device-passports/v1/helpers";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

function errText(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return `${String(error)}\n${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
  }
  throw new Error("expected the operation to throw");
}

describe("Sentinel + redaction", () => {
  it("validation errors + audit + revocation result never echo the sentinel", () => {
    expect(
      errText(() =>
        validateDevicePassportModelCommandV1({
          schemaVersion: 1,
          command: "identity.device_passport.revoke",
          passportId: "pass-a1",
          expectedRevision: 1,
          note: PASSPORT_SENTINEL,
        }),
      ),
    ).not.toContain(PASSPORT_SENTINEL);
    const audit = buildDevicePassportAuditEventV1({
      operationCategory: "passport_revocation",
      outcome: "allowed",
      mode: "standard",
      reasonCode: "passport_local",
    });
    expect(audit.redacted).toBe(true);
    expect(JSON.stringify(audit)).not.toContain(PASSPORT_SENTINEL);
    expect(JSON.stringify(DEVICE_PASSPORT_REVOCATION_RESULT_V1)).not.toContain(PASSPORT_SENTINEL);
    expect(DEVICE_PASSPORT_REVOCATION_RESULT_V1.cryptographicRevocationPerformed).toBe(false);
    expect(DEVICE_PASSPORT_REVOCATION_RESULT_V1.deviceAuthorizationAffected).toBe(false);
  });

  it("a strict-mode summary redacts scope/counts and claims nothing verified", () => {
    const passport = preparedDraft().state.passports[0]!;
    const priv = buildDevicePassportSummaryV1({
      passport,
      policy: resolveDevicePassportPolicyV1({
        mode: "private",
        operation: "passport.summary.read",
      }),
    });
    expect(priv.redacted).toBe(true);
    expect(priv.scopeKind).toBeUndefined();
    expect(priv.cryptographicallyIssued).toBe(false);
    expect(priv.cryptographicallyVerified).toBe(false);
    expect(priv.operationalAuthority).toBe(false);
  });
});

describe("Side-effect scope traps", () => {
  it("wrong-scope, denied, and forged decisions are all refused", () => {
    const base = {
      state: emptyState(),
      command: createRequestCommand(),
      mode: "standard" as const,
      rootRef: rootRef(),
      generatedIds: nextIds(),
      clockValue: CLOCK,
      processEpoch: "proc-1",
      repository: repo(),
    };
    expect(() =>
      applyDevicePassportModelCommandV1({
        ...base,
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.device_passport.revoke",
        ),
      }),
    ).toThrow(DevicePassportDecisionMismatchError);
    expect(() =>
      applyDevicePassportModelCommandV1({
        ...base,
        decision: issuePolicyDecision(
          "persistence",
          "denied",
          "standard",
          "identity.device_link_request.create",
        ),
      }),
    ).toThrow(DevicePassportDecisionMismatchError);
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
        ...base,
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
      }),
    ).toThrow(DevicePassportDecisionMismatchError);
  });

  it("the repository refuses non-passport scopes (incl. another identity domain)", () => {
    const memo = new InMemoryDevicePassportRepositoryV1();
    expect(() =>
      memo.replace(
        emptyState(),
        issuePolicyDecision("persistence", "allowed", "standard", "storage.write"),
      ),
    ).toThrow();
    expect(() =>
      memo.replace(
        emptyState(),
        issuePolicyDecision("persistence", "allowed", "standard", "identity.device.bootstrap"),
      ),
    ).toThrow();
  });
});

describe("Matrix ↔ policy agreement (13 ops × 7 modes)", () => {
  const MATRIX_OP: Readonly<Record<string, DevicePassportOperationV1>> = {
    "identity.device_link_request.create": "link_request.create",
    "identity.device_link_request.submit": "link_request.submit",
    "identity.device_link_request.reject": "link_request.reject",
    "identity.device_link_request.expire": "link_request.expire",
    "identity.device_link_request.revoke": "link_request.revoke",
    "identity.device_passport.prepare": "passport.prepare",
    "identity.device_passport.approve_unsigned": "passport.approve_unsigned",
    "identity.device_passport.restrict": "passport.restrict",
    "identity.device_passport.expire": "passport.expire",
    "identity.device_passport.revoke": "passport.revoke",
    "identity.device_passport.summary_read": "passport.summary.read",
    "identity.device_passport.issue_signed": "passport.issue_signed_future",
    "identity.device_passport.accept_verified": "passport.accept_verified_future",
  };
  it("every mapped passport matrix rule matches the runtime policy verdict", () => {
    const operational = POLICY_MATRIX_RULES.filter(
      (r) => r.domain === "identity" && r.operation in MATRIX_OP,
    );
    expect(operational).toHaveLength(13 * MODES.length);
    for (const rule of operational) {
      const operation = MATRIX_OP[rule.operation]!;
      expect(
        resolveDevicePassportPolicyV1({ mode: rule.mode, operation }).allowed,
        `${rule.operation}:${rule.mode}`,
      ).toBe(rule.allowed);
    }
  });
});

describe("Structural absence proofs", () => {
  it("no mode/op ever enables issuance, verification, remote acceptance, QR, history, attestation, persistence, network, notification, telemetry, AI, labels", () => {
    for (const mode of MODES) {
      for (const operation of DEVICE_PASSPORT_OPERATIONS) {
        const p = resolveDevicePassportPolicyV1({ mode, operation });
        expect(p.labelsAllowed).toBe(false);
        expect(p.cryptographicIssuanceAvailable).toBe(false);
        expect(p.remoteAcceptanceAvailable).toBe(false);
        expect(p.qrTransportAvailable).toBe(false);
        expect(p.historyTransferAvailable).toBe(false);
        expect(p.devicePostureClaimAllowed).toBe(false);
        expect(p.attestationClaimAllowed).toBe(false);
        expect(p.persistentStorageAllowed).toBe(false);
        expect(p.networkAllowed).toBe(false);
        expect(p.notificationAllowed).toBe(false);
        expect(p.telemetryAllowed).toBe(false);
        expect(p.aiAllowed).toBe(false);
      }
    }
  });

  it("always-forbidden / future-gated passport specs are never allowed", () => {
    const forbidden = new Set([
      "identity.passport_signed_issuance_future",
      "identity.passport_verification_future",
      "identity.passport_remote_acceptance_future",
      "identity.passport_qr_transport_future",
      "identity.passport_history_transfer",
      "identity.passport_attestation_binding",
      "identity.passport_persistence",
    ]);
    const rules = POLICY_MATRIX_RULES.filter((r) => forbidden.has(r.id.split(":")[0]!));
    expect(rules.length).toBe(forbidden.size * MODES.length);
    for (const rule of rules) expect(rule.allowed, rule.id).toBe(false);
  });
});

describe("Guardrail (spawned)", () => {
  const script = "scripts/check-no-device-passport-bypass.mjs";
  it("shipped passport source passes the bypass guard", () => {
    expect(() =>
      execFileSync("node", [script, "packages/identity/src/device-passports"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
  it("the intentional bypass fixture fails the guard", () => {
    expect(() =>
      execFileSync("node", [script, "tests/fixtures/device-passport-bypass"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).toThrow();
  });
});

describe("Not-crypto / not-authority proofs", () => {
  it("a local approval never grants operational authority; summary claims nothing verified", () => {
    const { state } = approvedPassport();
    const passport = state.passports[0]!;
    expect(devicePassportGrantsOperationalAuthorityV1(passport)).toBe(false);
    expect(passport.cryptographicallyIssued).toBe(false);
    expect(passport.cryptographicallyVerified).toBe(false);
    expect(passport.remotelyAccepted).toBe(false);
    const summary = buildDevicePassportSummaryV1({
      passport,
      policy: resolveDevicePassportPolicyV1({
        mode: "standard",
        operation: "passport.summary.read",
      }),
    });
    expect(summary.authenticity).toBe("local_policy_approved_unsigned");
    expect(summary.operationalAuthority).toBe(false);
    expect(summary.hardwareAttested).toBe(false);
    expect(summary.postureVerified).toBe(false);
  });

  it("Bunker + Emergency deny expansive passport preparation before mutation", () => {
    const { state, ids } = preparedDraft();
    for (const mode of ["bunker", "emergency"] as const) {
      expect(() =>
        applyP({
          state,
          command: {
            schemaVersion: 1,
            command: "identity.device_passport.approve_local_unsigned",
            passportId: ids.passportId,
            expectedRevision: 1,
          },
          scope: "identity.device_passport.approve_unsigned",
          mode,
          approver: approver(),
        }),
      ).toThrow(DevicePassportPolicyDeniedError);
    }
  });
});
