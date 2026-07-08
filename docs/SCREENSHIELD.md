# ScreenShield

[← Docs Index](README.md) · [Endpoint Defense Model](ENDPOINT_DEFENSE_MODEL.md) · [Platform Limitations](PLATFORM_LIMITATIONS.md) · [Accessibility trade-offs](ACCESSIBILITY_PRIVACY_TRADEOFFS.md)

> [!NOTE]
> Design only — no protection level is implemented (Gate K). Where a platform cannot protect, ScreenShield's rule is to say so honestly rather than pretend.

## Definition

**ScreenShield is the user-facing endpoint protection system for sensitive rooms, messages, files and documents.** It packages the Endpoint Defense controls ([ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md)) into levels a person can understand, choose, and trust — with the platform's real capabilities reported honestly rather than implied.

## Current status

**Design only.** No implementation; blocked by Gate K ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)).

## ScreenShield levels

```text
off · standard · protected · sealed · bunker
```

Levels participate in the policy conflict rule: **strictest wins** across device mode, room policy, and ScreenShield level ([PRIVACY_MODEL.md](PRIVACY_MODEL.md)).

### off

- Normal rendering.
- Still no telemetry, no external assets, no automatic link previews — the hard constraints never turn off.

### standard

- Normal private defaults.
- Notification previews policy-controlled.
- No automatic external assets (always true project-wide).

### protected

- Screenshot/capture protection engaged **where the platform supports it** (FLAG_SECURE-class, display-affinity-class); honest downgrade warning where it doesn't.
- Clipboard restrictions (deny or expiring copy, per policy).
- Task switcher redaction.
- No AI exposure by default; explicit per-room opt-in required.
- Sensitive messages redacted until user action (tap to reveal).

### sealed

- **Hold-to-view** and/or **time-limited reveal**.
- Auto-redact on focus loss.
- No clipboard. No AI. No caches (previews, thumbnails).
- Protected platform surface required where available; explicit low-assurance warning where not.

### bunker

- Everything in sealed, plus:
- Memory-only/no-persistence storage from the active mode (write barrier, ADR-0005).
- No direct transport (network policy).
- Redact while screen sharing/recording is detectable; deny reveal where policy says so.
- **Web/PWA is not high assurance** — bunker content on web is restricted or denied ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md)).
- Platform capability warnings always visible.

## UX patterns

- **Hold to reveal** — content visible only while pressed.
- **Tap to reveal for a limited time** — with a visible countdown.
- **Section-by-section document viewing** — only the section in focus is rendered; the rest stays redacted (reduces single-capture blast radius).
- **Redacted room preview** — room lists and previews never show protected plaintext.
- **Panic blur** — one gesture redacts everything instantly.
- **Capture-detected overlay** — when recording/mirroring is detected, protected content redacts and an overlay says why.
- **Device risk warning** — surfaced before reveal when the Device Risk Engine reports elevated risk ([DEVICE_RISK_MODEL.md](DEVICE_RISK_MODEL.md)).
- **Watermark / leak canary (optional)** — subtle per-reveal marking, policy-controlled, never silently enabled.

## Honest limitation language (user-facing examples)

> "ScreenShield reduces capture risk on this platform. It cannot protect against a compromised device or an external camera."

> "This platform cannot fully block screenshots. FreeLayer will redact when capture is detected where possible."

> "Web mode is lower assurance than desktop/mobile protected surfaces."

These sentences (or equivalents) are **required product copy** wherever ScreenShield levels are chosen or protected content is revealed. Marketing language that implies capture-proof content is forbidden (ADR-0012, project wording rules).

## Enforcement

ScreenShield levels are **policy objects evaluated by core** (ADR-0002): the Clipboard Firewall denies at the policy layer, not by hiding a button; AI exposure is denied by AIPolicy, not by UI convention; rendering goes through ProtectedContent or it does not happen ([PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md)).

## Required future tests

Inherited from [ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md) — levels map to testable invariants (e.g. "sealed ⇒ clipboard denied", "bunker + web ⇒ reveal denied or warned per policy").

## TODO

- [ ] Policy schema for levels (TECH-EDL-02)
- [ ] Reveal-timer and hold-to-view interaction design with accessibility review ([ACCESSIBILITY_PRIVACY_TRADEOFFS.md](ACCESSIBILITY_PRIVACY_TRADEOFFS.md))
- [ ] Capture-detected overlay UX
- [ ] Watermark/canary design decision (default-off, per-room opt-in)
