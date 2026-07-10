/**
 * Security-regression (TECH-13): the JSON export mirrors the TS matrix
 * verbatim (no drift), the validator script passes on the real matrix,
 * decisions/rationales carry no sensitive payloads or sentinels, and every
 * docsRef points at a real file.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  evaluatePolicyMatrix,
  POLICY_MATRIX_RULES,
  POLICY_MATRIX_SPECS,
  POLICY_MATRIX_VERSION,
} from "@freelayer/privacy";

const SENTINEL = "FREELAYER_POLICY_MATRIX_SENTINEL_DO_NOT_LEAK";

describe("JSON export sync (tests 38-40 support)", () => {
  const json = JSON.parse(readFileSync("docs/policy-matrix.v1.json", "utf8")) as {
    version: string;
    specCount: number;
    ruleCount: number;
    specs: unknown;
    deferredGates: string[];
  };

  it("version and counts match the TS matrix", () => {
    expect(json.version).toBe(POLICY_MATRIX_VERSION);
    expect(json.specCount).toBe(POLICY_MATRIX_SPECS.length);
    expect(json.ruleCount).toBe(POLICY_MATRIX_RULES.length);
  });

  it("specs mirror the TS specs verbatim (drift-proof)", () => {
    expect(json.specs).toEqual(JSON.parse(JSON.stringify(POLICY_MATRIX_SPECS)));
  });

  it("deferredGates list matches future_gate/not_implemented specs", () => {
    const expected = POLICY_MATRIX_SPECS.filter(
      (s) => s.effect === "future_gate" || s.effect === "not_implemented",
    ).map((s) => s.id);
    expect(json.deferredGates).toEqual(expected);
  });
});

describe("Validator script", () => {
  it("passes on the real matrix export", () => {
    const result = spawnSync(process.execPath, ["scripts/validate-policy-matrix.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });
});

describe("No sensitive data in matrix or decisions (tests 38-39)", () => {
  it("rationales and reason codes never contain the sentinel or identifiers", () => {
    for (const rule of POLICY_MATRIX_RULES) {
      expect(rule.rationale, rule.id).not.toContain(SENTINEL);
      expect(rule.rationale, rule.id).not.toContain("project-alpha");
    }
  });

  it("decisions echo only rule data, never evaluation-input payloads", () => {
    const decision = evaluatePolicyMatrix({
      mode: "private",
      domain: "metadata",
      operation: "receipt.read",
      sink: SENTINEL, // hostile input in an optional field
      dataClass: SENTINEL,
      transport: SENTINEL,
    });
    const serialized = JSON.stringify(decision);
    expect(serialized).not.toContain(SENTINEL);
    expect(decision.allowed).toBe(false);
  });

  it("unmatched (fail-closed) decisions never echo the unknown operation", () => {
    const decision = evaluatePolicyMatrix({
      mode: "standard",
      domain: "storage",
      operation: `storage.write.${SENTINEL}`,
    });
    expect(JSON.stringify(decision)).not.toContain(SENTINEL);
    expect(decision.allowed).toBe(false);
  });
});

describe("docsRefs integrity (test 40)", () => {
  it("every docsRef points to an existing file", () => {
    const refs = new Set(POLICY_MATRIX_SPECS.flatMap((s) => [...s.docsRefs]));
    for (const ref of refs) {
      expect(existsSync(ref), ref).toBe(true);
    }
  });
});
