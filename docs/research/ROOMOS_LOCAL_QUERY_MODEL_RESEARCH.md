# RoomOS Local Query Model — Research Note (TECH-19)

_Date: 2026-07-13. Informs the side-effect-free query layer, privacy-safe views, exact in-memory search, and local cursors._

> [!NOTE]
> **Source verification pending: internet unavailable in this environment.** The concepts below are stable, widely-documented engineering knowledge (author cutoff 2026-01). Re-confirm current specifics against primary sources before external citation.

## 7.1 CQRS / read-model separation

**Summary:** commands (writes) and queries (reads) are modeled separately; queries are side-effect-free; read models are derived data that may be denormalized and evolve independently; a full CQRS framework adds real complexity/consistency cost.

**Adopted:** RoomOS queries are a SEPARATE layer from the TECH-18 mutation pipeline — they never append events or mutate projections; views may differ from write objects; no CQRS framework is needed. **Rejected:** event-sourced read-side stores, async projections, a query bus.

## 7.2 Materialized-view privacy risks

**Summary:** duplicated/denormalized data and secondary indexes can retain sensitive or deleted content; stale views expose old policy; snapshot retention is a liability.

**Adopted:** views are computed in memory from ONE immutable snapshot; **no persistent materialized query index, no query-result cache, no search index**; derived views follow the source object's strictest policy; **redacted/tombstoned content never reappears** (the search path and detail view both exclude it). **Deferred:** any persisted derived view (future storage gate).

## 7.3 OWASP object-level authorization

**Summary:** deny-by-default; authorize every operation at a trusted enforcement point; check resource-specific access; never trust guessed identifiers or user-controlled authority fields; fail safely.

**Adopted:** every query requires an authentic `PolicyDecision` scoped to EXACTLY its query class (`assertRoomQueryAllowed`); **room/object IDs and actor refs confer no authority**; object-room relationships are revalidated (cross-room snapshot/request rejects); list vs detail vs count vs search have distinct scopes; strict-mode restrictions cannot be loosened by query parameters (the requested view can only be DOWNGRADED).

## 7.4 Privacy risk + data minimization (NIST)

**Summary:** expose only what a view requires; treat query terms, counts, timing, and relationships as sensitive; minimize by default.

**Adopted:** summaries carry no content; actor refs, timestamps, revisions, tags, assignees, and counts are metadata suppressed per policy; **total counts are off by default** (own scope, denied in Private/Ghost/Bunker/Emergency); **query terms are never logged/audited/persisted**; no query history; no result caching.

## 7.5 Local search privacy

**Summary:** full-text indexes duplicate content; token indexes, snippets, ranking metadata, and search history all leak; fuzzy/regex add complexity and over-matching; Unicode/case-folding needs care.

**Adopted:** v1 is **direct in-memory scanning only** — exact, case-SENSITIVE substring (`String.includes`), no index, no fuzzy/regex/glob/stemming, no snippets, no ranking, no suggestions, no history, no cache; bounded term (≤256 UTF-8 bytes) and result size; **user input never constructs a `RegExp`**; redacted/tombstoned content is never searched; the term never appears in errors/logs.

## 7.6 Pagination + cursor safety

**Summary:** cursors are pagination state, not authorization; offset vs cursor trade-offs; mutable datasets break cursor continuity; ordering must be deterministic.

**Adopted:** cursors are LOCAL typed values — **not authorization tokens**, not persisted, not serialized for remote use, carry no content; a cursor must match the query's room + sort; one execution uses one immutable snapshot; cross-snapshot continuity is not guaranteed in v1; every sort has an object-ID tie-breaker.

## 7.7 FreeLayer internal review

Reviewed the RoomOS projection/objects/summaries, current app access (apps cannot import rooms), Policy Matrix, Storage/Metadata/Network/Notification policies, PBOM, Trust Center, and Sovereign Rooms + threat-model docs. Findings:

- TECH-18 keeps full `RoomObjectV1` objects in `RoomObjectProjectionV1`, separate from the content-free `RoomMaterializedState.objects` summaries — so the query snapshot takes BOTH (documented deviation from the prompt's single-`roomState` snapshot signature).
- No app-side raw traversal exists (boundary guard); the new query guard forbids `roomState.objects.*` outside the query/objects packages.
- No content is persisted; no derived index exists; no doc overclaims secure rendering or endpoint protection.

## Adopted / rejected / deferred

**Adopted:** side-effect-free read layer; exact-scope authorization; immutable snapshot; privacy-safe view classes; structured filters + deterministic sorting; bounded local cursors; exact in-memory search; strict-mode redaction; deterministic + defensively-cloned results. **Rejected:** FTS/CRDT/DB/AI/network dependencies; query language; dynamic regex; generic field selection; query history/cache/persistent index; snippets/ranking. **Deferred:** remote queries + synchronized views (Gate H); encrypted/searchable indexes + PIR (Gate F); identity-backed query permissions (Gate G); semantic/embedding search (Gate I); external query parsing/wire format (Gate E); Bunker content views (future protected-presentation integration gate).

## Known limits

No authenticated identity; no persistent encrypted indexes; no constant-time queries; no protection against process-memory inspection; **no protection of rendered results from screenshots/capture** (endpoint defense is externalized); not safe for real secrets.

## TODOs for TECH-20 and later gates

Saved/named views + query-side audit (redacted, term-free) if ever needed; protected-presentation integration for Bunker content views (Gate R/presentation); remote/synchronized queries (Gate H); encrypted search (Gate F); semantic search (Gate I).
