# TECH-19 — RoomOS Query Model Threat Model

_Scope: the local, side-effect-free, policy-gated read layer. Extends [TECH_18_ROOM_OBJECT_THREAT_MODEL.md](TECH_18_ROOM_OBJECT_THREAT_MODEL.md)._

## Unauthorized query

Querying another room/object; a guessed object ID; a list permission used for detail; a summary permission used for content; an actor/role placeholder treated as authority; a query without a decision; a wrong-scope decision; room policy loosening device policy. **Mitigation:** `assertRoomQueryAllowed` requires an authentic (WeakSet-provenance) decision scoped to EXACTLY the query class; cross-room snapshot/request rejects; **object IDs/actor refs confer no authority**; list/detail/count/search are distinct scopes; the requested view can only be DOWNGRADED (never upgraded); a guessed object yields `object_not_available` (content-free), never content.

## Privacy-view

Content in summaries; a room title where redaction is required; actor refs exposing relationships; timestamps exposing activity; revisions exposing edit frequency; tags/assignees exposing sensitive categories/relationships; counts exposing activity; file-ref metadata exposing context; result snippets exposing content. **Mitigation:** summaries never carry content; the snapshot drops the title in strict modes (and `roomState.title` is already RoomPolicy-redacted); actor refs/timestamps/revisions/tags/assignees/counts are suppressed per policy; counts have their own scope and are off by default in Private/Ghost/Bunker/Emergency; file-ref views expose only an opaque `localRefId`; **no snippets exist**.

## Search

Query terms logged; query history retained; a full-text index duplicating content; dynamic regex causing DoS; fuzzy search over-matching; results bypassing content-view policy; ranking exposing activity; search timing recorded. **Mitigation:** exact case-sensitive `String.includes` only — **no index/history/cache/snippet/ranking/fuzzy/regex**; user input never builds a `RegExp`; redacted/tombstoned content is never searched; results are summary views (content-policy still applies); the term never appears in errors/audit/logs; Bunker/Emergency deny search.

## Query side effect

A query appending an operation-log event; mutating the projection; writing a cache; triggering network/notification/link-preview/file-read/AI/endpoint hooks. **Mitigation:** the executor reads a frozen snapshot only — no event append, no operation-log access, no storage/network/notification/preview/file/AI/endpoint call (trap-tested); the guardrail statically bans these patterns and nondeterminism in query modules.

## Pagination

A cursor granting authority; a cursor carrying content; a cursor reused across rooms or incompatible snapshots; unstable ordering duplicating/omitting results; total count leaking hidden objects. **Mitigation:** cursors are local typed values, never authorization, never persisted, content-free; a cursor must match the query's room + sort (mismatch rejects); every sort has an object-ID tie-breaker; one execution uses one immutable snapshot; pagination fields never imply a hidden total.

## Derived-data

A redacted object reappearing from a cached view; tombstoned content reappearing; a stale view exposing old policy; result objects sharing mutable references; a query result mutating the projection. **Mitigation:** no cached/persisted views exist; redacted/tombstoned content is excluded from detail and search; the snapshot is a defensive deep clone and is frozen; results are cloned/frozen — mutating a result cannot mutate source state (trap-tested).

## Endpoint-defense separation

A query result assumed capture-protected; ScreenShield implied active; native monitoring entering the query package. **Mitigation:** query policy's `endpointIntegration` is `externalized`/`not_integrated`/`hook_only` and cannot be `active`; docs state plainly that results are NOT protected from capture; the guardrail + import-hygiene test forbid monitoring dependencies.

## Limits (stated plainly)

No authenticated identity (Gate G); no persistent encrypted indexes (Gate F); no constant-time queries; no defense against process-memory inspection; **no protection of rendered results from screenshots/capture** (endpoint defense externalized); no anti-spyware; not safe for real secrets.
