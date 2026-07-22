# TECH-ID-02 — Identity Firewall Boundary Audit

_Date: 2026-07-22. Branch: `architecture/identity-firewall-adr`. Documentation only; no implementation._

Audits that the **decided** Identity Firewall architecture ([ADR-0013](../adr/ADR-0013-identity-firewall-architecture.md), companion [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) **Diagram 8 — Identity Firewall boundary**) keeps clean boundaries with every neighboring subsystem. For each boundary this records: the **rule**, the **direction of allowed information flow**, what must **never cross**, and the **status**. This audit decides and verifies *boundaries*, not algorithms; it does not claim any assurance that is not met.

## Legends

**Direction** — which way information is permitted to move across the boundary.

**Status** vocabulary (honest about what actually holds today):

| Status | Meaning |
| --- | --- |
| `enforced-by-code` | A mechanical/code fact holds in the repository today. |
| `architecture-rule` | A decided, binding invariant on any future implementation; **not yet** code-enforced. |
| `future-gate` | Cannot even exist before a named gate: **Gate F** (crypto), **Gate E** (wire formats), **Gate H** (synchronization), or the **Secure Device Integration Gate**. |

Most rows below are `architecture-rule` and/or `future-gate`. This is stated plainly rather than dressed up as enforcement — see [Current enforcement reality](#current-enforcement-reality).

---

## 1. Identity Firewall ↔ RoomOS (membership)

- **Rule.** A `RoomIdentityBinding` binds one root/persona ↔ one Sovereign Room ↔ one room-scoped alias ↔ one RoomOS membership (`RoomMembershipRecordV1`). RoomOS membership is a **local, unverified placeholder** and is **not** identity proof; a RoomOS role does **not** prove identity ownership. Room aliases are room-scoped, not global; one persona may use different aliases in different rooms; two room aliases are not linkable through reusable root material by default.
- **Allowed flow (bidirectional, non-authoritative).** Identity → RoomOS supplies a room-scoped alias plus a membership reference to complete a binding. RoomOS → Identity supplies only a local membership handle (`RoomMemberRef`) as a non-authoritative reference. Identity authority is **never derived from** a RoomOS role; the flow of *authority* is one-directional (root/persona → binding), never role → identity.
- **Never crosses.** The private local root (room participants never receive it); reusable root material that would link two room aliases; unrelated pairwise-relationship identifiers via room export; a RoomOS role presented as identity verification.
- **Status.** Mixed, stated honestly:
  - `enforced-by-code`: `RoomMemberRef` in [`packages/rooms/src/room-types.ts`](../../packages/rooms/src/room-types.ts) is a branded local slug validated as non-sensitive (`LOCAL_ID_RE`: "no names, no keys, no timestamps"); the `member_ref` object kind is classified `sensitivity: "relationship"`, `dataClass: "contact_aliases"`, `futureGate: "gate_g_identity"`; and `RoomTrustState.verified_placeholder` is documented as **not** real identity verification.
  - `architecture-rule`: the `RoomIdentityBinding` itself and "role ≠ identity ownership".
  - `future-gate`: room export/bundle semantics stay deferred to RoomOS/CapsuleNet (Gate E), and room-specific key state is Gate F.

## 2. Identity Firewall ↔ DevicePosture / Secure Device (external)

- **Rule.** DevicePosture is an **external environment attribute**. It may **tighten** an authorized device's permissions but **never** authorizes a device, verifies identity, or proves personhood. Secure Device / Endpoint Defense remains a **separate project** ([ENDPOINT_DEFENSE_MODEL.md](../ENDPOINT_DEFENSE_MODEL.md)). The Identity Firewall **never parses attestation evidence** and **never infers identity from posture**.
- **Mandatory distinctions (restated verbatim in spirit).** DevicePosture is **not** identity; device security is **not** personhood; a device is **not** a person; a key is **not** necessarily a real-world identity; a verified key relationship is **not** legal identity proofing.
- **Allowed flow (one-directional, restrict-only).** DevicePosture → Identity Firewall as a tighten-or-deny signal only. There is **no** reverse flow: identity never feeds posture, and posture never feeds identity status. Missing posture cannot change identity status; endpoint risk may restrict operations but cannot alter identity history.
- **Never crosses.** Posture used as a credential or authorizer; attestation Evidence into identity logic (per RFC 9334 RATS, FreeLayer core is the **Relying Party** only — it consumes a normalized result, never appraises firmware or measurements); identity inferred from device model or posture; posture altering identity history.
- **Status.** `architecture-rule` from the Identity side (no identity code exists to bound). The restrict-only, Relying-Party-only, evidence-never-parsed contract is already `enforced-by-code` on the **Secure Device** side (TECH-23: `SecureDeviceProviderPortV1` + side-effect-free `NullSecureDeviceProviderV1` reporting `not_integrated`/`unverified`; posture resolver reduces any unverified caller claim to `unverified` and lets `at_risk` override). Real posture provenance beyond `unverified`/`at_risk` is `future-gate` (**Secure Device Integration Gate**).

## 3. Identity Firewall ↔ Crypto (Gate F)

- **Rule.** All key material, signatures, key derivation, verification fingerprints/codes, recovery encryption, and device-passport signatures are **deferred to Gate F**. The architecture must **not** invent crypto ([ADR-0004](../adr/ADR-0004-no-crypto-implementation-before-review.md)), must **not** share one public root key across unrelated contexts, must **not** use display aliases as cryptographic identifiers, and must **not** use DevicePosture as a credential.
- **Allowed flow (dependency only; nothing crosses today).** Identity → Crypto is a future "needs" edge (Diagram 8: `IF -. needs .-> Crypto`). No key material, signature, or fingerprint exists to flow. Direction is Identity *depends on* Crypto; today the flow is empty.
- **Never crosses.** Ad-hoc/invented cryptography; a single global root public key reused across relationships; display aliases used as cryptographic identifiers; DevicePosture used as a credential.
- **Status.** `future-gate` (Gate F), reinforced by ADR-0004. All `*_secret_future` and `*_key_state_future` fields in the entity appendix are architecture sketches only — no persistence, no algorithm chosen.

## 4. Identity Firewall ↔ CapsuleNet / wire formats (Gate E)

- **Rule.** Invite/QR **wire formats** and **Capsule identity serialization** are deferred (Gate E for format; Gate F for authentication). **No identity leaves the device in a defined format yet.**
- **Allowed flow (none today).** Identity → CapsuleNet is a future "needs" edge (Diagram 8: `IF -. needs .-> Capsule`). Any future invite/verification/identity payload would be emitted **only** through a Gate E-defined format. Current identity egress is **zero**.
- **Never crosses.** Any identity byte-stream in an undefined or ad-hoc wire format; the private root inside an invite/QR payload; a public invite directory.
- **Status.** `future-gate` (Gate E for format, Gate F for authentication). Consistent with the project-wide zero-egress posture; contact/room invites explicitly do not expose the private root and there is no public invite directory (ADR-0013 §14).

## 5. Identity Firewall ↔ StoragePolicy

- **Rule.** Identity **secrets** are never plaintext, never in logs, never in telemetry, never in external assets; **encrypted persistence only after Gate F**. Relationship/trust metadata stays local and minimized. **Recovery material** is never in ordinary UI cache, clipboard, notifications, or cloud. Ghost/Bunker storage restrictions apply. **No identity storage is implemented.**
- **Allowed flow (bidirectional, declarative).** Identity → StoragePolicy declares data classes and policy direction (secret vs. relationship/trust metadata). StoragePolicy → Identity supplies the classification/enforcement direction. No secret is persisted today.
- **Never crosses.** Identity secrets as plaintext, into logs/telemetry/external assets; recovery material into UI cache/clipboard/notifications/cloud by default; relationship/trust metadata to a project server, public directory, or analytics.
- **Status.** `architecture-rule` — the data-classification table exists (IDENTITY_ARCHITECTURE.md §Storage & metadata classification; ADR-0013 §16; see the [metadata review](TECH_ID_02_IDENTITY_METADATA_REVIEW.md)). Encrypted persistence is `future-gate` (Gate F). No identity storage code exists.

## 6. Identity Firewall ↔ Synchronization (Gate H)

- **Rule.** Local identity state is **authoritative only for the current local vault**. No distributed consistency and no distributed revocation is claimed. **No CRDT is designed here.**
- **Allowed flow (none).** Identity state does not synchronize. The local vault is the sole authority; there is no cross-device or cross-peer identity convergence edge.
- **Never crosses.** Any claim of distributed revocation or distributed consistency; a CRDT/library selection; cross-device identity convergence.
- **Status.** `future-gate` (Gate H). Honest residual (ADR-0013 §20): a removed device may persist on unreachable peers; distributed revocation is deferred, not solved. Consistent with the RoomOS operation-log direction where the CRDT choice is likewise deferred to Gate H.

## 7. Identity Firewall ↔ Apps / UI

- **Rule.** Apps must **not** treat profile name, `RoomMemberRef`, or DevicePosture as identity; must **not** construct identity roots or verification; **unknown identity state fails closed**; identity secrets are **never logged**. (UI is future.)
- **Allowed flow (mediated, one-directional authority).** Apps → Identity Firewall only through a future SDK/core facade, requesting identity-scoped decisions. Identity → Apps returns display-safe, non-authoritative state (for example a claim-specific trust label), never secrets and never root material. Apps **consume**; they never **construct** identity.
- **Never crosses.** Profile name / `RoomMemberRef` / DevicePosture treated as identity; app-constructed identity roots or verification; identity secrets into app logs; a fabricated generic `verified: true` boolean (none exists — verification is claim-specific, ADR-0013 §12).
- **Status.** `architecture-rule` + `future-gate` (no UI and no SDK identity facade exist yet). A related precedent is already `enforced-by-code`: `apps/*` cannot import `@freelayer/rooms` (allowlisted to `ui`/`sdk`/`core`/`privacy` via `scripts/check-boundaries.mjs`), so once an identity package exists the same app-boundary machinery applies — but no identity package is present to bound today.

---

## Summary table

| Boundary | Rule | Allowed flow | Never crosses | Status |
| --- | --- | --- | --- | --- |
| **1. RoomOS (membership)** | Binding links root/persona ↔ room ↔ alias ↔ membership; membership is a local unverified placeholder; a role is not identity ownership | Alias + membership handle both ways, non-authoritative; authority only root/persona → binding | Private root to participants; reusable root material linking aliases; unrelated relationship IDs via export; role as verification | `enforced-by-code` (RoomMemberRef is a non-identity placeholder) + `architecture-rule` (binding) + `future-gate` (export/keys) |
| **2. DevicePosture / Secure Device** | Posture may tighten, never authorize/verify/prove personhood; core never parses evidence | Posture → Identity, restrict-only, one-directional | Posture as credential; evidence into identity logic; identity from posture; posture altering identity history | `architecture-rule` (Identity side) + `future-gate` (Secure Device Integration Gate); restrict-only contract `enforced-by-code` on the Secure Device side (TECH-23) |
| **3. Crypto (Gate F)** | Keys/signatures/derivation/fingerprints/recovery encryption deferred; do not invent crypto | Identity → Crypto dependency edge; empty today | Ad-hoc crypto; one shared global root key; aliases as cryptographic IDs; posture as credential | `future-gate` (Gate F), per ADR-0004 |
| **4. CapsuleNet / wire (Gate E)** | Invite/QR/Capsule identity formats deferred; no identity leaves the device in a defined format | Identity → CapsuleNet dependency edge; zero egress today | Identity in undefined/ad-hoc wire format; root in invite/QR; public invite directory | `future-gate` (Gate E format, Gate F auth) |
| **5. StoragePolicy** | Secrets never plaintext/logs/telemetry; encrypted persistence only after Gate F; recovery material never in UI cache/clipboard/cloud; Ghost/Bunker restrictions | Identity declares data classes ↔ StoragePolicy supplies classification | Secrets as plaintext/logs/telemetry; recovery material to cache/clipboard/cloud; metadata to server/directory/analytics | `architecture-rule` (classification exists) + `future-gate` (Gate F persistence); no storage code |
| **6. Synchronization (Gate H)** | Local vault is the only authority; no distributed consistency/revocation; no CRDT designed | None — identity does not synchronize | Distributed revocation/consistency claims; CRDT selection; cross-device convergence | `future-gate` (Gate H) |
| **7. Apps / UI** | Apps never treat name/RoomMemberRef/posture as identity, never construct roots/verification; unknown fails closed; secrets never logged | Apps → Identity via future facade (consume only); Identity → Apps returns display-safe non-authoritative state | Name/RoomMemberRef/posture as identity; app-constructed roots/verification; secrets in logs; fabricated `verified: true` | `architecture-rule` + `future-gate` (no UI/facade); app-import boundary `enforced-by-code` as precedent |

## Current enforcement reality

Stated plainly, so the status column is not mistaken for more than it is: **the only identity-adjacent code in the repository today is `RoomMemberRef`** — a branded, local, unverified placeholder in [`packages/rooms/src/room-types.ts`](../../packages/rooms/src/room-types.ts), explicitly labelled *not identity* (`futureGate: "gate_g_identity"`, `RoomTrustState.verified_placeholder` documented as not real verification). **There is no Identity Firewall implementation** — no roots, personas, pairwise relationships, aliases, device authorizations, device passports, invites, recovery, verification, or identity storage.

Consequently, **most of these boundaries are `architecture-rule`s and `future-gate`s, not yet code-enforced.** What *is* code-enforced today is narrow and adjacent, not the identity boundaries themselves: the RoomOS `RoomMemberRef` placeholder is mechanically a non-sensitive slug and classified as non-identity relationship metadata (boundary 1); the Secure Device restrict-only, evidence-never-parsed, Relying-Party-only contract is enforced in TECH-23 (boundary 2); and the app-import allowlist that keeps `apps/*` out of `@freelayer/rooms` is an enforced precedent that will extend to a future identity package (boundary 7).

These boundaries become code-enforceable only as the implementation sequence (TECH-ID-03+) lands behind its gates. This audit fixes the boundary invariants now so that later implementation and its regression tests (AUDIT-ID-14) have an explicit contract to verify against; it does not claim those invariants are mechanically enforced yet, and makes no spyware-proof, capture-proof, anti-impersonation, or real-world-identity-proofing claim.
