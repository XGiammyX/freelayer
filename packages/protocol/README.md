# @freelayer/protocol

**Status: type placeholders only — no parser, no serialization, no wire format (Gate E, Phase 4).**

Wire formats: the capsule envelope, canonical encoding, schema versioning, and strict validation for every object type. Crypto-agility identifiers live in the formats defined here.

All parsing in this package treats input as hostile: strict schemas, explicit size limits, fuzz targets in `tests/fuzz/`. Interop test vectors are published so independent implementations can verify.

See [docs/CAPSULENET.md](../../docs/CAPSULENET.md).
