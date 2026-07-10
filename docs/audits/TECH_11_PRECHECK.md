# TECH-11 — Precheck

_Branch: `tech/link-preview-external-asset-blocking` (off `main` @ `5db99f8`, which contains TECH-10 #28 + stabilize/harden #27). Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable`._

## Platform baseline

| Item | Evidence | Status |
| --- | --- | --- |
| main green, TECH-10 merged | `main` @ `5db99f8` (PR #28); PR #27 (#stabilize) @ `d89fe42` | present |
| AST-backed ESLint guardrails | `eslint.config.mjs` (no-restricted-globals/imports) | present |
| Regex scanners (belt-and-suspenders) | `scripts/check-*.mjs` | present |
| WeakSet `PolicyDecision` authenticity | `packages/privacy/src/index.ts`; `tests/security-regression/policy-decision-authenticity.test.ts` | present |
| Dependency/maintenance docs | `docs/MAINTENANCE.md`, `docs/DEPENDENCY_POLICY.md` | present |
| Zero-egress scanners | `check-build-zero-egress`, `check-no-network-deps` | present |
| PBOM / Trust Center | active contracts; extended by TECH-11 | present |

## TECH-08 (NetworkPolicy)

| Item | Evidence | Status |
| --- | --- | --- |
| NetworkPolicy v0 | `packages/transports/src/networkPolicy.ts` | present |
| Network side-effect barrier | `networkBarrier.ts` | present |
| Forbidden-network guardrail | `scripts/check-no-forbidden-network.mjs` | present |
| Runtime network trap | `tests/helpers/network-trap.ts` | present |
| Metadata leakage labels | `networkMetadata.ts` | present |
| Mock/Noop transport | `networkProviders.ts` | present |
| `link.preview` / `asset.fetch` always-forbidden | `ALWAYS_FORBIDDEN_OPERATIONS` in `networkPolicy.ts` | present |

## TECH-09 (Zero-egress build)

| Item | Evidence | Status |
| --- | --- | --- |
| Build-artifact zero-egress scanner | `scripts/check-build-zero-egress.mjs` | present |
| Remote asset scanner | `scripts/check-no-external-assets.mjs` (hardened here) | present |
| Network dependency scanner | `scripts/check-no-network-deps.mjs` (extended here) | present |
| Service worker / Actions egress audits | `docs/audits/GITHUB_ACTIONS_EGRESS_AUDIT.md` | present |

## TECH-10 (Metadata Firewall)

| Item | Evidence | Status |
| --- | --- | --- |
| MetadataPolicy v0 + event/sink taxonomy | `packages/privacy/src/metadata*.ts` | present |
| `link.preview` metadata policy | denied every mode (`EXTERNAL_FETCH_EVENTS`) | present |
| `asset.remote_fetch` / `avatar.remote_fetch` metadata policy | denied every mode | present |
| Notification metadata policy | present | present |
| Redacted audit event model | `createRedactedAuditEvent` | present |
| Metadata guardrail | `scripts/check-no-metadata-bypass.mjs` (extended here) | present |
| Storage/Network integration | `tests/privacy-regression/metadata/metadata-integration.test.ts` | present |

## Verdict

All TECH-08/09/10 dependencies **present**. TECH-11 extends (does not modify) the metadata `link.preview`/`asset.remote_fetch` denials with dedicated `LinkPreviewPolicy` / `ExternalAssetPolicy` engines and a URL classifier, and hardens the existing scanners. No missing foundation had to be built.
