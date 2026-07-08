import { describe, expect, it } from "vitest";
import { createAuditEvent, redact } from "@freelayer/security";
import { createFreeLayerClient } from "@freelayer/sdk";

describe("redact", () => {
  it("produces a label that contains no original value", () => {
    const value = redact("room-content");
    expect(value).toBe("[redacted:room-content]");
  });
});

describe("createAuditEvent", () => {
  it("accepts only redacted detail and increases logical sequence", () => {
    const first = createAuditEvent("test.kind", redact("detail"));
    const second = createAuditEvent("test.kind", redact("detail"));
    expect(second.seq).toBeGreaterThan(first.seq);
  });
});

describe("sdk placeholder client", () => {
  it("reports honest foundation-only status", () => {
    const status = createFreeLayerClient().describeStatus();
    expect(status.stage).toBe("research_foundation");
    expect(status.crypto).toBe("not_implemented");
    expect(status.productFeatures).toBe("none");
    expect(status.release).toBe("none");
  });
});
