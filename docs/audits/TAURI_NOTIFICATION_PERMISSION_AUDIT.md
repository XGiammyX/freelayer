# Tauri Notification Permission Audit (TECH-12)

_Date: 2026-07-10. Verifies the desktop notification permission surface._

## Result: plugin NOT present; notification permissions are ZERO

- `@tauri-apps/plugin-notification` (or any equivalent) is **not a dependency** anywhere in the workspace (verified: `check:no-network-deps` + a repository search; `check:no-notification-bypass` bans the import string).
- `apps/desktop` is a **placeholder** with no Tauri shell and no capabilities file — its permission surface is deliberately zero (Phase 1 continuation / Phase 9, [../ROADMAP.md](../ROADMAP.md)).
- No notification code runs by default anywhere.

## Verification

| Check | Result |
| --- | --- |
| Plugin in any `package.json` | absent |
| Import of `@tauri-apps/plugin-notification` in source | none (guardrail-enforced) |
| Tauri capabilities granting `notification:*` | none (no capabilities file) |
| Notification code executing at startup | none |
| PBOM entry | "Tauri notification plugin: Not present or permission-audited" (PBOM §16) |
| Trust Center | notes no notifications implemented (TECH-12 section) |

## Future TODO (before the plugin may be added)

1. The plugin may be added **only after** NotificationPolicy integration — every notification must pass `resolveNotificationPolicy` + `assertNotificationOperationAllowed`.
2. Tauri capabilities must scope notification permissions to exactly the operations the policy allows — never a broad `notification:default`.
3. Per-OS lock-screen/notification-center content behavior must be documented (Windows/macOS/Linux).
4. Strict modes must show **no** content; content classes remain denied until a design gate.
5. The addition is a security-sensitive PR (CODEOWNERS review, [GOVERNANCE.md](../../GOVERNANCE.md)) and must update PBOM + Trust Center.
