# @freelayer/relay

**Status: placeholder only — no server, no ports, no storage, no implementation (Phase 4+).**

Optional, self-hostable, **untrusted** store-and-forward relay for encrypted capsules.

What it is:

- A blind courier: holds opaque ciphertext addressed by blinded routing hints until pickup.
- Something anyone can run; clients may use several at once, or none at all.

What it is not, and must never become:

- Required infrastructure. FreeLayer works with zero relays (QR/file/USB/LAN transports).
- A user database, account system, or metadata index.
- Trusted. The protocol assumes relays are hostile ([docs/THREAT_MODEL.md](../../docs/THREAT_MODEL.md)).

See [docs/NETWORK_MODEL.md](../../docs/NETWORK_MODEL.md) and [docs/CAPSULENET.md](../../docs/CAPSULENET.md).
