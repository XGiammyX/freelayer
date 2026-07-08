import { describe, expect, it } from "vitest";
import { issuePolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { PolicyBypassError } from "@freelayer/security";
import { MockTransport } from "@freelayer/transports";

const allowed = () => issuePolicyDecision("network", "allowed", "standard");

describe("MockTransport (test-only, no I/O)", () => {
  it("round-trips capsule bytes in memory with a valid decision", async () => {
    const transport = new MockTransport();
    const bytes = new Uint8Array([9, 8, 7]);
    await transport.send({ capsuleBytes: bytes, routingHint: new Uint8Array() }, allowed());
    const received = await transport.receive({ pickupHint: new Uint8Array() }, allowed());
    expect(received).toEqual([bytes]);
  });

  it("rejects calls without a valid PolicyDecision (anti-bypass)", async () => {
    const transport = new MockTransport();
    const forged = {} as unknown as PolicyDecision;
    await expect(
      transport.send({ capsuleBytes: new Uint8Array(), routingHint: new Uint8Array() }, forged),
    ).rejects.toBeInstanceOf(PolicyBypassError);
  });
});
