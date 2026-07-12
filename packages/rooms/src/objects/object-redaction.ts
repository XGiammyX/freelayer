/**
 * Metadata-only object summaries (TECH-18). A summary NEVER carries content;
 * strict MetadataPolicy suppresses revision/timing/counts. `contentPresent` is
 * a boolean flag only — never the content itself.
 */

import type { RoomObjectSummaryV1, RoomObjectV1 } from "./object-types";

export function summarizeRoomObjectV1(
  object: RoomObjectV1,
  options?: { readonly metadataAllowed?: boolean },
): RoomObjectSummaryV1 {
  const metadataAllowed = options?.metadataAllowed ?? true;
  const summary: RoomObjectSummaryV1 = {
    schemaVersion: 1,
    objectId: object.objectId,
    roomId: object.roomId,
    kind: object.kind,
    lifecycle: object.lifecycle,
    sensitivity: object.sensitivity,
    redacted: object.redacted,
    // Under strict metadata policy, activity signals (revision/content-present)
    // are suppressed; content is NEVER included in either case.
    ...(metadataAllowed
      ? { revision: object.revision, contentPresent: object.content !== null }
      : {}),
  };
  return summary;
}
