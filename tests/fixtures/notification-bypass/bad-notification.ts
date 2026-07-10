// FIXTURE (never compiled/run — not in tests/tsconfig include). Every line is a
// notification-bypass the guardrail must catch.
/* eslint-disable */
declare const self: any;
new Notification("hi");
Notification.requestPermission();
navigator.setAppBadge(3);
navigator.clearAppBadge();
self.registration.showNotification("x");
navigator.serviceWorker.register("/sw.js");
// import from a push plugin (string presence is what the scanner checks)
const plugin = "@tauri-apps/plugin-notification";
