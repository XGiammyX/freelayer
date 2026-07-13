/**
 * RoomOS query error taxonomy (TECH-19). Every error is REDACTED: a stable
 * machine code and a STATIC message only — never the query term, room title,
 * object content, actor ref, tags, filenames, raw cursor, or the leak
 * sentinel. Rejected requests are never stringified.
 */

export type RoomQueryErrorCode =
  | "unsupported_schema_version"
  | "unknown_query"
  | "unknown_view"
  | "unknown_filter"
  | "unknown_sort"
  | "invalid_field"
  | "unexpected_field"
  | "dangerous_key"
  | "invalid_room_id"
  | "invalid_object_id"
  | "room_mismatch"
  | "object_not_available"
  | "decision_missing"
  | "decision_mismatch"
  | "policy_denied"
  | "view_denied"
  | "search_denied"
  | "count_denied"
  | "empty_term"
  | "term_too_large"
  | "limit_too_small"
  | "limit_too_large"
  | "cursor_room_mismatch"
  | "cursor_sort_mismatch"
  | "cursor_invalid"
  | "forbidden_side_effect";

/** Safe, generic denial message (never mentions the term/room/content). */
export const SAFE_DENIAL_MESSAGE = "Room query was denied by the active privacy policy.";

export class RoomQueryError extends Error {
  readonly code: RoomQueryErrorCode;
  constructor(code: RoomQueryErrorCode, detail?: string) {
    // `detail` must be a STATIC caller string — never user input/content.
    super(detail ? `${code}: ${detail}` : code);
    this.name = "RoomQueryError";
    this.code = code;
  }
}

export class RoomQueryValidationError extends RoomQueryError {
  constructor(code: RoomQueryErrorCode, detail?: string) {
    super(code, detail);
    this.name = "RoomQueryValidationError";
  }
}
export class RoomQueryPolicyDeniedError extends RoomQueryError {
  constructor(detail?: string) {
    super("policy_denied", detail);
    this.name = "RoomQueryPolicyDeniedError";
  }
}
export class RoomQueryDecisionMismatchError extends RoomQueryError {
  constructor(detail?: string) {
    super("decision_mismatch", detail);
    this.name = "RoomQueryDecisionMismatchError";
  }
}
export class RoomQueryRoomMismatchError extends RoomQueryError {
  constructor() {
    super("room_mismatch");
    this.name = "RoomQueryRoomMismatchError";
  }
}
export class RoomQueryObjectNotAvailableError extends RoomQueryError {
  constructor() {
    super("object_not_available");
    this.name = "RoomQueryObjectNotAvailableError";
  }
}
export class RoomQueryCursorError extends RoomQueryError {
  constructor(code: "cursor_room_mismatch" | "cursor_sort_mismatch" | "cursor_invalid") {
    super(code);
    this.name = "RoomQueryCursorError";
  }
}
export class RoomQueryLimitError extends RoomQueryError {
  constructor(code: "limit_too_small" | "limit_too_large") {
    super(code);
    this.name = "RoomQueryLimitError";
  }
}
export class RoomSearchDeniedError extends RoomQueryError {
  constructor() {
    super("search_denied");
    this.name = "RoomSearchDeniedError";
  }
}
export class RoomQueryViewDeniedError extends RoomQueryError {
  constructor() {
    super("view_denied");
    this.name = "RoomQueryViewDeniedError";
  }
}

export function queryFail(code: RoomQueryErrorCode, detail?: string): never {
  throw new RoomQueryValidationError(code, detail);
}
