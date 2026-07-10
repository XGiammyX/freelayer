# TECH-12 — Notification Threat Model

_Scope: the leakage channels notifications open, and the honest limits of controlling them in-app. Extends [../THREAT_MODEL.md](../THREAT_MODEL.md)._

## Notification content leakage

Message preview, room name, sender alias, task/decision/document title, AI summary, protected-content reveal — on a lock screen, in a notification center, in OS notification search/history, or captured by a screenshot/recording. **Mitigation:** all sensitive content classes denied in every mode; the only allowed notification is a generic, content-free, in-app indicator (Standard/Private); `redactNotificationContent` yields generic labels only, empty in strict modes.

## Notification metadata leakage

Notification existence/time/frequency, badge count/dot, sound/vibration pattern, priority, channel/category name, app-icon state, grouping/threading — all enable room-activity and contact-graph inference. **Mitigation:** badge/sound/vibration denied in v0 (hard-denied in Ghost/Bunker/Emergency); `notification.channel_create` denied (channel names leak); no OS surface is used.

## Push / service worker leakage

Push subscription + endpoint metadata, push-service provider visibility, background wakeups, service-worker cache/network behavior, remote payloads, APNs/FCM/Web-Push dependency, delivery timing. **Mitigation:** push subscribe/receive and service-worker show denied in **all** modes (`future_gate`); no service worker or push code exists ([NOTIFICATION_SERVICE_WORKER_PUSH_AUDIT.md](NOTIFICATION_SERVICE_WORKER_PUSH_AUDIT.md)); NetworkPolicy independently denies the network these would need.

## Local storage / logging leakage

Notification payload persisted locally, OS notification history, audit event containing content, debug logs with content, badge state persisted, permission state stored, channel names revealing room/project names. **Mitigation:** `persistentStorageAllowed` always false; audit events redacted (numeric/boolean only, sentinel-free); notification content storage class is born denied (recorded TECH-10 decision).

## Policy bypass threats

A feature requesting permission automatically; showing a notification before the policy check; content bypassing Metadata/Storage/Network policy; a Tauri plugin enabled with broad permissions; a service worker displaying a notification outside core policy. **Mitigation:** the notification barrier requires an authentic, exactly-scoped `PolicyDecision`; `check:no-notification-bypass` (source) + the runtime trap (tests) + AST ESLint catch direct API use; the Tauri plugin is absent with zero permissions.

## Limits (stated plainly)

- FreeLayer can prevent **its own code** from generating sensitive notifications.
- It **cannot** control the OS notification center once a notification is delivered, nor screenshots/cameras of notifications, nor the user's OS notification settings.
- Push infrastructure is deferred and unavailable by default.
- Notification privacy is **application-level**, not absolute.
