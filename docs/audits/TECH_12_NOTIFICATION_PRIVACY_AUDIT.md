# TECH-12 — Notification Privacy Model Audit

_Branch: `tech/notification-privacy-model` (stacked on TECH-11) · Date: 2026-07-10._

## Commands run

`pnpm typecheck` · `lint` · `test` · `build` · `check:boundaries` · `check:no-external-assets` · `check:no-telemetry` · `check:no-forbidden-storage` · `check:no-forbidden-network` · `check:build-zero-egress` · `check:no-network-deps` · `check:no-metadata-bypass` · `check:no-notification-bypass` · `check:doc-links` · `audit:privacy` · `audit:supply-chain` · `test:coverage`. All green.

## Precheck

TECH-10/TECH-11 all `present`; nothing missing had to be built. → [TECH_12_PRECHECK.md](TECH_12_PRECHECK.md).

## Research summary

Notifications display content outside the page (lock screen, notification center); permission prompts and badges are side effects/metadata; Push needs a service + subscription + service worker (infrastructure FreeLayer refuses by default). Strict-mode content hiding maps to Android secret/private and Apple interruption levels in future. → [../research/NOTIFICATION_PRIVACY_RESEARCH.md](../research/NOTIFICATION_PRIVACY_RESEARCH.md). Threat model → [TECH_12_NOTIFICATION_THREAT_MODEL.md](TECH_12_NOTIFICATION_THREAT_MODEL.md). (Live internet unavailable → verification-pending marker.)

## Implementation

New in `packages/privacy/src/`:
- `notificationTypes.ts` — operation (13), content class (15), surface (10), action taxonomies + `NotificationPolicy`/`NotificationPolicyInput`/`NotificationOperationRequest`/`RedactedNotificationContent`.
- `notificationErrors.ts` — 12 redacted error classes.
- `notificationPolicy.ts` — `resolveNotificationPolicy` (default-deny; only a generic memory-only in-app indicator in Standard/Private is allowed) + `resolveBadgePolicy`/`shouldAllowBadgeUpdate`/`resolveNotificationSoundPolicy`/`resolveNotificationVibrationPolicy`/`resolvePushNotificationPolicy` + `redactNotificationContent`.
- `notificationBarrier.ts` — `assertNotificationOperationAllowed` (authentic, exactly-scoped `PolicyDecision`; reuses the WeakSet provenance).
- `index.ts` — 8 notification side-effect scopes + re-exports.

## Policy coverage

Permission request, push subscribe/receive, service-worker show, badge, sound, vibration, channel create, and all OS surfaces (banner/lock-screen/notification-center) denied in every mode. Sensitive content (message preview, room name, sender alias, task/decision/document title, AI summary, protected content, secret) denied in every mode. Only a generic, content-free, memory-only in-app indicator is allowed (Standard/Private); nothing persists or egresses.

## Guardrail / trap / audit coverage

- `check-no-notification-bypass.mjs` (+ script, `audit:privacy`, CI) — catches `new Notification`, `requestPermission`, `setAppBadge`/`clearAppBadge`, `showNotification`, `PushManager`, `serviceWorker.register`, `@tauri-apps/plugin-notification`, and push SDKs. Fixture-tested.
- Runtime trap `tests/helpers/notification-trap.ts` — fails any test touching a notification/badge/service-worker API; catches a real `new Notification` attempt.
- Tauri notification permission audit → [TAURI_NOTIFICATION_PERMISSION_AUDIT.md](TAURI_NOTIFICATION_PERMISSION_AUDIT.md): **plugin not present, zero permissions**.
- Service worker / push audit → [NOTIFICATION_SERVICE_WORKER_PUSH_AUDIT.md](NOTIFICATION_SERVICE_WORKER_PUSH_AUDIT.md): **none found**.

## Tests added

- `tests/privacy-regression/notifications/notification-policy.test.ts` — permission/push/SW/content/badge/sound/vibration denial, room tighten-only, Metadata/Storage/Network agreement, the allowed in-app path, barrier accept/reject, redaction.
- `tests/security-regression/notifications/notification-security.test.ts` — error/redaction/audit sentinel-freedom, no-platform-API (trap), guardrail fixtures.

29 new tests; **286 total**; coverage 82.3% statements.

## Integration

- **MetadataPolicy**: `notification.preview` denied — agrees (tested).
- **StoragePolicy**: notification content never persists — agrees with content-class persistence denial (tested).
- **NetworkPolicy**: push requires network, which is denied — agrees (tested).

## Known limitations

In-app policy only — cannot control the OS notification center once delivered, screenshots/cameras, or the user's OS settings. Push infrastructure deferred. The barrier's per-operation allow-gates are defensive: in v0 those operations are denied earlier, so those branches are dormant until features exist.

## Future gates

Any OS notification, push, or service worker requires a dedicated ADR/research gate; the Tauri plugin may be added only after scoped-permission + NotificationPolicy integration.

## Verdict

**TECH-12 is complete.** All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-13 — Policy Matrix v1**.
