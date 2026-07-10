# Notification Service Worker / Push Audit (TECH-12)

_Date: 2026-07-10. Verifies no service worker or push-notification behavior exists._

## Result: NO service worker / push implementation found — correct for TECH-12

A repository search across `apps/` and `packages/` found **no** occurrences of the following in shipped source (the only matches are string literals in the NotificationPolicy module itself and test files, which are policy/verification, not behavior):

| Symbol | Found in source? |
| --- | --- |
| service worker file (`sw.js` / `service-worker.*`) | none |
| `navigator.serviceWorker` / `serviceWorker.register` | none |
| `self.registration.showNotification` / `showNotification(` | none |
| `PushManager` / `pushManager` / `PushSubscription` | none |
| `Notification.requestPermission` / `new Notification(` | none |
| `navigator.setAppBadge` / `clearAppBadge` | none |
| Web app manifest (`*.webmanifest` / `manifest.json`) | none |
| Web Push / FCM / APNs / OneSignal / Pusher deps | none (`check:no-network-deps`) |

## Enforcement

- `scripts/check-no-notification-bypass.mjs` (in `audit:privacy` + CI) fails on any of the above appearing in `apps/`+`packages/` source.
- The runtime trap (`tests/helpers/notification-trap.ts`) fails any test that touches `Notification` / `setAppBadge` / `serviceWorker.register`.
- NotificationPolicy denies `notification.service_worker_show` and push subscribe/receive in every mode.

## Future gated TODO

Any service worker or push capability requires a dedicated ADR/research gate (push service selection, subscription-metadata design, background-wakeup privacy, cache/network behavior) and must never carry plaintext room/message content. Until then this remains **denied by policy and absent from the codebase.**
