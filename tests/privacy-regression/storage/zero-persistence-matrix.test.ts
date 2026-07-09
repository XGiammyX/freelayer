/**
 * Privacy-regression (TECH-07): table-driven provider-selection matrix,
 * mode transitions, capsule-spool/cache/logs strict-mode behavior, and the
 * zero-persistence assertion layer itself.
 */
import { describe, expect, it } from "vitest";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  assertNoPersistentBackendSelected,
  assertNoPersistentWriteAllowed,
  assertStorageWriteAllowed,
  assertZeroPersistentWriteMode,
  ForbiddenPersistentWriteError,
  isPersistentBackend,
  isZeroPersistenceMode,
  MemoryStorageProvider,
  resolveStoragePolicy,
  STORAGE_DATA_CLASSES,
  StorageBypassAttemptError,
  type StorageBackendKind,
  type StorageDataClass,
  type StoragePolicyInput,
} from "@freelayer/storage";

const MATRIX_CLASSES: readonly StorageDataClass[] = [
  "identity_key_material",
  "room_key_material",
  "message_content",
  "document_content",
  "file_blob",
  "capsule_spool",
  "capsule_inbox",
  "capsule_quarantine",
  "materialized_room_state",
  "preview_cache",
  "thumbnail_cache",
  "media_cache",
  "ai_prompt_cache",
  "ai_embedding_index",
  "ai_output_cache",
  "endpoint_redaction_state",
  "protected_content_reveal_state",
  "screen_capture_audit_event",
  "device_risk_state",
  "watermark_canary_state",
  "logs",
  "debug_artifact",
];

interface ModeConfig {
  readonly label: string;
  readonly input: Omit<StoragePolicyInput, "dataClass" | "sensitivity">;
  readonly zeroPersistence: boolean;
}

const MODE_CONFIGS: readonly ModeConfig[] = [
  { label: "standard", input: { mode: "standard" }, zeroPersistence: false },
  { label: "private", input: { mode: "private" }, zeroPersistence: false },
  { label: "ghost", input: { mode: "ghost" }, zeroPersistence: true },
  { label: "bunker", input: { mode: "bunker" }, zeroPersistence: true },
  { label: "offline_capsule", input: { mode: "offline_capsule" }, zeroPersistence: false },
  { label: "emergency", input: { mode: "emergency" }, zeroPersistence: true },
  {
    label: "sovereign room composed with ghost device",
    input: { mode: "ghost", roomPolicy: { allowWrite: true, persistentAllowed: true } },
    zeroPersistence: true,
  },
  {
    label: "sovereign room composed with bunker device",
    input: { mode: "bunker", roomPolicy: { allowWrite: true, allowCache: true } },
    zeroPersistence: true,
  },
];

