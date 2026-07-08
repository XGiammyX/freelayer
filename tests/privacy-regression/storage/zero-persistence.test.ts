/**
 * Privacy-regression: the zero-persistence harness (TECH-06).
 *
 * `assertNoPersistentStorageSideEffects` verifies, as far as the current
 * environment allows: no browser-storage globals were touched (they must not
 * even exist in the Node test env), strict modes never resolve a persistent
 * backend, non-persistent providers report honest flags, and no sentinel
 * reaches console/list/error channels during a full provider workout.
 */
import { describe, expect, it } from "vitest";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  EncryptedPersistentStorageProviderPlaceholder,
  MemoryStorageProvider,
  NullStorageProvider,
  resolveStoragePolicy,
  STORAGE_BACKEND_CAPABILITIES,
  STORAGE_DATA_CLASSES,
  StorageBackendNotImplementedError,
  type StoragePolicy,
} from "@freelayer/storage";
import {
  assertOutputDoesNotContainSentinel,
  captureConsoleOutput,
  SENTINEL,
} from "../../helpers/sentinel";

const STRICT_MODES = ["ghost", "bunker", "emergency"] as const;

async function assertNoPersistentStorageSideEffects(): Promise<void> {
  // 1. Browser-only persistence surfaces must be absent in the Node test env,
  //    and where the runtime itself provides web storage (Node ships
  //    localStorage/sessionStorage globals since the web-storage rollout),
  //    the storage layer must leave them completely untouched.
  const globals = globalThis as Record<string, unknown>;
  for (const api of ["indexedDB", "document", "caches"]) {
    expect(globals[api], `global "${api}" must be absent in the node test env`).toBeUndefined();
  }
  const webStores = ["localStorage", "sessionStorage"]
    .map((name) => globals[name] as { length: number } | undefined)
    .filter((store): store is { length: number } => store !== undefined);
  const initialLengths = webStores.map((store) => store.length);

  // 2. Strict modes never resolve a persistent backend for any data class.
  for (const mode of STRICT_MODES) {
    for (const dataClass of STORAGE_DATA_CLASSES) {
      const policy = resolveStoragePolicy({ mode, dataClass, sensitivity: "content" });
      expect(STORAGE_BACKEND_CAPABILITIES[policy.backend].persistent).toBe(false);
      expect(policy.persistentAllowed).toBe(false);
    }
  }

  // 3. Non-persistent providers report honest flags.
  expect(new MemoryStorageProvider().persistent).toBe(false);
  expect(new NullStorageProvider().persistent).toBe(false);
  const placeholder = new EncryptedPersistentStorageProviderPlaceholder();
  expect(placeholder.persistent).toBe(true);
  expect(placeholder.implemented).toBe(false);

  // 4. A full provider workout leaks no sentinel to console, lists, or errors.
  const output = await captureConsoleOutput(async () => {
    const provider = new MemoryStorageProvider();
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "message_content",
      sensitivity: "content",
    });
    await provider.write(
      {
        operation: "storage.write",
        dataClass: "message_content",
        key: "z1",
        value: SENTINEL,
        sensitivity: "content",
        reason: "zero-persistence harness",
      },
      issuePolicyDecision("persistence", "allowed", "private", "storage.write"),
      policy,
    );
    const listed = await provider.list(
      { operation: "storage.list", dataClass: "message_content", reason: "harness" },
      issuePolicyDecision("persistence", "allowed", "private", "storage.list"),
      policy,
    );
    assertOutputDoesNotContainSentinel(JSON.stringify(listed));
  });
  assertOutputDoesNotContainSentinel(output);

  // 5. Runtime-provided web storage (if any) is exactly as it was: the
  //    storage layer never touched it.
  webStores.forEach((store, index) => {
    expect(store.length).toBe(initialLengths[index]);
  });
}

describe("Zero-persistence harness", () => {
  it("assertNoPersistentStorageSideEffects passes on the current storage layer", async () => {
    await assertNoPersistentStorageSideEffects();
  });

  it("placeholder persistent backend throws instead of persisting", async () => {
    const placeholder = new EncryptedPersistentStorageProviderPlaceholder();
    const policy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "message_content",
      sensitivity: "content",
    });
    await expect(
      placeholder.write(
        {
          operation: "storage.write",
          dataClass: "message_content",
          key: "z2",
          value: SENTINEL,
          sensitivity: "content",
          reason: "harness",
        },
        issuePolicyDecision("persistence", "allowed", "standard", "storage.write"),
        policy,
      ),
    ).rejects.toBeInstanceOf(StorageBackendNotImplementedError);
  });
});

describe("Mode invariants added in TECH-06", () => {
  it("bunker denies export of protected content", () => {
    const policy = resolveStoragePolicy({
      mode: "bunker",
      dataClass: "bundle_export",
      sensitivity: "content",
    });
    expect(policy.allowExport).toBe(false);
  });

  it("emergency allows delete/clear (wipe direction) while denying writes", () => {
    const policy: StoragePolicy = resolveStoragePolicy({
      mode: "emergency",
      dataClass: "settings",
      sensitivity: "local_settings",
    });
    expect(policy.allowDelete).toBe(true);
    expect(policy.allowWrite).toBe(false);
  });

  it("device-risk state and watermark/canary state reject content-grade payloads", async () => {
    const provider = new MemoryStorageProvider();
    for (const dataClass of ["device_risk_state", "watermark_canary_state"] as const) {
      const policy = resolveStoragePolicy({
        mode: "private",
        dataClass,
        sensitivity: "content",
      });
      await expect(
        provider.write(
          {
            operation: "storage.write",
            dataClass,
            key: "e1",
            value: SENTINEL,
            sensitivity: "content",
            reason: "endpoint plaintext rule",
          },
          issuePolicyDecision("persistence", "allowed", "private", "storage.write"),
          policy,
        ),
      ).rejects.toThrow("must not contain content or key material");
    }
  });

  it("endpoint state with sensitive_metadata is accepted in memory (Standard/Private)", async () => {
    const provider = new MemoryStorageProvider();
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "device_risk_state",
      sensitivity: "sensitive_metadata",
    });
    const result = await provider.write(
      {
        operation: "storage.write",
        dataClass: "device_risk_state",
        key: "risk",
        value: { level: "medium" },
        sensitivity: "sensitive_metadata",
        reason: "endpoint hook",
      },
      issuePolicyDecision("persistence", "allowed", "private", "storage.write"),
      policy,
    );
    expect(result.ok).toBe(true);
  });
});
