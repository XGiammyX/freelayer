# @freelayer/web

**Status: minimal local-only shell implemented — static status page (React + Vite), strict CSP, zero external assets, no network calls, no storage.**

React + Vite client, PWA-capable. The primary user-facing app.

Constraints from day one:

- Zero external assets (no CDN scripts, remote fonts, remote images) — hard constraint.
- Strict Content Security Policy.
- Offline-first; no required backend.
- All privacy behavior delegated to `@freelayer/core` policy engine — never implemented in UI.

See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
