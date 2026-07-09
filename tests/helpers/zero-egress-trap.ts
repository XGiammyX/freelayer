/**
 * Zero-egress runtime trap (TECH-09). Extends the network trap with
 * service-worker registration and remote `Image` loading so that ANY egress
 * API called during a protected test both throws and is recorded. No real
 * network call is ever made; absent APIs are reported honestly.
 */

export class ZeroEgressTrapError extends Error {
  override readonly name = "ZeroEgressTrapError";
  constructor(api: string) {
    super(`Zero-egress trap fired: ${api}`);
  }
}

export interface ZeroEgressTrap {
  readonly calls: readonly string[];
  readonly coverage: { readonly trapped: readonly string[]; readonly absent: readonly string[] };
  uninstall(): void;
  assertNoEgress(): void;
}

export function createZeroEgressRuntimeTrap(): ZeroEgressTrap {
  const calls: string[] = [];
  const trapped: string[] = [];
  const absent: string[] = [];
  const restores: Array<() => void> = [];
  const globals = globalThis as Record<string, unknown>;

  const fire = (api: string): never => {
    calls.push(api);
    throw new ZeroEgressTrapError(api);
  };

  const patchFn = (name: string): void => {
    if (typeof globals[name] !== "function") {
      absent.push(name);
      return;
    }
    const original = globals[name];
    globals[name] = (..._a: unknown[]) => fire(name);
    trapped.push(name);
    restores.push(() => {
      globals[name] = original;
    });
  };

  const patchCtor = (name: string): void => {
    const existed = typeof globals[name] === "function";
    const original = globals[name];
    globals[name] = function trap() {
      return fire(name);
    };
    trapped.push(existed ? name : `${name} (synthetic)`);
    restores.push(() => {
      if (existed) {
        globals[name] = original;
      } else {
        delete globals[name];
      }
    });
  };

  patchFn("fetch");
  patchCtor("XMLHttpRequest");
  patchCtor("WebSocket");
  patchCtor("EventSource");
  patchCtor("RTCPeerConnection");
  patchCtor("RTCDataChannel");
  patchCtor("Image"); // remote <img> loading

  // navigator.sendBeacon and navigator.serviceWorker.register.
  const nav = globals["navigator"] as Record<string, unknown> | undefined;
  if (nav !== undefined && typeof nav["sendBeacon"] === "function") {
    const original = nav["sendBeacon"];
    nav["sendBeacon"] = (..._a: unknown[]) => fire("navigator.sendBeacon");
    trapped.push("navigator.sendBeacon");
    restores.push(() => {
      nav["sendBeacon"] = original;
    });
  } else {
    absent.push("navigator.sendBeacon");
  }
  const sw =
    nav !== undefined ? (nav["serviceWorker"] as Record<string, unknown> | undefined) : undefined;
  if (sw !== undefined && typeof sw["register"] === "function") {
    const original = sw["register"];
    sw["register"] = (..._a: unknown[]) => fire("navigator.serviceWorker.register");
    trapped.push("navigator.serviceWorker.register");
    restores.push(() => {
      sw["register"] = original;
    });
  } else {
    absent.push("navigator.serviceWorker.register");
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
    assertNoEgress() {
      if (calls.length > 0) {
        throw new ZeroEgressTrapError(`unexpected egress API calls: ${calls.join(", ")}`);
      }
    },
  };
}
