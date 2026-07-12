/**
 * RoomOS error taxonomy (TECH-16).
 *
 * REDACTION RULE: no error here may contain a room title, member alias,
 * message/task/note/decision content, file name, payload, or sentinel — only
 * operation kinds, object kinds, and non-sensitive policy reasons. Enforced by
 * construction (tests/security-regression/rooms).
 */

interface RoomErrorContext {
  readonly operation: string;
  /** Non-sensitive policy reason only. */
  readonly detail: string;
}

function describe(ctx: RoomErrorContext): string {
  return `room operation "${ctx.operation}" rejected: ${ctx.detail}`;
}

/** The resolved RoomPolicy denies this operation. */
export class RoomPolicyDeniedError extends Error {
  override readonly name = "RoomPolicyDeniedError";
  constructor(ctx: RoomErrorContext) {
    super(describe(ctx));
  }
}

/** The call tried to skip the barrier: missing/invalid/mismatched decision. */
export class RoomBypassAttemptError extends Error {
  override readonly name = "RoomBypassAttemptError";
  constructor(detail: string) {
    super(`Room bypass attempt rejected: ${detail}`);
  }
}

/** The PolicyDecision exists but was issued for a different side effect. */
export class RoomDecisionMismatchError extends Error {
  override readonly name = "RoomDecisionMismatchError";
  constructor(detail: string) {
    super(`Room decision mismatch: ${detail}`);
  }
}

/** Unknown/unsupported room operation — fail closed. */
export class InvalidRoomOperationError extends Error {
  override readonly name = "InvalidRoomOperationError";
  constructor() {
    super("Invalid or unsupported room operation.");
  }
}

/** Unknown/unsupported room object kind — fail closed. */
export class InvalidRoomObjectKindError extends Error {
  override readonly name = "InvalidRoomObjectKindError";
  constructor() {
    super("Invalid or unsupported room object kind.");
  }
}

/** The room id failed validation. Deliberately generic — never echoes input. */
export class InvalidRoomIdError extends Error {
  override readonly name = "InvalidRoomIdError";
  constructor() {
    super("Invalid room identifier.");
  }
}

/** A member/device reference failed validation. Never echoes input. */
export class InvalidRoomRefError extends Error {
  override readonly name = "InvalidRoomRefError";
  constructor() {
    super("Invalid room member/device reference.");
  }
}

/** Persistence (log/projection) attempted where policy forbids it. */
export class ForbiddenRoomPersistenceError extends Error {
  override readonly name = "ForbiddenRoomPersistenceError";
  constructor(ctx: RoomErrorContext) {
    super(describe(ctx));
  }
}

/** Any network/sync side effect — always forbidden in v1 (Gate H). */
export class ForbiddenRoomNetworkError extends Error {
  override readonly name = "ForbiddenRoomNetworkError";
  constructor(ctx: RoomErrorContext) {
    super(describe(ctx));
  }
}

/** Notification/AI/endpoint side effects a room op must never trigger in v1. */
export class ForbiddenRoomSideEffectError extends Error {
  override readonly name = "ForbiddenRoomSideEffectError";
  constructor(ctx: RoomErrorContext) {
    super(describe(ctx));
  }
}
