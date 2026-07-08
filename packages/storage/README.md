# @freelayer/storage

**Status: interfaces plus memory-only and null providers, all requiring a `PolicyDecision`; no persistent backend exists (Gates C/F).**

Storage policy engine: every write goes through policy, which selects a backend — **encrypted persistent**, **memory-only**, or **null** — based on the active Privacy Mode and data class. Also owns cache rules (caches inherit the strictest source policy), the no-persistence mode, and emergency wipe (crypto-shredding direction).

Features never choose their own persistence.

See [docs/STORAGE_MODEL.md](../../docs/STORAGE_MODEL.md).
