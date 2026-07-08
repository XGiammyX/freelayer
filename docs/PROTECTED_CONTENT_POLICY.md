# Protected Content Policy

## Purpose

Lock the architecture rule that makes endpoint defense enforceable rather than aspirational:

> **Sensitive content must be rendered only through approved protected rendering surfaces.**

A privacy model that encrypts perfectly and then hands plaintext to any `<p>` tag has no endpoint model at all. This document defines the future `ProtectedContent` contract — the rendering equivalent of the storage write barrier (ADR-0005): one lawful path, policy-checked, no exceptions.

## Current status

**Design only.** No component exists; no UI renders sensitive content today (there is no product UI). This contract is a Gate K deliverable and binds all future UI work (ADR-0012).

## ProtectedContent contract

Future sensitive UI must use a component/interface equivalent to:

```tsx
<ProtectedContent
  contentRef={...}
  dataClass="message|document|file|secret|room_memory"
  screenShieldLevel="standard|protected|sealed|bunker"
  policyDecision={...}
/>
```

Key contract properties:

- **`contentRef`, not content**: the component receives a reference and resolves plaintext internally through core — sensitive text never travels through ordinary props where any parent can log or copy it.
- **`policyDecision` required**: rendering sensitive content is a side effect; like storage and transports, the surface rejects calls without a valid `PolicyDecision` (ADR-0002).
- **`screenShieldLevel`** binds the surface to [SCREENSHIELD.md](SCREENSHIELD.md) semantics, resolved strictest-wins with device mode and room policy.

The ProtectedContent layer is responsible for:

- Reveal policy (redacted-by-default, tap/hold-to-view, time-limited reveal)
- Redaction rendering (placeholder, blur, panic state)
- Copy restrictions (Clipboard Firewall integration)
- Screen capture response (redact on capture-detected; require secure surface where supported)
- Auto-redact on blur/focus loss
- Task switcher behavior (snapshot redaction coordination)
- Accessibility label policy (what screen readers may receive — see trade-offs below)
- AI exposure policy (protected content is invisible to AI unless policy explicitly allows)
- Cache policy (no thumbnails/previews beyond what storage policy permits)
- Watermark/canary rendering when enabled
- Audit event generation (redacted, local-only)

## Forbidden pattern

```tsx
<p>{message.text}</p>
```

— for sensitive content, this is a defect, not a style choice. Direct rendering of sensitive fields through raw text nodes, `innerHTML`, string interpolation into generic components, or logging is rejected in review and, later, by lint.

**Future lint rules must detect direct rendering of sensitive fields** — direction: sensitive data classes carry branded types (like `SensitiveString` in `@freelayer/security`) that generic render paths cannot accept without an explicit, greppable unwrap.

## Required future tests

- Direct sensitive text rendering is forbidden (lint rule + a runtime canary test)
- ProtectedContent requires a `PolicyDecision` (rejects without one)
- ProtectedContent respects the resolved ScreenShield level
- ProtectedContent redacts by default in Bunker/Ghost
- ProtectedContent disables copy when policy requires
- ProtectedContent does not expose sensitive text to accessibility APIs unless policy allows it

## Accessibility trade-off warning

Screen readers need accessibility text; a surface that hides content from capture APIs may also hide it from assistive technology. **Some high-security modes may reduce accessibility.** This is documented honestly, decided deliberately, and user-controllable where possible — the full analysis lives in [ACCESSIBILITY_PRIVACY_TRADEOFFS.md](ACCESSIBILITY_PRIVACY_TRADEOFFS.md). The `allowAccessibilityExposure` policy field ([PRIVACY_MODEL.md](PRIVACY_MODEL.md)) makes the choice explicit and policy-controlled rather than an accident of implementation.

## TODO

- [ ] ProtectedContent rendering contract spec (TECH-EDL-03)
- [ ] Branded-type design so raw rendering fails the type checker where feasible
- [ ] Lint rule design (extends the mechanical guardrails)
- [ ] Accessibility exposure policy design with real assistive-technology testing
