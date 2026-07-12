/**
 * Security-regression (TECH-14): the conflict validator catches every planted
 * contradiction fixture (tests 45-48), conflict explanations are stable and
 * sentinel-free, the real repo passes, and scanner allowlists cannot hide real
 * source directories.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { explainPolicyConflict, type PolicyConflict } from "@freelayer/privacy";

const SENTINEL = "FREELAYER_POLICY_CONFLICT_SENTINEL_DO_NOT_LEAK";
const SCRIPT = "scripts/check-policy-conflicts.mjs";

function run(args: readonly string[]): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe("Conflict fixtures are detected (test 47)", () => {
  it("flags every category planted in the bad-matrix fixture", () => {
    const { status, output } = run(["--matrix", "tests/fixtures/policy-conflicts/bad-matrix.json"]);
    expect(status).toBe(1);
    expect(output).toContain("[persistent_allowed_conflict]"); // Ghost persistent write
    expect(output).toContain("[allow_vs_deny]"); // telemetry / link preview allowed
    expect(output).toContain("[network_allowed_conflict]"); // Offline Capsule network
    expect(output).toContain("[future_gate_treated_as_allow]"); // crypto executable
    expect(output).toContain("[not_implemented_treated_as_allow]"); // encrypted backend
    expect(output).toContain("[externalized_component_marked_implemented]"); // endpoint capability
    expect(output).toContain("[metadata_allowed_conflict]"); // private typing / bunker badge
  });

  it("flags every overclaim planted in the bad-trust-center fixture", () => {
    const { status, output } = run([
      "--trust-center",
      "tests/fixtures/policy-conflicts/bad-trust-center.md",
    ]);
    expect(status).toBe(1);
    for (const phrase of [
      "impossible to hack",
      "zero risk",
      "guaranteed anonymity",
      "forensic deletion",
      "stops spyware",
      "full endpoint protection active",
      "military grade",
      "prevents screenshots completely",
      "production ready for real secrets",
      "unbreakable",
    ]) {
      expect(output, phrase).toContain(phrase);
    }
  });

  it("passes on the real matrix and the real Trust Center", () => {
    expect(run(["--matrix", "docs/policy-matrix.v1.json"]).status).toBe(0);
    expect(run(["--trust-center", "docs/TRUST_CENTER.md"]).status).toBe(0);
  });
});

describe("Conflict explanations (tests 45-46)", () => {
  const conflict: PolicyConflict = {
    category: "allow_vs_deny",
    domain: "network",
    mode: "ghost",
    operation: "telemetry.send",
    expected: "deny",
    actual: "allow",
    severity: "critical",
    explanation: "Policy Matrix and NetworkPolicy disagree on this operation.",
  };

  it("are stable and readable", () => {
    const line = explainPolicyConflict(conflict);
    expect(line).toBe(
      "[CRITICAL] allow_vs_deny @ domain=network mode=ghost operation=telemetry.send — " +
        "expected deny, got allow. Policy Matrix and NetworkPolicy disagree on this operation.",
    );
    // Deterministic: same input, same output (safe for snapshots).
    expect(explainPolicyConflict(conflict)).toBe(line);
  });

  it("strip hostile/sensitive tokens from expected/actual/operation fields", () => {
    const hostile = explainPolicyConflict({
      ...conflict,
      operation: `telemetry.send?token=${SENTINEL}&room=project alpha`,
      expected: `deny <${SENTINEL}>`,
      actual: `allow "${SENTINEL}"`,
    });
    expect(hostile).not.toContain(SENTINEL.slice(0, 20) + "?"); // no raw query survives
    expect(hostile).not.toContain("project alpha");
    expect(hostile).not.toContain("<");
    expect(hostile).not.toContain('"');
  });
});

describe("Scanner allowlists cannot hide real source (test 48)", () => {
  it("guardrail fixtures live outside shipped scan roots", () => {
    // Every intentional-violation fixture lives under tests/fixtures, which is
    // never part of the default apps/packages scan roots.
    for (const scanner of [
      "scripts/check-no-external-assets.mjs",
      "scripts/check-no-notification-bypass.mjs",
      "scripts/check-no-metadata-bypass.mjs",
      "scripts/check-no-forbidden-storage.mjs",
    ]) {
      const result = spawnSync(process.execPath, [scanner], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
      expect(result.status, scanner).toBe(0);
    }
  });

  it("the notification allowlist still scans real packages (planted fixture dir fails when passed)", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-no-notification-bypass.mjs", "tests/fixtures/notification-bypass"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status).toBe(1);
  });
});
