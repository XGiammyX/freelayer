# Endpoint Defense Model

[← Docs Index](README.md) · [ScreenShield](SCREENSHIELD.md) · [Platform Limitations](PLATFORM_LIMITATIONS.md) · [Device Risk](DEVICE_RISK_MODEL.md)

> [!IMPORTANT]
> This layer **reduces** exposure after decryption — screenshots, clipboard, capture, risky devices. It never claims to defeat a compromised device or an external camera, and neither may anything built on it (ADR-0012).

## Purpose

Define FreeLayer's model for protecting sensitive data **after decryption** — while it is displayed, copied, typed, previewed, cached, or otherwise exposed to the local device environment. CapsuleNet protects data in transit and Storage Policy protects data at rest; this model covers **data in use**. The user-facing system built on it is **ScreenShield** ([SCREENSHIELD.md](SCREENSHIELD.md)); the constitutional decision is [ADR-0012](adr/ADR-0012-endpoint-defense-layer.md).

## Current status

**Research/design only.** No platform code is implemented; no Tauri or mobile permissions exist. Everything here is design direction gated behind Gate K ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)).

## Threats covered

- Screenshots (user- or software-initiated)
- Screen recording
- Remote screen sharing (conferencing, remote-support tools)
- Casting / non-secure external displays
- Task switcher / app switcher thumbnails
- Clipboard leakage (copy of sensitive content; clipboard-reading apps)
- Keyboard cache / autocomplete / predictive text learning sensitive input
- Overlay / tapjacking attacks on sensitive actions
- Browser extensions reading the DOM or capturing tabs (web/PWA)
- OS-level capture APIs (including OS features that periodically screenshot the desktop, e.g. Recall-class features)
- Local logs and crash reports capturing rendered content
- Local AI/GUI agents that observe screen contents
- OCR tools run over captures
- Shoulder surfing
- A camera pointed at the screen (mitigated only by reveal-minimization patterns, never solved)

## Threats not fully solvable

Stated plainly, because pretending otherwise would be a lie:

- A **compromised OS** — plaintext on a compromised device is exposed, period.
- **Root/jailbreak malware** and **kernel-level spyware** — can read framebuffers and memory below any app-level control.
- **Hardware keyloggers.**
- **External cameras** photographing the screen.
- **Malicious room members** — they legitimately hold the plaintext and can exfiltrate it by any means.
- A user who **intentionally captures content with a second device**.
- **Advanced forensic access to an unlocked device.**

## Principle

**FreeLayer reduces exposure. It does not guarantee impossible-to-capture content.** Endpoint defense is harm reduction and exposure minimization — fewer channels, shorter reveal windows, honest platform-capability reporting — never a capture-proof claim (consistent with the project-wide no-overclaiming rule).

## Endpoint Defense controls

| Control | Role |
| --- | --- |
| **ScreenShield Mode** | User/room-facing protection levels (off → bunker) governing all endpoint behavior ([SCREENSHIELD.md](SCREENSHIELD.md)) |
| **Protected View / Sealed View** | Rendering surfaces for sensitive content: redaction-first, hold-to-view, time-limited reveal |
| **Capture-Aware Rooms** | Rooms that react to capture state (redact when `isCaptured`-class signals fire; audit locally) |
| **ProtectedContent component** | The only lawful rendering path for sensitive content ([PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md)) |
| **Secure Surface adapters** | Per-platform adapters wrapping FLAG_SECURE / display-affinity / capture-detection APIs, reporting real capabilities honestly ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md)) |
| **Clipboard Firewall** | Policy-gated copy: deny, allow-with-expiry, or allow, per ScreenShield level |
| **Secure Input Firewall** | Sensitive input fields opt out of autocorrect/predictive/keyboard-cache learning where the platform allows |
| **Anti-Overlay/Tapjacking Guard** | Touch-filtering-class defenses on sensitive actions (reveal, send, wipe, key operations) |
| **Device Risk Engine** | Local-only risk assessment feeding policy ([DEVICE_RISK_MODEL.md](DEVICE_RISK_MODEL.md)) |
| **Panic / Auto-Redact / Decoy** | One-gesture blur/redact; auto-redact on focus loss; future decoy surfaces |
| **Leak Canary / Dynamic Watermark** | Optional per-reveal watermarking to make leaked captures attributable (never on by default; policy-controlled) |
| **PWA Low-Assurance Mode** | Web builds honestly labeled low assurance; sealed/bunker content restricted or denied on web |

All controls are **policy-enforced through core** (ADR-0002): a ScreenShield restriction is a `PolicyDecision` outcome, not a UI preference.

## Relationship to the data lifecycle

```text
Data in transit  → CapsuleNet
Data at rest     → Storage Policy
Data in memory/use → Endpoint Defense Layer
Data in UI       → ProtectedContent
Data in rooms    → Sovereign Rooms
Data in AI       → AI Privacy Guard
Data in development → GitHub Trust Pipeline
```

## Required future tests

- Protected content cannot render through raw text components (lint + runtime test)
- ScreenShield policy denies copy at the policy layer (not just missing UI button)
- ScreenShield policy disables AI exposure of protected content
- ScreenShield policy disables caches for protected content
- Ghost/Bunker protected content redacts by default
- Web/PWA shows the low-assurance warning before any protected reveal
- Platform adapters report capabilities honestly (a failed protection call downgrades reported assurance)
- Task switcher redaction tests where the platform supports testing it
- Clipboard guard tests (deny path, expiry path)
- Secure input attribute tests (autocorrect/cache flags present on sensitive fields)
- Overlay/tapjacking sensitive-action tests (touch filtering active where supported)

## Open questions

- Capture-detection semantics differ per platform (ongoing state vs. after-the-fact event) — unified `CaptureState` model needed at Gate K design.
- Watermark/canary: per-reveal uniqueness vs. metadata cost; opt-in semantics per room.
- How Device Risk interacts with Emergency mode (does `critical` auto-trigger panic redact?).

## TODO

- [ ] ScreenShield policy schema (TECH-EDL-02)
- [ ] ProtectedContent rendering contract (TECH-EDL-03)
- [ ] Secure Surface adapter interfaces (TECH-EDL-04)
- [ ] Unified capture-state model across platforms (Gate K design)
