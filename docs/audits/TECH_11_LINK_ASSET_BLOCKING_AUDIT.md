# TECH-11 — Link Preview / External Asset Blocking Audit

_Branch: `tech/link-preview-external-asset-blocking` · Base: `main` @ `5db99f8` (TECH-10 merged) · Date: 2026-07-10._

## Commands run

`pnpm typecheck` · `lint` (eslint + prettier) · `test` · `build` · `check:boundaries` · `check:no-external-assets` · `check:no-telemetry` · `check:no-forbidden-storage` · `check:no-forbidden-network` · `check:build-zero-egress` · `check:no-network-deps` · `check:no-metadata-bypass` · `check:doc-links` · `audit:privacy` · `audit:supply-chain` · `test:coverage`. All green (see final report).

## Precheck

TECH-08/09/10 all `present`; nothing missing had to be built. → [TECH_11_PRECHECK.md](TECH_11_PRECHECK.md).

## Research summary

Link previews/unfurling leak URL+IP+UA+referrer+timing; client-side leaks the reader, server-side needs a backend FreeLayer refuses (and adds SSRF). CORS is not a privacy boundary. Connection hints (preconnect/dns-prefetch/preload/prefetch) leak DNS/TCP before content. Strict CSP + `Referrer-Policy: no-referrer` are defense-in-depth. → [../research/LINK_PREVIEW_EXTERNAL_ASSET_BLOCKING_RESEARCH.md](../research/LINK_PREVIEW_EXTERNAL_ASSET_BLOCKING_RESEARCH.md). Threat model → [TECH_11_LINK_ASSET_THREAT_MODEL.md](TECH_11_LINK_ASSET_THREAT_MODEL.md). (Live internet unavailable → verification-pending marker in the research note.)

## Implementation

New in `packages/privacy/src/`:
- `urlClassification.ts` — pure `classifyUrl` (14 classifications; redacts query/credentials to domain-only) + `renderPlainTextUrlLabel` (only sanctioned renderer; no fetch, no image/favicon; sealed → `[redacted link]`).
- `linkPreviewPolicy.ts` — `resolveLinkPreviewPolicy`: automatic preview / fetch / favicon / OpenGraph / thumbnail / cache all denied every mode; relaxed modes show plain text; sealed ScreenShield redacts; room composes tighten-only; unknown mode fails closed.
- `externalAssetPolicy.ts` — `resolveExternalAssetPolicy`: all 16 asset kinds denied every mode; tracking pixels + connection hints flagged for a user-visible warning.

## Scanner improvements

- `check-no-external-assets.mjs`: added CDNs (jsdelivr/unpkg/cdnjs/gstatic/googletagmanager/google-analytics), protocol-relative asset patterns, `rel="dns-prefetch"`/`prefetch`/`preload` remote, remote favicon, OpenGraph/Twitter-card images, `new Image(` / `.src="http`, and CLI dir support for fixtures.
- `check-no-network-deps.mjs`: added link-preview/OpenGraph/scraper packages (metascraper, open-graph-scraper, link-preview-js, url-metadata, unfurl.js, html-metadata, `@extractus/`, cheerio).
- `check-no-metadata-bypass.mjs`: added `unfurl(`, `fetchFavicon`, `fetchRemoteAvatar`, `fetchAvatar`, `loadRemoteImage`.

## Build output scan

`check-build-zero-egress` scans `apps/web/dist`; `check-no-external-assets` run against real `apps`+`packages` source → no remote assets. Fixture tests confirm the scanner catches remote images/fonts/scripts/stylesheets/CSS/preconnect/dns-prefetch/preload/OpenGraph and passes local-only assets.

## Policy integration coverage

- **MetadataPolicy**: `link.preview` / `asset.remote_fetch` / `avatar.remote_fetch` denied — agrees with LinkPreview/ExternalAsset policies (tested).
- **NetworkPolicy**: `link.preview` / `asset.fetch` operations denied — agrees (tested).
- **StoragePolicy**: preview_cache / thumbnail_cache denied in Private+ — agrees with `cacheAllowed`/`thumbnailAllowed` false (tested).

## Tests added

- `tests/privacy-regression/link-preview/link-asset-policy.test.ts` — preview + asset denial matrix, sealed redaction, room tighten-only, cross-policy agreement.
- `tests/security-regression/link-preview/url-classification.test.ts` — credential/query redaction, dangerous-scheme classification, sentinel-freedom, no-fetch, scanner fixtures.
- Fixtures: `tests/fixtures/external-assets/` (bad), `tests/fixtures/external-assets-clean/` (good).

## CSP / header recommendations

[../WEB_SECURITY_HEADERS.md](../WEB_SECURITY_HEADERS.md): strict CSP (`connect-src 'none'`, `default-src 'self'`, no remote hosts), `Referrer-Policy: no-referrer`, `Permissions-Policy`. Framed as defense-in-depth; deployment is a future task.

## Known limitations

In-app/build blocking only — cannot control browser extensions, OS DNS, other apps, or a URL manually opened in another browser. CSP depends on deployment. A user-initiated preview remains a future gate.

## Deferred future preview design

User-initiated, single-shot, metadata-labeled preview through an IP-protecting transport; avatar-as-capsule-content; `no-referrer` + strict CSP in a future self-hosted deployment.

## Verdict

**TECH-11 is complete.** All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-12 — Notification Privacy Model**.
