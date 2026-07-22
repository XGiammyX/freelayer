# Identity Architecture (Identity Firewall)

> **Status: architecture decided ([ADR-0013](adr/ADR-0013-identity-firewall-architecture.md)); implementation NOT started.** No identity keys, recovery, invites, aliases, personas, device keys, device passports, key transparency, QR verification, DID, or verified-identity exist in code. Cryptography is **Gate F**, wire formats **Gate E**, synchronization **Gate H**. Diagrams below label future components; none imply implemented crypto. This document is the normative companion to ADR-0013 for TECH-ID-03+.

## Invariants (from ADR-0013 §8-equivalent)

No phone/email required · no central identity database · no universal public account identifier · the private root is never a normal peer-facing identifier · no global root public key reused across unrelated relationships by default · pairwise identifiers are relationship-scoped · room aliases are room-scoped · display profiles are separate from identity authority · profile names/avatars are never verification · `RoomMemberRef` is not identity · DevicePosture is not identity · a device is not a person · device authorization is subordinate to identity authority · every device has independent future key material · recovery never creates an admin backdoor · no project-owned master recovery key · recovery affects assurance visibly · verification states describe specific claims · verification never silently survives incompatible key/root changes · trust records are local observations · blocking binds to a relationship record, not an alias · one-time invites are narrow/expiring/revocable · unknown identity states fail closed · identity secrets are never logged · Ghost/Bunker storage restrictions apply · Secure Device remains a separate environmental input.

## Logical entities (non-implementational type appendix)

> These are **architecture sketches**, not production interfaces. TECH-ID-03 defines the real, versioned, local types. No field here implies crypto or persistence.

```
IdentityVault          { schemaVersion; roots: LocalIdentityRoot[]; independent: true }
LocalIdentityRoot      { schemaVersion; rootRefLocal (private); lifecycleState; personas; devices; recovery; trustNotebook }
Persona                { schemaVersion; localLabel; avatarRefLocal?; defaultProfile; defaultPolicy; roomAliasDefaults; unlinkable: false }
PairwiseRelationship   { schemaVersion; localContactRef; peerFacingPairwiseRef; presentation; trustState; blockState; keyContinuityState_future }
RoomIdentityBinding    { schemaVersion; rootOrPersonaRef; roomLocalId; roomAlias; membershipRef; roomKeyState_future }
DeviceAuthorization    { schemaVersion; deviceRefLocal; scope; authState; deviceKeyState_future }
TrustNotebook          { schemaVersion; records: TrustRecord[] }
TrustRecord            { schemaVersion; kind (fact|peer_claim|local_note); event; channel?; observedAtLocal }
RecoveryConfiguration  { schemaVersion; mode (offline_kit|existing_device|none); policy; assuranceOnRecovery: "recovered_reverification_required" }
InviteAuthority        { schemaVersion; class; issuerContext; targetPersonaOrRoom; maxAuthority; expiry; singleUseState; revocationState; recipientBinding? }
IdentityPolicy         { schemaVersion; failClosed: true; strictModeMinimization; ghostBunkerRestrictions }
```

## Diagram 1 — Identity entity graph

```mermaid
graph TD
  V[IdentityVault] --> R1[LocalIdentityRoot A]
  V --> R2[Independent Root B]
  R1 --> P1[Persona]
  R1 --> DA1[DeviceAuthorization]
  R1 --> RC1[RecoveryConfiguration]
  R1 --> TN1[TrustNotebook]
  P1 --> PR1[PairwiseRelationship]
  P1 --> RB1[RoomIdentityBinding]
  R2 --> P2[isolated personas/relationships/devices/recovery]
  classDef future stroke-dasharray:4 4;
```

## Diagram 2 — Pairwise relationship model

```mermaid
graph LR
  ME[My Persona under Root A] -- pairwise ref X --> C1[Contact 1]
  ME -- pairwise ref Y --> C2[Contact 2]
  ME -- pairwise ref Z --> C3[Contact 3]
  note[No shared global identifier across X/Y/Z by default]
```

Each contact gets a distinct peer-facing pairwise identifier; none is reused; the display alias can change without changing the relationship record; **block state survives alias changes**.

## Diagram 3 — Room identity binding

```mermaid
graph TD
  Root[LocalIdentityRoot / Persona] --> Bind[RoomIdentityBinding]
  Bind --> Alias[Room-scoped alias]
  Bind --> Room[Sovereign Room]
  Bind --> Member[RoomOS RoomMembershipRecordV1]
  Bind -. future .-> RoomKey[room-specific key state — Gate F]
  Room -. participants never receive .-> Root
```

