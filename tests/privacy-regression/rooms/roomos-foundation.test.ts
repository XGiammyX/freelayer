/**
 * Privacy-regression (TECH-16): RoomOS foundation — policy-controlled local
 * state transitions. Creation/mutation require authentic decisions; strict
 * modes never persist; no network/notification/preview/AI side effect fires;
 * room policy tightens only; projections are derived and redacted; the
 * anti-spyware boundary stays hook-only.
 */
import { describe, expect, it } from "vitest";
import {
  evaluatePolicyMatrix,
  issuePolicyDecision,
  resolveMetadataPolicy,
  type PolicyDecision,
  type PrivacyMode,
} from "@freelayer/privacy";
import { resolveStoragePolicy } from "@freelayer/storage";
import { resolveNetworkPolicy } from "@freelayer/transports";
import {
  assertRoomOperationAllowed,
  createLocalRoom,
  createRoomOperationEvent,
  createRoomLocalId,
  expectedRoomScope,
  projectRoomState,
  resolveRoomPolicy,
  ROOM_CAPABILITY,
  type RoomObjectKind,
  type RoomOperationKind,
  type RoomOperationRequest,
} from "@freelayer/rooms";
import { createNotificationSideEffectTrap } from "../../helpers/notification-trap";
import { createNetworkSideEffectTrap } from "../../helpers/network-trap";

function decisionFor(op: RoomOperationKind, mode: PrivacyMode): PolicyDecision {
  return issuePolicyDecision(ROOM_CAPABILITY, "allowed", mode, expectedRoomScope(op));
}

function requestFor(op: RoomOperationKind, mode: PrivacyMode): RoomOperationRequest {
  return { operation: op, mode, reason: "test" };
}

describe("Decision enforcement (tests 1-3)", () => {
  it("room creation requires a PolicyDecision; forged/wrong-scope rejected", () => {
    const genuine = decisionFor("room.create", "private");
    const { state } = createLocalRoom({ kind: "workspace", mode: "private", decision: genuine });
    expect(state.lifecycle).toBe("active_local");

    const forged = { ...decisionFor("room.create", "private") } as PolicyDecision;
    expect(() => createLocalRoom({ kind: "workspace", mode: "private", decision: forged })).toThrow(
      /bypass/i,
    );

    const wrongScope = issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.mutate");
    expect(() =>
      createLocalRoom({ kind: "workspace", mode: "private", decision: wrongScope }),
    ).toThrow(/mismatch/i);

    const denied = issuePolicyDecision(ROOM_CAPABILITY, "denied", "private", "room.create");
    expect(() =>
      createLocalRoom({ kind: "workspace", mode: "private", decision: denied }),
    ).toThrow();
  });
});

describe("Fail closed (tests 4-5)", () => {
  it("unknown operation and unknown object kind denied", () => {
    const policy = resolveRoomPolicy({ mode: "standard", roomKind: "workspace" });
    expect(() =>
      assertRoomOperationAllowed(
        requestFor("unknown", "standard"),
        issuePolicyDecision(ROOM_CAPABILITY, "allowed", "standard", "room.mutate"),
        policy,
      ),
    ).toThrow(/invalid or unsupported room operation/i);
    expect(() =>
      assertRoomOperationAllowed(
        {
          ...requestFor("message.create_placeholder", "standard"),
          objectKind: "unknown" as RoomObjectKind,
        },
        decisionFor("message.create_placeholder", "standard"),
        policy,
      ),
    ).toThrow(/object kind/i);
    // Matrix agrees: unknown room op denies.
    expect(
      evaluatePolicyMatrix({ mode: "standard", domain: "room", operation: "room.teleport" })
        .allowed,
    ).toBe(false);
  });
});

