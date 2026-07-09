/**
 * Runtime network side-effect trap (TECH-08).
 *
 * Monkeypatches every reachable egress API so any call during a protected
 * test BOTH throws and is recorded. Absent APIs are reported under
 * `coverage.absent`. No real network call is ever made — trapped functions
 * never delegate. This is the TECH-08 foundation; TECH-09 does the full-build
 * zero-egress verification.
 */

export class NetworkSideEffectTrapError extends Error {
  override readonly name = "NetworkSideEffectTrapError";
  constructor(api: string) {
    super(`Network side-effect trap fired: ${api}`);
  }
}

export interface NetworkSideEffectTrap {
  readonly calls: readonly string[];
  readonly coverage: { readonly trapped: readonly string[]; readonly absent: readonly string[] };
  uninstall(): void;
  assertNoNetworkApiCalled(): void;
}

export function createNetworkSideEffectTrap(): NetworkSideEffectTrap {
  const calls: string[] = [];
  const trapped: string[] = [];
  const absent: string[] = [];
  const restores: Array<() => void> = [];
  const globals = globalThis as Record<string, unknown>;

  const fire = (api: string): never => {
    calls.push(api);
    throw new NetworkSideEffectTrapError(api);
  };

  const patchGlobalFn = (name: string, label: string): void => {
    if (typeof globals[name] !== "function") {
      absent.push(label);
      return;
    }
    const original = globals[name];
    globals[name] = (..._args: unknown[]) => fire(label);
    trapped.push(label);
    restores.push(() => {
      globals[name] = original;
    });
  };

  const patchConstructor = (name: string, label: string): void => {
    if (typeof globals[name] !== "function") {
      // Install a synthetic trap so accidental construction still fails loudly.
      globals[name] = function trapped() {
        return fire(label);
      };
      trapped.push(`${label} (synthetic)`);
      restores.push(() => {
        delete globals[name];
      });
      return;
    }
    const original = globals[name];
    globals[name] = function trapped() {
      return fire(label);
    };
    trapped.push(label);
    restores.push(() => {
      globals[name] = original;
    });
  };

  patchGlobalFn("fetch", "fetch");
  patchConstructor("XMLHttpRequest", "XMLHttpRequest");
  patchConstructor("WebSocket", "WebSocket");
  patchConstructor("EventSource", "EventSource");
  patchConstructor("RTCPeerConnection", "RTCPeerConnection");
  patchConstructor("RTCDataChannel", "RTCDataChannel");

  // navigator.sendBeacon (present only in some runtimes).
  const nav = globals["navigator"] as Record<string, unknown> | undefined;
  if (nav !== undefined && typeof nav["sendBeacon"] === "function") {
    const original = nav["sendBeacon"];
    nav["sendBeacon"] = (..._args: unknown[]) => fire("navigator.sendBeacon");
    trapped.push("navigator.sendBeacon");
    restores.push(() => {
      nav["sendBeacon"] = original;
    });
  } else {
    absent.push("navigator.sendBeacon");
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
    assertNoNetworkApiCalled() {
      if (calls.length > 0) {
        throw new NetworkSideEffectTrapError(`unexpected network API calls: ${calls.join(", ")}`);
      }
    },
  };
}
