/**
 * Security-regression (TECH-15): the contributor-workflow governance surface
 * exists, asks the right questions, and states the anti-spyware
 * externalization everywhere contributors will read it. Docs-regression tests
 * folded in (existence + phrase assertions; no network, no secrets).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function read(path: string): string {
  return readFileSync(path, "utf8").toLowerCase();
}

describe("Templates (tests 1-9)", () => {
  it("PR template exists and asks about matrix/PBOM/Trust Center/anti-spyware (tests 1-5)", () => {
    const path = ".github/PULL_REQUEST_TEMPLATE.md";
    expect(existsSync(path)).toBe(true);
    const content = read(path);
    expect(content).toContain("policy matrix");
    expect(content).toContain("pbom");
    expect(content).toContain("trust center");
    expect(content).toContain("anti-spyware");
    expect(content).toContain("hook-only");
  });

  it("issue templates exist (tests 6-9)", () => {
    for (const file of [
      ".github/ISSUE_TEMPLATE/privacy_bug.yml",
      ".github/ISSUE_TEMPLATE/policy_change.yml",
      ".github/ISSUE_TEMPLATE/feature_gate_proposal.yml",
      ".github/ISSUE_TEMPLATE/antispyware_integration_proposal.yml",
    ]) {
      expect(existsSync(file), file).toBe(true);
    }
    // The policy-change form forces the strict-mode-safety question.
    expect(read(".github/ISSUE_TEMPLATE/policy_change.yml")).toContain("weaken strict modes");
    // The Gate R form requires the non-overclaim commitment.
    expect(read(".github/ISSUE_TEMPLATE/antispyware_integration_proposal.yml")).toContain(
      "overclaim",
    );
  });
});

describe("Workflow docs (tests 10-18)", () => {
  it("core workflow docs exist", () => {
    for (const file of [
      "docs/CONTRIBUTOR_WORKFLOW.md",
      "docs/POLICY_DEVELOPER_GUIDE.md",
      "docs/COMMANDS.md",
      "docs/ADR_WORKFLOW.md",
      "docs/adr/ADR-TEMPLATE.md",
      "docs/audits/OPENSSF_READINESS_CHECKLIST.md",
      "docs/audits/CODEOWNERS_REVIEW_AUDIT.md",
      "docs/GITHUB_REPOSITORY_SETUP.md",
      "docs/MAINTENANCE.md",
      ".github/CODEOWNERS",
    ]) {
      expect(existsSync(file), file).toBe(true);
    }
  });

  it("CODEOWNERS documents the solo-dev limitation (test 16)", () => {
    expect(read(".github/CODEOWNERS")).toContain("placeholder");
    expect(read("docs/audits/CODEOWNERS_REVIEW_AUDIT.md")).toContain("solo-dev");
  });

  it("required command list includes the policy conflict checks (test 24)", () => {
    const workflow = read("docs/CONTRIBUTOR_WORKFLOW.md");
    expect(workflow).toContain("check:policy-conflicts");
    expect(workflow).toContain("check:policy-matrix");
    expect(workflow).toContain("check:contributor-workflow");
  });
});

describe("Anti-spyware externalization statements (tests 19-22)", () => {
  it("Roadmap says externalized (test 19)", () => {
    expect(read("docs/ROADMAP.md")).toContain("externalized");
  });

  it("PBOM says the implementation is not active in core (test 20)", () => {
    const pbom = read("docs/PBOM.md");
    expect(pbom).toContain("externalized");
    expect(pbom).toContain("policy hooks only");
  });

  it("Trust Center does not claim active anti-spyware protection (test 21)", () => {
    const tc = read("docs/TRUST_CENTER.md");
    expect(tc).toContain("not active in freelayer core");
    // The overclaim scanner independently bans "stops spyware"-style claims.
    expect(tc).not.toContain("stops spyware");
    expect(tc).not.toContain("full endpoint protection active");
  });

  it("contributor workflow forbids endpoint-defense dependencies without the gate (test 22)", () => {
    const workflow = read("docs/CONTRIBUTOR_WORKFLOW.md");
    expect(workflow).toContain("do not add endpoint-defense dependencies");
    expect(workflow).toContain("gate r");
  });
});

describe("Validator + security-contributing coupling (tests 23, 25)", () => {
  it("check:contributor-workflow passes on the real repo (test 23)", () => {
    const result = spawnSync(process.execPath, ["scripts/check-contributor-workflow.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it("CONTRIBUTING_SECURITY requires matrix/PBOM/docs/tests for policy changes (test 25)", () => {
    const sec = read("docs/CONTRIBUTING_SECURITY.md");
    expect(sec).toContain("policy matrix");
    expect(sec).toContain("pbom");
    expect(sec).toContain("tests");
  });
});
