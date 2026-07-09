# Zero-Egress Research (TECH-09)

_Date: 2026-07-09 · Sources verified online during this pass (building on [NETWORK_POLICY_RESEARCH.md](NETWORK_POLICY_RESEARCH.md), TECH-08)._

## Sources reviewed

- OWASP MAS — [MASVS-NETWORK](https://mas.owasp.org/MASVS/08-MASVS-NETWORK/), [Testing Network Communication](https://mas.owasp.org/MASTG/0x04f-Testing-Network-Communication/)
- MDN — browser egress APIs: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `RTCPeerConnection`, `navigator.sendBeacon`, Service Worker / CacheStorage, `<link rel=preconnect/dns-prefetch/preload>`
- Vite — production build output shape (hashed `assets/*.js|*.css`, `index.html` with local module/link refs)
- Tauri v2 — [capabilities](https://v2.tauri.app/security/capabilities/), [HTTP client plugin](https://v2.tauri.app/plugin/http-client/) (deny-by-default)

## Findings and FreeLayer implications

### Static-only network checks are insufficient (OWASP)

**Finding:** MASVS/MASTG verify network behavior by *observing traffic*, not by trusting source — static checks miss runtime behavior and vice versa.
**Implication:** TECH-09 combines four independent layers — static source scan, built-artifact scan, runtime trap, and dependency scan — rather than relying on any one.

### Minified framework bundles contain dormant egress tokens

**Finding (verified in our own build):** the React DOM production bundle embeds `fetch(`, `createElement('script')`, and `.src=` for its resource/preload/RSC APIs, plus URL **strings** for `www.w3.org` (namespaces) and `react.dev` (error links). These do not execute unless the app opts in (`ReactDOM.preload`, remote `<img>`/`<script>`/`<link>`, etc.).
**Implication:** **token-scanning minified JS for `fetch(` is not a valid egress signal** — it would flag every React app falsely. Zero-egress-on-load is instead proven by (a) a **runtime trap** (no network API fires when FreeLayer's load-path code runs), (b) scanning **authored HTML/CSS** (small, unobfuscated) for remote assets, and (c) a remote-**host allowlist** applied to all URL strings.

### Browser egress surface

**Finding:** beyond `fetch`/XHR, egress happens via WebSocket/EventSource (persistent channels), WebRTC (IP leak), `sendBeacon` (telemetry), service workers (fetch/cache), and markup-driven remote assets (`src`/`href`/`url()`/`@import`/`preconnect`/font URLs).
**Implication:** the runtime trap covers the JS APIs (including `serviceWorker.register` and `Image`); the remote-asset scanner covers markup; the build scanner covers hosts. No service worker exists ([PWA audit](../audits/PWA_SERVICE_WORKER_NETWORK_AUDIT.md)).

### App runtime vs development/CI egress

**Finding:** `pnpm install` contacts the npm registry; GitHub Actions, CodeQL, dependency review, and Dependabot are GitHub-side infrastructure.
**Implication:** the **zero-egress claim is about the built app's runtime**, not development tooling. PBOM and Trust Center document the two separately; the GitHub Actions egress audit lists exactly what CI contacts (GitHub-only, no third-party upload).

### Playwright / browser-level verification

**Finding:** Playwright can block all routes and fail on any request — the gold standard for built-app egress verification.
**Implication:** Playwright is **not currently a project dependency**; adding a browser-automation stack is out of TECH-09 scope. A lightweight equivalent (runtime trap over the FreeLayer load path + HTML/CSS/host scans) ships now; full browser E2E is filed as **AUDIT-HARD — Browser-level zero-egress E2E**.

## Decisions made for TECH-09

1. **Host allowlist, not token purity.** Build artifacts may contain benign URL strings; the guarantee is "no remote host outside the allowlist, and no automatic-egress markup." Allowlist: `github.com` (navigation anchors, user-initiated), `www.w3.org` (framework namespace constants), `react.dev` (framework error-message links). Every other remote host fails.
2. **Runtime trap over the FreeLayer load path** (SDK client + NetworkPolicy + transports) proves FreeLayer's own code makes no calls. Full React-DOM render trapping needs a DOM env (jsdom/Playwright) — deferred to AUDIT-HARD.
3. **Do not token-scan minified JS for `fetch(`** — documented as framework-inherent noise; report it would be dishonest.
4. Sentinel `FREELAYER_ZERO_EGRESS_SENTINEL_DO_NOT_CALL` and fake endpoint `https://freelayer.invalid/should-never-be-called` (`.invalid` TLD, never resolvable) for tests.

## What can be tested now

Authored HTML/CSS have zero remote assets; the built bundle contains no remote host outside the allowlist; FreeLayer's runtime load path calls no network API (trap, positive-controlled); no network-client/analytics/AI dependency exists; no service worker exists; CI contacts only GitHub.

## What requires future automation / cannot be guaranteed

Full in-browser render egress (Playwright — AUDIT-HARD); desktop WebView egress (Tauri, future); and — always outside application control — the OS, browser, extensions, package manager, GitHub infrastructure, and the user's network stack.

## TODOs

- AUDIT-HARD: Playwright zero-egress E2E over the served build.
- Tauri desktop egress test strategy when the shell exists.
- CI-side network isolation (egress-blocked runners) — Phase 10.
