/**
 * RoomOS object content limits (TECH-18). v1 ENGINEERING SAFETY limits (memory
 * exhaustion, oversized-input, unbounded-array defenses) — NOT permanent
 * product limits. Byte counts are UTF-8. Tests must cover exact boundary, one
 * over boundary, and multi-byte Unicode.
 */

export const ROOM_OBJECT_LIMITS_V1 = {
  messageBodyBytes: 32_768,
  noteTitleBytes: 512,
  noteBodyBytes: 131_072,
  taskTitleBytes: 1_024,
  taskDescriptionBytes: 16_384,
  decisionStatementBytes: 16_384,
  decisionRationaleBytes: 65_536,
  pollQuestionBytes: 4_096,
  pollOptionLabelBytes: 1_024,
  pollOptionCount: 32,
  fileDisplayNameBytes: 1_024,
  mediaTypeBytes: 255,
  tagBytes: 128,
  tagCount: 32,
} as const;

export type RoomObjectLimits = typeof ROOM_OBJECT_LIMITS_V1;

/** Minimum poll options in v1. */
export const POLL_MIN_OPTIONS = 2;

/** Max assignee placeholder refs on a task (bounded array defense). */
export const TASK_MAX_ASSIGNEES = 64;
