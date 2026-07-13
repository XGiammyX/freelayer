# Endpoint Defense Model

[← Docs Index](README.md) · [ScreenShield](SCREENSHIELD.md) · [Platform Limitations](PLATFORM_LIMITATIONS.md) · [Device Risk](DEVICE_RISK_MODEL.md)

> [!IMPORTANT]
> This layer **reduces** exposure after decryption — screenshots, clipboard, capture, risky devices. It never claims to defeat a compromised device or an external camera, and neither may anything built on it (ADR-0012).

## Purpose

Define FreeLayer's model for protecting sensitive data **after decryption** — while it is displayed, copied, typed, previewed, cached, or otherwise exposed to the local device environment. CapsuleNet protects data in transit and Storage Policy protects data at rest; this model covers **data in use**. The user-facing system built on it is **ScreenShield** ([SCREENSHIELD.md](SCREENSHIELD.md)); the constitutional decision is [ADR-0012](adr/ADR-0012-endpoint-defense-layer.md).

## Current status

**Research/design only.** No platform code is implemented; no Tauri or mobile permissions exist. Everything here is design direction gated behind Gate K ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)).

## Project separation — Secure Device is external (TECH-22)

**FreeLayer / ChatControl and Secure Device / Endpoint Defense are now two clearly separated projects.** The device-management, anti-spyware, GrapheneOS, ScreenShield-runtime, and ProtectedContent responsibilities belong to the **separate Secure Device project** (developed elsewhere; research direction: supported Pixel devices, GrapheneOS, isolated ChatControl user profile, Device Posture Checker, Bunker Session Mode, ScreenShield, ProtectedContent — only after real validation). **FreeLayer core keeps ONLY:** interfaces, policy inputs, compatibility contracts, minimum-posture room requirements, protected-content requirements, future integration hooks, and honest PBOM/Trust Center disclosures.

FreeLayer core does **not** implement: anti-spyware/stalkerware/malware scanners, a phone-wide firewall, Device Owner/MDM, GrapheneOS install/update/management, custom ROM/firmware, Accessibility/overlay/keyboard/process/clipboard/screen-recording inspection, app-inventory scanning, device/hardware/Play-Integrity attestation, remote device management, an endpoint-risk scoring engine, or a native Secure Device bridge.

**The DevicePosture contract (TECH-22):** core defines the enum `unverified | basic | hardened | high_assurance | managed_bunker | at_risk` and a fail-closed resolver. **No provider is integrated**, so core resolves only `unverified` (default) or `at_risk` (untrusted tightening); a caller/UI claim of a higher posture is ignored and reduced to `unverified`; `at_risk` always overrides; unknown/missing fail closed. **An untrusted or endpoint-risk signal may tighten or deny an operation — it must NEVER grant access, restore access, or prove identity.** Real posture verification (`basic`+) is supplied later by Secure Device behind the **Secure Device Integration Gate** (dedicated ADR, provider trust model, posture provenance, freshness/expiration, anti-replay, native-permission audit, compromised-provider threat model — see [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)). Device posture is an environment attribute, **never identity** ([membership and device assurance remain separate inputs](SOVEREIGN_ROOMS.md)).

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

| Control                             | Role                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ScreenShield Mode**               | User/room-facing protection levels (off → bunker) governing all endpoint behavior ([SCREENSHIELD.md](SCREENSHIELD.md))                                                            |
| **Protected View / Sealed View**    | Rendering surfaces for sensitive content: redaction-first, hold-to-view, time-limited reveal                                                                                      |
| **Capture-Aware Rooms**             | Rooms that react to capture state (redact when `isCaptured`-class signals fire; audit locally)                                                                                    |
| **ProtectedContent component**      | The only lawful rendering path for sensitive content ([PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md))                                                                 |
| **Secure Surface adapters**         | Per-platform adapters wrapping FLAG_SECURE / display-affinity / capture-detection APIs, reporting real capabilities honestly ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md)) |
| **Clipboard Firewall**              | Policy-gated copy: deny, allow-with-expiry, or allow, per ScreenShield level                                                                                                      |
| **Secure Input Firewall**           | Sensitive input fields opt out of autocorrect/predictive/keyboard-cache learning where the platform allows                                                                        |
| **Anti-Overlay/Tapjacking Guard**   | Touch-filtering-class defenses on sensitive actions (reveal, send, wipe, key operations)                                                                                          |
| **Device Risk Engine**              | Local-only risk assessment feeding policy ([DEVICE_RISK_MODEL.md](DEVICE_RISK_MODEL.md))                                                                                          |
| **Panic / Auto-Redact / Decoy**     | One-gesture blur/redact; auto-redact on focus loss; future decoy surfaces                                                                                                         |
| **Leak Canary / Dynamic Watermark** | Optional per-reveal watermarking to make leaked captures attributable (never on by default; policy-controlled)                                                                    |
| **PWA Low-Assurance Mode**          | Web builds honestly labeled low assurance; sealed/bunker content restricted or denied on web                                                                                      |

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

## TECH-23 — Secure Device integration contract (external boundary)

Secure Device / Endpoint Defense remains **external**. TECH-23 adds only the CONTRACT through which a future external provider could one day supply a normalized posture result (`packages/rooms/src/secure-device/`):

- **Roles (RFC 9334 RATS):** the Attester (produces Evidence) and Verifier (appraises Evidence) are external; FreeLayer core is the **Relying Party** only and consumes a normalized result — it never parses Evidence, appraises firmware, or inspects measurements.
- **Provider port + Null provider:** a versioned `SecureDeviceProviderPortV1`; the only shipped implementation is the deterministic, side-effect-free `NullSecureDeviceProviderV1` (reports `not_integrated`, returns `unverified`).
- **Normalized transient assessment:** `DevicePostureAssessmentV1` carries no raw evidence, no device identifiers, no OS fingerprint, no app inventory, no history — those fields are forbidden and rejected. Provenance is a module-private registry (non-cryptographic — Gate F).
- **Freshness:** current-process-only; no trusted clock, nonce, or epoch; revision rollback is rejected; no replay-resistance claim.
- **Admission + session:** deterministic, fail-closed `resolveSensitiveRoomAdmissionV1`; a transient current-process session that invalidates on any posture/provider/policy/membership/mode/lifecycle/action change; recovery requires a fresh assessment + admission + authorization.
- **ProtectedContent / Bunker:** data-only intent types; core never renders content, blocks screenshots, or claims capture protection. Any future-required protection **denies** content (no silent downgrade).

Core still implements **none** of: anti-spyware/malware scanning, phone-wide firewall, Device Owner/MDM, GrapheneOS installation/management, custom ROM, app-inventory scanning, Accessibility scanning, screenshot/screen-recording detection, clipboard/overlay/keyboard/process monitoring, hardware attestation, Play Integrity, endpoint telemetry, or a native ScreenShield / Bunker Session Mode. See the **Secure Device Integration Gate** in docs/IMPLEMENTATION_GATES.md.
