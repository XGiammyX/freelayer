/**
 * Runtime notification side-effect trap (TECH-12).
 *
 * Monkeypatches every reachable notification/badge/service-worker API so any
 * call during a protected test BOTH throws and is recorded. Absent APIs are
 * reported under `coverage.absent`. No real notification, permission prompt, or
 * badge update ever happens — trapped functions never delegate.
 */

export class NotificationSideEffectTrapError extends Error {
  override readonly name = "NotificationSideEffectTrapError";
  constructor(api: string) {
    super(`Notification side-effect trap fired: ${api}`);
  }
}

export interface NotificationSideEffectTrap {
  readonly calls: readonly string[];
  readonly coverage: { readonly trapped: readonly string[]; readonly absent: readonly string[] };
  uninstall(): void;
  assertNoNotificationApiCalled(): void;
}

export function createNotificationSideEffectTrap(): NotificationSideEffectTrap {
  const calls: string[] = [];
  const trapped: string[] = [];
  const absent: string[] = [];
  const restores: Array<() => void> = [];
  const globals = globalThis as Record<string, unknown>;

  const fire = (api: string): never => {
    calls.push(api);
    throw new NotificationSideEffectTrapError(api);
  };

  // Notification constructor + static requestPermission/permission.
  const originalNotification = globals["Notification"];
  const trap = function trappedNotification() {
    return fire("new Notification");
  } as unknown as Record<string, unknown>;
  trap["requestPermission"] = () => fire("Notification.requestPermission");
  globals["Notification"] = trap;
  trapped.push(originalNotification === undefined ? "Notification (synthetic)" : "Notification");
  restores.push(() => {
    if (originalNotification === undefined) {
      delete globals["Notification"];
    } else {
      globals["Notification"] = originalNotification;
    }
  });

  // navigator.setAppBadge / clearAppBadge / serviceWorker.register.
  const nav = globals["navigator"] as Record<string, unknown> | undefined;
  if (nav !== undefined) {
    for (const method of ["setAppBadge", "clearAppBadge"] as const) {
      if (typeof nav[method] === "function") {
        const original = nav[method];
        nav[method] = (..._args: unknown[]) => fire(`navigator.${method}`);
        trapped.push(`navigator.${method}`);
        restores.push(() => {
          nav[method] = original;
        });
      } else {
        absent.push(`navigator.${method}`);
      }
    }
    const sw = nav["serviceWorker"] as Record<string, unknown> | undefined;
    if (sw !== undefined && typeof sw["register"] === "function") {
      const original = sw["register"];
      sw["register"] = (..._args: unknown[]) => fire("navigator.serviceWorker.register");
      trapped.push("navigator.serviceWorker.register");
      restores.push(() => {
        sw["register"] = original;
      });
    } else {
      absent.push("navigator.serviceWorker.register");
    }
  } else {
    absent.push(
      "navigator.setAppBadge",
      "navigator.clearAppBadge",
      "navigator.serviceWorker.register",
    );
  }

  return {
    get calls() {
      return [...calls];
    },
    coverage: { trapped, absent },
    uninstall() {
      for (const restore of restores.reverse()) {
        restore();
      }
      restores.length = 0;
    },
    assertNoNotificationApiCalled() {
      if (calls.length > 0) {
        throw new NotificationSideEffectTrapError(
          `unexpected notification API calls: ${calls.join(", ")}`,
        );
      }
    },
  };
}
