# Anti-spyware / Endpoint Defense Externalization Audit (TECH-14)

_Date: 2026-07-10. Verifies that the endpoint-defense implementation is genuinely absent from FreeLayer core following the project-direction decision._

## The decision

The anti-spyware / Endpoint Defense / ScreenShield **implementation** has been split into a separate standalone project. FreeLayer core keeps:

- **policy hooks** (types, matrix rows, ScreenShield levels as tightening inputs),
- **compatibility contracts** (data classes like `protected_content_reveal_state`, metadata events like `screen.capture_detected`),
- **docs, PBOM entries, Trust Center honesty, and integration gates**.

The implementation is **externalized · deferred · integration-gated · policy-hook-only**. It remains part of the product vision; integrating the finished external project requires a dedicated ADR/gate (see [../IMPLEMENTATION_GATES.md](../IMPLEMENTATION_GATES.md) — Endpoint Defense / Anti-spyware Integration Gate).

## Verification

| Check | Result |
| --- | --- |
| Native screenshot/clipboard/overlay/keystroke/process-monitoring implementation in core | **none** (repository search; only policy types/matrix rows exist) |
| OS-monitoring / anti-spyware dependencies (`iohook`, `robotjs`, `screenshot-desktop`, `active-win`, key-listener packages, `@nut-tree/*`) | **none** — machine-checked by `check:policy-conflicts` dependency scan |
| Tauri/native permissions for endpoint monitoring | **none** — `apps/desktop` is a placeholder with zero permission surface ([TAURI_NOTIFICATION_PERMISSION_AUDIT.md](TAURI_NOTIFICATION_PERMISSION_AUDIT.md)) |
| Policy hooks exist only as types/matrix rows | **confirmed** — endpoint capability rows (`clipboard_copy`, `secure_input`, `task_switcher_preview`, `screenshot_blocking`, `tauri_desktop_permissions`) are `future_gate` in every mode; `assertExternalizedHookOnly` test enforces it |
| PBOM reflects externalization | **yes** — PBOM "Endpoint Defense / Anti-spyware status" section |
| Trust Center says endpoint protection is not active in core | **yes** — TECH-14 section; the overclaim scanner additionally bans "stops spyware"/"full endpoint protection active" claims |
| Roadmap says integration requires future ADR/gate | **yes** — EDL track marked externalized |

## Allowed in core (and only these)

Docs references · policy hook types · matrix rows marked `future_gate`/`not_implemented` · future integration notes.

## Forbidden in core (machine-checked where possible)

Claiming active endpoint protection (Trust Center overclaim scan) · enabling native endpoint monitoring · importing anti-spyware dependencies (`check:policy-conflicts`) · presenting ScreenShield as implemented when only hooks exist (matrix + tests).

## Integration path (future)

When the external project is ready: dedicated ADR → threat model → PBOM update → Trust Center update → native-permission audit → integration behind the gate. The integration must not overclaim protection against compromised endpoints or cameras — those limits are permanent ([../PLATFORM_LIMITATIONS.md](../PLATFORM_LIMITATIONS.md)).
