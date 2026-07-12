/**
 * RoomOS operation-log error taxonomy (TECH-17).
 *
 * REDACTION RULE: no error here may contain an event payload, room title,
 * member alias, filename, raw event JSON, or sentinel — only stable category
 * information (error codes, operation kinds) safe enough to debug with.
 */

export type RoomEventValidationErrorCode =
  | "unsupported_schema_version"
  | "unsupported_projection_version"
  | "invalid_event_id"
  | "invalid_room_id"
  | "invalid_local_sequence"
  | "unknown_operation"
  | "unknown_object_kind"
  | "invalid_payload"
  | "room_mismatch"
  | "duplicate_event_id"
  | "duplicate_local_sequence"
  | "sequence_gap"
  | "out_of_order"
  | "invalid_lifecycle_transition";

/** A structural/internal-invariant failure on a room event. */
export class RoomEventValidationError extends Error {
  override readonly name: string = "RoomEventValidationError";
  readonly code: RoomEventValidationErrorCode;
  constructor(code: RoomEventValidationErrorCode) {
    super(`Room event rejected: ${code}.`);
    this.code = code;
  }
}

export class RoomEventVersionUnsupportedError extends RoomEventValidationError {
  override readonly name = "RoomEventVersionUnsupportedError";
  constructor(code: "unsupported_schema_version" | "unsupported_projection_version") {
    super(code);
  }
}

export class RoomDuplicateEventError extends RoomEventValidationError {
  override readonly name = "RoomDuplicateEventError";
  constructor() {
    super("duplicate_event_id");
  }
}

export class RoomSequenceConflictError extends RoomEventValidationError {
  override readonly name = "RoomSequenceConflictError";
  constructor() {
    super("duplicate_local_sequence");
  }
}

export class RoomSequenceGapError extends RoomEventValidationError {
  override readonly name = "RoomSequenceGapError";
  constructor() {
    super("sequence_gap");
  }
}

export class RoomEventOrderError extends RoomEventValidationError {
  override readonly name = "RoomEventOrderError";
  constructor() {
    super("out_of_order");
  }
}

export class RoomEventRoomMismatchError extends RoomEventValidationError {
  override readonly name = "RoomEventRoomMismatchError";
  constructor() {
    super("room_mismatch");
  }
}

export class RoomLifecycleTransitionError extends RoomEventValidationError {
  override readonly name = "RoomLifecycleTransitionError";
  constructor() {
    super("invalid_lifecycle_transition");
  }
}

/** The pure reducer met an event it cannot apply — fail closed, no fallback. */
export class RoomProjectionError extends Error {
  override readonly name = "RoomProjectionError";
  constructor(detail: string) {
    super(`Room projection rejected: ${detail}`);
  }
}

/** Replay failed before/without producing a partial result. */
export class RoomReplayError extends Error {
  override readonly name = "RoomReplayError";
  readonly code: RoomEventValidationErrorCode | "replay_invalid_input";
  constructor(code: RoomEventValidationErrorCode | "replay_invalid_input") {
    super(`Room replay rejected: ${code}.`);
    this.code = code;
  }
}

/** The payload cannot be safely cloned; storing it by reference would leak. */
export class RoomEventCloneError extends Error {
  override readonly name = "RoomEventCloneError";
  constructor() {
    super("Room event payload is not safely cloneable.");
  }
}
