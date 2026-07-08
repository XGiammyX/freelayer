/**
 * Privacy-regression: the storage-policy matrix keeps its promises
 * (docs/PRIVACY_MODEL.md — machine-checkable claims must be tested).
 */
import { describe, expect, it } from "vitest";
import {
  resolveStoragePolicy,
  STORAGE_DATA_CLASSES,
  STORAGE_BACKEND_CAPABILITIES,
  type StorageDataClass,
} from "@freelayer/storage";

const contentSensitivity = (dataClass: StorageDataClass) =>
  dataClass.includes("cache") || dataClass.includes("preview") || dataClass.includes("thumbnail")
    ? ("derived_content" as const)
    : ("content" as const);

describe("Ghost mode", () => {
  it("denies persistent writes for every data class", () => {
    for (const dataClass of STORAGE_DATA_CLASSES) {
      const policy = resolveStoragePolicy({
        mode: "ghost",
        dataClass,
        sensitivity: contentSensitivity(dataClass),
      });
      expect(policy.persistentAllowed).toBe(false);
      expect(STORAGE_BACKEND_CAPABILITIES[policy.backend].persistent).toBe(false);
    }
  });

  it("denies AI caches", () => {
    const policy = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "ai_prompt_cache",
      sensitivity: "derived_content",
    });
    expect(policy.allowWrite).toBe(false);
  });

  it("denies preview and thumbnail caches", () => {
    for (const dataClass of ["preview_cache", "thumbnail_cache"] as const) {
      expect(
        resolveStoragePolicy({ mode: "ghost", dataClass, sensitivity: "derived_content" })
          .allowWrite,
      ).toBe(false);
    }
  });
});

describe("Bunker mode", () => {
  it("denies persistent writes for every data class", () => {
    for (const dataClass of STORAGE_DATA_CLASSES) {
      const policy = resolveStoragePolicy({
        mode: "bunker",
        dataClass,
        sensitivity: contentSensitivity(dataClass),
      });
      expect(policy.persistentAllowed).toBe(false);
      expect(STORAGE_BACKEND_CAPABILITIES[policy.backend].persistent).toBe(false);
    }
  });

  it("denies thumbnail cache, AI cache, and reveal-history writes", () => {
    for (const dataClass of [
      "thumbnail_cache",
      "ai_embedding_index",
      "protected_content_reveal_state",
    ] as const) {
      expect(
        resolveStoragePolicy({ mode: "bunker", dataClass, sensitivity: "derived_content" })
          .allowWrite,
      ).toBe(false);
    }
  });

  it("denies all cache-class writes (caches inherit strict policy)", () => {
    for (const dataClass of ["cache", "media_cache", "preview_cache", "thumbnail_cache"] as const) {
      const policy = resolveStoragePolicy({
        mode: "bunker",
        dataClass,
        sensitivity: "derived_content",
      });
      expect(policy.allowWrite).toBe(false);
      expect(policy.allowCache).toBe(false);
    }
  });
});

describe("Emergency mode", () => {
  it("denies normal writes and reads; delete stays possible (wipe direction)", () => {
    const policy = resolveStoragePolicy({
      mode: "emergency",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(policy.allowWrite).toBe(false);
    expect(policy.allowRead).toBe(false);
    expect(policy.allowDelete).toBe(true);
    expect(policy.backend).toBe("null");
  });
});

describe("Private mode", () => {
  it("denies preview cache by default", () => {
    expect(
      resolveStoragePolicy({
        mode: "private",
        dataClass: "preview_cache",
        sensitivity: "derived_content",
      }).allowWrite,
    ).toBe(false);
  });

  it("allows memory-only content in the current implementation", () => {
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(policy.allowWrite).toBe(true);
    expect(policy.backend).toBe("memory_only");
    expect(policy.persistentAllowed).toBe(false);
  });
});

describe("Standard mode", () => {
  it("targets the unimplemented encrypted backend for content (writes will fail hard)", () => {
    const policy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(policy.backend).toBe("encrypted_persistent_placeholder");
    expect(STORAGE_BACKEND_CAPABILITIES[policy.backend].implemented).toBe(false);
  });

  it("denies AI caches in v0 (require AIPolicy, Gate I)", () => {
    expect(
      resolveStoragePolicy({
        mode: "standard",
        dataClass: "ai_output_cache",
        sensitivity: "derived_content",
      }).allowWrite,
    ).toBe(false);
  });
});

describe("ScreenShield tightening (ADR-0012 hooks)", () => {
  it("sealed denies protected preview cache regardless of mode", () => {
    const policy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "preview_cache",
      sensitivity: "derived_content",
      screenShieldLevel: "sealed",
    });
    expect(policy.allowWrite).toBe(false);
    expect(policy.allowCache).toBe(false);
  });

  it("sealed denies reveal-history writes", () => {
    expect(
      resolveStoragePolicy({
        mode: "private",
        dataClass: "protected_content_reveal_state",
        sensitivity: "sensitive_metadata",
        screenShieldLevel: "sealed",
      }).allowWrite,
    ).toBe(false);
  });
});

describe("Device risk tightening", () => {
  it("high risk denies protected reveal-state persistence", () => {
    const policy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "protected_content_reveal_state",
      sensitivity: "sensitive_metadata",
      deviceRiskLevel: "high",
    });
    expect(policy.allowWrite).toBe(false);
  });

  it("critical risk denies exports", () => {
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "bundle_export",
      sensitivity: "content",
      deviceRiskLevel: "critical",
    });
    expect(policy.allowExport).toBe(false);
  });
});

describe("Room policy composition (Sovereign Room)", () => {
  it("room policy can tighten device behavior", () => {
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "message_content",
      sensitivity: "content",
      roomPolicy: { allowWrite: false },
    });
    expect(policy.allowWrite).toBe(false);
  });

  it("room policy cannot loosen device behavior (strictest wins)", () => {
    const policy = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "preview_cache",
      sensitivity: "derived_content",
      roomPolicy: { allowWrite: true, allowCache: true, persistentAllowed: true },
    });
    expect(policy.allowWrite).toBe(false);
    expect(policy.persistentAllowed).toBe(false);
  });
});
