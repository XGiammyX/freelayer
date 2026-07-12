/**
 * RoomOS object-model error taxonomy (TECH-18). Every error is REDACTED: it
 * carries a stable machine code and NEVER the object content, command payload,
 * titles, member aliases, filenames, URLs, or the leak sentinel. Rejected
 * commands are never stringified into messages.
 */

export type RoomObjectErrorCode =
  | "unsupported_schema_version"
  | "unsupported_projection_version"
  | "unknown_object_kind"
  | "unknown_command"
  | "invalid_object_id"
  | "invalid_object_revision"
  | "invalid_room_id"
  | "invalid_actor_ref"
  | "invalid_field"
  | "unexpected_field"
  | "dangerous_key"
  | "content_too_large"
  | "invalid_plain_text"
  | "too_many_options"
  | "too_few_options"
  | "duplicate_option_id"
  | "too_many_tags"
  | "tag_too_large"
  | "forbidden_reference" // path/URL/credential in a file ref
  | "room_mismatch"
  | "object_not_found"
  | "cross_object_reference"
  | "stale_revision"
  | "future_revision"
  | "missing_expected_revision"
  | "revision_overflow"
  | "invalid_lifecycle_transition"
  | "invalid_status_transition"
  | "object_is_terminal"
  | "content_persistence_forbidden"
  | "policy_denied"
  | "decision_missing"
  | "decision_mismatch"
  | "forbidden_side_effect"
  | "clone_failed";

export class RoomObjectError extends Error {
  readonly code: RoomObjectErrorCode;
  constructor(code: RoomObjectErrorCode, detail?: string) {
    // `detail` must be a caller-controlled STATIC string (never user content).
    super(detail ? `${code}: ${detail}` : code);
    this.name = "RoomObjectError";
    this.code = code;
  }
}

/** Structural/content validation failure (fail-closed; content-free). */
export class RoomObjectValidationError extends RoomObjectError {
  constructor(code: RoomObjectErrorCode, detail?: string) {
    super(code, detail);
    this.name = "RoomObjectValidationError";
  }
}

/** Authorization/policy failure (missing/fake/denied/mismatched decision). */
export class RoomObjectAuthorizationError extends RoomObjectError {
  constructor(code: RoomObjectErrorCode, detail?: string) {
    super(code, detail);
    this.name = "RoomObjectAuthorizationError";
  }
}

/** Optimistic-concurrency / lifecycle failure. */
export class RoomObjectConcurrencyError extends RoomObjectError {
  constructor(code: RoomObjectErrorCode, detail?: string) {
    super(code, detail);
    this.name = "RoomObjectConcurrencyError";
  }
}

export function objectFail(code: RoomObjectErrorCode, detail?: string): never {
  throw new RoomObjectValidationError(code, detail);
}
