// Notification-bypass guard (TECH-12, docs/PRIVACY_MODEL.md — Notification
// Privacy Model). Notification behavior must pass NotificationPolicy
// (packages/privacy). This guard catches direct, call/import-shaped uses of
// notification/push/badge/service-worker APIs OUTSIDE the approved policy
// modules and tests.
//
// HONEST LIMITATIONS (docs/audits/TECH_12_NOTIFICATION_PRIVACY_AUDIT.md):
//   - Static, token-based scan; aliasing/dynamic access evade it.
//   - Narrow by design; the policy vocabulary (dotted strings like
//     "notification.show") does not match the call/import-shaped tokens below.
//   - AST-level global bans live in eslint.config.mjs; this adds
//     notification-specific patterns ESLint does not cover.
//
// Usage: node scripts/check-no-notification-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  "new Notification(",
  "Notification.requestPermission",
  "Notification.permission",
  "self.registration.showNotification",
  ".showNotification(",
  "showNotification(",
  "PushManager",
  "pushManager",
  "PushSubscription",
  "navigator.serviceWorker",
  "serviceWorker.register",
  "navigator.setAppBadge",
  "navigator.clearAppBadge",
  "setAppBadge(",
  "clearAppBadge(",
  // Push / notification SDKs and OS plugins.
  "@tauri-apps/plugin-notification",
  "firebase/messaging",
  "@react-native-firebase/messaging",
  "onesignal",
  "OneSignal",
  "web-push",
  "pusher-js",
  'from "pusher"',
];

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".html", ".mjs"];

// Approved notification policy modules reference the vocabulary as string
// literals only (no call-shaped tokens), but we allowlist them defensively.
function isAllowlisted(relPath) {
  return (
    relPath.includes("packages/privacy/src/notification") ||
    relPath.endsWith(".test.ts") ||
    relPath.endsWith(".test.tsx")
  );
}

const args = process.argv.slice(2);
const scanDirs = args.length > 0 && !args[0].startsWith("--") ? args : DEFAULT_DIRS;

const root = repoRoot();
const violations = [];

for (const dir of scanDirs) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const rel = repoRelative(root, file);
    if (isAllowlisted(rel)) {
      continue;
    }
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — notification/push API "${token}" ` +
              "(notification behavior must pass NotificationPolicy — docs/PRIVACY_MODEL.md)",
          );
        }
      }
    });
  }
}

report("check:no-notification-bypass", violations);
