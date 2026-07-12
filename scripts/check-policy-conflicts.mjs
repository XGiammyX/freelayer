// Policy conflict validator (TECH-14, docs/audits/POLICY_CONFLICT_REPORT.md).
//
// Policy contradictions are privacy bugs. This script fails on critical
// cross-layer contradictions that the type system cannot catch:
//   1. MATRIX conflicts — a matrix export marking always-forbidden behavior
//      allowed, strict modes loosened, deferred gates executable, or
//      externalized endpoint-defense capabilities marked implemented.
//   2. DOCS conflicts — PBOM/Trust Center/Roadmap missing the anti-spyware
//      externalization + hooks-only statements, or Trust Center overclaiming.
//   3. DEPENDENCY conflicts — endpoint-monitoring / push / remote-AI packages
//      appearing in core while PBOM says they are not implemented.
//
// Usage:
//   node scripts/check-policy-conflicts.mjs                     # full run
//   node scripts/check-policy-conflicts.mjs --matrix <file>     # matrix only (fixtures)
//   node scripts/check-policy-conflicts.mjs --trust-center <f>  # overclaim scan only
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPathExisting, report, repoRoot, walkFiles } from "./_util.mjs";

const MODES = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];
const ALLOWING_EFFECTS = ["allow", "memory_only", "redact", "coarsen", "delay", "batch"];
const STRICT_MODES = ["ghost", "bunker"];
const PRIVATE_PLUS = [
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];
// "room" graduated in TECH-16 (local RoomOS foundation rows exist); room SYNC
// stays future-gated via the explicit check below.
const DEFERRED_DOMAINS = ["crypto", "capsule", "identity"];

// Spec-id prefixes that may NEVER be allowed in any mode.
const NEVER_ALLOWED_PREFIXES = [
  "network.telemetry_send",
  "network.external_asset_fetch",
  "network.link_preview_fetch",
  "network.push_subscribe",
  "network.remote_ai_request",
  "external_asset.",
  "link_preview.automatic_preview",
  "link_preview.opengraph_fetch",
  "link_preview.favicon_fetch",
  "link_preview.preview_cache",
  "notification.push_subscribe",
  "notification.push_receive",
  "notification.service_worker_show",
  "notification.message_preview",
  "ai.remote_request",
  "ai.prompt_cache",
  "ai.output_cache",
];

// Externalized endpoint-defense CAPABILITY rows (hook-only; the anti-spyware
// implementation lives in a separate project). State rows (reveal/audit) may
// be memory-only; capability rows must never be executable in core.
const EXTERNALIZED_CAPABILITY_PREFIXES = [
  "endpoint.clipboard_copy",
  "endpoint.secure_input",
  "endpoint.task_switcher_preview",
  "endpoint.screenshot_blocking",
];

// App-signal metadata that Private+ must never allow.
const PRIVATE_PLUS_DENIED_PREFIXES = [
  "metadata.read_receipt",
  "metadata.delivery_receipt",
  "metadata.typing_indicator",
  "metadata.presence",
  "metadata.last_seen",
];

// Notification surfaces Bunker must never allow.
const BUNKER_DENIED_PREFIXES = [
  "notification.badge_",
  "notification.sound",
  "notification.vibration",
];

// Endpoint-monitoring / anti-spyware / push / remote-AI dependencies that must
// not appear in core (the anti-spyware project is external).
const FORBIDDEN_CONFLICT_DEPS = [
  "iohook",
  "robotjs",
  "screenshot-desktop",
  "active-win",
  "node-global-key-listener",
  "uiohook-napi",
  "@nut-tree/", // prefix
  "web-push",
  "firebase",
  "firebase-admin",
  "onesignal-node",
  "@onesignal/",
  "node-notifier",
  "@tauri-apps/plugin-notification",
];

// Unambiguous Trust Center overclaims (phrase → always flagged) plus
// negation-aware terms (flagged unless the line negates them).
const OVERCLAIM_PHRASES = [
  "impossible to hack",
  "zero risk",
  "guaranteed anonymity",
  "forensic deletion",
  "stops spyware",
  "full endpoint protection active",
  "military grade",
  "prevents screenshots completely",
  "production ready for real secrets",
  "unhackable",
  "100% secure",
];
const NEGATION_AWARE_TERMS = ["unbreakable"];
const NEGATIONS = ["no ", "not ", "never ", "cannot ", "isn't ", "is not ", "without "];

const args = process.argv.slice(2);
function argValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : undefined;
}
const matrixOverride = argValue("--matrix");
const trustCenterOverride = argValue("--trust-center");
const fixtureMode = matrixOverride !== undefined || trustCenterOverride !== undefined;

const root = repoRoot();
const violations = [];

