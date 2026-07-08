# @freelayer/desktop

**Status: placeholder package — the Tauri shell is a tracked TODO, deferred deliberately to keep the permissions surface at zero for now (no filesystem, no network, no updater, no notifications, no keychain).**

Tauri desktop shell wrapping the web client. Adds what the web platform cannot provide:

- OS keychain integration for key storage (Phase 7/9)
- Filesystem capsule/bundle import & export (file/USB transports)
- Stronger no-persistence guarantees than the PWA
- Future Ghost Vault support (offline identity device workflows)

Tauri capabilities will be locked to the minimum required (Phase 9 hardening). Rust code under `src-tauri/` (future) follows the same security review rules as security-sensitive packages.

See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
