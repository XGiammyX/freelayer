/**
 * Redacted room audit events (TECH-16). No room title, no member display
 * name, no message/task/note/decision content, no file name, no sentinel, no
 * endpoint-defense protection claims. Local timestamp label only.
 * Persistence follows StoragePolicy — memory-only in v1.
 */

import type { RoomOperationKind } from "./room-types";

export interface RedactedRoomAuditEvent {
  readonly category: "room";
  readonly kind: RoomOperationKind;
  readonly severity: "info" | "warning" | "critical";
  /** LOCAL label only ("local:" prefix). */
  readonly createdAtLocal: string;
  readonly redacted: true;
  /** Stable, non-sensitive slug (PolicyReasonCode-compatible). */
  readonly reasonCode: string;
  readonly details?: Record<string, string | number | boolean | null>;
}

/** Safe detail values: finite numbers, booleans, null. Strings are dropped
 *  entirely — a slug-shaped string is indistinguishable from a room title. */
function isSafeDetail(value: unknown): value is number | boolean | null {
  if (value === null || typeof value === "boolean") return true;
  return typeof value === "number" && Number.isFinite(value);
}

const SAFE_KEY = /^[a-z0-9_.:-]{1,32}$/;

export function createRedactedRoomAuditEvent(input: {
  readonly kind: RoomOperationKind;
  readonly severity: "info" | "warning" | "critical";
  readonly reasonCode: string;
  readonly details?: Record<string, unknown>;
}): RedactedRoomAuditEvent {
  const details: Record<string, string | number | boolean | null> = {};
  if (input.details !== undefined) {
    for (const [key, value] of Object.entries(input.details)) {
      if (SAFE_KEY.test(key) && isSafeDetail(value)) {
        details[key] = value;
      }
    }
  }
  return {
    category: "room",
    kind: input.kind,
    severity: input.severity,
    createdAtLocal: `local:${new Date().toISOString()}`,
    redacted: true,
    reasonCode: SAFE_KEY.test(input.reasonCode) ? input.reasonCode : "unknown_input",
    details,
  };
}