// ---------------------------------------------------------------------------
// 1. Matrix conflict checks
// ---------------------------------------------------------------------------
function checkMatrix(matrixPath) {
  let matrix;
  try {
    matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
  } catch (error) {
    violations.push(`cannot read/parse matrix "${matrixPath}": ${String(error)}`);
    return;
  }
  const specs = Array.isArray(matrix.specs) ? matrix.specs : [];
  for (const spec of specs) {
    for (const mode of MODES) {
      const effect = spec.effectOverrides?.[mode] ?? spec.effect;
      const allowed = ALLOWING_EFFECTS.includes(effect);
      const id = `${spec.id}:${mode}`;

      if (NEVER_ALLOWED_PREFIXES.some((p) => spec.id.startsWith(p)) && allowed) {
        violations.push(`[allow_vs_deny] ${id} — always-forbidden behavior marked allowed`);
      }
      if (EXTERNALIZED_CAPABILITY_PREFIXES.some((p) => spec.id.startsWith(p)) && allowed) {
        violations.push(
          `[externalized_component_marked_implemented] ${id} — endpoint-defense capability must stay hook-only (anti-spyware is external)`,
        );
      }
      if (DEFERRED_DOMAINS.includes(spec.domain) && allowed) {
        violations.push(`[future_gate_treated_as_allow] ${id} — deferred domain marked executable`);
      }
      if (STRICT_MODES.includes(mode) && spec.sink === "local_persistent_storage" && allowed) {
        violations.push(
          `[persistent_allowed_conflict] ${id} — Ghost/Bunker persistent sink allowed`,
        );
      }
      if (mode === "offline_capsule" && spec.domain === "network" && allowed) {
        violations.push(`[network_allowed_conflict] ${id} — Offline Capsule network allowed`);
      }
      if (
        PRIVATE_PLUS.includes(mode) &&
        PRIVATE_PLUS_DENIED_PREFIXES.some((p) => spec.id.startsWith(p)) &&
        allowed
      ) {
        violations.push(`[metadata_allowed_conflict] ${id} — Private+ app-signal metadata allowed`);
      }
      if (
        mode === "bunker" &&
        BUNKER_DENIED_PREFIXES.some((p) => spec.id.startsWith(p)) &&
        allowed
      ) {
        violations.push(`[metadata_allowed_conflict] ${id} — Bunker badge/sound/vibration allowed`);
      }
      if (spec.id === "storage.encrypted_persistent_backend" && effect !== "future_gate") {
        violations.push(
          `[not_implemented_treated_as_allow] ${id} — encrypted backend must stay future_gate`,
        );
      }
      if (spec.id === "crypto.operation" && effect !== "future_gate") {
        violations.push(`[future_gate_treated_as_allow] ${id} — crypto must stay future_gate`);
      }
      if (spec.id === "room.sync" && effect !== "future_gate") {
        violations.push(
          `[future_gate_treated_as_allow] ${id} — room sync must stay future_gate (Gate H)`,
        );
      }
      if (
        spec.domain === "room" &&
        spec.sink === "local_persistent_storage" &&
        ALLOWING_EFFECTS.includes(effect)
      ) {
        violations.push(
          `[persistent_allowed_conflict] ${id} — room log/projection persistence allowed`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Trust Center overclaim scan (negation-aware)
// ---------------------------------------------------------------------------
function checkTrustCenterOverclaims(path) {
  if (!isPathExisting(path)) {
    violations.push(`missing Trust Center at "${path}"`);
    return;
  }
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const phrase of OVERCLAIM_PHRASES) {
      if (lower.includes(phrase)) {
        violations.push(
          `[trust_center_test_mismatch] ${path}:${index + 1} — overclaim "${phrase}" (Trust Center must not overclaim; anti-spyware is not active in core)`,
        );
      }
    }
    for (const term of NEGATION_AWARE_TERMS) {
      const at = lower.indexOf(term);
      if (at !== -1) {
        const before = lower.slice(Math.max(0, at - 24), at);
        if (!NEGATIONS.some((neg) => before.includes(neg))) {
          violations.push(
            `[trust_center_test_mismatch] ${path}:${index + 1} — unqualified claim "${term}"`,
          );
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 3. Docs statements + dependency conflicts (full run only)
// ---------------------------------------------------------------------------
function checkDocsStatements() {
  const MUST_MENTION = {
    "docs/PBOM.md": ["externalized", "policy matrix"],
    "docs/TRUST_CENTER.md": ["externalized", "policy conflict"],
    "docs/ROADMAP.md": ["externalized", "TECH-14"],
    "docs/IMPLEMENTATION_GATES.md": ["anti-spyware", "policy conflict"],
  };
  for (const [file, phrases] of Object.entries(MUST_MENTION)) {
    const abs = join(root, file);
    if (!isPathExisting(abs)) {
      violations.push(`[docs_code_mismatch] missing "${file}"`);
      continue;
    }
    const content = readFileSync(abs, "utf8").toLowerCase();
    for (const phrase of phrases) {
      if (!content.includes(phrase.toLowerCase())) {
        violations.push(`[docs_code_mismatch] "${file}" does not mention "${phrase}"`);
      }
    }
  }
}

function checkDependencyConflicts() {
  const manifests = ["package.json"];
  for (const dir of ["apps", "packages"]) {
    for (const file of walkFiles(join(root, dir), ["package.json"])) {
      manifests.push(file);
    }
  }
  for (const manifest of manifests) {
    const abs = manifest.startsWith(root) ? manifest : join(root, manifest);
    if (!isPathExisting(abs)) continue;
    let json;
    try {
      json = JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      violations.push(`[pbom_code_mismatch] cannot parse "${manifest}"`);
      continue;
    }
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      const deps = json[field];
      if (deps === undefined || deps === null) continue;
      for (const depName of Object.keys(deps)) {
        if (
          FORBIDDEN_CONFLICT_DEPS.some((f) =>
            f.endsWith("/") ? depName.startsWith(f) : depName === f,
          )
        ) {
          violations.push(
            `[pbom_code_mismatch] "${manifest}" — dependency "${depName}" contradicts PBOM (endpoint-monitoring/push not implemented; anti-spyware external)`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
if (matrixOverride !== undefined) {
  checkMatrix(matrixOverride);
} else if (trustCenterOverride === undefined) {
  checkMatrix(join(root, "docs", "policy-matrix.v1.json"));
}
if (trustCenterOverride !== undefined) {
  checkTrustCenterOverclaims(trustCenterOverride);
} else if (matrixOverride === undefined) {
  checkTrustCenterOverclaims(join(root, "docs", "TRUST_CENTER.md"));
}
if (!fixtureMode) {
  checkDocsStatements();
  checkDependencyConflicts();
}

report("check:policy-conflicts", violations);
