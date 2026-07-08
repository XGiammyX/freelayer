# ADR-0003: Capsules as the only cross-device format

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

FreeLayer promises transport-agnostic communication: relays, QR codes, files, USB drives, LAN, email, external apps. That promise only holds if there is exactly **one** data format crossing device boundaries. The moment a feature invents its own wire format or side channel, transports stop being interchangeable, the metadata story fragments, and audit surface multiplies.

## Decision

1. **Every byte that crosses a device boundary is an encrypted capsule** in the versioned format defined by `packages/protocol` ([CAPSULENET.md](../CAPSULENET.md)). Messages, file chunks, document updates, room operations, invites, contact exchanges, decisions, task updates, delivery acknowledgements, and bundles — all capsules.
2. No feature may define its own cross-device wire format, side channel, or "temporary" export format.
3. All capsule formats carry **version and algorithm identifiers** (crypto agility) from the first draft.
4. Transports carry opaque capsules only. A transport that needs to understand payload content is misdesigned and will be rejected.
5. Capsule parsing is hostile-input parsing, governed by the rules in [CAPSULENET.md](../CAPSULENET.md) — strict schemas, size limits, quarantine, fuzz tests before production use.

## Consequences

- Adding a transport never requires protocol changes; adding a feature never requires transport changes.
- One format = one audit point, one fuzzing target, one padding/metadata discipline, one test-vector suite.
- Capsule envelope design must accommodate the most constrained future transport (radio-class links), imposing size discipline on everyone now.
- Some conveniences (streaming protocols, transport-specific optimizations) are harder. Accepted.

## Security impact

- The entire hostile-input surface for remote data concentrates in `packages/protocol`, which gets strict schemas, fuzz targets, and elevated review.
- Replay and deduplication semantics are defined once, deterministically, for all features.

## Privacy impact

- Metadata minimization (envelope minimalism, size padding, no plaintext type/sender/room information) is enforced in one place and inherited by every feature automatically.
- No feature can accidentally leak plaintext metadata onto a transport, because features do not talk to transports.

## What would require a new ADR

- Any second wire format or any feature-specific export that crosses a device boundary un-encapsulated.
- Any transport interface that receives plaintext or per-payload metadata.
- Envelope fields that expose sender, recipient, room, or content-type information in plaintext.
