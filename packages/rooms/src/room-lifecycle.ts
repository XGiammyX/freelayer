/**
 * Room lifecycle transition state machine (TECH-17). One explicit,
 * conservative v1 table — no broad restore/unarchive without design.
 * `deleted_tombstone` is terminal; tombstoning does NOT claim forensic
 * deletion (docs/SOVEREIGN_ROOMS.md).
 */

import { RoomLifecycleTransitionError } from "./room-log-errors";
import type { RoomLifecycleState, RoomOperationKind } from "./room-types";

const MUTATION_OPERATIONS: readonly RoomOperationKind[] = [
  "room.rename",
  "member.add_placeholder",
  "member.remove_placeholder",
  "message.create_placeholder",
  "note.create_placeholder",
  "task.create_placeholder",
  "decision.record_placeholder",
  "poll.create_placeholder",
  "file.attach_ref_placeholder",
  "ai.memory_ref_placeholder",
  "endpoint.hook_ref_placeholder",
];

/** Lifecycle targets each lock-family operation may reach. */
const LOCK_TARGETS: readonly RoomLifecycleState[] = ["sealed_local", "emergency_locked"];

export function assertValidRoomLifecycleTransition(input: {
  readonly current: RoomLifecycleState;
  readonly operation: RoomOperationKind;
  readonly target?: RoomLifecycleState;
}): void {
  const { current, operation, target } = input;
  const deny = (): never => {
    throw new RoomLifecycleTransitionError();
  };

  if (current === "unknown" || target === "unknown") deny();

  switch (current) {
    case "draft": {
      if (operation === "room.create") return; // completion → active_local
      if (operation === "room.policy_update") return; // restrictive update
      if (operation === "room.delete_tombstone") return;
      return deny();
    }
    case "active_local": {
      if (MUTATION_OPERATIONS.includes(operation)) return;
      if (operation === "room.policy_update") return;
      if (operation === "audit.append_redacted") return;
      if (operation === "room.archive") {
        return target === undefined || target === "archived_local" ? undefined : deny();
      }
      if (operation === "room.lock") {
        return target !== undefined && LOCK_TARGETS.includes(target) ? undefined : deny();
      }
      if (operation === "room.delete_tombstone") return;
      return deny();
    }
    case "sealed_local": {
      if (operation === "audit.append_redacted") return;
      if (operation === "room.policy_update") return; // stricter only (policy layer enforces)
      if (operation === "room.lock") {
        return target === "emergency_locked" ? undefined : deny();
      }
      if (operation === "room.archive") {
        return target === undefined || target === "archived_local" ? undefined : deny();
      }
      if (operation === "room.delete_tombstone") return;
      return deny();
    }
    case "archived_local": {
      if (operation === "audit.append_redacted") return;
      if (operation === "room.policy_update") return;
      if (operation === "room.delete_tombstone") return;
      return deny();
    }
    case "emergency_locked": {
      if (operation === "audit.append_redacted") return; // if policy permits
      if (operation === "room.delete_tombstone") return;
      return deny();
    }
    case "deleted_tombstone":
      return deny(); // terminal — no normal mutation
    default:
      return deny();
  }
}