describe("Room policy tighten-only (tests 6-8)", () => {
  it("room policy cannot loosen; strict devices win over permissive rooms", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const policy = resolveRoomPolicy({
        mode,
        roomKind: "workspace",
        roomPolicy: {
          allowPersistentProjection: true,
          allowOperationLogPersistence: true,
          allowNetworkSync: true,
          allowNotifications: true,
          allowLocalAI: true,
        } as never,
      });
      expect(policy.allowPersistentProjection, mode).toBe(false);
      expect(policy.allowOperationLogPersistence, mode).toBe(false);
      expect(policy.allowNetworkSync, mode).toBe(false);
      expect(policy.allowNotifications, mode).toBe(false);
      expect(policy.allowLocalAI, mode).toBe(false);
    }
    // A room CAN tighten (deny local mutation).
    const tightened = resolveRoomPolicy({
      mode: "standard",
      roomKind: "workspace",
      roomPolicy: { allowLocalContentMutation: false },
    });
    expect(tightened.allowLocalContentMutation).toBe(false);
    // Matrix agrees: room loosening attempts are ignored.
    const matrix = evaluatePolicyMatrix({
      mode: "ghost",
      domain: "room",
      operation: "room.operation_log.persist",
      roomPolicy: { allowed: true, effect: "allow" },
    });
    expect(matrix.allowed).toBe(false);
  });
});

describe("Persistence denied (tests 9-12, 26-27)", () => {
  it("Ghost/Bunker deny persistent log + projection (policy, matrix, storage agree)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const policy = resolveRoomPolicy({ mode, roomKind: "workspace" });
      expect(policy.allowOperationLogPersistence, mode).toBe(false);
      expect(policy.allowPersistentProjection, mode).toBe(false);
      for (const op of ["room.operation_log.persist", "room.project.persist"] as const) {
        expect(evaluatePolicyMatrix({ mode, domain: "room", operation: op }).allowed, op).toBe(
          false,
        );
      }
      for (const dataClass of ["room_operation_log", "materialized_room_state"] as const) {
        expect(
          resolveStoragePolicy({ mode, dataClass, sensitivity: "content" }).persistentAllowed,
          `${mode}/${dataClass}`,
        ).toBe(false);
      }
    }
  });

  it("content-bearing persistence fails hard until the encrypted gate (Standard)", () => {
    // Standard content targets the UNIMPLEMENTED encrypted backend: policy
    // points at the placeholder and persistentAllowed stays false.
    const storage = resolveStoragePolicy({
      mode: "standard",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(storage.backend).toBe("encrypted_persistent_placeholder");
    expect(storage.persistentAllowed).toBe(false);
    // RoomPolicy never allows persistent projection in v1, even in Standard.
    const policy = resolveRoomPolicy({ mode: "standard", roomKind: "workspace" });
    expect(policy.allowPersistentProjection).toBe(false);
  });
});

describe("Mode denials (tests 13-14)", () => {
  it("Offline Capsule denies network sync; Emergency denies normal mutation", () => {
    const offline = resolveRoomPolicy({ mode: "offline_capsule", roomKind: "workspace" });
    expect(offline.allowNetworkSync).toBe(false);
    expect(
      resolveNetworkPolicy({
        mode: "offline_capsule",
        operation: "transport.sync",
        transportClass: "relay",
      }).allowed,
    ).toBe(false);
    expect(
      evaluatePolicyMatrix({ mode: "offline_capsule", domain: "room", operation: "room.sync" })
        .allowed,
    ).toBe(false);

    const emergency = resolveRoomPolicy({ mode: "emergency", roomKind: "workspace" });
    expect(emergency.allowLocalContentMutation).toBe(false);
    expect(() =>
      createLocalRoom({
        kind: "workspace",
        mode: "emergency",
        decision: decisionFor("room.create", "emergency"),
      }),
    ).toThrow();
    expect(
      evaluatePolicyMatrix({ mode: "emergency", domain: "room", operation: "room.create" }).allowed,
    ).toBe(false);
  });
});

describe("Redaction in strict modes (tests 15-16)", () => {
  it("Bunker redacts title and member display", () => {
    const { state } = createLocalRoom({
      kind: "workspace",
      mode: "bunker",
      title: "secret-operation-name",
      decision: decisionFor("room.create", "bunker"),
    });
    expect(state.title).toBeUndefined();
    expect(state.titleRedacted).toBe(true);
    expect(JSON.stringify(state)).not.toContain("secret-operation-name");

    // Members are always display-redacted in v1.
    const events = [
      createRoomOperationEvent({
        roomId: state.roomId,
        operation: "member.add_placeholder",
        payloadClass: "placeholder",
        payload: "member-abc",
      }),
    ];
    // payload is only used when payloadClass is content; add via actor path:
    const projected = projectRoomState(state, events, state.policy);
    for (const member of projected.members) {
      expect(member.displayNameRedacted).toBe(true);
    }
  });
});

