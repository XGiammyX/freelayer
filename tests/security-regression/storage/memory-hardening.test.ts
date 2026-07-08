/**
 * Security-regression: MemoryStorageProvider hardening (TECH-06).
 * Sentinel rule: the secret sentinel must never appear in errors, console
 * output, or list metadata.
 */
import { describe, expect, it } from "vitest";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  InvalidStorageKeyError,
  MemoryStorageProvider,
  createMemoryStorageProvider,
  resolveStoragePolicy,
  UnsupportedStorageValueError,
  type StorageWriteRequest,
} from "@freelayer/storage";
import {
  assertErrorDoesNotContainSentinel,
  assertOutputDoesNotContainSentinel,
  captureConsoleOutput,
  SENTINEL,
} from "../../helpers/sentinel";

const policy = () =>
  resolveStoragePolicy({ mode: "private", dataClass: "message_content", sensitivity: "content" });
const wd = () => issuePolicyDecision("persistence", "allowed", "private", "storage.write");
const rd = () => issuePolicyDecision("persistence", "allowed", "private", "storage.read");
const ld = () => issuePolicyDecision("persistence", "allowed", "private", "storage.list");

const writeReq = (key: string, value: unknown): StorageWriteRequest => ({
  operation: "storage.write",
  dataClass: "message_content",
  key,
  value,
  sensitivity: "content",
  reason: "tech-06 hardening test",
});

describe("MemoryStorageProvider — key validation", () => {
  const badKeys = [
    "",
    "   ",
    "../escape",
    "..\\escape",
    "/absolute/path",
    "C:\\windows\\path",
    "https://example.org/x",
    "file://x",
    "data:text/plain",
    "line\nbreak",
    "x".repeat(300),
  ];

  it("rejects invalid keys without echoing them", async () => {
    const provider = new MemoryStorageProvider();
    for (const key of badKeys) {
      let caught: Error | null = null;
      try {
        await provider.write(writeReq(key, "v"), wd(), policy());
      } catch (error: unknown) {
        caught = error as Error;
      }
      expect(caught).toBeInstanceOf(InvalidStorageKeyError);
      expect(caught?.message).toBe("Invalid storage key.");
      // The (potentially sensitive) key never appears in the error.
      if (key.trim().length > 0) {
        expect(caught?.message).not.toContain(key.slice(0, 8));
      }
    }
  });

  it("rejects keys carrying the leak sentinel", async () => {
    const provider = new MemoryStorageProvider();
    await expect(provider.write(writeReq(`k-${SENTINEL}`, "v"), wd(), policy())).rejects.toThrow(
      "Invalid storage key.",
    );
  });
});

describe("MemoryStorageProvider — clone isolation", () => {
  it("mutating the original object after write does not change stored value", async () => {
    const provider = createMemoryStorageProvider();
    const original = { text: "before", nested: { n: 1 } };
    await provider.write(writeReq("m1", original), wd(), policy());
    original.text = "after";
    original.nested.n = 99;
    const result = await provider.read(
      { operation: "storage.read", dataClass: "message_content", key: "m1", reason: "t" },
      rd(),
      policy(),
    );
    expect(result.found).toBe(true);
    expect(result.value).toEqual({ text: "before", nested: { n: 1 } });
  });

  it("mutating the read result does not change stored value", async () => {
    const provider = createMemoryStorageProvider();
    await provider.write(writeReq("m1", { text: "stored" }), wd(), policy());
    const first = await provider.read(
      { operation: "storage.read", dataClass: "message_content", key: "m1", reason: "t" },
      rd(),
      policy(),
    );
    (first.value as { text: string }).text = "mutated";
    const second = await provider.read(
      { operation: "storage.read", dataClass: "message_content", key: "m1", reason: "t" },
      rd(),
      policy(),
    );
    expect((second.value as { text: string }).text).toBe("stored");
  });

  it("rejects uncloneable values instead of storing references", async () => {
    const provider = createMemoryStorageProvider();
    for (const value of [() => "fn", Symbol("s")]) {
      await expect(provider.write(writeReq("m1", value), wd(), policy())).rejects.toBeInstanceOf(
        UnsupportedStorageValueError,
      );
    }
  });
});

describe("MemoryStorageProvider — isolation and metadata", () => {
  it("instances do not share state", async () => {
    const a = new MemoryStorageProvider();
    const b = new MemoryStorageProvider();
    await a.write(writeReq("m1", "in-a"), wd(), policy());
    const fromB = await b.read(
      { operation: "storage.read", dataClass: "message_content", key: "m1", reason: "t" },
      rd(),
      policy(),
    );
    expect(fromB.found).toBe(false);
  });

  it("list returns metadata only and never the sentinel", async () => {
    const provider = new MemoryStorageProvider();
    await provider.write(writeReq("m1", SENTINEL), wd(), policy());
    const listed = await provider.list(
      { operation: "storage.list", dataClass: "message_content", reason: "t" },
      ld(),
      policy(),
    );
    expect(listed.entries).toHaveLength(1);
    const entry = listed.entries[0];
    expect(entry).toBeDefined();
    expect(entry?.key).toBe("m1");
    expect(entry?.dataClass).toBe("message_content");
    expect(entry?.sensitivity).toBe("content");
    expect(entry?.policyMode).toBe("private");
    expect(Object.values(entry ?? {}).join(" ")).not.toContain(SENTINEL);
    assertOutputDoesNotContainSentinel(JSON.stringify(listed));
  });

  it("provider flags are honest: not persistent, implemented", () => {
    const provider = new MemoryStorageProvider();
    expect(provider.persistent).toBe(false);
    expect(provider.implemented).toBe(true);
    expect(provider.kind).toBe("memory_only");
  });
});

describe("MemoryStorageProvider — no sensitive output", () => {
  it("write/read/denied paths emit no console output containing the sentinel", async () => {
    const output = await captureConsoleOutput(async () => {
      const provider = new MemoryStorageProvider();
      await provider.write(writeReq("m1", SENTINEL), wd(), policy());
      await provider.read(
        { operation: "storage.read", dataClass: "message_content", key: "m1", reason: "t" },
        rd(),
        policy(),
      );
      const denied = issuePolicyDecision("persistence", "denied", "private", "storage.write");
      await provider.write(writeReq("m2", SENTINEL), denied, policy()).catch(() => undefined);
      await provider.write(writeReq("../bad", SENTINEL), wd(), policy()).catch(() => undefined);
    });
    assertOutputDoesNotContainSentinel(output);
  });

  it("denied writes throw sentinel-free errors", async () => {
    const provider = new MemoryStorageProvider();
    const denied = issuePolicyDecision("persistence", "denied", "private", "storage.write");
    await assertErrorDoesNotContainSentinel(() =>
      provider.write(writeReq("m3", SENTINEL), denied, policy()),
    );
  });
});
