/**
 * Security-regression (TECH-ID-07 §33/§35): device-key-model boundary proofs.
 *
 *  - Sentinel + redaction: no device label or leak sentinel escapes into errors,
 *    audit events, revocation results, or redacted strict-mode summaries.
 *  - Side-effect scope traps: every write needs an AUTHENTIC exact-scope decision;
 *    forged / wrong-scope / denied decisions reject; the repository refuses a
 *    non-device scope (incl. another identity domain's scope).
 *  - Matrix ↔ policy agreement across 9 operational device ops × 7 modes.
 *  - Structural absence proofs: real keys / device addition / passport / remote
 *    revocation / hardware attestation / persistence / network / notification /
 *    telemetry / AI are false in EVERY mode; always-forbidden specs never allowed.
 *  - Guardrail: shipped device code passes the bypass guard; the fixture fails.
 *  - Not-identity / not-crypto proofs: key/hardware/posture/authority fields
 *    reject; records + summaries never claim authorization/attestation.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyDeviceKeyModelCommandV1,
  buildDeviceAuthorizationAuditEventV1,
  buildLocalDeviceSummaryV1,
  DEVICE_KEY_MODEL_OPERATIONS,
  DEVICE_REVOCATION_RESULT_V1,
  DeviceAuthorizationDecisionMismatchError,
  DeviceAuthorizationPolicyDeniedError,
  InMemoryDeviceKeyModelRepositoryV1,
  normalizeContactAliasDisplayTextV1,
  resolveDeviceKeyModelPolicyV1,
  validateDeviceKeyModelCommandV1,
  type DeviceKeyModelOperationV1,
} from "@freelayer/identity";
import { issuePolicyDecision, POLICY_MATRIX_RULES, type PrivacyMode } from "@freelayer/privacy";
import {
  applyD,
  bootstrapCommand,
  bootstrapped,
  CLOCK,
  DEVICE_SENTINEL,
  emptyState,
  nextIds,
  repo,
  rootRef,
} from "../../../fixtures/device-key-model/v1/helpers";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const NUL = "\u0000";
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
  it("validation / normalization errors never echo the label or sentinel", () => {
    expect(errText(() => normalizeContactAliasDisplayTextV1(DEVICE_SENTINEL + NUL))).not.toContain(
      DEVICE_SENTINEL,
    );
    expect(
      errText(() =>
        validateDeviceKeyModelCommandV1({
          schemaVersion: 1,
          command: "identity.device.label.set",
          deviceRef: "dev-a1",
          expectedRevision: 1,
          labelText: DEVICE_SENTINEL + NUL,
        }),
      ),
    ).not.toContain(DEVICE_SENTINEL);
  });

  it("audit + revocation result carry no label/sentinel", () => {
    const audit = buildDeviceAuthorizationAuditEventV1({
      operationCategory: "device_revocation",
      outcome: "allowed",
      mode: "standard",
      reasonCode: "device_local",
    });
    expect(audit.redacted).toBe(true);
    expect(JSON.stringify(audit)).not.toContain(DEVICE_SENTINEL);
    expect(JSON.stringify(DEVICE_REVOCATION_RESULT_V1)).not.toContain(DEVICE_SENTINEL);
    expect(DEVICE_REVOCATION_RESULT_V1.cryptographicRevocationPerformed).toBe(false);
    expect(DEVICE_REVOCATION_RESULT_V1.remoteSessionsAffected).toBe(false);
  });

  it("a strict-mode summary redacts the device label (sentinel)", () => {
    const { state, deviceRef } = bootstrapped();
    const labelled = applyD({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.device.label.set",
        deviceRef,
        expectedRevision: 1,
        labelText: DEVICE_SENTINEL,
      },
      scope: "identity.device.label.write",
    }).state;
    const rec = labelled.authorizations[0]!;
    const label = labelled.labels[0]!;
    const priv = buildLocalDeviceSummaryV1({
      record: rec,
      label,
      policy: resolveDeviceKeyModelPolicyV1({ mode: "private", operation: "summary.detail" }),
    });
    expect(priv.redacted).toBe(true);
    expect(JSON.stringify(priv)).not.toContain(DEVICE_SENTINEL);
  });
});

describe("Side-effect scope traps", () => {
  it("wrong-scope, denied, and forged decisions are all refused", () => {
    const base = {
      state: emptyState(),
      command: bootstrapCommand(),
      mode: "standard" as const,
      rootRef: rootRef(),
      generatedIds: nextIds(),
      clockValue: CLOCK,
      repository: repo(),
    };
    expect(() =>
      applyDeviceKeyModelCommandV1({
        ...base,
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.device.revoke",
        ),
      }),
    ).toThrow(DeviceAuthorizationDecisionMismatchError);
    expect(() =>
      applyDeviceKeyModelCommandV1({
        ...base,
        decision: issuePolicyDecision(
          "persistence",
          "denied",
          "standard",
          "identity.device.bootstrap",
        ),
      }),
    ).toThrow(DeviceAuthorizationDecisionMismatchError);
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "identity.device.bootstrap",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    expect(() =>
      applyDeviceKeyModelCommandV1({
        ...base,
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
      }),
    ).toThrow(DeviceAuthorizationDecisionMismatchError);
  });

  it("the repository refuses non-device scopes (incl. another identity domain)", () => {
    const memo = new InMemoryDeviceKeyModelRepositoryV1();
    expect(() =>
      memo.replace(
        emptyState(),
        issuePolicyDecision("persistence", "allowed", "standard", "storage.write"),
      ),
    ).toThrow();
    expect(() =>
      memo.replace(
        emptyState(),
        issuePolicyDecision("persistence", "allowed", "standard", "identity.room_alias.create"),
      ),
    ).toThrow();
  });
});

describe("Matrix ↔ policy agreement (9 ops × 7 modes)", () => {
  const MATRIX_OP: Readonly<Record<string, DeviceKeyModelOperationV1>> = {
    "identity.device.bootstrap": "bootstrap",
    "identity.device.restrict": "restrict",
    "identity.device.mark_compromised": "mark_compromised",
    "identity.device.revoke": "revoke",
    "identity.device.label.set": "label.set",
    "identity.device.label.clear": "label.clear",
    "identity.device.summary.list": "summary.list",
    "identity.device.summary.detail": "summary.detail",
    "identity.device.key_slots.read_redacted": "key_slots.read_redacted",
  };
  it("every operational device matrix rule matches the runtime policy verdict", () => {
    const operational = POLICY_MATRIX_RULES.filter(
      (r) => r.domain === "identity" && r.operation in MATRIX_OP,
    );
    expect(operational).toHaveLength(9 * MODES.length);
    for (const rule of operational) {
      const operation = MATRIX_OP[rule.operation]!;
      expect(
        resolveDeviceKeyModelPolicyV1({ mode: rule.mode, operation }).allowed,
        `${rule.operation}:${rule.mode}`,
      ).toBe(rule.allowed);
    }
  });
});

describe("Structural absence proofs", () => {
  it("no mode/op ever enables keys, device addition, passport, remote revocation, attestation, persistence, network, notification, telemetry, AI", () => {
    for (const mode of MODES) {
      for (const operation of DEVICE_KEY_MODEL_OPERATIONS) {
        const p = resolveDeviceKeyModelPolicyV1({ mode, operation });
        expect(p.realKeysAvailable).toBe(false);
        expect(p.deviceAdditionAvailable).toBe(false);
        expect(p.devicePassportAvailable).toBe(false);
        expect(p.remoteRevocationAvailable).toBe(false);
        expect(p.hardwareAttestationAvailable).toBe(false);
        expect(p.persistentPlaintextAllowed).toBe(false);
        expect(p.networkAllowed).toBe(false);
        expect(p.notificationAllowed).toBe(false);
        expect(p.telemetryAllowed).toBe(false);
        expect(p.aiAllowed).toBe(false);
      }
    }
  });

  it("always-forbidden / future-gated device specs are never allowed", () => {
    const forbidden = new Set([
      "identity.device_add_future",
      "identity.device_link_future",
      "identity.device_remote_revoke_future",
      "identity.device_attestation",
      "identity.device_history",
      "identity.device_key_future",
      "identity.device_passport_future",
    ]);
    const rules = POLICY_MATRIX_RULES.filter((r) => forbidden.has(r.id.split(":")[0]!));
    expect(rules.length).toBe(forbidden.size * MODES.length);
    for (const rule of rules) expect(rule.allowed, rule.id).toBe(false);
  });
});

describe("Guardrail (spawned)", () => {
  const script = "scripts/check-no-device-key-model-bypass.mjs";
  it("shipped device source passes the bypass guard", () => {
    expect(() =>
      execFileSync("node", [script, "packages/identity/src/devices"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
  it("the intentional bypass fixture fails the guard", () => {
    expect(() =>
      execFileSync("node", [script, "tests/fixtures/device-key-model-bypass"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).toThrow();
  });
});

describe("Not-identity / not-crypto proofs", () => {
  it("a bootstrapped record + summary never claim authorization / attestation / sync", () => {
    const { state } = bootstrapped();
    const rec = state.authorizations[0]!;
    expect(rec.cryptographicallyAuthorized).toBe(false);
    expect(rec.hardwareAttested).toBe(false);
    expect(rec.remotelySynchronized).toBe(false);
    const summary = buildLocalDeviceSummaryV1({
      record: rec,
      policy: resolveDeviceKeyModelPolicyV1({ mode: "standard", operation: "summary.detail" }),
    });
    expect(summary.cryptographicallyAuthorized).toBe(false);
    expect(summary.hardwareAttested).toBe(false);
    expect(summary.postureVerified).toBe(false);
    expect(summary.remotelySynchronized).toBe(false);
  });

  it("Bunker + Emergency deny expansive device bootstrap before mutation", () => {
    for (const mode of ["bunker", "emergency"] as const) {
      expect(() =>
        applyD({
          state: emptyState(),
          command: bootstrapCommand(),
          scope: "identity.device.bootstrap",
          mode,
          rootRef: rootRef(),
          generatedIds: nextIds(),
        }),
      ).toThrow(DeviceAuthorizationPolicyDeniedError);
    }
  });
});
