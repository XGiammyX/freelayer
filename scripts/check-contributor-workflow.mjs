// Contributor-workflow validator (TECH-15, docs/CONTRIBUTOR_WORKFLOW.md).
//
// Verifies the contributor-facing governance surface exists and that the
// anti-spyware externalization is stated where contributors will read it.
// Simple existence + phrase checks — deliberately no NLP.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPathExisting, report, repoRoot } from "./_util.mjs";

const root = repoRoot();
const violations = [];

const MUST_EXIST = [
  "CONTRIBUTING.md",
  "docs/CONTRIBUTING_SECURITY.md",
  "SECURITY.md",
  "GOVERNANCE.md",
  "docs/MAINTENANCE.md",
  "docs/CONTRIBUTOR_WORKFLOW.md",
  "docs/POLICY_DEVELOPER_GUIDE.md",
  "docs/COMMANDS.md",
  "docs/ADR_WORKFLOW.md",
  "docs/adr/ADR-TEMPLATE.md",
  "docs/LABELS.md",
  "docs/DOCS_CANONICAL_WORKFLOW.md",
  "docs/GITHUB_REPOSITORY_SETUP.md",
  "docs/audits/OPENSSF_READINESS_CHECKLIST.md",
  "docs/audits/CODEOWNERS_REVIEW_AUDIT.md",
  "docs/audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/CODEOWNERS",
  ".github/ISSUE_TEMPLATE/privacy_bug.yml",
  ".github/ISSUE_TEMPLATE/policy_change.yml",
  ".github/ISSUE_TEMPLATE/feature_gate_proposal.yml",
  ".github/ISSUE_TEMPLATE/antispyware_integration_proposal.yml",
];
for (const path of MUST_EXIST) {
  if (!isPathExisting(join(root, path))) {
    violations.push(`missing required file "${path}"`);
  }
}

// The anti-spyware externalization must be stated in contributor-facing docs.
const EXTERNALIZATION_MENTIONS = {
  "docs/ROADMAP.md": ["externalized"],
  "docs/IMPLEMENTATION_GATES.md": ["anti-spyware"],
  "docs/PBOM.md": ["externalized"],
  "docs/TRUST_CENTER.md": ["externalized"],
  "docs/CONTRIBUTOR_WORKFLOW.md": ["externalized", "hook"],
  ".github/PULL_REQUEST_TEMPLATE.md": ["anti-spyware"],
};
// PR/workflow essentials.
const CONTENT_MENTIONS = {
  ".github/PULL_REQUEST_TEMPLATE.md": ["Policy Matrix", "PBOM", "Trust Center"],
  "docs/CONTRIBUTOR_WORKFLOW.md": ["check:policy-conflicts", "check:policy-matrix"],
  "docs/CONTRIBUTING_SECURITY.md": ["Policy Matrix", "PBOM"],
};

for (const [file, phrases] of Object.entries({ ...EXTERNALIZATION_MENTIONS })) {
  const abs = join(root, file);
  if (!isPathExisting(abs)) continue; // existence already reported
  const content = readFileSync(abs, "utf8").toLowerCase();
  for (const phrase of phrases) {
    if (!content.includes(phrase.toLowerCase())) {
      violations.push(`"${file}" does not state the anti-spyware boundary ("${phrase}")`);
    }
  }
}
for (const [file, phrases] of Object.entries(CONTENT_MENTIONS)) {
  const abs = join(root, file);
  if (!isPathExisting(abs)) continue;
  const content = readFileSync(abs, "utf8").toLowerCase();
  for (const phrase of phrases) {
    if (!content.includes(phrase.toLowerCase())) {
      violations.push(`"${file}" does not mention "${phrase}"`);
    }
  }
}

report("check:contributor-workflow", violations);
