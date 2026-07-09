/**
 * Privacy-regression (TECH-07): runtime persistent-write traps.
 * Strict-mode storage workouts must never touch a persistence API; the traps
 * both prevent and record any attempt. Positive controls prove the traps fire.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import { issuePolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import {
  EncryptedPersistentStorageProviderPlaceholder,
  MemoryStorageProvider,
  NullStorageProvider,
  resolveStoragePolicy,
  StorageBackendNotImplementedError,
  type StoragePolicy,
  type StorageWriteRequest,
} from "@freelayer/storage";
import {
  createPersistentWriteTrap,
  PersistentWriteTrapError,
  type PersistentWriteTrap,
} from "../../helpers/persistent-write-trap";

const ZP_SENTINEL = "FREELAYER_ZERO_PERSISTENCE_SENTINEL_DO_NOT_LEAK";

let trap: PersistentWriteTrap;

beforeEach(() => {
  trap = createPersistentWriteTrap();
});

afterEach(() => {
  trap.uninstall();
});

const writeReq = (mode: PrivacyMode): StorageWriteRequest => ({
  operation: "storage.write",
  dataClass: "message_content",
  key: `k-${mode}`,
  value: ZP_SENTINEL,
  sensitivity: "content",
  reason: "trap test",
});

async function strictModeWorkout(mode: "ghost" | "bunker"): Promise<void> {
  const provider = new MemoryStorageProvider();
  const policy = resolveStoragePolicy({
    mode,
    dataClass: "message_content",
    sensitivity: "content",
  });
  const wd = issuePolicyDecision("persistence", "allowed", mode, "storage.write");
  const rd = issuePolicyDecision("persistence", "allowed", mode, "storage.read");
  const ld = issuePolicyDecision("persistence", "allowed", mode, "storage.list");
  await provider.write(writeReq(mode), wd, policy);
  await provider.read(
    { operation: "storage.read", dataClass: "message_content", key: `k-${mode}`, reason: "t" },
    rd,
    policy,
  );
  await provider.list(
    { operation: "storage.list", dataClass: "message_content", reason: "t" },
    ld,
    policy,
  );
}

describe("Strict-mode workouts trigger no persistence APIs", () => {
  it("Ghost write/read/list path calls no persistent API", async () => {
    await strictModeWorkout("ghost");
    trap.assertNoPersistentApiCalled();
  });

  it("Bunker write/read/list path calls no persistent API", async () => {
    await strictModeWorkout("bunker");
    trap.assertNoPersistentApiCalled();
  });

  it("Emergency normal write is denied and calls no persistent API", async () => {
    const provider = new NullStorageProvider();
    const policy = resolveStoragePolicy({
      mode: "emergency",
      dataClass: "message_content",
      sensitivity: "content",
    });
    const wd = issuePolicyDecision("persistence", "allowed", "emergency", "storage.write");
    await expect(provider.write(writeReq("emergency"), wd, policy)).rejects.toThrow();
    trap.assertNoPersistentApiCalled();
  });

  it("NullStorageProvider full surface calls no persistent API", async () => {
    const provider = new NullStorageProvider();
    const policy: StoragePolicy = {
      ...resolveStoragePolicy({
        mode: "private",
        dataClass: "message_content",
        sensitivity: "content",
      }),
      backend: "null",
    };
    await provider.write(
      writeReq("private"),
      issuePolicyDecision("persistence", "allowed", "private", "storage.write"),
      policy,
    );
    await provider.clear(
      { operation: "storage.clear", reason: "t" },
      issuePolicyDecision("persistence", "allowed", "private", "storage.clear"),
      policy,
    );
    trap.assertNoPersistentApiCalled();
  });

  it("Persistent placeholder throws before any persistent API is reached", async () => {
    const provider = new EncryptedPersistentStorageProviderPlaceholder();
    const policy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "message_content",
      sensitivity: "content",
    });
    await expect(
      provider.write(
        writeReq("standard"),
        issuePolicyDecision("persistence", "allowed", "standard", "storage.write"),
        policy,
      ),
    ).rejects.toBeInstanceOf(StorageBackendNotImplementedError);
    trap.assertNoPersistentApiCalled();
  });
});

describe("Positive controls: the traps actually fire", () => {
  it("catches or neutralizes a direct browser-storage write attempt", () => {
    const store = (globalThis as Record<string, unknown>)["localStorage"] as
      { setItem?(k: string, v: string): void } | undefined;
    if (store === undefined) {
      expect(trap.coverage.absent.join(",")).toContain("localStorage");
      return;
    }
    if (trap.coverage.trapped.some((t) => t.startsWith("localStorage.setItem"))) {
      expect(() => store.setItem?.("k", "v")).toThrow(PersistentWriteTrapError);
      expect(trap.calls).toContain("localStorage.setItem");
      return;
    }
    // Third honest state (observed on Node without a localstorage backing
    // file): the global exists but is INERT — there is no callable setItem,
    // so no write can succeed by construction. Recorded as absent coverage.
    expect(trap.coverage.absent.join(",")).toContain("localStorage");
    expect(typeof store.setItem).not.toBe("function");
  });

  it("catches a direct filesystem write attempt (and prevents it)", () => {
    expect(() => fs.writeFileSync("should-never-exist.txt", ZP_SENTINEL)).toThrow(
      PersistentWriteTrapError,
    );
    expect(trap.calls).toContain("fs.writeFileSync");
    trap.uninstall();
    expect(fs.existsSync("should-never-exist.txt")).toBe(false);
    trap = createPersistentWriteTrap(); // re-arm for afterEach symmetry
  });

  it("catches synthetic browser APIs installed for coverage (indexedDB/caches)", () => {
    const globals = globalThis as Record<string, unknown>;
    const idb = globals["indexedDB"] as { open(name: string): unknown };
    expect(() => idb.open("db")).toThrow(PersistentWriteTrapError);
    const caches = globals["caches"] as { open(name: string): unknown };
    expect(() => caches.open("c")).toThrow(PersistentWriteTrapError);
    expect(trap.calls).toEqual(expect.arrayContaining(["indexedDB.open", "caches.open"]));
  });

  it("reports honest coverage of trapped vs absent APIs", () => {
    expect(trap.coverage.trapped.length).toBeGreaterThanOrEqual(4);
    for (const api of ["Deno.writeFile", "Bun.write"]) {
      expect(trap.coverage.absent).toContain(api);
    }
  });
});