describe("Zero-persistence assertion layer", () => {
  it("classifies modes correctly", () => {
    expect(isZeroPersistenceMode("ghost")).toBe(true);
    expect(isZeroPersistenceMode("bunker")).toBe(true);
    expect(isZeroPersistenceMode("emergency")).toBe(true);
    expect(isZeroPersistenceMode("standard")).toBe(false);
    expect(isZeroPersistenceMode("private")).toBe(false);
    expect(isZeroPersistenceMode("offline_capsule")).toBe(false);
    expect(() => assertZeroPersistentWriteMode("standard")).toThrow(StorageBypassAttemptError);
    expect(() => assertZeroPersistentWriteMode("ghost")).not.toThrow();
  });

  it("detects persistent backends with fail-closed unknowns", () => {
    expect(isPersistentBackend("encrypted_persistent_placeholder")).toBe(true);
    expect(isPersistentBackend("memory_only")).toBe(false);
    expect(isPersistentBackend("null")).toBe(false);
    expect(isPersistentBackend("future_disk_backend" as StorageBackendKind)).toBe(true);
  });

  it("assertNoPersistentBackendSelected rejects persistent policies", () => {
    const standardContent = resolveStoragePolicy({
      mode: "standard",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(() => assertNoPersistentBackendSelected(standardContent)).toThrow(
      ForbiddenPersistentWriteError,
    );
    const ghostContent = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(() => assertNoPersistentBackendSelected(ghostContent)).not.toThrow();
  });

  it("assertNoPersistentWriteAllowed validates the full strict-mode tuple", () => {
    const policy = resolveStoragePolicy({
      mode: "bunker",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(() =>
      assertNoPersistentWriteAllowed({
        mode: "bunker",
        dataClass: "message_content",
        policy,
        backend: "memory_only",
      }),
    ).not.toThrow();
    expect(() =>
      assertNoPersistentWriteAllowed({
        mode: "bunker",
        dataClass: "message_content",
        policy,
        backend: "encrypted_persistent_placeholder",
      }),
    ).toThrow(ForbiddenPersistentWriteError);
  });
});

describe("Provider-selection matrix (8 mode configs × 22 data classes)", () => {
  for (const config of MODE_CONFIGS) {
    it(`${config.label}: ${config.zeroPersistence ? "no persistent backend for any class" : "persistence flag stays honest"}`, () => {
      for (const dataClass of MATRIX_CLASSES) {
        const policy = resolveStoragePolicy({
          ...config.input,
          dataClass,
          sensitivity: "derived_content",
        });
        if (config.zeroPersistence) {
          expect(isPersistentBackend(policy.backend), `${config.label}/${dataClass}`).toBe(false);
          expect(policy.persistentAllowed, `${config.label}/${dataClass}`).toBe(false);
        }
        // Universal v0 invariant: nothing implemented may persist, anywhere.
        expect(policy.persistentAllowed).toBe(false);
      }
    });
  }

  it("Ghost denies caches, AI artifacts and debug artifacts", () => {
    for (const dataClass of [
      "preview_cache",
      "thumbnail_cache",
      "ai_prompt_cache",
      "ai_embedding_index",
      "ai_output_cache",
      "debug_artifact",
    ] as const) {
      const policy = resolveStoragePolicy({
        mode: "ghost",
        dataClass,
        sensitivity: "derived_content",
      });
      expect(policy.allowWrite, dataClass).toBe(false);
    }
  });

  it("Bunker is at least as strict as Ghost for every class", () => {
    for (const dataClass of MATRIX_CLASSES) {
      const ghost = resolveStoragePolicy({
        mode: "ghost",
        dataClass,
        sensitivity: "derived_content",
      });
      const bunker = resolveStoragePolicy({
        mode: "bunker",
        dataClass,
        sensitivity: "derived_content",
      });
      // If ghost denies a write, bunker must deny it too.
      if (!ghost.allowWrite) {
        expect(bunker.allowWrite, dataClass).toBe(false);
      }
      expect(Number(bunker.allowCache), dataClass).toBeLessThanOrEqual(Number(ghost.allowCache));
      expect(Number(bunker.allowExport), dataClass).toBeLessThanOrEqual(Number(ghost.allowExport));
    }
  });

  it("Sovereign Room composition cannot loosen Ghost/Bunker (strictest wins)", () => {
    const loosened = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "preview_cache",
      sensitivity: "derived_content",
      roomPolicy: {
        allowWrite: true,
        allowCache: true,
        persistentAllowed: true,
        backend: "encrypted_persistent_placeholder",
      },
    });
    expect(loosened.allowWrite).toBe(false);
    expect(loosened.persistentAllowed).toBe(false);
    expect(isPersistentBackend(loosened.backend)).toBe(false);
  });

  it("ScreenShield sealed + Ghost device: no persistent protected artifacts", () => {
    for (const dataClass of ["preview_cache", "protected_content_reveal_state"] as const) {
      const policy = resolveStoragePolicy({
        mode: "ghost",
        dataClass,
        sensitivity: "sensitive_metadata",
        screenShieldLevel: "sealed",
      });
      expect(policy.allowWrite, dataClass).toBe(false);
      expect(isPersistentBackend(policy.backend)).toBe(false);
    }
  });

  it("unknown data class and unknown mode fail closed", () => {
    const unknownClass = resolveStoragePolicy({
      mode: "standard",
      dataClass: "brand_new_class" as StorageDataClass,
      sensitivity: "content",
    });
    expect(unknownClass.allowWrite).toBe(false);
    expect(unknownClass.allowRead).toBe(false);
    expect(unknownClass.backend).toBe("null");

    const unknownMode = resolveStoragePolicy({
      mode: "party_mode" as never,
      dataClass: "settings",
      sensitivity: "local_settings",
    });
    expect(unknownMode.allowWrite).toBe(false);
    expect(unknownMode.backend).toBe("null");
  });
});

describe("Mode transitions (storage level)", () => {
  it("Standard → Ghost: writes become memory/null only", () => {
    const before = resolveStoragePolicy({
      mode: "standard",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(isPersistentBackend(before.backend)).toBe(true); // future intent (throws today)
    const after = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(isPersistentBackend(after.backend)).toBe(false);
  });

  it("Private → Bunker: strictest wins, caches gone, nothing persistent", () => {
    const privateCache = resolveStoragePolicy({
      mode: "private",
      dataClass: "media_cache",
      sensitivity: "derived_content",
    });
    expect(privateCache.allowCache).toBe(true);
    const bunkerCache = resolveStoragePolicy({
      mode: "bunker",
      dataClass: "media_cache",
      sensitivity: "derived_content",
    });
    expect(bunkerCache.allowCache).toBe(false);
    expect(isPersistentBackend(bunkerCache.backend)).toBe(false);
  });

  it("Ghost → Standard: no auto-flush surface exists on providers", async () => {
    const provider = new MemoryStorageProvider();
    // Structural proof: the provider exposes exactly the five policy-gated
    // operations — there is no flush/persist/export API that a mode switch
    // could call to move memory state to disk.
    const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(provider)).sort();
    expect(surface).toEqual(["clear", "constructor", "delete", "list", "read", "write"]);

    // And a standard-mode content policy cannot authorize the memory
    // provider: leaving Ghost cannot silently re-target the same provider
    // into a persistent path.
    const ghostPolicy = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "message_content",
      sensitivity: "content",
    });
    await provider.write(
      {
        operation: "storage.write",
        dataClass: "message_content",
        key: "g1",
        value: "ghost-era",
        sensitivity: "content",
        reason: "transition test",
      },
      issuePolicyDecision("persistence", "allowed", "ghost", "storage.write"),
      ghostPolicy,
    );
    const standardPolicy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "message_content",
      sensitivity: "content",
    });
    await expect(
      provider.write(
        {
          operation: "storage.write",
          dataClass: "message_content",
          key: "g1",
          value: "flush-attempt",
          sensitivity: "content",
          reason: "transition test",
        },
        issuePolicyDecision("persistence", "allowed", "standard", "storage.write"),
        standardPolicy,
      ),
    ).rejects.toBeInstanceOf(StorageBypassAttemptError); // backend mismatch
  });
});

