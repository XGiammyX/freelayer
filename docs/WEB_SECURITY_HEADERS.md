# Web Security Headers (recommended)

[← Docs Index](README.md) · [Network Model](NETWORK_MODEL.md) · [No External Assets Policy](NO_EXTERNAL_ASSETS_POLICY.md)

> [!NOTE]
> These headers are **defense-in-depth**, not a replacement for FreeLayer's code guardrails and policy engines. They depend on the deployment context (static host, dev server, future self-hosted app). Nothing here is deployed yet — there is no hosting config in this repo. This document records the target so a future deployment gets it right.

## Why

FreeLayer's default build already ships zero remote assets and makes no network calls (enforced by `check-no-external-assets`, `check-build-zero-egress`, `check-no-forbidden-network`, and AST ESLint bans). Strict headers add a second, browser-enforced layer: even if a remote-asset regression slipped past the scanners, the browser would refuse the request.

## Recommended headers

```
Content-Security-Policy:
  default-src 'self';
  connect-src 'none';
  img-src 'self' data:;
  font-src 'self';
  script-src 'self';
  style-src 'self';
  object-src 'none';
  frame-src 'none';
  base-uri 'none';
  form-action 'none';

Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
X-Content-Type-Options: nosniff
```

## Honest notes

- **CSP is not absolute.** It reduces risk; it does not replace policy/guardrails. `img-src 'self' data:` permits inline data-URI images (bundled, local) but no remote hosts; tighten to `'self'` if data URIs are unnecessary.
- **`connect-src 'none'`** matches the current zero-egress default. When an approved transport is eventually designed (Gate D / Phase 4), it must scope `connect-src` to exactly that endpoint — never broaden it to `*`.
- **`Referrer-Policy: no-referrer`** is required for any future external navigation so a click never leaks the origin/path/query or room/message context. FreeLayer does not auto-fetch URLs today, so no referrer is emitted.
- **`frame-src 'none'` / `object-src 'none'`** block iframes/plugins (an external-asset and clickjacking surface).
- **Dev servers** may need relaxations (HMR websockets). Any relaxation must be documented and must not ship to production.

## Current status

- The web shell (`apps/web`) ships local-only assets with a strict content model already; formal header emission is a **future deployment task** (tracked in [ROADMAP.md](ROADMAP.md) hardening phases).
- This file is the reference; verify/update it when a hosting config is added.
