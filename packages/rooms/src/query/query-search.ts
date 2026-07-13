/**
 * Exact plain-text search v1 (TECH-19). Case-SENSITIVE substring match over
 * explicitly-allowed in-memory plain-text fields ONLY. No regex, wildcard,
 * glob, fuzzy, stemming, token index, persistent index, snippet, ranking,
 * suggestion, history, or cache. Redacted/tombstoned content is never
 * searched. The query term never appears in errors/audit/logs.
 *
 * User input is NEVER used to construct a RegExp — matching is `String.includes`.
 */

import type { RoomObjectV1 } from "../objects";
import type { RoomQueryPolicy } from "./query-policy";

/** Collect the searchable plain-text fields of an object, per policy. */
function searchableText(object: RoomObjectV1, policy: RoomQueryPolicy): string[] {
  // Redacted/tombstoned objects expose no content to search.
  if (object.redacted || object.content === null || object.lifecycle === "deleted_tombstone") {
    return [];
  }
  const out: string[] = [];
  const push = (t?: { value: string } | undefined): void => {
    if (t && typeof t.value === "string") out.push(t.value);
  };
  switch (object.kind) {
    case "message":
      push(object.content.body);
      break;
    case "note":
      push(object.content.title);
      push(object.content.body);
      break;
    case "task":
      push(object.content.title);
      push(object.content.description);
      break;
    case "decision":
      push(object.content.statement);
      push(object.content.rationale);
      break;
    case "poll":
      push(object.content.question);
      for (const opt of object.content.options) push(opt.label);
      break;
    case "file_ref":
      // Display metadata is searched only if relationship metadata is allowed.
      if (policy.relationshipMetadataAllowed) push(object.content.displayName);
      break;
    default:
      break;
  }
  return out;
}

/**
 * Return objects whose allowed plain-text contains `term` (exact, case-
 * sensitive substring). Deterministic: preserves the caller's (already sorted)
 * object order.
 */
export function searchRoomObjectsExact(
  objects: readonly RoomObjectV1[],
  term: string,
  policy: RoomQueryPolicy,
  allowedKinds?: readonly RoomObjectV1["kind"][],
): RoomObjectV1[] {
  const kinds = allowedKinds && allowedKinds.length > 0 ? new Set(allowedKinds) : undefined;
  const hits: RoomObjectV1[] = [];
  for (const object of objects) {
    if (kinds && !kinds.has(object.kind)) continue;
    for (const text of searchableText(object, policy)) {
      if (text.includes(term)) {
        hits.push(object);
        break;
      }
    }
  }
  return hits;
}
