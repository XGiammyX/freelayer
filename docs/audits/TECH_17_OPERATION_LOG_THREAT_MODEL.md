# TECH-17 — Operation Log Threat Model

_Scope: integrity, replay, privacy, policy and future-sync risks of the LOCAL RoomOS operation log. Extends [TECH_16_ROOMOS_THREAT_MODEL.md](TECH_16_ROOMOS_THREAT_MODEL.md)._

## Event integrity and validation

Malformed events, unsupported versions, unknown operations/object kinds, duplicate IDs/sequences, gaps, out-of-order appends, foreign-room events, invalid lifecycle transitions, invalid operation payloads, post-append mutation, returned entries mutating internals. **Mitigation:** `validateRoomOperationEventV1` fails closed with stable codes; the memory log enforces uniqueness/contiguity/order and clones on append AND read (private `#` fields — internals unreachable); the lifecycle state machine is a single explicit table; typed payload schemas reject unknown fields. All fixture-tested (7 invalid golden fixtures + deterministic invalid variants).

## Replay

Clock/randomness/storage/network/notification use inside the projector; nondeterministic repeats; silent skip/sort/repair; partial application before failure. **Mitigation:** replay is validate-ALL-then-dry-run-then-apply — a failure yields **no partial result**; no sorting/dedup/skip by construction; determinism proven by repeated + cloned replays compared deep-equal, a `Date.now` spy (0 calls), and network/notification traps; the guardrail statically bans `Date.now(`/`Math.random(`/`new Date(` in the reducer/log/lifecycle modules and `JSON.stringify(event` anywhere shipped.

## Privacy

Payloads holding message content; titles/aliases/filenames in audit/errors/status; timing as persistent metadata; history preserving deleted content; sentinel in artifacts. **Mitigation:** placeholder payloads carry no real content by schema; errors/status/replay-report are code-only and sentinel-tested; timestamps are `local:`-labeled and never used for ordering; tombstone clears visible summaries but is **documented as NOT forensic deletion** (the in-memory log may retain prior placeholder events until cleared; null log retains nothing); persistent history simply does not exist in v1.

## Policy

Appends without decisions; one decision authorizing two side-effect classes; Ghost/Bunker persistence; Emergency mutation; Offline network; room loosening device policy. **Mitigation:** room mutation vs log append/read/clear each require their **own exactly-scoped decision** (cross-scope rejection tested); RoomPolicy v1 invariants + matrix rows (`room.operation_log_persist`/`room.projection_persist` deny everywhere; `room.replay`/`room.operation_log.read` deny in Emergency; `.clear` stays allowed — wipe direction) with validators pinning them.

## Future synchronization

`localSequence` mistaken for global ordering; event IDs mistaken for authenticity; the log mistaken for a CRDT; validators advertised as hostile-input parsing; replay assumptions blocking Gate H. **Mitigation:** explicit non-claims in code headers and docs ("not a CRDT, distributed ledger, tamper-proof log or synchronization protocol"); no causal metadata baked in; concurrent-event representation is exactly the Gate H design space and nothing here precludes it.

## Endpoint-defense separation

`endpoint.hook_ref_placeholder` events interpreted as active protection; monitoring dependencies entering RoomOS. **Mitigation:** hook rows stay future-gated; guardrail bans active flags; dependency scans (TECH-14) + rooms-package import hygiene test.

## Limits (stated plainly)

The log is local-only; events are **not signed, not encrypted**; local order is not global causality; internal validation is not hostile-input parsing; replay determinism is **not tamper resistance**; nothing is safe for real secrets; no endpoint protection is active in core.
