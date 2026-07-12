# RoomOS Object Model — Research Note (TECH-18)

_Date: 2026-07-13. Informs the concrete object schemas, explicit mutation commands, optimistic-concurrency revisions, and the policy-gated mutation pipeline._

> [!NOTE]
> **Source verification pending: internet unavailable in this environment.** The concepts below are stable, widely-documented engineering knowledge (author cutoff 2026-01). Re-confirm current library/spec specifics against primary sources before external citation.

## 7.1 Structural object validation (JSON Schema concepts)

**Summary:** explicit object schemas with required properties, typed fields, enumerated values, discriminated composition, `additionalProperties: false`, and schema versioning are the standard defense against malformed/ambiguous data.

**Adopted:** each object kind has an explicit TypeScript schema; discriminated unions keyed on `kind`/`command`; required fields enforced; unexpected fields rejected (`assertOnlyKeys`); `schemaVersion: 1` explicit and unknown versions **fail closed**; no silent coercion. **Rejected:** adding a JSON-Schema runtime dependency — the *principles* are applied with small explicit validators.

## 7.2 Authorization and object-level access control (OWASP ASVS)

**Summary:** deny-by-default; authorize every operation at a trusted enforcement point; enforce object-level authorization; prevent cross-object/cross-container access; never trust user-controlled authority fields.

**Adopted:** every mutation requires an authentic `PolicyDecision` scoped to exactly its side-effect class (`assertRoomObjectMutationAllowed`); object `roomId` must match the target room; **object IDs and actor refs confer no authority** (Gate G — placeholders, not authenticated identities); authorization runs BEFORE any event/log/projection side effect; apps cannot import the pipeline internals or mutate the projection.

## 7.3 Explicit commands vs generic patching

**Summary:** generic JSON Patch / merge-patch invites mass-assignment, prototype-pollution, unknown-field injection, and unauditable mutations. Explicit domain commands make each mutation's meaning clear and safe.

**Adopted:** a discriminated **command union** — no `object.patch`/`set_property`/`merge_payload`/`json_patch`; accepted fields are explicitly extracted (never spread from unvalidated input); `__proto__`/`prototype`/`constructor` rejected; getters are never invoked (exact own-key checks); unknown commands deny. Mutation meaning is explicit in tests and audits. **Rejected:** any JSON-Patch dependency.

## 7.4 Local-first object models (Automerge/Yjs/Loro guidance)

**Summary:** local replicas own the data; nested objects and histories are first-class; storage/network adapters are separate; merge/conflict handling is a distinct concern.

**Adopted:** the object model works entirely locally with no server; schemas carry no CRDT/causal metadata so a future engine can be layered; **local revision checks are optimistic-concurrency guards, explicitly NOT concurrent-edit resolution** (Gate H). No merge algorithm is baked into `revision`.

## 7.5 Object lifecycle and deletion

**Summary:** active/archived/redacted/tombstoned states model records over time; deletion in an event history is a tombstone/redaction, not guaranteed historical erasure; terminal states need explicit rules.

**Adopted:** explicit lifecycle machine (`active → archived/redacted → deleted_tombstone`; tombstone terminal); redaction removes content one-way; **tombstones are documented as NOT forensic erasure** (the in-memory event log may retain prior content until cleared); persistent erasure is unimplemented (Gate F).

## 7.6 Resource and content limits

**Summary:** untrusted input needs size caps, bounded arrays, careful Unicode handling, no untrusted property getters, and no rich-text/HTML rendering paths (XSS/memory risks).

**Adopted:** **plain text only** (no HTML mode, no rendered Markdown, no embedded remote resources); conservative UTF-8 byte limits with exact-boundary tests; bounded tag/option/assignee arrays; NUL + lone-surrogate rejection; no deeply-nested/arbitrary structured payloads.

## 7.7 FreeLayer internal review

Reviewed `packages/rooms` (types/policy/events/log/reducer), Policy Matrix, Storage/Metadata/Network/Notification policies, PBOM, Trust Center, Sovereign Rooms + threat-model docs, and the TECH-16/17 fixtures/tests. Findings:

- The TECH-16 `RoomObjectKind` taxonomy + per-kind data-class/sensitivity meta already exist; TECH-18 concrete objects reuse the kind names.
- TECH-16/17 placeholder object-creation operations (`*.create_placeholder`) become **real** v1 commands here; to avoid destabilizing the TECH-17 content-free event union (399 green tests) and its "no real content" guarantee, TECH-18 introduces a dedicated, structurally-parallel `RoomObjectEventV1` envelope + memory/null object log rather than widening the TECH-17 union.
- No content is accidentally persisted (memory/null only; StoragePolicy denies persistence).
- No direct mutation bypass exists (guardrail + immutable projection + boundaries).
- No doc overclaims endpoint-defense functionality; `endpoint_hook_ref` stays placeholder-only.

## Adopted / rejected / deferred

**Adopted:** explicit schemas + commands; optimistic revisions; deny-by-default policy-gated pipeline; plain-text-only content; memory/null retention; deterministic events + replay; explicit lifecycle/status machines. **Rejected:** JSON-Schema/JSON-Patch/CRDT/crypto/network dependencies; generic patching; rich text/HTML/Markdown rendering; file bytes/paths/URLs. **Deferred:** external object import + wire format (Gate E); encryption + persistent content + secure deletion (Gate F); verified identity + authoritative voting/ownership (Gate G); sync + CRDT selection + concurrent-edit resolution (Gate H); AI memory (Gate I); endpoint integration (Gate R).

## Known limits (stated plainly)

Objects are local-only; content is unencrypted and not safe for real secrets; revisions are local optimistic-concurrency values (not distributed version vectors, not tamper resistance); no distributed conflict resolution; no verified identity; tombstones are not forensic erasure; no anti-spyware is active.

## TODOs for TECH-19 / Gates

Messaging transport + delivery (Gate H); capsule object serialization + hostile-input parser (Gate E); encrypted persistence + snapshots (Gate F); authenticated members + poll voting (Gate G); CRDT/merge selection (Gate H); AI memory objects (Gate I); endpoint hook integration (Gate R, dedicated ADR/threat-model/PBOM/Trust-Center/tests).
