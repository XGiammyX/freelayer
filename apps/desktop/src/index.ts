/**
 * @freelayer/desktop — placeholder. NOT a Tauri app yet.
 *
 * Desktop will be the primary target for stronger local controls: OS keychain
 * key storage, filesystem capsule import/export, and better no-persistence
 * guarantees than the PWA can offer. Adding the Tauri shell now would drag in
 * a Rust toolchain and a permissions surface this phase doesn't need.
 *
 * TODO (Phase 1 continuation, before Gate A closes on desktop):
 * - Tauri shell wrapping apps/web
 * - capability allowlist kept MINIMAL: no broad filesystem, no network, no
 *   updater, no OS integrations, no auto-start, no notifications, no
 *   keychain — each future capability needs docs/PBOM.md section 5 and
 *   review per docs/SECURITY_REVIEW_CHECKLIST.md ("Tauri permissions").
 */

export const DESKTOP_STATUS = "placeholder_no_tauri_shell_yet" as const;
