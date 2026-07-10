# Link Preview / External Asset Blocking — Research Note (TECH-11)

_Date: 2026-07-10. Informs `LinkPreviewPolicy`, `ExternalAssetPolicy`, and the URL classifier in `packages/privacy`._

> [!NOTE]
> **Source verification pending: live internet was unavailable in this environment.** The facts below are stable, well-established web-platform and privacy-engineering knowledge (author cutoff 2026-01). Re-confirm exact spec wordings against the primary sources named before external citation.

## Why this pass

A single automatic link preview or remote asset can leak the pasted URL, the reader's IP, the user-agent, referrer, DNS lookups, open-timing, and (if wired wrong) room/message context — to a server the user never chose to contact. FreeLayer's rule: **no automatic previews, no remote assets, ever.** A future preview must be user-initiated, policy-gated, and metadata-labeled — a separate design gate, not this pass.

## 5.1 Link previews / URL unfurling

**Summary:** Unfurling fetches the target URL and parses OpenGraph/meta tags to build a card. Whether done client-side (leaks the *reader's* IP/UA) or server-side (needs a backend, introduces SSRF and a trusted third party), the fetch itself confirms interest in the URL and its timing. FreeLayer has no backend, so a server/proxy preview is architecturally impossible without violating the constitution.

**Applied:** `resolveLinkPreviewPolicy` denies automatic previews and all preview fetches in every mode; `networkFetchAllowed`/`openGraphAllowed`/`faviconAllowed`/`cacheAllowed`/`thumbnailAllowed` are permanently false. The ceiling is redacted plain text.

## 5.2 Fetch / request metadata (MDN)

**Summary:** `fetch()` sends URL, headers, and (per config) referrer/credentials; **CORS is not a privacy boundary** — a blocked *response* still means the *request* left the machine. Any asset load is a request.

**Applied:** link preview and external-asset loading are network side effects; `fetch` stays forbidden (ESLint `no-restricted-globals` + `check-no-forbidden-network`). The URL classifier and both policy resolvers perform **zero** network calls (tested with a fetch spy).

## 5.3 Referrer-Policy / Referer

**Summary:** Without a strict policy the `Referer` header leaks the origin, path, and sometimes query of the page. `Referrer-Policy: no-referrer` suppresses it entirely.

**Applied:** documented as a required future header ([../WEB_SECURITY_HEADERS.md](../WEB_SECURITY_HEADERS.md)); URLs are never fetched automatically, so no referrer is emitted today; a future preview/navigation path must use `no-referrer` and never attach room/message context.

## 5.4 Remote assets

**Summary:** Remote images/fonts/scripts/CSS `url()`, favicons, avatars, OpenGraph images, and tracking pixels are all outbound requests. `preconnect`/`dns-prefetch`/`preload`/`prefetch` leak metadata (DNS + TCP/TLS) *before* any content is fetched.

**Applied:** `resolveExternalAssetPolicy` denies all 16 asset kinds in every mode; connection hints and tracking pixels carry a user-visible-warning flag. The hardened `check-no-external-assets` scanner catches remote images/fonts/scripts/stylesheets, CSS `url()`/`@import`, protocol-relative assets, CDNs (jsdelivr/unpkg/cdnjs/gstatic/googletagmanager/google-analytics), connection hints, favicons, and OpenGraph/Twitter-card images. Avatars must travel as future capsule content, never remote URLs.

## 5.5 OWASP (MASVS-PRIVACY / MASVS-NETWORK)

**Summary:** Minimize access to external resources; test that no unexpected network traffic occurs; treat logs/errors/referrers as leakage surfaces.

**Applied:** external resources are forbidden and machine-checked (scanners + build-zero-egress); PBOM documents the behavior; URLs are redacted in display, errors, and audit events (no query/credentials/sentinel).

## 5.6 CSP and web hardening (MDN)

**Summary:** A strict CSP (`default-src 'self'; connect-src 'none'; img-src 'self'; …`) is defense-in-depth against remote assets and injection. CSP does not replace code guardrails and depends on deployment context.

**Applied:** recommended headers documented in [../WEB_SECURITY_HEADERS.md](../WEB_SECURITY_HEADERS.md), explicitly framed as defense-in-depth. Future self-hosted docs/app should set them; future transports may need a carefully scoped `connect-src`.

## Decisions made for TECH-11

1. URLs are **content-adjacent metadata**; remote assets are **network side effects** — both denied by default.
2. `LinkPreviewPolicy` / `ExternalAssetPolicy` live in `packages/privacy` (self-contained; agreement with Metadata/Network/Storage proven by tests).
3. The URL classifier is **pure** — no network, no DNS, no normalization that hides suspicious input; query/credentials always redacted; `javascript:`/`data:`/`blob:`/`file:` classified and denied.
4. `renderPlainTextUrlLabel` is the only sanctioned URL renderer: domain-only, redacted, never an image/favicon/card.
5. A real preview is a **future gate** — not implemented, not promised.

## TODOs for future user-initiated preview design

- Define the user-initiated, single-shot, metadata-labeled preview flow (explicit tap → warning → optional fetch through an approved, IP-protecting transport).
- `Referrer-Policy: no-referrer` + strict CSP in a future self-hosted app/docs deployment.
- Avatar-as-capsule-content model (Identity/CapsuleNet gates).
- Consider a local-only, offline "link card" that shows classification (domain, scheme) with zero fetch.
