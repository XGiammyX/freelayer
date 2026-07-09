/**
 * Runtime persistent-write trap (TECH-07).
 *
 * Monkeypatches every reachable persistence API in the test runtime so that
 * any call during a strict-mode workout BOTH throws and is recorded. APIs
 * absent in this environment are listed under `coverage.absent` (skipped
 * gracefully, honestly reported). Nothing here ever writes the sentinel to
 * disk — trapped functions never delegate to the originals.
 */
import fs from "node:fs";

export class PersistentWriteTrapError extends Error {
  override readonly name = "PersistentWriteTrapError";
  constructor(api: string) {
    super(`Persistent write trap fired: ${api}`);
  }
}

interface Restore {
  (): void;
}

export interface PersistentWriteTrap {
  readonly calls: readonly string[];
  readonly coverage: { readonly trapped: readonly string[]; readonly absent: readonly string[] };
  uninstall(): void;
  assertNoPersistentApiCalled(): void;
}

export function createPersistentWriteTrap(): PersistentWriteTrap {
  const calls: string[] = [];
  const trapped: string[] = [];
  const absent: string[] = [];
  const restores: Restore[] = [];

  const fire = (api: string): never => {
    calls.push(api);
    throw new PersistentWriteTrapError(api);
  };

  const patchMethod = (
    holder: Record<string, unknown> | undefined,
    method: string,
    label: string,
  ): void => {
    if (holder === undefined || typeof holder[method] !== "function") {
      absent.push(label);
      return;
    }
    const original = holder[method];
    holder[method] = (..._args: unknown[]) => fire(label);
    trapped.push(label);
    restores.push(() => {
      holder[method] = original;
    });
  };

  const defineTrapGlobal = (name: string, value: unknown): void => {
    const globals = globalThis as Record<string, unknown>;
    if (globals[name] !== undefined) {
      return; // patched separately if it exists
    }
    globals[name] = value;
    trapped.push(`${name} (synthetic trap)`);
    restores.push(() => {
      delete globals[name];
    });
  };

  const globals = globalThis as Record<string, unknown>;

  // Runtime-provided web storage (Node ships these globals now — TECH-06
  // finding). Web Storage instances intercept property ASSIGNMENT as item
  // storage, so instance-level patching is impossible: patch the shared
  // Storage prototype instead (an ordinary object with real methods).
  const patchedProtos = new Set<object>();
  const patchStorage = (name: "localStorage" | "sessionStorage"): void => {
    const store = globals[name];
    if (store === undefined || store === null) {
      absent.push(`${name}.setItem`);
      return;
    }
    const proto = Object.getPrototypeOf(store) as Record<string, unknown>;
    if (patchedProtos.has(proto)) {
      trapped.push(`${name}.setItem (shared prototype)`);
      return;
    }
    patchedProtos.add(proto);
    patchMethod(proto, "setItem", `${name}.setItem`);
  };
  patchStorage("localStorage");
  patchStorage("sessionStorage");

  // Browser-only APIs: patch if present, otherwise install synthetic traps so
  // accidental calls still fail loudly instead of silently no-oping.
  if (globals["indexedDB"] === undefined) {
    defineTrapGlobal("indexedDB", { open: () => fire("indexedDB.open") });
  } else {
    patchMethod(globals["indexedDB"] as Record<string, unknown>, "open", "indexedDB.open");
  }
  if (globals["caches"] === undefined) {
    defineTrapGlobal("caches", { open: () => fire("caches.open") });
  } else {
    patchMethod(globals["caches"] as Record<string, unknown>, "open", "caches.open");
  }
  for (const missing of ["document.cookie", "navigator.sendBeacon"]) {
    if (globals[missing.split(".")[0] ?? ""] === undefined) {
      absent.push(missing);
    }
  }

  // Node filesystem writes.
  patchMethod(fs as unknown as Record<string, unknown>, "writeFile", "fs.writeFile");
  patchMethod(fs as unknown as Record<string, unknown>, "writeFileSync", "fs.writeFileSync");
  patchMethod(fs as unknown as Record<string, unknown>, "appendFileSync", "fs.appendFileSync");
  patchMethod(
    fs.promises as unknown as Record<string, unknown>,
    "writeFile",
    "fs.promises.writeFile",
  );

  // Deno/Bun runtimes: absent under Vitest/Node — recorded honestly.
  for (const runtime of ["Deno.writeFile", "Bun.write"]) {
    if (globals[runtime.split(".")[0] ?? ""] === undefined) {
      absent.push(runtime);
    }
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
    assertNoPersistentApiCalled() {
      if (calls.length > 0) {
        throw new PersistentWriteTrapError(`unexpected persistent API calls: ${calls.join(", ")}`);
      }
    },
  };
}
