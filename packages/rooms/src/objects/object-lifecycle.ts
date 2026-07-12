/**
 * Object lifecycle + per-kind status state machines (TECH-18). Explicit tables;
 * no arbitrary reopening. Tombstone is terminal (never restored) and is NOT
 * forensic erasure. Redaction is one-way (content never restored).
 */

import { RoomObjectConcurrencyError } from "./object-errors";
import type {
  RoomDecisionStatus,
  RoomObjectLifecycle,
  RoomPollStatus,
  RoomTaskStatus,
} from "./object-types";

/** Mutation intent classes used for lifecycle gating. */
export type ObjectMutationClass = "create" | "content_update" | "redact" | "archive" | "tombstone";

/**
 * Which mutation classes each lifecycle state accepts.
 * active: all updates. archived: read-only except redact/tombstone.
 * redacted: no content restore — only archive/tombstone. tombstone: terminal.
 */
const LIFECYCLE_ALLOWS: Readonly<Record<RoomObjectLifecycle, readonly ObjectMutationClass[]>> = {
  active: ["content_update", "redact", "archive", "tombstone"],
  archived: ["redact", "tombstone"],
  redacted: ["archive", "tombstone"],
  deleted_tombstone: [],
};

export function assertObjectLifecycleAllows(
  current: RoomObjectLifecycle,
  mutation: ObjectMutationClass,
): void {
  if (current === "deleted_tombstone") {
    throw new RoomObjectConcurrencyError("object_is_terminal");
  }
  if (!LIFECYCLE_ALLOWS[current].includes(mutation)) {
    throw new RoomObjectConcurrencyError("invalid_lifecycle_transition");
  }
}

// ---------------------------------------------------------------------------
// Task status transitions
// ---------------------------------------------------------------------------

const TASK_TRANSITIONS: Readonly<Record<RoomTaskStatus, readonly RoomTaskStatus[]>> = {
  todo: ["in_progress", "done", "cancelled"],
  in_progress: ["todo", "done", "cancelled"],
  // Resolved tasks do not return to an ordinary active state (only lifecycle
  // archive/redact/tombstone applies, handled by the lifecycle machine).
  done: [],
  cancelled: [],
};

export function assertTaskStatusTransition(from: RoomTaskStatus, to: RoomTaskStatus): void {
  if (from === to || !TASK_TRANSITIONS[from].includes(to)) {
    throw new RoomObjectConcurrencyError("invalid_status_transition");
  }
}

// ---------------------------------------------------------------------------
// Decision status transitions (resolved decisions never return to proposed)
// ---------------------------------------------------------------------------

const DECISION_TRANSITIONS: Readonly<Record<RoomDecisionStatus, readonly RoomDecisionStatus[]>> = {
  proposed: ["accepted", "rejected", "superseded"],
  accepted: ["superseded"],
  rejected: ["superseded"],
  superseded: [],
};

export function assertDecisionStatusTransition(
  from: RoomDecisionStatus,
  to: RoomDecisionStatus,
): void {
  if (from === to || !DECISION_TRANSITIONS[from].includes(to)) {
    throw new RoomObjectConcurrencyError("invalid_status_transition");
  }
}

// ---------------------------------------------------------------------------
// Poll status transitions (opening freezes question/options in v1)
// ---------------------------------------------------------------------------

const POLL_TRANSITIONS: Readonly<Record<RoomPollStatus, readonly RoomPollStatus[]>> = {
  draft: ["open_local_placeholder"],
  open_local_placeholder: ["closed_local_placeholder"],
  closed_local_placeholder: [],
};

export function assertPollStatusTransition(from: RoomPollStatus, to: RoomPollStatus): void {
  if (from === to || !POLL_TRANSITIONS[from].includes(to)) {
    throw new RoomObjectConcurrencyError("invalid_status_transition");
  }
}

/** Poll draft content may only be edited while still a draft. */
export function assertPollDraftEditable(status: RoomPollStatus): void {
  if (status !== "draft") {
    throw new RoomObjectConcurrencyError("invalid_status_transition");
  }
}
