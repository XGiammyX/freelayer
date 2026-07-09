# TECH-09 Threat Model — Zero-Egress Default Build

_Scope: the built FreeLayer app's **runtime egress** and the repository's authored surface. TECH-09 can verify the default app build and source; it cannot guarantee the OS, browser, extensions, package manager, GitHub Actions infrastructure, the user's network stack, or future dependencies never perform network activity._

## Runtime egress threats

`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `RTCPeerConnection`/`RTCDataChannel`, `sendBeacon`, service-worker fetches, remote image/font/script loading, CSS remote `url()`/`@import`, `<link rel=preconnect/dns-prefetch/preload>` to remote hosts, remote source maps, remote AI, telemetry, crash reporting, automatic update checks, analytics SDKs.
**Controls:** runtime zero-egress trap (JS APIs incl. `serviceWorker.register`/`Image`); remote-asset scanner over authored HTML/CSS/TS; NetworkPolicy default-deny (TECH-08).

## Build artifact threats

Bundled endpoint strings, remote URLs in JS/CSS/HTML, source maps with endpoints, dependency-bundled analytics, default assets loading remote URLs, imported CSS referencing remote fonts.
**Controls:** build zero-egress scanner — remote-**host allowlist** ({github.com, www.w3.org, react.dev}) over all dist files, remote-asset markup scan of dist HTML/CSS, analytics/telemetry host denylist. Honest note: minified framework bundles contain dormant `fetch(`/`createElement('script')`; these are not egress and are not treated as findings (the runtime trap is the real check).

## Test / CI threats

Tests reaching the internet, snapshots with endpoints, CI uploading to third parties, coverage upload, dependency postinstall network calls, over-broad Actions permissions.
**Controls:** runtime trap fails any test touching a network API; GitHub Actions egress audit (GitHub-only, least privilege, no third-party upload); dependency network-client scan; install-script review (dependency policy).

## Policy bypass threats

Feature calls network before a policy check; app imports a network provider directly; policy says deny but runtime still calls an API; a mock transport replaced by a real API; a service worker bypassing core policy; markup loading a remote asset outside TypeScript.
**Controls:** import boundaries (apps can't reach transports), forbidden-network source scan, NetworkPolicy barrier, remote-asset scan of markup, no service worker present.

## Limits

TECH-09 verifies the default app build and repository source. It is an **application-behavior + build-artifact guarantee**, not a promise about the OS, browser, extensions, package manager, GitHub infrastructure, or future dependencies. Full in-browser render egress and desktop WebView egress are future automation (AUDIT-HARD / Tauri phase).
