/**
 * Security-regression (TECH-16): RoomOS never leaks — errors/audit/projections
 * are sentinel-free; denial precedes side effects; gated operations are not
 * executable; the guardrail catches bypass fixtures; the matrix agrees with
 * RoomPolicy on key rows.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { evaluatePolicyMatrix, issuePolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import {
  assertRoomOperationAllowed,
  createLocalRoom,
  createRedactedRoomAuditEvent,
  createRoomOperationEvent,
  expectedRoomScope,
  projectRoomState,
  resolveRoomPolicy,
  ROOM_CAPABILITY,
  validateRoomMemberRef,
  type RoomOperationRequest,
} from "@freelayer/rooms";

const SENTINEL = "FREELAYER_ROOMOS_SENTINEL_DO_NOT_LEAK";

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (error: unknown) {
    return error instanceof Error
      ? `${error.name}: ${error.message} ${error.stack ?? ""}`
      : String(error);
  }
  throw new Error("expected the operation to throw");
}

describe("Errors never leak (tests 1-5)", () => {
  it("denied operations throw sentinel-free, content-free errors", () => {
    const policy = resolveRoomPolicy({ mode: "emergency", roomKind: "workspace" });
    const request: RoomOperationRequest = {
      operation: "message.create_placeholder",
      mode: "emergency",
      reason: "send",
      payload: {
        title: SENTINEL,
        member: "alice-alias",
        file: "secret-plans.pdf",
        body: `room title: ${SENTINEL}`,
      },
    };
    const decision = issuePolicyDecision(
      ROOM_CAPABILITY,
      "allowed",
      "emergency",
      expectedRoomScope("message.create_placeholder"),
    );
    const text = errorText(() => assertRoomOperationAllowed(request, decision, policy));
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain("alice-alias");
    expect(text).not.toContain("secret-plans.pdf");
  });

  it("id/ref validation errors never echo the input", () => {
    const text = errorText(() => validateRoomMemberRef(`Alice ${SENTINEL}!!`));
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain("Alice");
  });
});

describe("Audit + projection never leak (tests 6, 9)", () => {
  it("redacted room audit drops all strings and the sentinel", () => {
    const audit = createRedactedRoomAuditEvent({
      kind: "room.rename",
      severity: "warning",
      reasonCode: "default_deny",
      details: { title: SENTINEL, member: "alice", attempts: 2, blocked: true },
    });
    const serialized = JSON.stringify(audit);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).not.toContain("alice");
    expect(audit.details).toEqual({ attempts: 2, blocked: true });
    expect(audit.createdAtLocal.startsWith("local:")).toBe(true);
  });

  it("event ids and object summaries carry no payload", () => {
    const decision = issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.create");
    const { state } = createLocalRoom({ kind: "workspace", mode: "private", decision });
    const event = createRoomOperationEvent({
      roomId: state.roomId,
      operation: "note.create_placeholder",
      objectKind: "note",
      payloadClass: "content",
      payload: { body: SENTINEL },
    });
    expect(event.id).not.toContain(SENTINEL);
    const projected = projectRoomState(state, [event], state.policy);
    expect(JSON.stringify(projected)).not.toContain(SENTINEL); // summary is redacted
  });
});

describe("Denial precedes side effects; no direct mutation path (tests 7-8)", () => {
  it("a denied operation reaches no downstream code", () => {
    let downstream = false;
    const policy = resolveRoomPolicy({ mode: "emergency", roomKind: "workspace" });
    const decision = issuePolicyDecision(ROOM_CAPABILITY, "allowed", "emergency", "room.mutate");
    expect(() => {
      assertRoomOperationAllowed(
        { operation: "note.create_placeholder", mode: "emergency", reason: "x" },
        decision,
        policy,
      );
      downstream = true;
    }).toThrow();
    expect(downstream).toBe(false);
  });

  it("materialized state is immutable-by-convention (readonly arrays; projection returns new objects)", () => {
    const decision = issuePolicyDecision(ROOM_CAPABILITY, "allowed", "standard", "room.create");
    const { state } = createLocalRoom({ kind: "workspace", mode: "standard", decision });
    const projected = projectRoomState(
      state,
      [
        createRoomOperationEvent({
          roomId: state.roomId,
          operation: "task.create_placeholder",
          objectKind: "task",
        }),
      ],
      state.policy,
    );
    expect(projected).not.toBe(state);
    expect(state.objects.length).toBe(0); // original untouched
    expect(projected.objects.length).toBe(1);
  });
});

describe("Gated operations are not executable (tests 11-14)", () => {
  it("sync/crypto/identity stay future-gated; endpoint 'active' unrepresentable", () => {
    for (const [domain, operation] of [
      ["room", "room.sync"],
      ["crypto", "crypto.any"],
      ["identity", "identity.invite"],
      ["capsule", "capsule.wire_format"],
    ] as const) {
      for (const mode of ["standard", "ghost"] as const) {
        const d = evaluatePolicyMatrix({ mode, domain, operation });
        expect(d.allowed, `${domain}/${mode}`).toBe(false);
        expect(d.effect, `${domain}/${mode}`).toBe("future_gate");
      }
    }
    // Endpoint-defense integration values do not include "active".
    const policy = resolveRoomPolicy({ mode: "standard", roomKind: "workspace" });
    expect(["externalized", "hook_only", "future_gate", "not_available"]).toContain(
      policy.endpointDefenseIntegration,
    );
  });
});

describe("Matrix ↔ RoomPolicy agreement (test 15)", () => {
  it("key rows agree across all modes", () => {
    const modes = [
      "standard",
      "private",
      "ghost",
      "bunker",
      "offline_capsule",
      "emergency",
    ] as const;
    for (const mode of modes) {
      const policy = resolveRoomPolicy({ mode, roomKind: "workspace" });
      const create = evaluatePolicyMatrix({ mode, domain: "room", operation: "room.create" });
      expect(create.allowed, `create/${mode}`).toBe(policy.allowLocalContentMutation);
      const logPersist = evaluatePolicyMatrix({
        mode,
        domain: "room",
        operation: "room.operation_log.persist",
      });
      expect(logPersist.allowed, `log/${mode}`).toBe(policy.allowOperationLogPersistence);
      const projPersist = evaluatePolicyMatrix({
        mode,
        domain: "room",
        operation: "room.project.persist",
      });
      expect(projPersist.allowed, `proj/${mode}`).toBe(policy.allowPersistentProjection);
      const sync = evaluatePolicyMatrix({ mode, domain: "room", operation: "room.sync" });
      expect(sync.allowed, `sync/${mode}`).toBe(policy.allowNetworkSync);
    }
  });
});

describe("RoomOS guardrail", () => {
  const SCRIPT = "scripts/check-no-roomos-bypass.mjs";
  function run(dir?: string): { status: number | null; output: string } {
    const result = spawnSync(process.execPath, dir ? [SCRIPT, dir] : [SCRIPT], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  }

  it("catches direct mutation / payload logging / overclaim / CRDT fixtures", () => {
    const { status, output } = run("tests/fixtures/roomos-bypass");
    expect(status).toBe(1);
    expect(output).toContain(".objects.push(");
    expect(output).toContain("console.log(event");
    expect(output).toContain("endpointDefenseActive: true");
    expect(output).toContain('from "yjs"');
  });

  it("passes on the real source", () => {
    expect(run().status).toBe(0);
  });
});

describe("Decision authenticity reuse (WeakSet provenance)", () => {
  it("a structurally-perfect forged decision is rejected", () => {
    const genuine = issuePolicyDecision(ROOM_CAPABILITY, "allowed", "standard", "room.create");
    const forged = { ...genuine } as PolicyDecision;
    expect(() =>
      createLocalRoom({ kind: "workspace", mode: "standard", decision: forged }),
    ).toThrow(/bypass/i);
  });
});
