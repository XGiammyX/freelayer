# TECH-09 Zero-Egress Audit

_Date: 2026-07-09 · Branch: `tech/zero-egress-default-build-tests` (from `daae3a7`)_

## Verdict

**TECH-09: COMPLETE.** All acceptance criteria met; 168/168 tests green; all local checks pass.

## Commands run

`pnpm install/typecheck/lint/test/build` + `check:boundaries` + `check:no-external-assets` + `check:no-telemetry` + `check:no-forbidden-storage` + `check:no-forbidden-network` + **`check:no-network-deps`** (new) + **`check:build-zero-egress`** (new, after build) + `check:doc-links` + `audit:privacy` + `audit:supply-chain` — **all PASS**.

## Research summary

Static-only checks are insufficient (OWASP) → four layers. Minified React DOM contains dormant `fetch(`/`createElement('script')` and benign URL strings (`www.w3.org`, `react.dev`) → token-scanning minified JS is invalid; the guarantee is a remote-**host allowlist** + runtime trap + authored-markup scan. App-runtime egress is distinct from dev/CI egress. Full: [research/ZERO_EGRESS_RESEARCH.md](../research/ZERO_EGRESS_RESEARCH.md).

## Coverage

| Layer | Status | Notes |
| --- | --- | --- |
| Static source scan | ✅ | `check-no-forbidden-network` — API/import tokens, `http:`, `ws(s):`, node/client libs, Tauri HTTP + remote-host allowlist (github.com nav reported). `--build`/`--all` modes added. |
| Build artifact scan | ✅ | `check-build-zero-egress` — remote-host allowlist ({github.com, www.w3.org, react.dev}), remote-asset markup in dist HTML/CSS, analytics/AI host denylist. Real `apps/web/dist`: clean. |
| Runtime trap | ✅ | `createZeroEgressRuntimeTrap` (fetch/XHR/WebSocket/EventSource/RTC/sendBeacon/serviceWorker.register/Image). FreeLayer load path (SDK + NetworkPolicy + transports) calls nothing; positive controls fire. |
| Remote-asset scan | ✅ | `check-no-external-assets` broadened (preconnect/dns-prefetch/preload/remote favicon/fonts). |
| Dependency scan | ✅ | `check-no-network-deps` — no axios/got/ky/ws/socket.io/Sentry/PostHog/Mixpanel/Segment/Amplitude/Datadog/OpenAI/Anthropic/Firebase/Supabase/Tauri-HTTP anywhere. |
| Service worker audit | ✅ | None exists ([PWA_SERVICE_WORKER_NETWORK_AUDIT.md](PWA_SERVICE_WORKER_NETWORK_AUDIT.md)). |
| GitHub Actions egress audit | ✅ | GitHub-only; no third-party upload/telemetry/deploy ([GITHUB_ACTIONS_EGRESS_AUDIT.md](GITHUB_ACTIONS_EGRESS_AUDIT.md)). |
| Source map / artifact policy | ✅ | Vite default: no `.map` emitted in the production build (verified — dist is `index.html` + `assets/*.js|*.css` only). Scanner covers `.map`/`.json`/`.webmanifest` if present. |
| Sentinel tests | ✅ | `FREELAYER_ZERO_EGRESS_SENTINEL_DO_NOT_CALL` + `https://freelayer.invalid/...` — never called (trap-controlled), caught in the bad-build fixture, absent from the real build. |

## Tests added (11 new → 168 total)

Runtime-load-path no-egress (SDK/policy/transports/denied-op), sentinel-never-called positive control, trap coverage + WebSocket/RTC/Image construction, build-scanner catches the bad fixture, real build clean, no network deps, sentinel absent from real build.

## Known limitations

Application-behavior + build-artifact guarantee, **not** a promise about OS/browser/extensions/package-manager/GitHub infrastructure. Static host-allowlist scan can be evaded by dynamic host construction (AST/runtime is the backstop). Full in-browser render egress needs a DOM env.

## Deferred

- **AUDIT-HARD — Browser-level zero-egress E2E** (Playwright over the served build; not a current dependency).
- Tauri desktop WebView egress test strategy (when the shell exists).
- Egress-blocked CI runners (Phase 10).
