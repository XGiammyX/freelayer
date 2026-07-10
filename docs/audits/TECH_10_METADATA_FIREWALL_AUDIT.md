# TECH-10 — Metadata Firewall Audit

_Branch: `tech/metadata-firewall-implementation` · Base commit: `99d0c4a` (stabilize/harden pass, PR #27) · Date: 2026-07-10._

## Commands run

`pnpm typecheck` · `pnpm lint` (eslint + prettier) · `pnpm test` · `pnpm build` · `pnpm check:boundaries` · `check:no-external-assets` · `check:no-telemetry` · `check:no-forbidden-storage` · `check:no-forbidden-network` · `check:build-zero-egress` · `check:no-network-deps` · `check:no-metadata-bypass` · `check:doc-links` · `pnpm audit:privacy` · `audit:security` · `audit:supply-chain` · `pnpm test:coverage`. Results in the final report; all green.

## Platform reconciliation summary

Repository matches the stated baseline (`edb3654` + stabilize/harden = `99d0c4a`). No resolved item (AST ESLint, WeakSet `PolicyDecision`, Node 24, Dependabot, zero-egress scanners, storage/network foundations) was redone; no accepted limitation reopened; no gated work pulled forward. Full table: [TECH_10_PLATFORM_RECONCILIATION.md](TECH_10_PLATFORM_RECONCILIATION.md). Precheck (TECH-05…09 all `present`): [TECH_10_PRECHECK.md](TECH_10_PRECHECK.md).

## Research summary

Focused pass over OWASP MASVS/MASTG (metadata as sensitive data; redacted logs), MDN referrer/request metadata (auto previews & external assets forbidden), WebRTC ICE (IP exposure → WebRTC denied Private+), Notification API (content denied strict; badge/room-activity is metadata), and messaging prior art (receipts/typing/presence off by default; delivery acks must become sealed capsule content; padding/cover traffic deferred). Live internet was unavailable — stable facts documented with a verification-pending marker. See [../research/METADATA_FIREWALL_RESEARCH.md](../research/METADATA_FIREWALL_RESEARCH.md).

## Metadata categories covered

Application-signal, notification, content-adjacent (link/asset/avatar/preview/thumbnail), network-metadata (timing/size/relay/LAN/ICE), local-state (spool/cache existence), log/audit, AI-derived, endpoint/ScreenShield. Development/CI metadata noted as out-of-app-scope. Full threat model: [TECH_10_METADATA_THREAT_MODEL.md](TECH_10_METADATA_THREAT_MODEL.md).

## Implementation

New modules in `packages/privacy/src/`: `metadataTypes.ts`, `metadataErrors.ts`, `metadataHelpers.ts`, `metadataPolicy.ts` (`resolveMetadataPolicy`), `metadataBarrier.ts` (`assertMetadataOperationAllowed`), `metadataSignals.ts` (application-signal / link-preview / asset / notification hooks). `index.ts` extended with 10 metadata side-effect scopes and re-exports. Guardrail: `scripts/check-no-metadata-bypass.mjs` (+ `check:no-metadata-bypass` script, wired into `audit:privacy` and CI).

## Tests added (47; 220 total)

- `tests/privacy-regression/metadata/metadata-policy.test.ts` — matrix, application-signal/notification/AI/asset denial, persistent/network sink denial, room composition, barrier accept + reject (fake decision, wrong scope, denied decision, deny-before-call).
- `tests/privacy-regression/metadata/metadata-integration.test.ts` — **StoragePolicy** (preview/AI caches, reveal persistence, audit persistence) and **NetworkPolicy** (link preview, external assets, WebRTC, telemetry) agreement; ScreenShield hooks.
- `tests/security-regression/metadata/metadata-redaction.test.ts` — payload/audit redaction, sentinel-freedom (errors/audit/console), generic bypass/mismatch errors, WeakSet decision authenticity.

## Storage / Network integration coverage

Proven by the integration test (privacy may not import storage/transports; agreement is asserted at test level): both engines deny link preview, external assets, WebRTC exposure, telemetry-shape, preview/thumbnail caches (Private+), AI caches (all modes), and reveal-state/metadata persistence (strict).

## Guardrail coverage

`check-no-metadata-bypass` flags `new Notification(`, `Notification.requestPermission`, `navigator.setAppBadge/clearAppBadge`, `document.title =`, hand-rolled app-signal emitters, and OpenGraph/link-preview fetchers outside the policy modules/tests. **Limitations (honest):** static token scan; aliasing/dynamic access evade it; intentionally narrow to avoid flagging prose or the policy vocabulary; AST-level global bans (fetch/WebSocket/RTCPeerConnection/storage) remain in `eslint.config.mjs`.

## Known limitations

Metadata is reduced, not eliminated. No messaging/notifications/real network exist. No batching/padding/cover traffic. Global passive adversary, transport-native metadata, and malicious room members are out of scope. Same-realm reflection reuse of a real decision remains bounded by exact-scope checks (accepted, Gate B).

## Deferred / accepted (preserved, not reopened)

Crypto (Gate F), room sync (Gate H), identity (Gate G), capsule wire format (Gate E), compile-time construction restriction + nonced decisions (Gate B), Playwright E2E (AUDIT-HARD), SBOM (Phase 10), desktop shell (Phase 9). Deferred to TECH-11+: `Referrer-Policy: no-referrer`, user-initiated-only previews, sealed-capsule delivery acks, notification model, network-metadata coarsening.

## Verdict

**TECH-10 is complete.** All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-11 — Link Preview / External Asset Blocking**.
