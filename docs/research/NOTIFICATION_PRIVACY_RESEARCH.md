# Notification Privacy — Research Note (TECH-12)

_Date: 2026-07-10. Informs `NotificationPolicy` and the notification barrier in `packages/privacy`._

> [!NOTE]
> **Source verification pending: live internet was unavailable in this environment.** The facts below are stable, well-established platform knowledge (author cutoff 2026-01). Re-confirm exact API/behavior wordings against the primary sources named before external citation.

## Why this pass

A notification is not harmless UI. Once delivered it can appear on a lock screen, persist in an OS notification center, and reveal that FreeLayer is installed, that a room is active, a sender alias, or a message preview — outside the app's control. TECH-12 defines and tests notification policy **before** any notification feature exists. No real notifications, no permission prompts, no push, no service worker are implemented.

## 5.1 Web Notifications API (MDN)

**Summary:** `new Notification()` and `Notification.requestPermission()` display content outside the page; `Notification.permission` is local state; a secure context is required. Permission prompts are user-visible side effects.

**Applied:** `resolveNotificationPolicy` denies `notification.permission_request` in every mode (a future explicit user action); denies all OS-surface display; the guardrail + trap catch `new Notification` / `requestPermission`. No permission is ever requested automatically.

## 5.2 Push API & Service Workers (MDN)

**Summary:** Web Push needs a push service, a subscription (endpoint metadata), and a service worker running in the background — infrastructure FreeLayer does not have and will not require by default. Service workers also add network/cache surface.

**Applied:** push subscribe/receive and `service_worker_show` denied in **all** modes (`future_gate`); `pushAllowed`/`networkAllowed` always false; the SW/push audit confirms none exists. Push is a future ADR/research gate, not TECH-12.

## 5.3 Badging API (MDN)

**Summary:** `navigator.setAppBadge()` sets an app-icon badge (count or dot) — activity metadata visible on the OS.

**Applied:** badge is metadata; denied in every mode in v0 (`badgeAllowed` false), hard-denied in Ghost/Bunker/Emergency; guardrail + trap catch `setAppBadge`/`clearAppBadge`.

## 5.4 Android notification privacy

**Summary:** Android has lock-screen visibility levels (public/private/secret) and notification channels; content can be hidden on secure lock screens.

**Applied (future mapping):** strict modes must map to secret/private-like behavior; message content must never show on a secure lock screen; channel configuration must be policy-aware. Not implemented now; `notification.channel_create` denied (channel names can leak room/project names).

## 5.5 Apple notification privacy

**Summary:** UserNotifications (local + remote) can appear on the lock screen / notification list; summaries retain metadata; remote notifications need APNs payload design + infrastructure.

**Applied:** no APNs/remote design now; payloads must never carry content; notification content classes (message_preview/room_name/sender_alias/...) denied.

## 5.6 Windows/macOS desktop + Tauri

**Summary:** Desktop toasts persist in OS notification centers; content is visible outside the app; the Tauri notification plugin exposes OS notifications and must be permission-scoped.

**Applied:** the Tauri plugin is **not present** and notification permissions are **zero** ([../audits/TAURI_NOTIFICATION_PERMISSION_AUDIT.md](../audits/TAURI_NOTIFICATION_PERMISSION_AUDIT.md)); it may be added only after NotificationPolicy integration with scoped permissions and per-OS documented behavior.

## 5.7 OWASP (MASVS-PRIVACY / MASVS-STORAGE)

**Summary:** treat notification content as sensitive data; keep it out of logs/local storage; document platform leakage.

**Applied:** notification content is sensitive; audit events are redacted (numeric/boolean only); content never persists; PBOM documents the behavior.

## Decisions made for TECH-12

1. Notifications are side effects; content **and** metadata (badge/sound/vibration/permission state) are sensitive; denied by default.
2. The ONLY allowed path in v0 is a **generic, memory-only, in-app indicator** in Standard/Private — no OS surface, no content, no persistence.
3. Push / service worker / permission request denied in every mode (future gates).
4. `redactNotificationContent` yields generic labels (`FreeLayer` / `New activity`); strict modes return empty. Never the input title/body.
5. Enforcement reuses the WeakSet `PolicyDecision` provenance and the redacted audit model — not re-implemented.

## TODOs for future notification implementation

- ADR/research gate for any OS notification, push, or service worker.
- Per-OS lock-screen visibility mapping (Android secret/private; Apple interruption levels; desktop notification-center behavior).
- Scoped Tauri notification permission + capability audit before enabling the plugin.
- Generic, content-free notification model (Standard/Private opt-in) with explicit user permission flow.
