// Policy docs consistency check (TECH-13, docs/POLICY_MATRIX.md).
//
// Lightweight, stable existence + mention checks — deliberately NOT NLP-based
// doc validation. Ensures the canonical matrix artifacts exist and the core
// docs reference the concepts they must reference.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPathExisting, report, repoRoot } from "./_util.mjs";

const root = repoRoot();
const violations = [];

const MUST_EXIST = [
  "docs/POLICY_MATRIX.md",
  "docs/policy-matrix.v1.json",
  "packages/privacy/src/policyMatrix.ts",
  "scripts/validate-policy-matrix.mjs",
];
for (const path of MUST_EXIST) {
  if (!isPathExisting(join(root, path))) {
    violations.push(`missing required file "${path}"`);
  }
}

// file → phrases that must appear (case-insensitive). TECH-14 added the
// consistency statements for always-denied behaviors, deferred gates, honest
// non-guarantees, and the anti-spyware externalization.
const MUST_MENTION = {
  "docs/PBOM.md": ["Policy Matrix", "telemetry", "external assets", "push", "externalized"],
  "docs/TRUST_CENTER.md": ["Policy Matrix", "anonymity", "externalized"],
  "docs/PRIVACY_MODEL.md": ["strictest", "Policy Matrix", "push"],
  "docs/ROADMAP.md": ["TECH-13", "TECH-14", "externalized"],
  "docs/IMPLEMENTATION_GATES.md": ["Policy Matrix", "anti-spyware"],
  "docs/POLICY_MATRIX.md": ["deny", "strictest", "future_gate", "externalized"],
  "docs/NETWORK_MODEL.md": ["telemetry", "link preview", "push"],
  "docs/THREAT_MODEL.md": ["policy drift", "anonymity"],
  // RESEARCH-ID-01 / TECH-ID-03: the Identity Firewall must stay honest — no
  // cryptographic identity, and DevicePosture stays separate from identity.
  "docs/IDENTITY_FIREWALL.md": ["not implemented", "DevicePosture is not identity"],
};

for (const [file, phrases] of Object.entries(MUST_MENTION)) {
  const abs = join(root, file);
  if (!isPathExisting(abs)) {
    violations.push(`missing doc "${file}"`);
    continue;
  }
  const content = readFileSync(abs, "utf8").toLowerCase();
  for (const phrase of phrases) {
    if (!content.includes(phrase.toLowerCase())) {
      violations.push(`"${file}" does not mention "${phrase}"`);
    }
  }
}

report("check:policy-docs", violations);
