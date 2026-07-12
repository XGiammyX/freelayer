# TECH-18 — RoomOS Object Model Threat Model

_Scope: the concrete local object model + policy-gated mutation pipeline. Extends [TECH_17_OPERATION_LOG_THREAT_MODEL.md](TECH_17_OPERATION_LOG_THREAT_MODEL.md)._

## Object-content leakage

Message/note/task/decision/poll bodies, filenames, or poll questions leaking into errors, audit events, status objects, summaries, replay/conflict reports, console/logger output, thrown error causes, or test artifacts. **Mitigation:** errors carry stable codes only and never stringify the command/object (`RoomObjectError` + `objectFail`); `RoomObjectSummaryV1` is metadata-only (`contentPresent` is a boolean; content is never included); strict modes suppress even the boolean/revision; the object log `status()` is metadata-only; the pipeline emits no audit/log of content. Sentinel-tested (`FREELAYER_ROOM_OBJECT_SENTINEL_DO_NOT_LEAK`) across errors, summaries, status, and console.

## Object-level authorization

Mutating an object from another room; guessing/reusing an object ID; mutating without a decision; wrong side-effect decision; reusing a room decision as a storage decision; treating a member/actor placeholder as authenticated authority; an app mutating the projection directly. **Mitigation:** deny-by-default `assertRoomObjectMutationAllowed` requires an authentic (WeakSet-provenance) decision scoped to EXACTLY the mutation's side-effect class; `roomId` must match; **object IDs/actor refs confer no authority**; mutation vs object-log append use SEPARATE exact-scoped decisions; the projection is immutable and apps cannot import the pipeline (boundaries + guardrail).

## Validation

Unsupported schema version; unknown object kind/command; extra fields; mass assignment; prototype pollution; accessor/getter side effects; oversized strings; excessive poll options; invalid state transition; invalid timestamp; remote URL/path in a file ref; HTML/script content later rendered unsafely. **Mitigation:** `validateRoomObjectMutationCommandV1` fails closed — exact own-key checks, `__proto__`/`prototype`/`constructor` rejection, no getter invocation, UTF-8 byte limits, bounded arrays, `local:`-prefixed timestamps, path/URL/credential rejection in file refs, and **plain-text-only** storage (never rendered here). Internal validators are NOT a hostile-input security boundary (Gate E).

## Event / projection

Command validates but the event loses fields; event replays onto a different object; mutation applied twice; revision increments incorrectly; a tombstone silently restored; replay invoking policy/side effects; the projector silently ignoring an unsupported event. **Mitigation:** the event carries the RESULTING object so replay is total and deterministic; the reducer enforces object/room identity + revision continuity; tombstone is terminal (reducer + lifecycle machine reject further mutation); replay is pure (validate-all-then-apply, no partial result, no clock/network); the reducer has no silent fallback.

## Privacy-mode

Ghost/Bunker persisting object content; Bunker showing sensitive summaries; Offline Capsule triggering network; Emergency allowing ordinary mutations; metadata counts exposing activity; notification/link-preview triggered by content. **Mitigation:** `resolveRoomObjectMutationPolicy` — persistent content denied in every mode (Gate F); Bunker prefers null retention; Offline Capsule forbids network/remote refs; Emergency denies ordinary create/edit and allows only safe-direction redact/tombstone; strict modes suppress summary signals; no notification/preview path exists. Matrix rows + StoragePolicy agree.

## Future-sync

Local revisions mistaken for distributed versions; edit semantics incompatible with a future CRDT; poll votes coupled to unimplemented identity; file refs coupled to one filesystem; object IDs presented as authenticated identities. **Mitigation:** explicit non-claims in code + docs; no causal metadata baked into `revision`; poll `voteCapability` is literally `not_implemented_gate_g_h`; file refs hold an opaque `localRefId` only (no path/URL/bytes); IDs documented as opaque and non-authoritative.

## Endpoint-defense separation

An endpoint object interpreted as active protection; ScreenShield fields implying capture prevention; a native monitoring dependency entering the object package. **Mitigation:** `endpoint_hook_ref` stays a future-gated placeholder (no v1 object kind); the guardrail bans active flags and monitoring imports; the import-hygiene test asserts the objects package pulls in no such dependency.

## Limits (stated plainly)

Objects are local-only; content is not encrypted and not safe for real secrets; revisions are local optimistic-concurrency values (no distributed conflict resolution); no verified identity exists; tombstones are not forensic erasure; no anti-spyware protection is active.
