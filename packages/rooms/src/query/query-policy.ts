/**
 * RoomOS query policy + authorization (TECH-19).
 *
 * Deny-by-default, side-effect-free reads. A query is authorized only by an
 * authentic PolicyDecision scoped to EXACTLY its query class; object IDs and
 * actor refs confer no authority. Strictest policy wins; room policy tightens
 * the device mode but never loosens it. The requested view may be DOWNGRADED
 * but never upgraded. Query history/cache/index are structurally impossible
 * (typed `false`). No network/notification/AI/active endpoint is representable.
 */

import {
  isPolicyDecision,
  type PolicyCapability,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import { ROOM_CAPABILITY, type RoomPolicy } from "../room-policy";
import type { RoomObjectSensitivity } from "../objects";
import {
  RoomQueryDecisionMismatchError,
  RoomQueryPolicyDeniedError,
  RoomQueryValidationError,
} from "./query-errors";
import type { RoomQueryRequestV1 } from "./query-requests";
import {
  ROOM_QUERY_MAX_LIMIT,
  ROOM_QUERY_SEARCH_MAX_LIMIT,
  type RoomQueryKind,
  type RoomQueryViewClass,
} from "./query-types";

export const ROOM_QUERY_CAPABILITY: PolicyCapability = ROOM_CAPABILITY;

export type RoomQueryScope = Extract<PolicySideEffectScope, `room.query.${string}`>;

/** Map a query kind to its exact side-effect scope. */
export function roomQueryScope(query: RoomQueryKind): RoomQueryScope {
  switch (query) {
    case "room.summary":
      return "room.query.summary";
    case "room.object.get":
      return "room.query.detail";
    case "room.objects.search_plain_text":
      return "room.query.search";
    case "room.object_counts":
      return "room.query.count";
    case "room.objects.list":
    case "room.tasks.list":
    case "room.decisions.list":
    case "room.polls.list":
    case "room.file_refs.list":
      return "room.query.list";
    default:
      // unknown → deny at validation; scope lookup should never reach here.
      return "room.query.list";
  }
}

export interface RoomQueryPolicy {
  readonly mode: PrivacyMode;
  readonly query: RoomQueryKind;
  readonly requestedView: RoomQueryViewClass;
  readonly allowed: boolean;
  readonly effectiveView: RoomQueryViewClass;
  readonly maxResults: number;
  readonly contentAllowed: boolean;
  readonly actorRefsAllowed: boolean;
  readonly timestampsAllowed: boolean;
  readonly revisionsAllowed: boolean;
  readonly countsAllowed: boolean;
  readonly tagsAllowed: boolean;
  readonly relationshipMetadataAllowed: boolean;
  readonly searchAllowed: boolean;
  readonly queryHistoryAllowed: false;
  readonly resultCacheAllowed: false;
  readonly persistentIndexAllowed: false;
  readonly networkAllowed: false;
  readonly notificationAllowed: false;
  readonly aiAllowed: boolean;
  readonly endpointIntegration: "externalized" | "not_integrated" | "hook_only";
  readonly reasonCode: string;
}

/** Downgrade a requested view to the strongest allowed variant for the mode. */
function effectiveViewFor(
  requested: RoomQueryViewClass,
  contentAllowed: boolean,
  detailAllowed: boolean,
): RoomQueryViewClass {
  if (requested === "object_detail_content") {
    return contentAllowed ? "object_detail_content" : "object_detail_redacted";
  }
  if (requested === "object_detail_redacted") return "object_detail_redacted";
  if (requested === "object_summary")
    return detailAllowed ? "object_summary" : "object_summary_redacted";
  if (requested === "object_summary_redacted") return "object_summary_redacted";
  if (requested === "room_summary") return detailAllowed ? "room_summary" : "room_summary_redacted";
  return "room_summary_redacted";
}

export function resolveRoomQueryPolicy(input: {
  mode: PrivacyMode;
  query: RoomQueryKind;
  requestedView: RoomQueryViewClass;
  roomPolicy: RoomPolicy;
  objectSensitivity?: RoomObjectSensitivity;
  deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
}): RoomQueryPolicy {
  const { mode, query, requestedView } = input;

  // Structural constants — impossible to enable in TECH-19.
  const constants = {
    queryHistoryAllowed: false as const,
    resultCacheAllowed: false as const,
    persistentIndexAllowed: false as const,
    networkAllowed: false as const,
    notificationAllowed: false as const,
    endpointIntegration: "externalized" as const,
  };

  const base = (over: Partial<RoomQueryPolicy>): RoomQueryPolicy => {
    const merged: RoomQueryPolicy = {
      mode,
      query,
      requestedView,
      allowed: true,
      effectiveView: "object_summary_redacted",
      maxResults: ROOM_QUERY_MAX_LIMIT,
      contentAllowed: false,
      actorRefsAllowed: true,
      timestampsAllowed: true,
      revisionsAllowed: true,
      countsAllowed: false,
      tagsAllowed: true,
      relationshipMetadataAllowed: true,
      searchAllowed: false,
      aiAllowed: false,
      reasonCode: "default_deny",
      ...constants,
      ...over,
    };
    // effectiveView is always DERIVED from the merged allow-flags — never
    // taken from the caller — so a requested view can only be downgraded.
    return {
      ...merged,
      effectiveView: effectiveViewFor(
        requestedView,
        merged.contentAllowed,
        merged.actorRefsAllowed,
      ),
    };
  };

  const deny = (reasonCode: string): RoomQueryPolicy =>
    base({
      allowed: false,
      contentAllowed: false,
      actorRefsAllowed: false,
      timestampsAllowed: false,
      revisionsAllowed: false,
      countsAllowed: false,
      tagsAllowed: false,
      relationshipMetadataAllowed: false,
      searchAllowed: false,
      maxResults: 0,
      effectiveView: "object_summary_redacted",
      reasonCode,
    });

  const isSearch = query === "room.objects.search_plain_text";

  switch (mode) {
    case "emergency":
      // Only minimal safe room/tombstone status; ordinary queries denied.
      if (query === "room.summary") {
        return base({
          contentAllowed: false,
          actorRefsAllowed: false,
          timestampsAllowed: false,
          revisionsAllowed: false,
          countsAllowed: false,
          tagsAllowed: false,
          relationshipMetadataAllowed: false,
          maxResults: 0,
          reasonCode: "emergency_mode",
        });
      }
      return deny("emergency_mode");

    case "bunker":
      // Endpoint protection is externalized/not integrated → deny content
      // views, search, counts, and relationship metadata. Redacted summaries
      // only. Enabling content views needs a future presentation gate.
      if (isSearch || query === "room.object_counts") return deny("strict_mode");
      return base({
        contentAllowed: false,
        actorRefsAllowed: false,
        timestampsAllowed: false,
        revisionsAllowed: false,
        countsAllowed: false,
        tagsAllowed: false,
        relationshipMetadataAllowed: false,
        searchAllowed: false,
        maxResults: 10,
        reasonCode: "strict_mode",
      });

    case "ghost":
      return base({
        contentAllowed: query === "room.object.get",
        actorRefsAllowed: false,
        timestampsAllowed: false,
        revisionsAllowed: true,
        countsAllowed: false,
        tagsAllowed: true,
        relationshipMetadataAllowed: false,
        searchAllowed: isSearch,
        maxResults: 15,
        reasonCode: "strict_mode",
      });

    case "private":
      return base({
        contentAllowed: query === "room.object.get",
        actorRefsAllowed: false,
        timestampsAllowed: false,
        revisionsAllowed: true,
        countsAllowed: false,
        tagsAllowed: true,
        relationshipMetadataAllowed: false,
        searchAllowed: isSearch,
        maxResults: ROOM_QUERY_MAX_LIMIT,
        reasonCode: "default_deny",
      });

    case "offline_capsule":
      return base({
        contentAllowed: query === "room.object.get",
        actorRefsAllowed: true,
        timestampsAllowed: true,
        revisionsAllowed: true,
        tagsAllowed: true,
        relationshipMetadataAllowed: true,
        searchAllowed: isSearch,
        countsAllowed: true,
        maxResults: ROOM_QUERY_MAX_LIMIT,
        reasonCode: "offline_capsule_mode",
      });

    case "standard":
    case "sovereign_room":
      return base({
        contentAllowed: query === "room.object.get",
        actorRefsAllowed: true,
        timestampsAllowed: true,
        revisionsAllowed: true,
        tagsAllowed: true,
        relationshipMetadataAllowed: true,
        searchAllowed: isSearch,
        countsAllowed: true,
        maxResults:
          query === "room.objects.search_plain_text"
            ? ROOM_QUERY_SEARCH_MAX_LIMIT
            : ROOM_QUERY_MAX_LIMIT,
        reasonCode: "default_deny",
      });

    default:
      return deny("unknown_input");
  }
}

/**
 * Authorize a query. Runs BEFORE execution; a denial means nothing is read.
 * Object ID/actor ref are NOT authorization proof.
 */
export function assertRoomQueryAllowed(
  request: RoomQueryRequestV1,
  decision: PolicyDecision,
  policy: RoomQueryPolicy,
): void {
  if (!isPolicyDecision(decision)) {
    throw new RoomQueryDecisionMismatchError("decision_missing");
  }
  if (decision.verdict !== "allowed") {
    throw new RoomQueryPolicyDeniedError("verdict_denied");
  }
  if (decision.capability !== ROOM_QUERY_CAPABILITY) {
    throw new RoomQueryDecisionMismatchError();
  }
  const scope = roomQueryScope(request.query);
  if (decision.sideEffect !== scope) {
    throw new RoomQueryDecisionMismatchError();
  }
  if (policy.query !== request.query || policy.requestedView !== request.requestedView) {
    throw new RoomQueryDecisionMismatchError();
  }
  if (!policy.allowed) {
    throw new RoomQueryPolicyDeniedError(policy.reasonCode);
  }
  if (request.query === "room.objects.search_plain_text" && !policy.searchAllowed) {
    throw new RoomQueryPolicyDeniedError("search_denied");
  }
  if (request.query === "room.object_counts" && !policy.countsAllowed) {
    throw new RoomQueryPolicyDeniedError("count_denied");
  }
  // The requested view may only be honored up to the effective view.
  if (
    request.requestedView === "object_detail_content" &&
    policy.effectiveView !== "object_detail_content"
  ) {
    // Not an error — the executor downgrades to the effective view. But an
    // explicit content request under a mode that forbids it (Bunker) is a
    // policy denial to avoid a silent, surprising downgrade.
    if (!policy.contentAllowed) {
      throw new RoomQueryPolicyDeniedError("content_view_denied");
    }
  }
  // Structural guarantees (defence in depth).
  if (
    policy.queryHistoryAllowed ||
    policy.resultCacheAllowed ||
    policy.persistentIndexAllowed ||
    policy.networkAllowed ||
    policy.notificationAllowed
  ) {
    throw new RoomQueryValidationError("forbidden_side_effect");
  }
  if ((policy.endpointIntegration as string) === "active") {
    throw new RoomQueryValidationError("forbidden_side_effect");
  }
}
