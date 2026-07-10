# TECH-11 — Link Preview / External Asset Threat Model

_Scope: the leakage channels opened by automatic previews and remote assets, and the honest limits of blocking them in-app. Extends [../THREAT_MODEL.md](../THREAT_MODEL.md)._

## Automatic link preview threats

| Threat | Mitigation |
| --- | --- |
| URL fetched without user intent | No automatic preview; `networkFetchAllowed` permanently false |
| IP address leak to target server | No fetch occurs; classifier/policy are pure |
| User-agent / header leak | No request is made |
| DNS leak | No preconnect/dns-prefetch/lookup |
| Open-timing leak (confirms message read) | No fetch → no timing signal |
| Referrer leak (room/message context) | No fetch; future navigation must use `no-referrer` and attach no context |
| Target server learns interest in URL | Nothing is contacted |
| Malicious URL → parser attack | No remote page is parsed; classifier is a pure string parser with no fetch/eval |
| SSRF (if a server-side preview ever existed) | Architecturally impossible — FreeLayer has no backend; documented as forbidden |
| Tracking URL confirms open | No auto-fetch; tracking pixels denied |

## External asset threats

Tracking pixels, remote images/avatars/fonts/scripts/CSS, favicons, OpenGraph images, CSS `url()`, `preconnect`/`dns-prefetch`/`preload`/`prefetch`, mixed content, malicious remote script/style, and asset-request timing as an activity signal. **Mitigation:** `resolveExternalAssetPolicy` denies all 16 kinds in every mode; the hardened `check-no-external-assets` scanner blocks the markup/URLs in source and build; connection hints and tracking pixels are flagged for a user-visible warning; avatars/images must travel as future capsule content.

## Storage / cache threats

Preview cache (URL/title/image), thumbnail cache, favicon cache (browsing interests), avatar cache (contact-graph hints), build artifacts with remote endpoints, and logs/errors containing URLs. **Mitigation:** LinkPreviewPolicy denies all preview/thumbnail/favicon caching; StoragePolicy denies preview_cache/thumbnail_cache in Private+ (agreement tested); build-zero-egress scans the build; URLs are redacted before any log/audit.

## Metadata threats

Exact URL as content-adjacent metadata, domain as a relationship/context clue, preview existence as room activity, click/open timing, navigation referrer, and link-classification results. **Mitigation:** URLs redacted to domain-only display (`renderPlainTextUrlLabel`); MetadataPolicy denies `link.preview` / `asset.remote_fetch` / `avatar.remote_fetch`; audit events carry only classification/kind/mode/reason-code — never the URL.

## Limits (stated plainly)

- FreeLayer blocks automatic preview/asset behavior in **its own code and build** only.
- It cannot control the user's **browser extensions, OS DNS resolver, other apps, or a URL manually copied into another browser** — opening a link externally leaks to that browser and the target site.
- CSP/headers are **defense-in-depth** and depend on deployment context.
- A future **user-initiated** preview is a separate research/design problem with its own leakage trade-offs; it is not solved here.
