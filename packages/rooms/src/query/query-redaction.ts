/**
 * Privacy-safe view redaction (TECH-19). Summaries carry NO content; detail
 * views carry content only when policy allows AND the object is not
 * redacted/tombstoned (content never reappears). Actor refs, timestamps,
 * revisions, tags, assignees, and counts are stripped per policy. Views never
 * expose file paths/URLs and never claim capture protection.
 */

import { cloneRoomProjection } from "../room-event-v1";
import type { RoomMemberRef } from "../room-types";
import type { RoomObjectV1 } from "../objects";
import type { RoomQueryPolicy } from "./query-policy";
import type { RoomQuerySnapshotV1 } from "./query-snapshot";
import type {
  RoomObjectDetailViewV1,
  RoomObjectSummaryViewV1,
  RoomSummaryViewV1,
} from "./query-views";

const REDACTED_TS = "local:redacted";

function isRedactedView(policy: RoomQueryPolicy): boolean {
  return (
    policy.effectiveView === "room_summary_redacted" ||
    policy.effectiveView === "object_summary_redacted" ||
    policy.effectiveView === "object_detail_redacted"
  );
}

export function redactRoomSummaryForQuery(
  snapshot: RoomQuerySnapshotV1,
  policy: RoomQueryPolicy,
  objectCount: number,
): RoomSummaryViewV1 {
  const redacted = policy.effectiveView === "room_summary_redacted";
  const view: RoomSummaryViewV1 = {
    schemaVersion: 1,
    kind: snapshot.roomKind,
    lifecycle: snapshot.lifecycle,
    mode: snapshot.mode,
    redacted,
    // A non-redacted room summary may carry the (already policy-redacted)
    // title and — only if counts are allowed — the object count.
    ...(redacted ? {} : { roomId: snapshot.roomId }),
    ...(!redacted && snapshot.title !== undefined ? { title: snapshot.title } : {}),
    ...(policy.countsAllowed ? { objectCount } : {}),
  };
  return view;
}

export function redactRoomObjectSummaryForQuery(
  object: RoomObjectV1,
  policy: RoomQueryPolicy,
): RoomObjectSummaryViewV1 {
  const redacted = isRedactedView(policy);
  if (redacted) {
    // Minimal: kind + lifecycle + redacted marker; nothing identifying.
    return {
      schemaVersion: 1,
      kind: object.kind,
      lifecycle: object.lifecycle,
      redacted: true,
    };
  }
  return {
    schemaVersion: 1,
    objectId: object.objectId,
    kind: object.kind,
    lifecycle: object.lifecycle,
    sensitivity: object.sensitivity,
    redacted: object.redacted,
    ...(policy.revisionsAllowed ? { revision: object.revision as number } : {}),
    // content-present is an activity signal — suppressed with revisions.
    ...(policy.revisionsAllowed ? { contentPresent: object.content !== null } : {}),
    ...(policy.timestampsAllowed ? { createdAtLocal: object.createdAtLocal } : {}),
    ...(policy.timestampsAllowed ? { updatedAtLocal: object.updatedAtLocal } : {}),
  };
}

/** Neutralize per-policy metadata on a cloned object for a detail view. */
function sanitizeObjectForDetail(object: RoomObjectV1, policy: RoomQueryPolicy): RoomObjectV1 {
  const clone = cloneRoomProjection(object) as RoomObjectV1 & {
    createdBy: RoomMemberRef | "local_unknown";
    updatedBy: RoomMemberRef | "local_unknown";
    createdAtLocal: string;
    updatedAtLocal: string;
  };
  if (!policy.actorRefsAllowed) {
    clone.createdBy = "local_unknown";
    clone.updatedBy = "local_unknown";
  }
  if (!policy.timestampsAllowed) {
    clone.createdAtLocal = REDACTED_TS;
    clone.updatedAtLocal = REDACTED_TS;
  }
  if (clone.content !== null) {
    const content = clone.content as Record<string, unknown>;
    if (!policy.tagsAllowed && Array.isArray(content["tags"])) content["tags"] = [];
    if (!policy.relationshipMetadataAllowed) {
      if (Array.isArray(content["assigneeRefs"])) content["assigneeRefs"] = [];
      if (!policy.timestampsAllowed && typeof content["dueAtLocal"] === "string") {
        content["dueAtLocal"] = REDACTED_TS;
      }
    }
  }
  return Object.freeze(clone);
}

export function createRoomObjectDetailView(
  object: RoomObjectV1,
  policy: RoomQueryPolicy,
): RoomObjectDetailViewV1 {
  // Content never reappears from a redacted/tombstoned object.
  if (object.lifecycle === "deleted_tombstone") {
    return {
      schemaVersion: 1,
      object: sanitizeObjectForDetail(object, policy),
      redacted: true,
      redactionReason: "object_tombstoned",
    };
  }
  if (object.redacted || object.content === null) {
    return {
      schemaVersion: 1,
      object: sanitizeObjectForDetail(object, policy),
      redacted: true,
      redactionReason: "object_redacted",
    };
  }
  if (!policy.contentAllowed || policy.effectiveView !== "object_detail_content") {
    // Policy forbids content → strip it (content-free envelope, redacted).
    const stripped = cloneRoomProjection(object) as RoomObjectV1;
    (stripped as { content: unknown }).content = null;
    return {
      schemaVersion: 1,
      object: sanitizeObjectForDetail(stripped, policy),
      redacted: true,
      redactionReason: "policy_redacted",
    };
  }
  return { schemaVersion: 1, object: sanitizeObjectForDetail(object, policy), redacted: false };
}
