# PWA / Service Worker Network Audit (TECH-09)

_Date: 2026-07-09_

## Finding: no service worker exists

The `apps/web` shell registers **no service worker**, ships **no PWA manifest**, and imports no PWA plugin. Verified:

- `grep -r "serviceWorker" apps/` — no `navigator.serviceWorker.register` anywhere (the only matches are in the forbidden-network guardrail token list and the zero-egress trap, both tooling).
- No `vite-plugin-pwa`, `workbox`, or manifest in `apps/web` config or `package.json`.
- The build output (`apps/web/dist`) contains `index.html` + local hashed `assets/*.js|*.css` only — no `sw.js`, no `manifest.webmanifest`.

## Consequences

- No service-worker network fetching or remote pre-caching can occur, because none is registered.
- The forbidden-network guardrail includes `serviceWorker.register` as a forbidden token, so adding one is a review-blocking event.
- The zero-egress runtime trap patches `navigator.serviceWorker.register`; any future accidental registration in a test path fails immediately.

## TODO (future PWA hardening)

When a service worker is genuinely needed (offline shell caching), it must:

1. Cache only **local, same-origin** assets — never remote resources.
2. Never intercept or perform remote `fetch`.
3. Be gated by a policy/ADR and enumerated in [PBOM.md](../PBOM.md).
4. Have its own zero-egress test (Workbox/route assertions).

Filed as part of **Phase 9 — Desktop/PWA hardening** ([ROADMAP.md](../ROADMAP.md)). Do not add a service worker before then.
