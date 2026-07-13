/**
 * ProtectedContent integration CONTRACT (TECH-23) — data-only intent types.
 *
 * ScreenShield / ProtectedContent native presentation surfaces live in the
 * SEPARATE Secure Device project. Core describes the INTENT (which surface wants
 * which protection at which policy/assessment revision) but NEVER renders content,
 * NEVER blocks screenshots, and NEVER claims capture protection. When a room
 * requires a future protected presentation, content is DENIED — never silently
 * downgraded.
 */

import type { RoomLocalId } from "../room-types";
import type { ProtectedContentRequirementV1 } from "../policy-composition/protected-content";
import { resolveProtectedPresentationStatusV1 } from "../policy-composition/protected-content";
import type { RoomPolicyRevision } from "../policy-composition/room-policy-document";

export type ProtectedContentSurfaceV1 =
  | "room_content"
  | "message_content"
  | "note_content"
  | "task_content"
  | "decision_content"
  | "poll_content"
  | "file_content";

export const PROTECTED_CONTENT_SURFACES: readonly ProtectedContentSurfaceV1[] = [
  "room_content",
  "message_content",
  "note_content",
  "task_content",
  "decision_content",
  "poll_content",
  "file_content",
];

export interface ProtectedContentIntentV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly surface: ProtectedContentSurfaceV1;
  readonly requirement: ProtectedContentRequirementV1;
  readonly assessmentRevision: number;
  readonly roomPolicyRevision: RoomPolicyRevision;
  /** Structural: no native ScreenShield is integrated; no protected surface exists. */
  readonly screenShieldIntegrated: false;
  readonly protectedSurfaceAvailable: false;
}

export type ProtectedContentIntentHandlingV1 =
  "normal_policy" | "redacted_core_view" | "deny_content";

/**
 * Decide how a protected-content intent is handled NOW: `none` → normal policy;
 * `policy_redaction_only` → redacted core view; every future-required protection
 * → deny content (integration absent). Pure, deterministic, content-free.
 */
export function resolveProtectedContentIntentHandlingV1(intent: ProtectedContentIntentV1): {
  readonly handling: ProtectedContentIntentHandlingV1;
  readonly reasonCode: string;
} {
  const status = resolveProtectedPresentationStatusV1(intent.requirement);
  if (intent.requirement === "none") {
    return { handling: "normal_policy", reasonCode: status.reasonCode };
  }
  if (intent.requirement === "policy_redaction_only") {
    return { handling: "redacted_core_view", reasonCode: status.reasonCode };
  }
  // secure_device / screen_shield / managed_bunker future-required → deny content.
  return { handling: "deny_content", reasonCode: status.reasonCode };
}

/** Build a protected-content intent (no content, no rendering — description only). */
export function buildProtectedContentIntentV1(input: {
  roomId: RoomLocalId;
  surface: ProtectedContentSurfaceV1;
  requirement: ProtectedContentRequirementV1;
  assessmentRevision: number;
  roomPolicyRevision: RoomPolicyRevision;
}): ProtectedContentIntentV1 {
  return {
    schemaVersion: 1,
    roomId: input.roomId,
    surface: input.surface,
    requirement: input.requirement,
    assessmentRevision: input.assessmentRevision,
    roomPolicyRevision: input.roomPolicyRevision,
    screenShieldIntegrated: false,
    protectedSurfaceAvailable: false,
  };
}
