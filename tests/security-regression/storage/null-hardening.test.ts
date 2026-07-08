/**
 * Security-regression: NullStorageProvider hardening (TECH-06).
 * The null provider validates everything and stores absolutely nothing.
 */
import { describe, expect, it } from "vitest";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  createNullStorageProvider,
  InvalidStorageKeyError,
  NullStorageProvider,
  resolveStoragePolicy,
  StorageDecisionMismatchError,
  StoragePolicyDeniedError,
  type StoragePolicy,
  type StorageWriteRequest,
} from "@freelayer/storage";
import {
  assertErrorDoesNotContainSentinel,
  assertOutputDoesNotContainSentinel,
  captureConsoleOutput,
  SENTINEL,
} from "../../helpers/sentinel";

// A null-backend policy: Emergency resolves to null but denies writes, so we
// derive an allowing null policy from a memory policy for provider testing.
const nullPolicy = (): StoragePolicy => ({
  ...resolveStoragePolicy({
    mode: "private",
    dataClass: "message_content",
    sensitivity: "content",
  }),
  backend: "null",
});

const wd = () => issuePolicyDecision("persistence", "allowed", "private", "storage.write");
const rd = () => issuePolicyDecision("persistence", "allowed", "private", "storage.read");

const writeReq = (value: unknown): StorageWriteRequest => ({
  operation: "storage.write",
  dataClass: "message_content",
  key: "n1",
  value,
  sensitivity: "content",
  reason: "tech-06 null test",
});

describe("NullStorageProvider", () => {
  it("accepts allowed writes, but reads return not-found", async () => {
    const provider = createNullStorageProvider();
    const written = await provider.write(writeReq(SENTINEL), wd(), nullPolicy());
    expect(written.ok).toBe(true);
    const read = await provider.read(
      { operation: "storage.read", dataClass: "message_content", key: "n1", reason: "t" },
      rd(),
      nullPolicy(),
    );
    expect(read.found).toBe(false);
    expect(read.value).toBeUndefined();
  });

  it("list is empty and delete/clear are validated no-ops", async () => {
    const provider = new NullStorageProvider();
    await provider.write(writeReq(SENTINEL), wd(), nullPolicy());
    const listDecision = issuePolicyDecision("persistence", "allowed", "private", "storage.list");
    const listed = await provider.list(
      { operation: "storage.list", dataClass: "message_content", reason: "t" },
      listDecision,
      nullPolicy(),
    );
    expect(listed.entries).toEqual([]);
    const deleted = await provider.delete(
      { operation: "storage.delete", dataClass: "message_content", key: "n1", reason: "t" },
      issuePolicyDecision("persistence", "allowed", "private", "storage.delete"),
      nullPolicy(),
    );
    expect(deleted.ok).toBe(true);
    const cleared = await provider.clear(
      { operation: "storage.clear", reason: "t" },
      issuePolicyDecision("persistence", "allowed", "private", "storage.clear"),
      nullPolicy(),
    );
    expect(cleared.ok).toBe(true);
  });

  it("repeated writes do not grow internal state (provider owns no value fields)", async () => {
    const provider = new NullStorageProvider();
    for (let i = 0; i < 50; i += 1) {
      await provider.write(writeReq(`${SENTINEL}-${i}`), wd(), nullPolicy());
    }
    // Structural check: no own enumerable property of the provider holds state.
    expect(Object.keys(provider)).toEqual(["kind", "persistent", "implemented"]);
    expect(JSON.stringify(provider)).not.toContain(SENTINEL);
  });

  it("rejects denied decisions and wrong side-effect decisions", async () => {
    const provider = new NullStorageProvider();
    const denied = issuePolicyDecision("persistence", "denied", "private", "storage.write");
    await expect(provider.write(writeReq("v"), denied, nullPolicy())).rejects.toBeInstanceOf(
      StoragePolicyDeniedError,
    );
    const wrongScope = issuePolicyDecision("persistence", "allowed", "private", "storage.read");
    await expect(provider.write(writeReq("v"), wrongScope, nullPolicy())).rejects.toBeInstanceOf(
      StorageDecisionMismatchError,
    );
  });

  it("rejects invalid keys without echoing them", async () => {
    const provider = new NullStorageProvider();
    await expect(
      provider.write({ ...writeReq("v"), key: "../escape" }, wd(), nullPolicy()),
    ).rejects.toBeInstanceOf(InvalidStorageKeyError);
  });

  it("errors and console output never contain the sentinel", async () => {
    const provider = new NullStorageProvider();
    const denied = issuePolicyDecision("persistence", "denied", "private", "storage.write");
    await assertErrorDoesNotContainSentinel(() =>
      provider.write(writeReq(SENTINEL), denied, nullPolicy()),
    );
    const output = await captureConsoleOutput(async () => {
      await provider.write(writeReq(SENTINEL), wd(), nullPolicy());
      await provider.write(writeReq(SENTINEL), denied, nullPolicy()).catch(() => undefined);
    });
    assertOutputDoesNotContainSentinel(output);
  });

  it("provider flags are honest: not persistent, implemented", () => {
    const provider = new NullStorageProvider();
    expect(provider.persistent).toBe(false);
    expect(provider.implemented).toBe(true);
    expect(provider.kind).toBe("null");
  });
});
