/**
 * Security-regression (TECH-ID-04): ephemeral identity leak traps, side-effect
 * traps, matrix/policy agreement, no promotion/recovery/export/sync/persistence,
 * the bypass guardrail, and honest (no anonymity / no forensic-erasure) docs.
 * Covers §31 (69-73) + sentinel + §33 traps.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildEphemeralIdentitySummaryV1,
  destroyEphemeralIdentityV1,
  EphemeralIdentityDecisionMismatchError,
  EphemeralIdentityExpiredError,
  EphemeralIdentityValidationError,
  resolveEphemeralIdentityPolicyV1,
  validateIdentityLocalRevision,
  type EphemeralIdentityOperationV1,
} from "@freelayer/identity";
import { evaluatePolicyMatrix, type PrivacyMode } from "@freelayer/privacy";
import {
  activeEphemeral,
  clock,
  EPHEMERAL_SENTINEL,
  EPOCH,
} from "../../../fixtures/ephemeral-identity/v1/helpers";

const EPH_DIR = join("packages", "identity", "src", "ephemeral");

describe("Sentinel + redaction leak traps", () => {
  it("errors / destruction result / summaries carry no sentinel or ids", () => {
    const errs = [
      new EphemeralIdentityValidationError("forbidden_field"),
      new EphemeralIdentityExpiredError("deadline"),
      new EphemeralIdentityDecisionMismatchError(),
    ];
    for (const e of errs) {
      expect(e.message).not.toContain(EPHEMERAL_SENTINEL);
      expect(e.message).not.toContain("idr-");
    }
    const { state, rootId } = activeEphemeral();
    const { result } = destroyEphemeralIdentityV1({
      state,
      rootId,
      expectedRevision: validateIdentityLocalRevision(2),
      clockValue: clock(1),
      processEpochId: EPOCH,
    });
    const s = JSON.stringify(result);
    expect(s).not.toContain(EPHEMERAL_SENTINEL);
    expect(s).not.toContain("idr-");
    const summary = buildEphemeralIdentitySummaryV1({
      root: state.roots[0]!,
      personaCount: 0,
      relationshipCount: 0,
      roomBindingCount: 0,
      policy: resolveEphemeralIdentityPolicyV1({ mode: "ghost", operation: "summary.read" }),
    });
    expect(summary.anonymous).toBe(false);
    expect(summary.rootId).toBeUndefined(); // Ghost suppresses id
    expect(JSON.stringify(summary)).not.toContain(EPHEMERAL_SENTINEL);
  });

  it("sentinel appears nowhere in shipped ephemeral source", () => {
    for (const f of readdirSync(EPH_DIR)) {
      expect(readFileSync(join(EPH_DIR, f), "utf8"), f).not.toContain(EPHEMERAL_SENTINEL);
    }
  });
});

describe("Side-effect traps (§33)", () => {
  it("the ephemeral module imports no storage/network/AI/fs sink and calls no side effect", () => {
    const imports = [
      "@freelayer/storage",
      "@freelayer/transports",
      "@freelayer/ai",
      "@freelayer/crypto",
      "node:fs",
      "node:net",
      "node:http",
    ];
    const calls = [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket(",
      "localStorage.",
      "sessionStorage.",
      "indexedDB.",
      "Math.random(",
      "crypto.subtle",
      "setInterval(",
      "setTimeout(",
    ];
    for (const f of readdirSync(EPH_DIR)) {
      const src = readFileSync(join(EPH_DIR, f), "utf8");
      for (const imp of imports)
        expect(src.includes(`"${imp}"`), `${f} imports ${imp}`).toBe(false);
      for (const c of calls) expect(src.includes(c), `${f} calls ${c}`).toBe(false);
    }
  });
});

describe("Matrix / policy agree; forbidden ops denied (§31: 70-71)", () => {
  const MODES: readonly PrivacyMode[] = [
    "standard",
    "private",
    "ghost",
    "bunker",
    "offline_capsule",
    "emergency",
    "sovereign_room",
  ];

  it("Policy Matrix and ephemeral policy agree on create + restrictive across modes", () => {
    const pairs: Array<{ op: string; policyOp: EphemeralIdentityOperationV1 }> = [
      { op: "identity.ephemeral.create", policyOp: "create" },
      { op: "identity.ephemeral.persona.create", policyOp: "persona.create" },
    ];
    for (const mode of MODES) {
      for (const { op, policyOp } of pairs) {
        const matrix = evaluatePolicyMatrix({ mode, domain: "identity", operation: op });
        const policy = resolveEphemeralIdentityPolicyV1({ mode, operation: policyOp });
        expect(matrix.allowed, `${mode}/${op}`).toBe(policy.allowed);
        expect(matrix.persistentAllowed).toBe(false);
        expect(matrix.networkAllowed).toBe(false);
      }
    }
  });

  it("promotion / recovery / export / synchronize / persistent-storage are denied", () => {
    for (const op of [
      "identity.ephemeral.promotion",
      "identity.ephemeral.recovery",
      "identity.ephemeral.export",
      "identity.ephemeral.synchronize",
      "identity.ephemeral.persistent_storage",
    ]) {
      expect(
        evaluatePolicyMatrix({ mode: "standard", domain: "identity", operation: op }).allowed,
        op,
      ).toBe(false);
    }
  });
});

describe("Guardrail + honest docs (§31: 72-73)", () => {
  it("the ephemeral guardrail passes real code and fails on the fixture", () => {
    const real = spawnSync(process.execPath, ["scripts/check-no-ephemeral-identity-bypass.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(real.status).toBe(0);
    const fx = spawnSync(
      process.execPath,
      [
        "scripts/check-no-ephemeral-identity-bypass.mjs",
        "tests/fixtures/ephemeral-identity-bypass",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(fx.status).toBe(1);
    expect(fx.stderr).toContain("FAILED");
  });

  it("Trust Center / PBOM make no anonymity or self-destruct claim; Secure Device external", () => {
    const trust = readFileSync("docs/TRUST_CENTER.md", "utf8").toLowerCase();
    expect(trust).not.toContain("self-destruct");
    expect(trust).not.toContain("anonymous identity");
    const firewall = readFileSync("docs/IDENTITY_FIREWALL.md", "utf8");
    expect(firewall).toContain("DevicePosture is not identity");
    // The overclaim scanner passes on the Trust Center.
    const scan = spawnSync(
      process.execPath,
      ["scripts/check-policy-conflicts.mjs", "--trust-center", "docs/TRUST_CENTER.md"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(scan.status).toBe(0);
  });
});
