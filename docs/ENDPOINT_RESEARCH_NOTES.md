# Endpoint Defense — Research Notes (RESEARCH-EDL-01)

## Purpose

Sources and findings behind the Endpoint Defense Layer documents. Summaries are in our own words; each entry lists the finding, the FreeLayer implication, and remaining uncertainty. Research date: 2026-07.

## Android

- **Source:** Android Developers — window security / `FLAG_SECURE`; fraud-prevention guidance ("Secure sensitive activities").
  **Finding:** `FLAG_SECURE` marks a window's content as excluded from screenshots and from display on non-secure displays (also blanking recents thumbnails); Compose/SurfaceView equivalents exist (`setSecure`, `SecureFlagPolicy`).
  **Implication:** the primary Android mechanism for Protected View/Sealed surfaces.
  **Uncertainty:** exact behavior across OEM skins and multi-display setups — verify at implementation (TODO).
- **Source:** Android Developers — Android 14 screenshot detection (`registerScreenCaptureCallback`).
  **Finding:** per-activity callback when the user takes a hardware-combo screenshot; no image provided; does not fire for ADB/instrumentation captures.
  **Implication:** useful for warning/audit/redaction; **must not replace prevention**.
  **Uncertainty:** coverage of third-party capture apps — assume not covered.
- **Source:** OWASP MASTG — overlay attacks (MASTG-TEST-0035).
  **Finding:** tapjacking via overlays remains a live attack class; touch filtering is the standard mitigation.
  **Implication:** Anti-Overlay Guard required on sensitive actions (reveal, send, wipe).

## iOS / iPadOS

- **Source:** Apple Developer — `UIScreen.isCaptured` / `capturedDidChangeNotification`.
  **Finding:** reports **ongoing** recording/mirroring/AirPlay as a state; apps redact while true.
  **Implication:** capture-aware redaction is the iOS backbone.
- **Source:** Apple Developer / community analyses — `userDidTakeScreenshotNotification`.
  **Finding:** fires **after** the screenshot; no prevention API exists.
  **Implication:** **FreeLayer must never claim screenshot prevention on iOS**; after-the-fact warning/audit only.
- **Source:** community engineering write-ups (secure text entry rendering trick).
  **Finding:** content hosted in a secure-entry field's layer is typically blanked in screenshots — an **undocumented behavior**, not an API contract.
  **Implication:** best-effort hardening at most; never load-bearing. **Uncertainty:** can break in any iOS release (TODO re-verify per release).
- **Source:** OWASP MASTG (iOS) — keyboard cache (MASTG-TEST-0055), auto-generated screenshots (MASTG-TEST-0059).
  **Finding:** app-switcher snapshots and predictive-text caches are standard leak paths; mitigations: snapshot redaction on backgrounding, `autocorrectionType = .no`-class flags.
  **Implication:** Secure Input Firewall + task-switcher redaction requirements.

## Windows

- **Source:** Microsoft Learn — `SetWindowDisplayAffinity` (winuser.h).
  **Finding:** `WDA_EXCLUDEFROMCAPTURE` (Windows 10 2004 / build 19041+) removes the window from capture output; `WDA_MONITOR` (Win7+) is the older, weaker mode. Return value must be checked.
  **Implication:** Protected Window direction for the desktop shell; **failed call or old OS ⇒ display lower assurance**. Also the relevant control against Recall-class OS screenshotting (per Microsoft ecosystem guidance on excluding apps from capture/Recall).
  **Uncertainty:** interaction with specific capture stacks (DWM changes, DRM paths, remote-desktop pipelines) — per-version verification needed; capture *detection* on Windows has no clean public API (research).

## macOS

- **Source:** Apple Developer — ScreenCaptureKit; macOS screen-recording permission model.
  **Finding:** capture is OS-mediated with per-app permission (with periodic re-consent in recent releases); app-controlled *prevention* of authorized capture is limited (`NSWindow.sharingType` has narrow/caveated semantics).
  **Implication:** macOS is **lower assurance** than Android/Windows: rely on redaction, warnings, limited protected surfaces; no full-prevention claims.
  **Uncertainty:** whether apps can reliably detect active third-party capture — research required (TECH-EDL-04).

## Linux

