# TECH-12 — Precheck

_Branch: `tech/notification-privacy-model` (stacked on `tech/link-preview-external-asset-blocking` / TECH-11, which is on `main` + TECH-10). Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable`._

## Platform baseline

| Item | Evidence | Status |
| --- | --- | --- |
| main green; TECH-10 merged; TECH-11 in review | `main` @ TECH-10 (#28); TECH-11 = PR #34 (stacked) | present |
| AST-backed ESLint guardrails | `eslint.config.mjs` | present |
| Regex scanners | `scripts/check-*.mjs` | present |
| WeakSet `PolicyDecision` authenticity | `packages/privacy/src/index.ts` + authenticity test | present |
| Dependency/maintenance docs | `docs/MAINTENANCE.md` | present |
| Zero-egress scanners | `check-build-zero-egress`, `check-no-network-deps` | present |
| PBOM / Trust Center | active; extended by TECH-12 | present |

## TECH-10 (Metadata Firewall)

| Item | Evidence | Status |
| --- | --- | --- |
| MetadataPolicy v0 + event/sink taxonomy | `packages/privacy/src/metadata*.ts` | present |
| Notification metadata policy hook | `evaluateNotificationPolicy` / `notification.preview` denied | present |
| Redacted audit event model | `createRedactedAuditEvent` (reused by TECH-12) | present |
| Metadata guardrail | `scripts/check-no-metadata-bypass.mjs` | present |
| Storage/Network integration | `metadata-integration.test.ts` | present |

## TECH-11 (Link Preview / External Asset)

| Item | Evidence | Status |
| --- | --- | --- |
| LinkPreviewPolicy / ExternalAssetPolicy | `packages/privacy/src/{linkPreviewPolicy,externalAssetPolicy}.ts` | present |
| URL classifier | `urlClassification.ts` | present |
| External-asset + build scanners | `check-no-external-assets`, `check-build-zero-egress` | present |
| WEB_SECURITY_HEADERS | `docs/WEB_SECURITY_HEADERS.md` | present |
| Link/asset PBOM updates | PBOM §15 | present |

## Recorded prior decision (baseline)

Notification-content storage class is **born denied in strict modes, no plaintext in audit** (TECH-10 decision C7). TECH-12 honors this: notification content never persists (`persistentStorageAllowed` always false in v0) and audit events are redacted.

## Verdict

All TECH-10/TECH-11 dependencies **present**. Nothing missing had to be built. TECH-12 adds NotificationPolicy alongside the existing policies and reuses (does not modify) the WeakSet `PolicyDecision` provenance and the redacted audit model.