## Diagram 4 — Root-to-device authorization hierarchy

```mermaid
graph TD
  Root[LocalIdentityRoot authority] --> D1[DeviceAuthorization: this device]
  Root --> D2[DeviceAuthorization: laptop - persona-limited]
  Root --> D3[DeviceAuthorization: tablet - read-only]
  D1 -. cannot authorize .-> D4[another device unless explicitly allowed]
  Posture[DevicePosture - external] -. may TIGHTEN, never authorize .-> D1
```

## Diagram 5 — Verification & warning state transitions

```mermaid
stateDiagram-v2
  [*] --> unverified
  unverified --> continuity_observed
  continuity_observed --> out_of_band_verified
  unverified --> introduced_unverified
  out_of_band_verified --> key_change_warning: key changes
  continuity_observed --> key_change_warning: key changes
  out_of_band_verified --> device_change_warning: device changes
  key_change_warning --> unverified: review
  key_change_warning --> out_of_band_verified: re-verify
  out_of_band_verified --> recovered_reverification_required: peer recovered
  recovered_reverification_required --> unverified
  recovered_reverification_required --> out_of_band_verified: re-verify
  unverified --> compromised_suspected
  out_of_band_verified --> compromised_suspected
  compromised_suspected --> revoked
  revoked --> [*]
```

## Diagram 6 — Recovery flow

```mermaid
graph TD
  Loss[Device / root loss] --> Kit{Offline Recovery Kit OR existing authorized device?}
  Kit -- neither --> NoRecover[No recovery - Ghost identities may choose this]
  Kit -- yes --> Restore[Restore identity authority - Gate F encryption]
  Restore --> Rev[State: recovered_reverification_required]
  Rev --> Warn[Warn high-assurance contacts]
  Rev --> Devices[Review / invalidate old device authorizations]
  Rev --> Reverify[Re-verify contacts; verification NOT auto-restored]
  Note[No FreeLayer master key · no server · no admin override]
```

## Diagram 7 — Invite lifecycle

```mermaid
stateDiagram-v2
  [*] --> issued
  issued --> delivered: out-of-band / QR / capsule
  delivered --> accepted: current policy + user action
  delivered --> expired: expiry reached
  delivered --> revoked: issuer revokes
  issued --> revoked
  accepted --> consumed: single-use
  expired --> [*]
  revoked --> [*]
  consumed --> [*]
  note right of accepted : replay of consumed/expired/revoked = DENY
```

## Diagram 8 — Identity Firewall boundary

```mermaid
graph TB
  subgraph FreeLayer core
    IF[Identity Firewall]
    RoomOS[RoomOS membership]
    Storage[StoragePolicy]
    Crypto[Crypto - Gate F, deferred]
    Capsule[CapsuleNet - Gate E, deferred]
  end
  subgraph External
    SD[Secure Device project]
    Posture[DevicePosture]
  end
  IF --- RoomOS
  IF --- Storage
  IF -. needs .-> Crypto
  IF -. needs .-> Capsule
  Posture -. tightens only, never identity .-> IF
  SD --- Posture
  IF -. never parses evidence / never identity from posture .- SD
```

## Identity-root lifecycle (state table — not implemented)

| State | Meaning | Notable transitions |
| --- | --- | --- |
| `draft_local` | Root being created locally | → `active_local` |
| `active_local` | Usable local authority | → `locked_local`, `compromised_suspected` |
| `locked_local` | Temporarily locked | → `active_local`, `recovery_required` |
| `recovery_required` | Authority unavailable; needs recovery | → `recovered_reverification_required` |
| `recovered_reverification_required` | Restored; assurance reset | → `active_local` **after explicit review** |
| `compromised_suspected` | Possible compromise | → `revoked_tombstone` |
| `revoked_tombstone` | Terminal, local | — |

Invalid/uncertain transitions (e.g., `revoked_tombstone` → anything) are denied. Distributed propagation of any of these is **deferred (Gate H)**.

## Relationship trust lifecycle & device authorization lifecycle

See Diagram 5 (verification). Device authorization: `proposed_future → authorized_local → restricted_local → removed_tombstone` (removal is terminal locally; distributed revocation deferred).

## Storage & metadata classification

