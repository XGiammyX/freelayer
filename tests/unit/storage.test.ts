import { describe, expect, it } from "vitest";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  EncryptedPersistentStorageProviderPlaceholder,
  MemoryStorageProvider,
  NullStorageProvider,
  resolveStoragePolicy,
  StorageBackendNotImplementedError,
  type StorageWriteRequest,
  type StorageReadRequest,
} from "@freelayer/storage";

const writeDecision = () =>
  issuePolicyDecision("persistence", "allowed", "private", "storage.write");
const readDecision = () => issuePolicyDecision("persistence", "allowed", "private", "storage.read");
const deleteDecision = () =>
  issuePolicyDecision("persistence", "allowed", "private", "storage.delete");
const clearDecision = () =>
  issuePolicyDecision("persistence", "allowed", "private", "storage.clear");

const policy = () =>
  resolveStoragePolicy({ mode: "private", dataClass: "message_content", sensitivity: "content" });

const writeReq = (value: unknown): StorageWriteRequest => ({
  operation: "storage.write",
  dataClass: "message_content",
  key: "m1",
  value,
  sensitivity: "content",
  reason: "unit test",
});

const readReq: StorageReadRequest = {
  operation: "storage.read",
  dataClass: "message_content",
  key: "m1",
  reason: "unit test",
};

describe("MemoryStorageProvider (hardened)", () => {
  it("writes and reads within one instance under an allowing policy", async () => {
    const provider = new MemoryStorageProvider();
    await provider.write(writeReq("hello"), writeDecision(), policy());
    await expect(provider.read(readReq, readDecision(), policy())).resolves.toBe("hello");
  });

  it("does not persist across instance recreation", async () => {
    const first = new MemoryStorageProvider();
    await first.write(writeReq("hello"), writeDecision(), policy());
    const second = new MemoryStorageProvider();
    await expect(second.read(readReq, readDecision(), policy())).resolves.toBeNull();
  });

  it("delete removes a key and clear removes everything", async () => {
    const provider = new MemoryStorageProvider();
    await provider.write(writeReq("hello"), writeDecision(), policy());
    await provider.delete(
      { operation: "storage.delete", dataClass: "message_content", key: "m1", reason: "t" },
      deleteDecision(),
      policy(),
    );
    await expect(provider.read(readReq, readDecision(), policy())).resolves.toBeNull();

    await provider.write(writeReq("again"), writeDecision(), policy());
    await provider.clear({ operation: "storage.clear", reason: "t" }, clearDecision(), policy());
    await expect(provider.read(readReq, readDecision(), policy())).resolves.toBeNull();
  });

  it("lists only keys of the requested data class", async () => {
    const provider = new MemoryStorageProvider();
    await provider.write(writeReq("hello"), writeDecision(), policy());
    const listDecision = issuePolicyDecision("persistence", "allowed", "private", "storage.list");
    await expect(
      provider.list(
        { operation: "storage.list", dataClass: "message_content", reason: "t" },
        listDecision,
        policy(),
      ),
    ).resolves.toEqual(["m1"]);
  });
});

describe("NullStorageProvider (hardened)", () => {
  it("accepts allowed writes but stores nothing; list returns empty", async () => {
    const provider = new NullStorageProvider();
    const nullPolicy = { ...policy(), backend: "null" as const };
    await provider.write(writeReq("secret"), writeDecision(), nullPolicy);
    await expect(provider.read(readReq, readDecision(), nullPolicy)).resolves.toBeNull();
    const listDecision = issuePolicyDecision("persistence", "allowed", "private", "storage.list");
    await expect(
      provider.list(
        { operation: "storage.list", dataClass: "message_content", reason: "t" },
        listDecision,
        nullPolicy,
      ),
    ).resolves.toEqual([]);
  });
});

describe("EncryptedPersistentStorageProviderPlaceholder", () => {
  it("throws not-implemented for every operation", async () => {
    const provider = new EncryptedPersistentStorageProviderPlaceholder();
    await expect(provider.read(readReq, readDecision(), policy())).rejects.toBeInstanceOf(
      StorageBackendNotImplementedError,
    );
    await expect(provider.write(writeReq("x"), writeDecision(), policy())).rejects.toThrow(
      "Encrypted persistent storage is not implemented yet",
    );
  });
});
