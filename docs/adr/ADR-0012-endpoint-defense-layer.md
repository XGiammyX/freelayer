# ADR-0012: Endpoint Defense Layer / ScreenShield

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

FreeLayer's existing models protect data in transit (CapsuleNet), at rest (Storage Policy), in metadata (Metadata Firewall), in identity (Identity Firewall), in rooms (Sovereign Rooms), and in AI (AI Privacy Guard). None of them says anything about the moment that actually matters to an attacker with endpoint access: **after decryption, while content is rendered, copied, typed, previewed, or cached**. Screenshots, screen recording, capture-happy OS features (Recall-class), clipboard readers, predictive keyboards, task-switcher thumbnails, overlays, browser extensions, and screen-observing AI agents all operate in that gap. A privacy platform that stops modeling at the render boundary has an incomplete threat model.

## Decision

**FreeLayer adopts the Endpoint Defense Layer, with ScreenShield as its user-facing system, as an official architecture pillar.** Binding elements:

1. **No absolute claims.** Endpoint defense is **harm reduction and exposure minimization**. FreeLayer never claims screenshot-proof, recording-proof, or spyware-proof content — a compromised endpoint exposes plaintext, stated everywhere ([ENDPOINT_DEFENSE_MODEL.md](../ENDPOINT_DEFENSE_MODEL.md)).
2. **Sensitive content renders only through ProtectedContent** (or an equivalent policy-controlled surface). Direct rendering of sensitive fields is a defect, enforced by review now and lint later ([PROTECTED_CONTENT_POLICY.md](../PROTECTED_CONTENT_POLICY.md)).
3. **Platform protections must report capabilities honestly.** Adapters report `protected/degraded/unavailable/failed`; the UI shows real assurance; a failed protection never presents as success ([PLATFORM_LIMITATIONS.md](../PLATFORM_LIMITATIONS.md)).
4. **Web/PWA is lower assurance for sensitive content**, permanently labeled as such; sealed/bunker content is restricted or denied on web per policy.
5. **Ghost/Bunker and ScreenShield consider endpoint exposure**: strictest-wins applies across device mode, room policy, and ScreenShield level; capture-detected states trigger redaction where detectable.
6. ScreenShield levels (`off/standard/protected/sealed/bunker`), the Device Risk Engine, Clipboard/Secure-Input Firewalls, and Anti-Overlay Guard are **core-enforced policy** (ADR-0002), not UI preferences.

## Consequences

- Every future UI phase inherits a rendering constraint before the first screen is built — deliberately cheaper now than retrofitting after a messaging UI exists.
- Platform-specific work (Tauri windows, Android/iOS shells) gains a mandatory capability-reporting layer and per-platform test obligations.
- Some product polish (previews, thumbnails, rich notifications) is constrained by default.
- FreeLayer accepts honest, visible degradation on weak platforms instead of uniform-looking, unequal protection.

## Security impact

- Closes the gap between "encrypted everywhere" and "readable by any screen recorder": capture-exclusion where the platform allows, capture-aware redaction where it only detects, reveal-minimization everywhere.
- Overlay/tapjacking and accessibility-abuse enter the threat model as first-class attack classes on sensitive actions.
- Honest limit, restated: nothing here defends a compromised OS, kernel malware, hardware keyloggers, or a camera aimed at the screen.

## Privacy impact

- Endpoint exposure signals (capture state, reveal timing, clipboard events) are **local-only**: never uploaded, no telemetry (ADR-0008), redacted in audits, storage-policy-governed ([METADATA_MODEL.md](../METADATA_MODEL.md)).
- The leakage surface of *derived* artifacts (thumbnails, previews, reveal history) is bounded by storage policy rules added in this decision ([STORAGE_MODEL.md](../STORAGE_MODEL.md)).

## Accessibility impact

High-security modes can restrict channels assistive technology relies on (accessibility text, clipboard, timers). The trade-offs are documented and policy-controlled — explicit `allowAccessibilityExposure`, accessible alternatives for reveal interactions, honest mode-selection warnings ([ACCESSIBILITY_PRIVACY_TRADEOFFS.md](../ACCESSIBILITY_PRIVACY_TRADEOFFS.md)). Accessibility review is a Gate K exit criterion.

## Platform impact

Per-platform reality ([PLATFORM_LIMITATIONS.md](../PLATFORM_LIMITATIONS.md)): Android strongest (FLAG_SECURE-class), Windows strong on modern builds (WDA_EXCLUDEFROMCAPTURE), iOS detection-plus-redaction (no prevention claims), macOS medium/low pending research, Linux compositor-dependent, web/PWA low. No platform code, permissions, or Tauri capabilities are added by this ADR — design only.

## Implementation gates

All implementation is blocked behind **Gate K** ([IMPLEMENTATION_GATES.md](../IMPLEMENTATION_GATES.md)): design-complete requirements before protected messaging UI, platform-research requirements before platform code, and enforcement/test requirements before any Bunker/protected-content release. ProtectedContent/ScreenShield design **precedes serious messaging UI** (roadmap dependency).

## What would require a new ADR

- Any capture-proof, screenshot-proof, or spyware-proof product claim (forbidden outright; changing that requires superseding this ADR — and should not happen).
- Rendering sensitive content outside ProtectedContent-class surfaces.
- Uploading any endpoint signal (capture events, risk state) off-device.
- Making web/PWA a full-assurance platform for sealed/bunker content.
- Watermarking/canary on by default.
- Weakening the honest-capability-reporting rule.
