# Platform Limitations — Endpoint Defense

## Purpose

Per-platform truth about what ScreenShield can and cannot do. FreeLayer's rule: **the product must show platform capability warnings in UI** — a protection that silently fails is worse than no protection, because it changes user behavior. Sources and details: [ENDPOINT_RESEARCH_NOTES.md](ENDPOINT_RESEARCH_NOTES.md).

## Current status

Research-stage assessment (2026-07). Statuses will be re-verified per platform at implementation time (Gate K), and adapters must **report capabilities honestly at runtime** — a failed protection call downgrades assurance visibly.

## Capability matrix

Statuses: `supported` · `partially supported` · `unsupported` · `research required` · `platform dependent`

| Platform | Screenshot blocking | Capture detection | Task switcher redaction | Secure input | Clipboard control | Assurance |
| --- | --- | --- | --- | --- | --- | --- |
| Windows desktop | partially supported (`WDA_EXCLUDEFROMCAPTURE`, Win10 2004+) | research required | platform dependent | partially supported | supported (app-side) | medium/high on modern Windows |
| macOS desktop | partially supported (`sharingType`-class; limited) | research required (ScreenCaptureKit ecosystem) | research required | partially supported | supported (app-side) | medium/low — research |
| Linux desktop | platform dependent (compositor/session) | research required | platform dependent | research required | supported (app-side) | research required |
| Android | supported direction (`FLAG_SECURE`) | partially supported (Android 14+ screenshot callback; hardware-combo only) | supported (FLAG_SECURE covers recents) | supported direction (input flags) | supported (app-side; OS clipboard readable by focused apps) | high-ish **if OS not compromised** |
| iOS / iPadOS | unsupported as guarantee (detection-based redaction instead) | supported (`UIScreen.isCaptured` for recording/mirroring/AirPlay; screenshot notification is after-the-fact) | supported direction (app-switcher snapshot redaction) | supported direction (secure text entry, autocorrect off) | supported (app-side; pasteboard rules apply) | medium |
| Web / PWA | unsupported | unsupported (page cannot see OS capture) | unsupported | partially supported (autocomplete hints only) | partially supported (page-side only) | **low for sensitive views** |

## Per-platform direction

### Android
- `FLAG_SECURE` (and `setSecure`/Compose secure policies) is the direction for Protected View / ScreenShield surfaces: blocks screenshots, recording, and display on non-secure displays, and blanks recents thumbnails.
- Android 14+ screenshot-detection callback is useful for **warning/audit/redaction — never as a replacement for prevention** (it detects only hardware-combo screenshots, provides no image, and misses ADB/instrumentation captures).
- Overlay/tapjacking mitigations (touch filtering per OWASP MASTG) are **required** for sensitive actions.
- Assurance is high-ish only on an uncompromised OS; root malware defeats all of it.

### iOS / iPadOS
- `UIScreen.isCaptured` + `capturedDidChangeNotification` detect **ongoing** recording/mirroring/AirPlay → Protected View must redact while captured.
- Screenshot notification fires **after** the capture — usable for audit/warning only. **FreeLayer must not claim screenshot prevention on iOS.** The secure-text-entry rendering trick is an undocumented behavior, not a guarantee — treated as best-effort hardening at most, never relied on.
- App-switcher snapshot redaction (replace content on backgrounding) is the direction for task-switcher exposure.
- Pasteboard and keyboard-cache mitigations per OWASP (autocorrect off on sensitive fields, pasteboard restrictions).

### Windows
- `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` (Windows 10 2004/build 19041+) excludes protected windows from capture APIs — also relevant against Recall-class OS screenshotting. `WDA_MONITOR` exists since Windows 7 with weaker semantics.
- **Must check the call's return and OS version**: unsupported version or failure ⇒ display lower assurance, never assume protection.
- Protected Window state ties directly to ScreenShield levels; capture-detection on Windows is research (no clean public signal).

### macOS
- Lower assurance than Android/Windows: app-controlled capture *prevention* is limited (`NSWindow.sharingType`-class controls have caveats); the OS mediates recording via ScreenCaptureKit and per-app screen-recording permissions, which protect against unauthorized apps but not authorized/user-approved capture.
- Direction: redaction, warnings, and limited protected surfaces; **do not claim full capture prevention**. Detection/redaction pathways: research required.

### Linux
- Highly variable: Wayland compositors mediate capture through portals (per-compositor behavior); X11 effectively allows any client to read the screen. Assurance: research required, likely `platform dependent` forever — reported honestly per session type.

### Web / PWA
- **Low assurance for sensitive content, structurally.** The page cannot block or detect OS screenshots; `getDisplayMedia` gives pages capture only via user consent, but browser extensions (tabCapture/debugger-class APIs, DOM access) are invisible to the page and cannot be excluded.
- Consequences: Bunker/Ghost-Vault-class features are **not fully available** on web; recovery-phrase display and protected documents are restricted on web unless explicitly designed with the low-assurance warning; sealed content may be denied entirely per policy.

## Standing rule

Adapters report what they actually achieved (`protected`, `degraded`, `unavailable`, `failed`) — and the UI shows it. Overstating platform protection is treated as a security defect.
