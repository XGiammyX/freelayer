# TECH-13 — Precheck

_Branch: `tech/policy-matrix-v1` off `main` @ `79af52b` (TECH-12 #35 merged). Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable`._

## Platform baseline

| Item | Evidence | Status |
| --- | --- | --- |
| main green (286 tests, 8 privacy guards) | verified locally at branch point | present |
| AST ESLint guardrails / regex scanners | `eslint.config.mjs`, `scripts/check-*.mjs` | present |
| WeakSet `PolicyDecision` authenticity | `packages/privacy/src/index.ts` + regression test | present |
| Maintenance/dependency docs | `docs/MAINTENANCE.md` | present |
| Zero-egress scanners | `check-build-zero-egress`, `check-no-network-deps` | present |
| PBOM / Trust Center | active; extended by TECH-13 | present |

## TECH-10 (Metadata Firewall)

MetadataPolicy v0, event/sink taxonomy, redacted audit model, `check-no-metadata-bypass`, Storage/Network integration tests — all **present** (`packages/privacy/src/metadata*.ts`, `tests/privacy-regression/metadata/`).

## TECH-11 (Link Preview / External Asset)

LinkPreviewPolicy, ExternalAssetPolicy, URL classifier, hardened `check-no-external-assets` (+fixtures), build scanner, `docs/WEB_SECURITY_HEADERS.md`, PBOM §15 — all **present**.

## TECH-12 (Notification Privacy)

NotificationPolicy + operation/content/surface taxonomy, `redactNotificationContent`, badge/sound/vibration/push helpers, `check-no-notification-bypass` (+fixtures), runtime trap, Tauri + SW/push audits — all **present**.

## Verdict

All dependencies **present**; nothing missing had to be built. TECH-13 unifies the existing engines under one canonical matrix and adds agreement tests — it modifies no engine behavior.
