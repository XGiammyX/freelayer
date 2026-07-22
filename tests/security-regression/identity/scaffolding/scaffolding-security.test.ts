/**
 * Security-regression (TECH-ID-03): local identity scaffolding leak traps,
 * side-effect traps, matrix/policy/storage agreement, no-crypto/no-persistence/
 * no-directory absence proofs, the bypass guardrail, and continued Secure Device
 * externalization. Covers §31 (59-70) + sentinel + §30/§33 traps.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildIdentityAuditEventV1,
  buildLocalIdentityRootSummaryV1,
  IdentityDecisionMismatchError,
  IdentityLifecycleError,
  IdentityValidationError,
  resolveLocalIdentityPolicyV1,
  type IdentityOperationV1,
} from "@freelayer/identity";
import { evaluatePolicyMatrix, type PrivacyMode } from "@freelayer/privacy";
import { resolveStoragePolicy } from "@freelayer/storage";
import {
  IDENTITY_SENTINEL,
  withActiveRoot,
} from "../../../fixtures/identity-scaffolding/v1/helpers";

const IDENTITY_DIR = join("packages", "identity", "src");

describe("Sentinel leak traps + redaction (§31: 59-60)", () => {
  it("errors carry no identity content or sentinel", () => {
    const errors = [
      new IdentityValidationError("forbidden_field"),
      new IdentityLifecycleError("invalid_transition"),
      new IdentityDecisionMismatchError(),
    ];
    for (const e of errors) {
      expect(e.message).not.toContain(IDENTITY_SENTINEL);
      expect(e.message).not.toContain("idr-");
      expect(e.message).not.toContain("@");
      expect(JSON.stringify(e, Object.getOwnPropertyNames(e))).not.toContain(IDENTITY_SENTINEL);
    }
  });

  it("audit events are redacted and content-free", () => {
    const audit = buildIdentityAuditEventV1({
      operationCategory: "root_lifecycle",
      outcome: "denied",
      mode: "standard",
      reasonCode: "restrictive_mode_expansive_denied",
    });
    const serialized = JSON.stringify(audit);
    expect(audit.redacted).toBe(true);
    expect(serialized).not.toContain(IDENTITY_SENTINEL);
    expect(serialized).not.toContain("idr-");
    expect(serialized).not.toMatch(/localLabel|personaId|relationshipId|roomId/);
  });

  it("the sentinel appears nowhere in shipped identity source", () => {
    for (const file of readdirSync(IDENTITY_DIR).filter((f) => f.endsWith(".ts"))) {
      expect(readFileSync(join(IDENTITY_DIR, file), "utf8"), file).not.toContain(IDENTITY_SENTINEL);
    }
  });
});

describe("Side-effect traps (§30, §33)", () => {
  it("the identity module imports no storage/network/AI/fs sink and calls no side effect", () => {
    const forbiddenImports = [
      "@freelayer/storage",
      "@freelayer/transports",
      "@freelayer/ai",
      "@freelayer/crypto",
      "node:fs",
      "node:net",
      "node:http",
    ];
    const forbiddenCalls = [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket(",
      "localStorage.",
      "sessionStorage.",
      "indexedDB.",
      "Math.random(",
      "crypto.subtle",
    ];
    for (const file of readdirSync(IDENTITY_DIR).filter((f) => f.endsWith(".ts"))) {
      const src = readFileSync(join(IDENTITY_DIR, file), "utf8");
      for (const imp of forbiddenImports) {
        expect(src.includes(`"${imp}"`), `${file} imports ${imp}`).toBe(false);
      }
      for (const call of forbiddenCalls) {
        expect(src.includes(call), `${file} calls ${call}`).toBe(false);
      }
    }
  });
});

describe("No premature implementation (§31: 61-67)", () => {
  it("a created root carries only future-gate key/recovery/device markers", () => {
    const { state } = withActiveRoot();
    const root = state.roots[0]!;
    expect(root.keyMaterialState).toBe("not_implemented_gate_f");
    expect(root.recoveryState).toBe("not_configured");
    expect(root.deviceAuthorizationState).toBe("not_implemented_gate_f_g");
    expect(root.phoneRequired).toBe(false);
    expect(root.emailRequired).toBe(false);
    expect(root.publicDirectory).toBe("forbidden");
    // No key/secret/contact fields exist on the record.
    for (const forbidden of [
      "privateKey",
      "publicKey",
      "seed",
      "mnemonic",
      "email",
      "phone",
      "did",
    ]) {
      expect(root).not.toHaveProperty(forbidden);
    }
  });

  it("matrix keeps keys/device/alias/trust/recovery/invite future-gated and public directory denied", () => {
    for (const op of [
      "identity.keys",
      "identity.device_key",
      "identity.device_passport",
      "identity.alias.per_contact",
      "identity.alias.per_room",
      "identity.trust_notebook",
      "identity.recovery",
      "identity.invite",
      "identity.verification",
    ]) {
      const d = evaluatePolicyMatrix({ mode: "standard", domain: "identity", operation: op });
      expect(d.effect, op).toBe("future_gate");
      expect(d.allowed, op).toBe(false);
    }
    expect(
      evaluatePolicyMatrix({
        mode: "standard",
        domain: "identity",
        operation: "identity.public_directory",
      }).allowed,
    ).toBe(false);
  });
});

describe("Matrix / Policy / Storage agree (§31: 68-69)", () => {
  const ALL_MODES: readonly PrivacyMode[] = [
    "standard",
    "private",
    "ghost",
    "bunker",
    "offline_capsule",
    "emergency",
    "sovereign_room",
  ];

  it("Policy Matrix and IdentityPolicy agree on create/lifecycle allow across modes", () => {
    const pairs: Array<{ op: string; policyOp: IdentityOperationV1 }> = [
      { op: "identity.root.create", policyOp: "root.create" },
      { op: "identity.root.lifecycle", policyOp: "root.lock" },
      { op: "identity.persona.create", policyOp: "persona.create" },
      { op: "identity.room_binding.create", policyOp: "room_binding.create_placeholder" },
    ];
    for (const mode of ALL_MODES) {
      for (const { op, policyOp } of pairs) {
        const matrix = evaluatePolicyMatrix({ mode, domain: "identity", operation: op });
        const policy = resolveLocalIdentityPolicyV1({ mode, operation: policyOp });
        expect(matrix.allowed, `${mode}/${op}`).toBe(policy.allowed);
        expect(matrix.persistentAllowed, `${mode}/${op}`).toBe(false);
        expect(matrix.networkAllowed, `${mode}/${op}`).toBe(false);
      }
    }
  });

  it("StoragePolicy agrees: identity data never persists", () => {
    for (const mode of ALL_MODES) {
      // `trust_notebook` is the identity-adjacent storage class; identity
      // metadata must never persist (the identity vault is memory/null only).
      const storage = resolveStoragePolicy({
        mode,
        dataClass: "trust_notebook",
        sensitivity: "sensitive_metadata",
      });
      expect(storage.persistentAllowed, mode).toBe(false);
    }
  });
});

describe("Guardrail + Secure Device externalization (§31: 70)", () => {
  it("the identity guardrail passes on real code and fails on the fixture", () => {
    const real = spawnSync(process.execPath, ["scripts/check-no-identity-scaffolding-bypass.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(real.status).toBe(0);
    expect(real.stdout).toContain("OK");

    const fixture = spawnSync(
      process.execPath,
      [
        "scripts/check-no-identity-scaffolding-bypass.mjs",
        "tests/fixtures/identity-scaffolding-bypass",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(fixture.status).toBe(1);
    expect(fixture.stderr).toContain("FAILED");
  });

  it("Secure Device stays external; identity boundary audit + honest docs exist", () => {
    expect(existsSync("docs/audits/IDENTITY_SCAFFOLDING_BOUNDARY_AUDIT.md")).toBe(true);
    const firewall = readFileSync("docs/IDENTITY_FIREWALL.md", "utf8");
    expect(firewall).toContain("DevicePosture is not identity");
    // A summary read still requires a decision (redaction is not authority).
    const { state } = withActiveRoot();
    const summary = buildLocalIdentityRootSummaryV1({
      root: state.roots[0]!,
      personaCount: 0,
      relationshipCount: 0,
      roomBindingCount: 0,
      policy: resolveLocalIdentityPolicyV1({ mode: "ghost", operation: "identity.summary.read" }),
    });
    // Ghost minimizes to lifecycle+assurance only (no id/counts).
    expect(summary.rootId).toBeUndefined();
    expect(summary.redacted).toBe(true);
  });
});
