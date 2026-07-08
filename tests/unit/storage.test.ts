import { describe, expect, it } from "vitest";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  EncryptedPersistentStorageProviderPlaceholder,
  MemoryStorageProvider,
  NullStorageProvider,
  resolveStoragePolicy,
  StorageBackendNotImplementedError,
  type StoragePolicy,
  type StorageReadRequest,
  type StorageWriteRequest,
} from "@freelayer/storage";

const writeDecision = () =>
  issuePolicyDecision("persistence", "allowed", "private", "storage.write");
const readDecision = () => issuePolicyDecision("persistence", "allowed", "private", "storage.read");
const deleteDecision = () =>
  issuePolicyDecision("persistence", "allowed", "private", "storage.delete");
const clearDecision = () =>
  issuePolicyDecision("persistence", "allowed", "private", "storage.clear");
const listDecision = () => issuePolicyDecision("persistence", "allowed", "private", "storage.list");

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
    const written = await provider.write(writeReq("hello"), writeDecision(), policy());
    expect(written).toEqual({ ok: true, backend: "memory_only", dataClass: "message_content" });
    const read = await provider.read(readReq, readDecision(), policy());
    expect(read.found).toBe(true);
    expect(read.value).toBe("hello");
  });

  it("does not persist across instance recreation", async () => {
    const first = new MemoryStorageProvider();
    await first.write(writeReq("hello"), writeDecision(), policy());
    const second = new MemoryStorageProvider();
    const read = await second.read(readReq, readDecision(), policy());
    expect(read.found).toBe(false);
  });

  it("delete removes a key and clear removes everything", async () => {
    const provider = new MemoryStorageProvider();
    await provider.write(writeReq("hello"), writeDecision(), policy());
    await provider.delete(
      { operation: "storage.delete", dataClass: "message_content", key: "m1", reason: "t" },
      deleteDecision(),
      policy(),
    );
    expect((await provider.read(readReq, readDecision(), policy())).found).toBe(false);

    await provider.write(writeReq("again"), writeDecision(), policy());
    await provider.clear({ operation: "storage.clear", reason: "t" }, clearDecision(), policy());
    expect((await provider.read(readReq, readDecision(), policy())).found).toBe(false);
  });

  it("lists metadata for the requested data class only", async () => {
    const provider = new MemoryStorageProvider();
    await provider.write(writeReq("hello"), writeDecision(), policy());
    const listed = await provider.list(
      { operation: "storage.list", dataClass: "message_content", reason: "t" },
      listDecision(),
      policy(),
    );
    expect(listed.entries.map((e) => e.key)).toEqual(["m1"]);
    expect(listed.entries[0]?.policyMode).toBe("private");
  });
});

describe("NullStorageProvider (hardened)", () => {
  it("accepts allowed writes but stores nothing; list returns empty", async () => {
    const provider = new NullStorageProvider();
    const nullPolicy: StoragePolicy = { ...policy(), backend: "null" };
    await provider.write(writeReq("secret"), writeDecision(), nullPolicy);
    const read = await provider.read(readReq, readDecision(), nullPolicy);
    expect(read.found).toBe(false);
    const listed = await provider.list(
      { operation: "storage.list", dataClass: "message_content", reason: "t" },
      listDecision(),
      nullPolicy,
    );
    expect(listed.entries).toEqual([]);
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