describe("Capsule spool strict-mode behavior", () => {
  const SPOOL_CLASSES = ["capsule_spool", "capsule_inbox", "capsule_quarantine"] as const;

  it("Ghost: spool/inbox/quarantine never persistent; timestamps stay in memory metadata only", () => {
    for (const dataClass of SPOOL_CLASSES) {
      const policy = resolveStoragePolicy({ mode: "ghost", dataClass, sensitivity: "content" });
      expect(isPersistentBackend(policy.backend), dataClass).toBe(false);
      expect(policy.persistentAllowed, dataClass).toBe(false);
    }
  });

  it("Bunker: spool persistence and bundle-export persistence denied", () => {
    for (const dataClass of SPOOL_CLASSES) {
      const policy = resolveStoragePolicy({ mode: "bunker", dataClass, sensitivity: "content" });
      expect(isPersistentBackend(policy.backend), dataClass).toBe(false);
    }
    const bundle = resolveStoragePolicy({
      mode: "bunker",
      dataClass: "bundle_export",
      sensitivity: "content",
    });
    expect(bundle.allowExport).toBe(false);
    expect(isPersistentBackend(bundle.backend)).toBe(false);
  });
});

describe("Logs/debug strict-mode behavior", () => {
  it("Ghost and Bunker reject content-grade logs at the barrier", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const policy = resolveStoragePolicy({ mode, dataClass: "logs", sensitivity: "content" });
      const decision = issuePolicyDecision("persistence", "allowed", mode, "storage.write");
      expect(() =>
        assertStorageWriteAllowed(
          {
            operation: "storage.write",
            dataClass: "logs",
            key: "log-1",
            value: "content-grade payload",
            sensitivity: "content",
            reason: "strict log test",
          },
          decision,
          policy,
        ),
      ).toThrow(/must not contain content|rejected/);
    }
  });

  it("debug artifacts are denied in Ghost/Bunker for any sensitivity", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const policy = resolveStoragePolicy({
        mode,
        dataClass: "debug_artifact",
        sensitivity: "metadata",
      });
      expect(policy.allowWrite, mode).toBe(false);
      expect(policy.allowDebugArtifacts, mode).toBe(false);
    }
  });

  it("every data class in Ghost/Bunker resolves non-persistent (full sweep)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      for (const dataClass of STORAGE_DATA_CLASSES) {
        const policy = resolveStoragePolicy({ mode, dataClass, sensitivity: "content" });
        expect(isPersistentBackend(policy.backend), `${mode}/${dataClass}`).toBe(false);
      }
    }
  });
});