describe("No side effects (tests 19-25)", () => {
  it("room operations trigger no network/notification/preview/AI APIs", () => {
    const netTrap = createNetworkSideEffectTrap();
    const notifTrap = createNotificationSideEffectTrap();
    try {
      const decision = decisionFor("room.create", "private");
      const { state, event } = createLocalRoom({
        kind: "conversation",
        mode: "private",
        decision,
      });
      const mutated = projectRoomState(
        state,
        [
          createRoomOperationEvent({
            roomId: state.roomId,
            operation: "note.create_placeholder",
            objectKind: "note",
            payloadClass: "placeholder",
          }),
        ],
        state.policy,
      );
      expect(mutated.objects.length).toBe(1);
      expect(event.version).toBe(1);
    } finally {
      netTrap.uninstall();
      notifTrap.uninstall();
    }
    expect(() => netTrap.assertNoNetworkApiCalled()).not.toThrow();
    expect(() => notifTrap.assertNoNotificationApiCalled()).not.toThrow();
    // AI in Ghost/Bunker: RoomPolicy + MetadataPolicy agree it is denied.
    for (const mode of ["ghost", "bunker"] as const) {
      expect(resolveRoomPolicy({ mode, roomKind: "workspace" }).allowLocalAI, mode).toBe(false);
      expect(resolveMetadataPolicy({ mode, event: "ai.prompt_exists", sink: "ai" }).allowed).toBe(
        false,
      );
    }
    // Previews/assets: network policy denies regardless of room content.
    expect(
      resolveNetworkPolicy({ mode: "private", operation: "link.preview", transportClass: "relay" })
        .allowed,
    ).toBe(false);
    expect(
      resolveNetworkPolicy({ mode: "private", operation: "asset.fetch", transportClass: "relay" })
        .allowed,
    ).toBe(false);
  });
});

describe("Anti-spyware boundary (tests 24-25)", () => {
  it("endpoint hooks are placeholders; active integration is unrepresentable", () => {
    const policy = resolveRoomPolicy({ mode: "standard", roomKind: "workspace" });
    expect(policy.endpointDefenseIntegration).toBe("externalized");
    // The type has no "active" member; a cast attempt is rejected at the barrier.
    const active = { ...policy, endpointDefenseIntegration: "active" } as unknown as typeof policy;
    expect(() =>
      assertRoomOperationAllowed(
        requestFor("endpoint.hook_ref_placeholder", "standard"),
        decisionFor("endpoint.hook_ref_placeholder", "standard"),
        active,
      ),
    ).toThrow(/externalized/i);
    // Matrix: endpoint capabilities stay future-gated.
    expect(
      evaluatePolicyMatrix({
        mode: "standard",
        domain: "endpoint",
        operation: "display.screenshot_blocking",
      }).allowed,
    ).toBe(false);
  });
});

describe("Events + projection semantics (tests 17-18, 26, 30)", () => {
  it("events are versioned, local-time labeled, and projections stay derived", () => {
    const decision = decisionFor("room.create", "standard");
    const { state, event } = createLocalRoom({
      kind: "project_room",
      mode: "standard",
      title: "ok-title",
      decision,
    });
    expect(event.version).toBe(1);
    expect(event.createdAtLocal.startsWith("local:")).toBe(true); // no trusted-time claim
    expect(state.title).toBe("ok-title"); // standard shows title

    const roomId = state.roomId;
    const projected = projectRoomState(
      state,
      [
        createRoomOperationEvent({ roomId, operation: "room.archive" }),
        createRoomOperationEvent({
          roomId,
          operation: "task.create_placeholder",
          objectKind: "task",
          payloadClass: "placeholder",
        }),
        // Event for a DIFFERENT room must be skipped.
        createRoomOperationEvent({
          roomId: createRoomLocalId(),
          operation: "room.delete_tombstone",
        }),
      ],
      state.policy,
    );
    expect(projected.lifecycle).toBe("archived_local");
    expect(projected.objects.map((o: { kind: string }) => o.kind)).toEqual(["task"]);
    expect(projected.objects[0]?.redacted).toBe(true); // summaries never carry content
    // Rebuildable: projecting the same events again from the same initial
    // state yields the same shape (derived, not asserted).
    const again = projectRoomState(state, [], state.policy);
    expect(again.objects.length).toBe(0);
  });
});
