# Device Risk Model

## Purpose

Define the **Device Risk Engine**: a local-only assessment of how hostile the current device/environment appears, feeding ScreenShield and core policy. It exists so protected content decisions can respond to reality ("screen recording is active", "this is a web build") instead of assuming a safe endpoint.

## Current status

**Design only.** No signals are collected today; nothing is implemented. All signals are **local-only — never uploaded, no telemetry** (ADR-0008), and the risk state itself is policy-governed data ([STORAGE_MODEL.md](STORAGE_MODEL.md)).

## Risk levels

```text
low · medium · high · critical · unknown
```

`unknown` is a first-class level: when the platform adapter cannot assess a signal, the engine says so rather than guessing low. Policy decides whether `unknown` is treated as `medium` or worse (fail-toward-caution default).

## Risk signals (initial set)

- Web/PWA mode (structurally lower assurance)
- Development build
- Debug mode / attached debugger where detectable
- Screen capture currently active (recording/mirroring/casting detection where available)
- External display / casting active
- OS protection unavailable (e.g. capture-exclusion API missing on this OS version)
- Platform adapter failed (protection call errored — treated as unprotected)
- Accessibility/overlay risk indicator where available (platform-dependent)
- Jailbreak/root indicator *(future; detection is unreliable and adversarial — advisory only)*
- Remote desktop / screen sharing indicator where available
- Browser extension risk (web: extensions cannot be enumerated reliably — presence assumed)
- Clipboard recently used for sensitive content (Clipboard Firewall state)
- Unsupported OS version
- Unknown platform

## Actions by risk level

### low
- Normal protected behavior for the active ScreenShield level.

### medium
- Warning surfaced to the user.
- Redaction for sealed content until acknowledged.

### high
- Protected document display disabled.
- Hold-to-view required for any reveal.
- Clipboard disabled.
- AI exposure disabled.
- Explicit warning before any reveal.

### critical
- Sealed content is **not revealed**.
- Only emergency/panic actions available (panic blur, emergency wipe entry points).
- User override only if the active policy permits it — and never silently.

## Enforcement model

The engine is **advisory plus policy-enforced where possible**: its assessment feeds core policy evaluation (strictest wins — [PRIVACY_MODEL.md](PRIVACY_MODEL.md)), and enforceable consequences (clipboard deny, AI deny, reveal deny) are `PolicyDecision` outcomes. Honest limit: a sufficiently compromised device can lie to every signal — the engine reduces exposure on honest-but-risky devices; it does not detect sophisticated compromise ([ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md), threats not fully solvable).

## Privacy properties of the engine itself

- All signals evaluated locally; no signal, score, or event leaves the device.
- Risk state persists only under storage policy; in Ghost/Bunker it is memory-only.
- Audit events about risk changes are redacted (no content, no identifiers beyond what the local audit needs).
- Every signal source is listed in [PBOM.md](PBOM.md) once implemented.

## Open questions

- Signal weighting: fixed mapping vs. worst-signal-wins (initial direction: worst-signal-wins for enforceable signals; advisory signals only raise, never lower).
- Should `critical` auto-trigger panic redact across all rooms, or only the active surface?
- Root/jailbreak detection: adopt at all, or document as theater-prone and skip? *(TODO research — leaning: advisory-only, never a security claim.)*

## TODO

- [ ] Risk engine design in the ScreenShield policy schema (TECH-EDL-08)
- [ ] Per-platform signal availability matrix (with [PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md))
- [ ] Fail-toward-caution defaults review at Gate K