- **Finding (general platform knowledge, to verify per target):** X11 lets any client read the screen; Wayland routes capture through compositor portals with per-compositor behavior.
  **Implication:** assurance is `platform dependent`; report per-session honestly.
  **Uncertainty:** entire area is **research required** before any Linux claim.

## Web / PWA

- **Source:** W3C/MDN — Screen Capture API (`getDisplayMedia`); Chrome extension capabilities (tabCapture, debugger).
  **Finding:** pages capture displays only via user-gesture + picker, but the page cannot detect or block OS screenshots; extensions can read the DOM or capture tabs invisibly to the page.
  **Implication:** **PWA is low-assurance for sensitive content**: Bunker/Ghost-Vault not fully available on web; recovery-phrase display and protected documents restricted; permanent low-assurance labeling.

## OWASP / mobile security alignment

- **Sources:** OWASP MASTG/MASWE — MASWE-0055 (screenshot/recording leakage), MASTG-BEST-0014 (preventing screenshots/recording), MASTG-TEST-0010/0059 (auto-generated screenshots), MASTG-TEST-0055 (keyboard cache), MASTG-TEST-0035 (overlays), clipboard/pasteboard guidance, sensitive-data-in-logs guidance.
  **Alignment:** the Endpoint Defense controls map 1:1 onto MASVS-PLATFORM/STORAGE expectations (FLAG_SECURE-class protection, snapshot redaction, keyboard-cache opt-out, tapjacking touch filtering, no plaintext logs). FreeLayer's addition is making these **policy-enforced through core** rather than per-screen developer discipline.

## Spyware / compromised endpoints

- **Finding (consensus across OWASP device-compromise guidance and platform threat models):** keyloggers, screen recorders, accessibility-service abuse, root/jailbreak/kernel malware, and remote-access tools operate below or beside app-level controls; detection is unreliable and adversarial.
  **Implication:** **ScreenShield reduces exposure but cannot secure a compromised endpoint** — stated in every user-facing surface and in [THREAT_MODEL.md](THREAT_MODEL.md). Root/jailbreak detection, if ever added, is advisory-only.

## Browser extensions

- **Finding:** extensions with host permissions read/modify the DOM; capture-capable extension APIs exist; pages cannot enumerate or exclude them.
  **Implication:** web sensitive views assume extension presence; Device Risk floor for web is `medium`+.

## AI GUI agents / screenshot exposure

- **Finding:** OS- and app-level AI agents that observe the screen (assistant screenshots, GUI automation, Recall-class recording) are proliferating; they are functionally screen capture with a different name.
  **Implication:** treated as a first-class capture threat: capture-exclusion where available, capture-aware redaction elsewhere, explicit user education that pasting/screenshotting protected content into external AI tools is out of FreeLayer's control ([LOCAL_AI.md](LOCAL_AI.md)).

## Open questions

- Unified cross-platform `CaptureState` semantics (state vs. event).
- Windows capture detection; macOS third-party capture detection.
- Linux portal behavior matrix.
- Root/jailbreak advisory signals: include or skip.
- Watermark/canary efficacy vs. metadata and UX cost.

## Implementation risks

- Platform APIs shift (iOS behaviors are partly undocumented; Windows affinity semantics change across builds) — re-verify at each Gate K platform milestone.
- Protection theater: a wrapper that claims protection without checking results is worse than nothing — hence the honest-capability-reporting rule.
- Accessibility regressions ([ACCESSIBILITY_PRIVACY_TRADEOFFS.md](ACCESSIBILITY_PRIVACY_TRADEOFFS.md)).

## Primary sources

- <https://developer.android.com/about/versions/14/features/screenshot-detection>
- <https://developer.android.com/security/fraud-prevention/activities>
- <https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity>
- <https://developer.apple.com/documentation/uikit/uiscreen/iscaptured>
- <https://mas.owasp.org/MASTG/best-practices/MASTG-BEST-0014/>
- <https://mas.owasp.org/MASWE/MASVS-PLATFORM/MASWE-0055/>
- <https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0035/>
- <https://mas.owasp.org/MASTG/tests/ios/MASVS-STORAGE/MASTG-TEST-0055/>
- <https://mas.owasp.org/MASTG/tests/ios/MASVS-PLATFORM/MASTG-TEST-0059/>
