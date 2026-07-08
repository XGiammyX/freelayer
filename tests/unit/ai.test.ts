import { describe, expect, it } from "vitest";
import { DisabledAIProvider, type AIPolicyDecision } from "@freelayer/ai";
import { issuePolicyDecision } from "@freelayer/privacy";

describe("DisabledAIProvider", () => {
  it("rejects even with an allowing decision — AI is disabled by default", async () => {
    const provider = new DisabledAIProvider();
    const decision: AIPolicyDecision = {
      base: issuePolicyDecision("localAI", "allowed", "standard"),
      roomScopeOnly: true,
    };
    await expect(
      provider.run({ task: "room_summary", roomScope: "room-1" }, decision),
    ).rejects.toThrow("Local AI is disabled by default and not implemented yet.");
  });
});