| Data class | Category | Policy direction |
| --- | --- | --- |
| `identity_root_secret_future` | secret | never plaintext/logs/telemetry; encrypted persistence only after Gate F; Ghost/Bunker restricted |
| `identity_root_public_reference_future` | secret-adjacent | private; not a peer-facing identifier; not exposed in discovery |
| `persona_profile` | relationship/trust metadata | local; no server/directory/analytics; strict-mode minimized |
| `pairwise_relationship` | relationship/trust metadata | local; not searchable; no directory |
| `relationship_secret_future` | secret | as secrets above (Gate F) |
| `room_identity_binding` | relationship/trust metadata | local; room-scoped; not globally linkable |
| `device_authorization` | relationship/trust metadata | local; revocable; minimal device metadata |
| `device_secret_future` | secret | as secrets above (Gate F) |
| `trust_notebook` | relationship/trust metadata | local; facts vs claims vs notes; no reputation; no upload |
| `verification_record` | relationship/trust metadata | local; claim-specific; invalidated on incompatible change |
| `recovery_configuration` | relationship/trust metadata | local; discloses assurance trade-offs |
| `recovery_material_future` | secret (recovery) | never cached in ordinary UI; no clipboard/notifications/cloud by default; future protected presentation |
| `invite_secret_future` | secret | as secrets above (Gate E/F) |
| `block_relationship` | relationship/trust metadata | local; binds to relationship, survives alias change |
| `identity_tombstone` | relationship/trust metadata | local; no forensic-erasure claim |

## Contact discovery & public identifiers (v1 decision)

**No public searchable identity directory. No mandatory global username. No address-book upload. No phone/email discovery.** Connection methods: one-time invite exchange, QR/out-of-band exchange, Capsule/file exchange, trusted introduction, and (only if a future privacy gate approves) an exact high-entropy connection reference. Explicitly rejected for v1: globally searchable usernames, short enumerable identifiers, a public root-key directory, contact-book matching, a social-graph server, and alias lookup returning near matches. Any future optional username system requires its own research + privacy gate.

## Blocking & abuse

Blocking binds to the **local relationship**, not the visible alias: a blocked relationship cannot bypass via alias rename; a new independent identity is a new relationship and **cannot be globally identified without undermining privacy**. Block lists stay local; there is **no central reputation database and no global person ban**. Invite rate limits may be local/transport-specific; message requests default to deny/quarantine; unknown invite senders gain no room authority; room admins cannot identify a person across independent roots. **The unlinkability ↔ Sybil-resistance tension is unavoidable and is not claimed solved.**

## DID / VC / passkey / key-transparency decisions

| Topic | Decision (v1) | Reason / re-evaluation trigger |
| --- | --- | --- |
| **DIDs** | **Rejected for the initial core** | method/resolver complexity, service-endpoint metadata, registry dependence, correlation risk, unproven interop benefit. FreeLayer uses pairwise-identifier *principles* without a DID method. |
| **Verifiable Credentials** | **Out of scope** | issuer dependence + infrastructure; no concrete credential-sharing use case. Reconsider only for a specific need. |
| **Passkeys / WebAuthn** | **Not the identity root** | authenticates to an account server FreeLayer doesn't have; synced passkeys add provider dependence; not recovery architecture. May later be evaluated for *local vault unlock* only. |
| **Key transparency** | **Deferred** | no public username/account/key directory is selected; relationship-based verification + warnings come first. Re-evaluate only if public usernames / server key directories / large-scale discovery / federation are introduced. |

## Rejected alternatives (benefit / cost / reason)

| Alternative | Benefit | Cost | Verdict |
| --- | --- | --- | --- |
| Phone/email as identity | discovery, familiarity | correlation, central dependence, enumeration | **Rejected** |
| Global public key to all peers | simple continuity | maximal cross-context correlation | **Rejected** |
| One mandatory global username | easy discovery | enumeration + global identifier | **Rejected** |
| Public searchable directory | convenience | enumeration + social-graph exposure | **Rejected (v1)** |
| Root copied unprotected to every device | simple multi-device | one compromise = full compromise | **Rejected** |
| Server/administrator recovery | convenience | backdoor / takeover class | **Rejected** |
| Project-owned master key | central recovery | catastrophic backdoor | **Rejected** |
| Profile name as verification | simple UX | trivial impersonation | **Rejected** |
| `RoomMemberRef` / DevicePosture / device model as identity | reuse existing signals | term collapse; false assurance | **Rejected** |
| Automatic trust after recovery | smooth UX | silent takeover after recovery compromise | **Rejected** |
| Single `verified` boolean | simple | hides key/device/recovery nuance | **Rejected** |
| DID method as initial requirement | interop story | complexity/metadata/correlation | **Rejected (v1)** |
| Central reputation for abuse | Sybil resistance | universal identifier + surveillance | **Rejected** |
