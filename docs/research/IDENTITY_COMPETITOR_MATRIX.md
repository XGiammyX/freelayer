# Identity Competitor Matrix & Threat Model

**Research ID:** RESEARCH-ID-01
**Scope:** Research only — NO implementation. Feeds TECH-ID-02.
**Subject:** Competitor identity models for FreeLayer / ChatControl (private, decentralized, accountless, local-first messenger).
**Branch:** `research/identity-competitor-threat-model`

---

## 0. Sourcing statement (READ FIRST)

> **All sources for this document were consulted OFFLINE, from prior established knowledge.** No live web fetch, protocol spec, source repository, or audit report was retrieved during authoring. This is an internet-unavailable environment.
>
> **Every factual claim below MUST be re-verified against primary sources before TECH-ID-02 begins.** Treat this document as a structured hypothesis map and a checklist of things to confirm — not as a settled reference.
>
> **Knowledge cutoff caveat:** Details current to roughly **2023–early 2025**. Several of these projects iterate quickly (Signal usernames, Matrix cross-signing UX, SimpleX routing). Anything marked with a date is approximate. Anything I am unsure about is flagged inline with **[UNCERTAIN]** or a note about whether the behavior is protocol-level or product-level.

### Evidence-type tags

Each claim is tagged with the *kind* of evidence it rests on. These tags describe **what the claim is based on in general public knowledge**, not a specific citation I retrieved today:

| Tag | Meaning |
|-----|---------|
| `[marketing]` | Vendor's own promotional framing. **Not** treated as verified fact. |
| `[product-docs]` | Official user/product documentation or support pages. |
| `[protocol-spec]` | A published protocol specification (e.g., Signal Protocol docs, Matrix spec). |
| `[source-code]` | Behavior visible in open-source implementation. |
| `[security-audit]` | Third-party formal audit / cryptographic review. |
| `[independent-analysis]` | Reputable third-party research, academic papers, or community teardown. |

Where marketing and reality may diverge, I say so explicitly. Marketing claims (especially around metadata and anonymity) are **the most important thing to re-verify**.

---

# PART 1 — Comparison Matrix (spec §8)

Competitors are presented as **per-field-group blocks** with competitors as columns. Fields follow spec §8 exactly. Abbreviations: SGX = Intel Software Guard Extensions (secure enclave); TOFU = Trust On First Use; SAS = Short Authentication String; DID = Decentralized Identifier; PoW = Proof of Work.

The optional extra local-first / peer system chosen is **Cwtch** (Tor-based, per-conversation pseudonymous, metadata-resistant) — described where I can do so accurately, flagged **[UNCERTAIN]** where I cannot.

---

### §8.1 Identity root

| | Signal | Matrix / Element | SimpleX Chat | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Root type** | Phone number → account; identity keypair bound to account `[product-docs]` | `@user:homeserver` **server account** on a homeserver `[protocol-spec]` | **No global identity**; per-connection keypairs (pairwise) `[product-docs]` | **Public key** (Ed25519/X25519-derived Session ID); accountless `[product-docs]` `[marketing]` | **Local public-key identity** generated on device; no account `[product-docs]` | **Local keypair profile**; per-conversation pseudonymous onion address `[product-docs]` `[UNCERTAIN on exact key type]` |
| **Server account required?** | Yes (registration on Signal servers) `[product-docs]` | Yes (homeserver account) `[protocol-spec]` | No global account; uses relay servers but no account `[product-docs]` | No account `[marketing]`; uses service-node network `[product-docs]` | No — fully local `[product-docs]` | No — Tor onion services `[product-docs]` |
| **Closest FreeLayer analogue** | (reject: centralized/phone) | (partial: DID-like `user@domain`) | **pairwise, no global id** ✅ | public-key-as-id | **local-only key identity** ✅ | **per-context pseudonym** ✅ |

---

### §8.2 Discovery

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Primary mechanism** | Phone-contact discovery (address book) `[product-docs]` | Homeserver user directory + exact `@id` lookup `[protocol-spec]` | Out-of-band **connection link / QR**; no directory `[product-docs]` | Share **Session ID** out-of-band / QR `[product-docs]` | **QR in person** + remote introductions `[product-docs]` | Share onion address / QR out-of-band `[product-docs]` |
| **Public username directory?** | Usernames added ~2024 as **discovery handle**, not a browsable directory; exact-match lookup `[product-docs]` | Yes, per-homeserver directory (federated search varies) `[protocol-spec]` | No `[product-docs]` `[marketing]` | Open-group/community listings exist; no global user directory `[product-docs]` | No `[product-docs]` | No `[product-docs]` |
| **Invite link / one-time?** | Username-based link; username can be rotated/deleted `[product-docs]` | Room invite links; matrix.to links `[product-docs]` | **One-time or long-term invitation links** `[product-docs]` ✅ | Reusable Session ID (not one-time by default) | Yes, links/introductions `[product-docs]` | Per-conversation invite `[product-docs]` |
| **Offline / out-of-band** | Not primary | Not primary | Supported via link/QR share | Supported | **Yes — Bluetooth/Wi-Fi/QR in person** `[product-docs]` ✅ | QR share |

---

### §8.3 Identifier visibility

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Global visibility** | Phone number is the account root but **hidden from other users by default** since ~2023–24 privacy changes `[product-docs]`; username optional & changeable | `@user:homeserver` is **global & permanent-ish** (tied to homeserver) `[protocol-spec]` | **None** — no global identifier `[product-docs]` | Session ID is **global & permanent** (public key) `[product-docs]` | Public key identity is per-contact-facing; no global directory `[product-docs]` | Onion address per profile; can create alt profiles `[UNCERTAIN]` |
| **Changeable?** | Username changeable/removable; phone number changeable with migration `[product-docs]` | User ID **not** changeable (migration = new account) `[protocol-spec]` | Links rotatable; identity is pairwise `[product-docs]` | Session ID fixed unless you generate a new one (loses continuity) `[product-docs]` | Identity fixed per profile `[product-docs]` | Per-conversation → naturally pairwise-ish `[UNCERTAIN]` |
| **Pairwise?** | No (one identity) | No | **Yes — pairwise by design** `[product-docs]` ✅ | No (one Session ID) | No (one identity, but no global exposure) | **Per-conversation pseudonym** ✅ `[UNCERTAIN on strictness]` |
| **Hidden-after-connect** | Phone hidden; username optional | ID visible to contacts/rooms | N/A (pairwise) | Session ID visible to contacts | Key visible to contacts only | Address visible to that conversation |

---

### §8.4 Profile model

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Name/avatar** | Profile name + avatar, **end-to-end encrypted**, shared per-contact on connect `[product-docs]` `[protocol-spec]` | Displayname + avatar stored on homeserver, **server-visible** `[protocol-spec]` | Per-connection display profile; incognito available `[product-docs]` | Display name + avatar, local/attached to ID `[product-docs]` | Nickname per contact, local `[product-docs]` | Per-profile nickname `[product-docs]` |
| **Server sees profile?** | **No** (encrypted profile) `[product-docs]` | **Yes** (displayname/avatar plaintext on homeserver) `[protocol-spec]` | Minimal; relays are dumb `[marketing]` `[UNCERTAIN]` | Stored/routed via swarm; **[UNCERTAIN]** if plaintext | No server | No server (Tor) |
| **Uniqueness enforced?** | Username unique; profile name not unique `[product-docs]` | Displayname not unique; user ID unique `[protocol-spec]` | No global names → no uniqueness `[product-docs]` | No uniqueness on display name `[product-docs]` | No `[product-docs]` | No `[product-docs]` |
| **Per-contact / per-room profile** | Profile is single (per-account) | Per-room displayname override possible `[product-docs]` | **Per-connection / incognito** ✅ | Single profile | Per-contact nickname (local label) | **Per-conversation** ✅ |

---

### §8.5 Key model

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Identity key** | Long-term identity key per account; X3DH + Double Ratchet `[protocol-spec]` | Per-device keys + **cross-signing** master/self/user-signing keys `[protocol-spec]` | Per-connection keys; no master identity `[product-docs]` | Ed25519 keypair = the identity; Session ID derived from it `[product-docs]` | Long-term identity keypair, local `[product-docs]` | Keypair per profile `[UNCERTAIN]` |
| **Device vs identity** | Primary device holds identity; linked devices have own keys `[product-docs]` `[protocol-spec]` | **Per-device keys**, unified by cross-signing `[protocol-spec]` | Device = holder of connection state `[product-docs]` | Single key; multi-device shares the seed `[product-docs]` `[UNCERTAIN]` | Device-bound identity `[product-docs]` | Device-bound `[UNCERTAIN]` |
| **Key transparency / server-known** | Moving toward **key transparency** (KT) for username→key; identity keys not escrowed `[product-docs]` `[independent-analysis]` | Homeserver knows device list + public keys; no formal KT log (as of ~2024) `[protocol-spec]` `[UNCERTAIN if changed]` | Server does not hold identity map `[marketing]` `[UNCERTAIN]` | Service nodes store public routing info `[product-docs]` | Local-only; no server keys `[product-docs]` | No central key server `[product-docs]` |
| **Local-only keys** | Private keys local; profile keys local | Private keys local; **backed by SSSS** on server (encrypted) `[protocol-spec]` | Local `[product-docs]` | **Seed = keys**, local; recoverable from seed `[product-docs]` | Local `[product-docs]` | Local `[product-docs]` |

---

### §8.6 Multi-device model

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **# devices** | 1 primary phone + linked (desktop/iPad); historically phone-primary `[product-docs]` | Many devices, co-equal `[protocol-spec]` | Limited multi-device; historically single-device-centric, added multi-device later `[product-docs]` `[UNCERTAIN on maturity]` | Multi-device via seed `[product-docs]` | **Single device** (device-bound) `[product-docs]` | **[UNCERTAIN]** — historically single-device |
| **Linking** | QR-scan primary↔linked `[product-docs]` | Login + cross-sign new device `[protocol-spec]` | Link via QR/state transfer `[product-docs]` | Restore from recovery phrase `[product-docs]` | N/A `[product-docs]` | `[UNCERTAIN]` |
| **Verification of new device** | Primary authorizes linked device `[product-docs]` | **Cross-signing** each new device `[protocol-spec]` | `[UNCERTAIN]` | Seed-based; no per-device verify `[product-docs]` | N/A | `[UNCERTAIN]` |
| **History migration** | Limited; device transfer for primary; linked devices historically no full backfill `[product-docs]` | Via key backup / server-stored encrypted history `[protocol-spec]` | Local; migration is manual/state-transfer `[product-docs]` | Limited history sync `[product-docs]` `[UNCERTAIN]` | Local DB only; no cloud `[product-docs]` | Local `[product-docs]` |
| **Stale-device handling** | Linked device expiry; unlink UI `[product-docs]` | Stale/unverified device warnings; can be **noisy/confusing** `[independent-analysis]` | `[UNCERTAIN]` | `[UNCERTAIN]` | N/A | `[UNCERTAIN]` |

---

### §8.7 Verification UX

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Method** | **Safety number** (compare/scan QR) `[product-docs]` | **SAS emoji / decimal**, QR, cross-signing `[protocol-spec]` | Compare connection security code; TOFU on link `[product-docs]` `[UNCERTAIN]` | TOFU on Session ID exchange `[product-docs]` | **In-person QR** + introductions `[product-docs]` | In-person / out-of-band `[UNCERTAIN]` |
| **Automatic / KT** | Safety-number change alerts; KT direction reduces manual burden `[product-docs]` `[independent-analysis]` | Cross-signing propagates trust once device is verified `[protocol-spec]` | TOFU-based `[UNCERTAIN]` | TOFU-based `[product-docs]` | Manual, human-anchored `[product-docs]` | Manual `[UNCERTAIN]` |
| **Real-world identity proof?** | **No** — safety number proves key continuity, **not** who the person is `[protocol-spec]` | SAS proves key match, not real identity `[protocol-spec]` | Proves connection integrity, not identity | Proves key, not identity | In-person QR is strongest human anchor `[product-docs]` | Out-of-band anchor |

---

### §8.8 Recovery

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Mechanism** | **PIN + Registration Lock**; Secure Value Recovery (SVR) for profile/contacts/settings `[product-docs]` `[security-audit]` | **Recovery key / passphrase** unlocking SSSS + key backup `[protocol-spec]` | Local export/import; **[UNCERTAIN]** on managed recovery | **Recovery phrase (seed)** regenerates identity `[product-docs]` | **Local password**; backup limited/manual `[product-docs]` | Local; **[UNCERTAIN]** |
| **Central recovery service?** | Yes — SVR (SGX-backed) holds PIN-encrypted secrets `[product-docs]` `[security-audit]` | Homeserver stores encrypted key backup `[protocol-spec]` | No central identity recovery `[UNCERTAIN]` | No — seed is user-held `[product-docs]` | No `[product-docs]` | No `[product-docs]` |
| **Device loss = ?** | Recover via SVR + PIN; re-register phone `[product-docs]` | Recover via recovery key + backup `[protocol-spec]` | Possible identity/history loss without local backup `[UNCERTAIN]` | Re-derive from seed (if saved) `[product-docs]` | **Identity loss** if no backup — no server to recover from `[product-docs]` | Likely loss without backup `[UNCERTAIN]` |

---

### §8.9 Alias & unlinkability

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Global username** | Optional username (changeable) `[product-docs]` | Global user ID (permanent) `[protocol-spec]` | None `[product-docs]` | Session ID (global, permanent) `[product-docs]` | None global `[product-docs]` | None global `[product-docs]` |
| **Per-contact / per-room alias** | No (single profile) | Per-room displayname override `[product-docs]` | **Incognito per connection** ✅ `[product-docs]` | No `[product-docs]` | Local per-contact label | **Per-conversation profile** ✅ |
| **Incognito / alt profile** | No native alt profile `[product-docs]` | Multiple accounts = manual `[protocol-spec]` | **Yes — incognito mode** `[product-docs]` ✅ | No native | Multiple profiles limited `[UNCERTAIN]` | **Yes** `[UNCERTAIN strictness]` |
| **Cross-context correlation risk** | Username + phone can correlate if reused `[independent-analysis]` | Same user ID across rooms = correlatable `[protocol-spec]` | **Low** — pairwise ✅ | **High** — one ID everywhere `[independent-analysis]` | Low (no directory) | **Low** ✅ |

---

### §8.10 Metadata & privacy

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Server knows your identifier** | Yes — phone number known to Signal servers `[product-docs]` `[independent-analysis]` | Yes — homeserver knows user ID `[protocol-spec]` | Relays don't hold a global id `[marketing]` `[UNCERTAIN — verify]` | Service nodes know Session ID (public key) `[product-docs]` | No server `[product-docs]` | Tor hides network id `[product-docs]` |
| **Server knows social graph** | **Sealed sender** reduces (not eliminates) metadata; contact discovery reveals overlap `[product-docs]` `[independent-analysis]` | Homeserver sees room membership/graph `[protocol-spec]` `[independent-analysis]` | **Designed to minimize** graph knowledge via pairwise queues `[marketing]` `[independent-analysis — partly corroborated]` | Onion routing claims to hide sender-recipient link `[marketing]` `[UNCERTAIN — verify vs swarm storage]` | No central graph holder `[product-docs]` | **Metadata-resistant by design** (Tor + no server) `[marketing]` `[independent-analysis]` |
| **Directory enumeration** | Historic contact-discovery enumeration concerns → mitigated by **private contact discovery (SGX)** `[product-docs]` `[security-audit]` `[independent-analysis: SGX critiqued]` | Directory scraping possible per homeserver `[independent-analysis]` | No directory → no enumeration `[product-docs]` | No user directory `[product-docs]` | None `[product-docs]` | None `[product-docs]` |
| **Account-creation metadata** | Phone number + SMS = strong real-world linkage `[independent-analysis]` | Homeserver registration (email/captcha varies) `[protocol-spec]` | Minimal `[marketing]` | Minimal (no signup) `[marketing]` | Minimal (local) | Minimal (Tor) |
| **IP protection** | Servers see IP unless relayed; calls can relay `[product-docs]` | Homeserver sees IP `[protocol-spec]` | Uses relays; claims IP protection `[marketing]` `[UNCERTAIN]` | **Onion routing** hides IP `[marketing]` `[independent-analysis]` | **Tor** `[product-docs]` | **Tor** `[product-docs]` |
| **Recovery-service metadata** | SVR/SGX holds PIN-derived secrets — trust in enclave `[security-audit]` `[independent-analysis: SGX side-channel history]` | Key backup on homeserver (encrypted) `[protocol-spec]` | N/A `[UNCERTAIN]` | Seed is client-side → **no recovery metadata** `[product-docs]` | None | None |

---

### §8.11 Decentralization

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Central required** | **Yes** — Signal-operated servers `[product-docs]` `[independent-analysis]` | No — **federated** homeservers `[protocol-spec]` | Relay servers, **self-hostable**, no central identity `[product-docs]` | Decentralized **service-node** network (Oxen) `[product-docs]` | **None — P2P** `[product-docs]` | **None — P2P over Tor** `[product-docs]` |
| **Federated** | No `[independent-analysis]` | **Yes** ✅ `[protocol-spec]` | N/A (relays are interchangeable) | N/A | No (direct P2P) | No (direct) |
| **P2P / offline exchange** | No | No | Store-and-forward via relays `[product-docs]` | Store-and-forward via swarms `[product-docs]` | **Yes — Bluetooth/Wi-Fi offline** ✅ `[product-docs]` | Direct P2P (online, via Tor) `[product-docs]` |
| **Self-hostable** | Server is open-source but federation discouraged `[independent-analysis]` | **Yes** ✅ | **Yes** (SMP servers) ✅ | Service nodes are staked/permissionless `[product-docs]` | N/A (no server) | N/A |

---

### §8.12 Abuse & spam controls

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Message requests** | Yes `[product-docs]` | Room invites / knock `[protocol-spec]` | **Connection consent per link** `[product-docs]` ✅ | Message requests `[product-docs]` | **Contact must be mutually added** `[product-docs]` ✅ | Per-conversation accept `[product-docs]` |
| **Blocking** | Yes `[product-docs]` | Yes / ignore `[protocol-spec]` | Delete connection `[product-docs]` | Block by Session ID `[product-docs]` | Remove contact `[product-docs]` | Remove `[product-docs]` |
| **PoW / rate limits** | Server rate limits; phone-number **cost** is anti-spam `[independent-analysis]` | Server-side rate limits per homeserver `[protocol-spec]` | Link-based → spam needs your link `[product-docs]` | **[UNCERTAIN]** — open groups moderated | N/A | N/A |
| **Sybil cost** | **Phone number = cost/friction** `[independent-analysis]` | Homeserver registration friction (varies) `[independent-analysis]` | No account → relies on out-of-band link secrecy `[independent-analysis]` | Free IDs → **cheap Sybil** `[independent-analysis]` | In-person/introductions raise cost `[product-docs]` | Out-of-band cost `[independent-analysis]` |
| **Directory moderation** | Username abuse handling `[product-docs]` | Per-homeserver moderation `[protocol-spec]` | No directory | Open-group moderation `[product-docs]` | None | None |

---

### §8.13 Endpoint & trust assumptions

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Local device trust** | Assumes device secure; keys local `[product-docs]` | Same; keys per device `[protocol-spec]` | Same | Same; **seed security is critical** `[product-docs]` | Same; local DB password `[product-docs]` | Same |
| **Hardware / enclave** | **SGX** for contact discovery + SVR `[security-audit]` `[independent-analysis: SGX trust debated]` | None required `[protocol-spec]` | None `[product-docs]` | None `[product-docs]` | None `[product-docs]` | None `[product-docs]` |
| **Server honesty assumption** | Trust Signal + SGX attestation `[security-audit]` | Trust your homeserver (sees metadata) `[protocol-spec]` `[independent-analysis]` | Relays assumed **untrusted/dumb** `[marketing]` `[verify]` | Service nodes assumed untrusted individually `[product-docs]` | **No server to trust** ✅ | **No server** ✅ |
| **Browser exposure** | Desktop app (Electron) `[product-docs]` | Element Web = browser threat surface `[independent-analysis]` | Native apps `[product-docs]` | Native apps `[product-docs]` | Native `[product-docs]` | Native `[product-docs]` |
| **Transparency log / trusted directory** | KT log (emerging) `[independent-analysis]` | No standard KT (as of ~2024) `[protocol-spec]` `[UNCERTAIN]` | None needed (pairwise) | None | None | None |

---

### §8.14 Known limitations

| | Signal | Matrix/Element | SimpleX | Session | Briar | Cwtch |
|---|---|---|---|---|---|---|
| **Headline limitation** | **Phone-number dependency**; centralized servers `[independent-analysis]` | **Metadata exposure** to homeservers; multi-device/key complexity `[independent-analysis]` | Multi-device immaturity; UX of no-address model `[UNCERTAIN]` | Cheap Sybil; **swarm stores messages** (storage-node trust); onion ≠ identity `[independent-analysis]` | Single-device; no cloud recovery; needs both online-ish for P2P `[product-docs]` | Small ecosystem; requires Tor; maturity **[UNCERTAIN]** |
| **Notable incidents / findings** | Contact-discovery enumeration research; debate over SGX trust; SVR design scrutiny `[independent-analysis]` | Historical device/key-confusion & "unable to decrypt" UX; homeserver metadata critiques `[independent-analysis]` | Younger project → less audit coverage `[UNCERTAIN]` | Fork-of-Signal lineage; metadata claims need scrutiny `[independent-analysis]` | Mature threat model but niche; battery/discovery trade-offs `[product-docs]` | Least externally audited here `[UNCERTAIN]` |

---

# PART 2 — Per-competitor deep analyses

---

## §9 — Signal

### Identity model
Signal's identity root is a **phone number** bound to a Signal-server **account**, plus a long-term **identity key** used in X3DH + Double Ratchet. `[protocol-spec]` `[product-docs]` Registration requires receiving an SMS/call code, so **account creation is tied to a real-world, cost-bearing identifier**. `[independent-analysis]`

### Phone number: registration ≠ visibility
A critical distinction FreeLayer must internalize:
- **Phone-number registration** (required to create the account) `[product-docs]`
- **≠ Phone-number visibility** to other users. Since ~2023–2024 privacy changes, Signal **hides your phone number** from contacts by default and lets you connect via **username** instead. `[product-docs]`

So the phone number is a **Sybil-resistance + bootstrap** mechanism, not necessarily a displayed identifier. The centralization cost is the *server + phone dependency*, not "everyone sees your number."

### Usernames (added ~2024)
- Usernames are an **optional discovery handle**, **changeable and deletable**, resolved by **exact match** (not a browsable directory). `[product-docs]`
- **Signal username ≠ permanent public identity.** It is a rotatable pointer to your account; deleting it breaks that discovery path. `[product-docs]`
- Signal has publicly moved toward **key transparency** so username→key mappings can be audited without trusting the server blindly. `[independent-analysis]` `[UNCERTAIN on rollout state — verify]`

### Profiles vs usernames vs identity
- **Profile** (name + avatar) is **end-to-end encrypted** and shared per-contact. `[product-docs]`
- **Profile ≠ verified identity.** Anyone can set any profile name. `[product-docs]`
- **Safety number ≠ real-world identity proof.** The safety number verifies **key continuity between two devices/keys**, catching MITM/key changes — it does **not** prove who the human is. `[protocol-spec]`

### Message requests, linked devices
- **Message requests** gate first contact from unknown senders. `[product-docs]`
- **Linked devices**: a primary (historically phone) authorizes desktop/iPad via QR. Linked devices historically had **limited history backfill** and the phone was a single point of primacy. `[product-docs]` `[UNCERTAIN — Signal has been reworking multi-device/primary-less; verify current state]`

### Recovery: PIN, Registration Lock, SVR
- **Registration Lock + PIN** prevent someone re-registering your number without your PIN. `[product-docs]`
- **Secure Value Recovery (SVR)** stores PIN-encrypted data (profile, some settings/contacts) server-side, protected by **SGX** enclaves with rate-limited PIN attempts. `[product-docs]` `[security-audit]`
- Trade-off: SVR requires trusting **enclave attestation**; SGX has a documented history of side-channel research, so this is a **debated trust anchor**. `[independent-analysis]`

### Contact discovery (private / SGX)
- Signal runs **private contact discovery** inside SGX enclaves to match address-book numbers without exposing the full contact set to the server. `[product-docs]` `[security-audit]`
- Independent researchers have both validated the intent and **critiqued enclave trust and enumeration edges**. `[independent-analysis]`

### Device transfer / recovery trade-offs
Device transfer (phone-to-phone) moves the identity locally; losing the device without PIN/SVR can mean re-registration and loss of local history. `[product-docs]`

### Lessons for FreeLayer (without copying Signal's model)
1. **Separate Sybil-resistance from identity display.** Signal uses phone cost for anti-spam; FreeLayer should get Sybil resistance from **one-time invites / out-of-band exchange**, not a central phone/account.
2. **Rotatable discovery handle over permanent public ID.** Emulate "username is a deletable pointer," but make FreeLayer's equivalent **per-contact/per-room**, not global.
3. **Key continuity ≠ identity.** Adopt safety-number-style continuity checks, but present them honestly as *"this key hasn't changed,"* never *"this is person X."*
4. **Avoid enclave/central recovery.** SVR's SGX dependency is exactly the centralization FreeLayer rejects. Prefer **user-held offline recovery** (see §14).
5. **Message-request gating is good UX** and portable to an accountless model.

---

## §10 — Matrix / Element

### Identity model
A Matrix user ID is `@localpart:homeserver.tld` — **inseparably tied to a homeserver domain**. `[protocol-spec]` The homeserver is a **server account** and a **metadata-holding party**: it knows your ID, device list, room memberships, displayname/avatar (plaintext), and IP. `[protocol-spec]` `[independent-analysis]`

### Devices, device keys, cross-signing
- Each login is a **device** with its own **device ID** and **device keys**. `[protocol-spec]`
- **Cross-signing** introduces a **master key** plus **self-signing** and **user-signing** keys, so verifying one device establishes trust across your devices and to other users, instead of pairwise-verifying every device. `[protocol-spec]`
- This is the **root-of-trust** design: master key = personal root; device keys are leaves.

### Verification (SAS/emoji) + key backup + SSSS + recovery key
- **Interactive verification** uses **SAS** (emoji or decimal comparison) or QR. `[protocol-spec]`
- **Secure Secret Storage and Sharing (SSSS)** stores cross-signing keys and **key backup** (encrypted room keys) on the homeserver, unlocked by a **recovery key / passphrase**. `[protocol-spec]`
- **Recovery key** is the user-held secret; losing it can mean losing access to encrypted history / cross-signing trust. `[protocol-spec]`

### Device trust, stale devices, key confusion
- **Stale/unverified device warnings** and "unable to decrypt" errors have historically been a **major UX pain point** and a source of **key-confusion**, eroding user trust in the security signal. `[independent-analysis]`
- Server/account coupling means **migrating homeservers = effectively a new identity** (no clean portable ID). `[protocol-spec]`

### Account recovery, migration limits
- Recovery depends on **recovery key + server-stored encrypted backup**. `[protocol-spec]`
- **No standardized key transparency** (as of ~2024) — you trust the homeserver's key distribution. `[protocol-spec]` `[UNCERTAIN — verify current MSC status]`

### Lessons for FreeLayer
1. **Don't couple identity to a server domain.** The `@user:homeserver` model bakes a metadata holder and a migration trap into the identifier itself. FreeLayer's accountless, local-first root avoids this entirely.
2. **A clean root-of-trust (cross-signing) is worth emulating conceptually** — a local personal root that signs device/session keys — **but keep the root local**, not in server-side SSSS.
3. **Multi-device is where security UX goes to die.** Stale-device noise and "unable to decrypt" show that **complexity is the enemy of trust**. FreeLayer should make device state legible and quiet.
4. **Never conflate a key identifier with a person.** Matrix's key-confusion incidents are a warning.
5. **Recovery-key UX must be honest and testable** — users who lose the recovery key lose history; design the offline-recovery flow so this is understood up front.

---

## §11 — SimpleX Chat

### Identity model — the headline idea
SimpleX's defining property: **there is no global user identifier at all** — no phone, no username, no public key that represents "you" everywhere. `[product-docs]` `[marketing]` Instead, identity is **pairwise**: each connection is a separate set of unidirectional messaging queues on relay (SMP) servers, addressed by per-connection identifiers. `[product-docs]`

### Connection links, pairwise identities
- You connect by sharing a **connection link / QR** out-of-band; links can be **one-time or long-term**. `[product-docs]`
- Each contact relationship has its **own pairwise identity**; there is no single address that correlates you across contacts. `[product-docs]`

### Incognito / alternate profiles, rotation
- **Incognito mode** generates a random profile per connection. `[product-docs]`
- Addresses/links can be **rotated**; queues can be changed to shed correlation. `[product-docs]` `[UNCERTAIN on rotation mechanics — verify]`

### Message routing & server knowledge
- Relays are designed to be **dumb store-and-forward** queues that don't hold a global identity map, aiming to minimize **social-graph** knowledge at any single server. `[marketing]` `[independent-analysis — partially corroborated; verify]`
- **[UNCERTAIN whether this is fully protocol-guaranteed or partly a deployment property]** — re-verify against the SimpleX protocol whitepaper.

### Multi-device, recovery, continuity
- Multi-device support was **historically limited** (single-device-centric), added/expanded later. `[product-docs]` `[UNCERTAIN on maturity]`
- **Identity continuity** is the hard part: with no global id and pairwise state, losing your local database can mean **losing your connections** unless you exported/backed up. `[UNCERTAIN — verify recovery model]`

### Spam prevention
- Because there's no directory and contact requires **possession of your link**, unsolicited contact requires you to have leaked/shared a link. `[product-docs]` One-time links limit reuse. `[product-docs]`

### Lessons for FreeLayer (most directly relevant competitor)
1. **Pairwise-by-default is the strongest unlinkability primitive here** and aligns with FreeLayer's per-contact/per-room aliases. Adopt the mental model: *a relationship, not a person, is the addressable unit.*
2. **One-time invite links** map directly onto FreeLayer's one-time-invite requirement — validate the UX and revocation semantics.
3. **No global public address = no directory enumeration and low cross-context correlation** — a north star for FreeLayer's metadata posture.
4. **Continuity/recovery is the cost of no-global-id.** SimpleX shows the trade-off: unlinkability makes recovery harder. FreeLayer's **offline recovery** design must confront this directly.
5. **Verify, don't trust, the "server knows nothing" claim** — treat it as `[marketing]` until confirmed against spec/audit before TECH-ID-02.

---

## §12 — Session

### Identity model
A **Session ID** is a public key (X25519-derived, from an Ed25519 keypair generated from a **recovery seed**). `[product-docs]` It is **accountless** — no phone, no email. `[marketing]` The Session ID **is** the identity and is **global and permanent** (until you generate a new one, which discards continuity). `[product-docs]`

### Account/key relationship, recovery phrase
- The **recovery phrase (seed)** deterministically generates the keypair → the Session ID. `[product-docs]`
- Whoever holds the seed **is** the identity; there is **no server-side recovery** and thus **no recovery metadata**. `[product-docs]`
- **Key-compromise consequence:** leaking the seed = full identity takeover, with no revocation authority. `[independent-analysis]`

### Username/profile separation
Display name and avatar are separate from the Session ID; names are non-unique and cosmetic. `[product-docs]`

### Multi-device, message storage (swarms)
- Multi-device works by **restoring the same seed** on another device. `[product-docs]`
- Messages are stored-and-forwarded via **swarms** of **service nodes** (Oxen network). Individual nodes are assumed untrusted; **storage-node trust and metadata at the swarm** are the scrutiny points. `[product-docs]` `[independent-analysis]`

### Onion routing / metadata claims — SEPARATE from identity assurance
- Session uses **onion routing** to hide sender↔recipient IP linkage. `[marketing]` `[independent-analysis]`
- **Critical separation:** **onion routing is a network-anonymity property, NOT an identity-verification property.** Hiding *where a message came from* says nothing about *whether the key belongs to who you think*. `[independent-analysis]` FreeLayer must never let network anonymity marketing stand in for identity assurance.

### Community / open-group identity
Open groups/communities have their own identity/listing model with **moderation**; different trust surface from 1:1. `[product-docs]`

### Blocking / spam
- Block by Session ID. `[product-docs]`
- **Free, unlimited IDs → cheap Sybil.** No cost to mint identities is the flip side of accountlessness. `[independent-analysis]`

### Lessons for FreeLayer
1. **Seed-based, user-held recovery is attractive** (no recovery-service metadata) — but a **single global permanent key** is exactly the **correlation risk** FreeLayer wants to avoid. Combine seed-held recovery with **per-context aliases** instead of one global ID.
2. **Cheap Sybil is the accountless tax.** FreeLayer's **one-time invites + out-of-band** must carry the anti-spam weight Session leaves to (weak) blocking.
3. **Keep network anonymity and identity assurance in separate boxes** — this maps cleanly to FreeLayer keeping **DevicePosture separate from identity**.
4. **No revocation authority is dangerous.** Design for **key rotation / relationship re-keying** so a compromise isn't terminal.

---

## §13 — Briar

### Identity model
Briar creates a **local public-key identity on the device**, with **no account and no server**. `[product-docs]` The identity lives in a **local encrypted database** protected by a **password**. `[product-docs]`

### Contact exchange, verification
- Preferred contact exchange is **in person via QR code**, giving a **strong human-anchored TOFU** (you saw the other person). `[product-docs]`
- **Remote introductions**: an existing verified contact can **introduce** two of your contacts to each other, extending trust through a **web-of-introductions**. `[product-docs]`
- Distinction between **verified** (in-person/introduced) and **unverified** contacts is surfaced. `[product-docs]`

### Transports: offline-first
- Briar works over **Bluetooth, Wi-Fi (local), and Tor** — enabling **offline / infrastructure-less** communication, notably its differentiator for censorship/blackout scenarios. `[product-docs]`

### Local DB, backup, recovery, device loss
- Everything is in a **local password-protected DB**; **no cloud**. `[product-docs]`
- **Backup/migration is limited/manual**, and **device loss without a backup = identity + history loss** — there is **no server to recover from**. `[product-docs]`
- This is the honest cost of true local-only/no-central-server design.

### Lessons for FreeLayer (strongest local-first analogue)
1. **In-person QR as the gold-standard trust anchor** — directly reusable for FreeLayer's offline contact establishment.
2. **Introduction chains** are a proven way to grow a contact graph **without a directory** — a "trust notebook" model where verified contacts vouch. Consider for FreeLayer, but note correlation/consent implications.
3. **Verified vs unverified labeling** is honest UX FreeLayer should adopt.
4. **Offline transports (Bluetooth/Wi-Fi) as first-class** aligns with FreeLayer's offline-exchange and offline-recovery goals.
5. **Local-only means recovery is the user's responsibility** — Briar's device-loss reality is the design constraint FreeLayer must solve with **explicit, user-controlled offline recovery** rather than pretending a server can help.

---

# PART 3 — Conclusions

## 3.1 Common identity-root patterns observed

| Pattern | Who | Trade-off |
|---|---|---|
| **Phone/account root** (central) | Signal | Strong Sybil resistance + easy recovery; **central + real-world linkage** |
| **Server-domain account root** | Matrix | Federation + multi-device; **metadata holder baked into the ID + migration trap** |
| **Global public-key root** | Session | Accountless + user-held recovery; **permanent global correlator + cheap Sybil** |
| **Pairwise / no-global-id root** | SimpleX | Best unlinkability; **recovery/continuity is hard** |
| **Local-only key root** | Briar, Cwtch | No server to trust; **no server to recover from either** |

## 3.2 Common failure modes (what to avoid)

1. **Conflating identifiers with people** — safety numbers / SAS / Session IDs verify *keys*, not humans. Every system risks users over-reading the signal.
2. **Conflating network anonymity with identity assurance** — Session/onion routing; Cwtch/Tor. Separate concerns.
3. **Multi-device complexity eroding trust** — Matrix's stale-device noise and decryption failures.
4. **Metadata leakage via the identifier itself** — phone numbers (Signal), `@user:homeserver` (Matrix), permanent Session ID (correlatable).
5. **Cheap Sybil under accountlessness** — Session's free IDs; the tax FreeLayer must pay via invites.
6. **Recovery vs unlinkability tension** — the more pairwise/local the identity, the harder recovery (SimpleX, Briar).
7. **Treating vendor metadata claims as facts** — "server knows nothing" is `[marketing]` until audited.

## 3.3 Concrete lessons for FreeLayer (accountless, local-first)

1. **Adopt SimpleX/Cwtch pairwise-by-default as the core primitive.** The addressable unit is a **relationship (per-contact/per-room alias)**, never a global "you." This kills directory enumeration and cross-context correlation at the root.

2. **One-time invites carry the anti-Sybil load** that Signal gets from phone cost and Session fails to get at all. Design invite issuance, single-use enforcement, and revocation as first-class. Out-of-band exchange (Briar-style QR) is the strongest bootstrap.

3. **User-held offline recovery, never a recovery service.** Reject Signal's SVR/SGX and Matrix's server-side SSSS. Learn from Session's seed model (no recovery metadata) but **do not** pair it with a single global key — derive **per-context identities** from a locally-held root secret so recovery restores relationships without creating a global correlator.

4. **Confront the recovery-vs-unlinkability tension explicitly.** SimpleX and Briar show that no-global-id makes recovery hard and device-loss lossy. FreeLayer must ship an **explicit, testable offline recovery flow** (e.g., encrypted local backup / offline key export) and be honest in UX that lost secrets = lost relationships.

5. **Keep a local root-of-trust, borrow cross-signing's shape not its server-coupling.** A local personal root that signs device/session keys (Matrix's good idea) — but the root stays on-device, never in server storage.

6. **Say "key continuity," not "identity."** Provide safety-number-style continuity verification (Signal) and in-person QR verification (Briar), but present them honestly: FreeLayer verifies *keys and relationships*, not real-world persons. Support **key rotation / re-keying** so compromise isn't terminal (fixing Session's no-revocation gap).

7. **Keep DevicePosture strictly separate from identity.** Session/Cwtch conflate network anonymity with assurance and pay for it in clarity. FreeLayer's device-security/posture signals must be an **orthogonal axis** that never masquerades as identity proof.

8. **Make multi-device state legible and quiet.** Matrix's stale-device noise is the anti-pattern. If FreeLayer supports linked devices/sessions, surface device trust simply, avoid "unable to decrypt" cliffs, and default to a small, well-understood device set (learn from Briar's single-device simplicity as the safe baseline).

9. **Introduction chains as a directory-free growth path** (Briar) — optionally let verified contacts introduce others, but gate on **mutual consent** and account for the correlation it creates.

10. **Treat every competitor metadata claim as `[marketing]` until re-verified.** Before TECH-ID-02, confirm SimpleX's "servers can't build the graph," Session's swarm/onion metadata posture, and Signal's KT/SVR trust model against **`[protocol-spec]` / `[source-code]` / `[security-audit]`** primary sources.

---

## Appendix A — Brief mentions (only where accurate)

- **Threema** `[product-docs]`: paid app, **random Threema ID** (accountless-ish, no phone required), optional phone/email linkage for discovery, ID backup + password recovery. Relevant as a **random-ID, no-phone** precedent — but it is **centralized** and paid. Sybil resistance via **purchase cost**.
- **Wire** `[product-docs]`: email/phone account, MLS-based group crypto direction, enterprise focus. Centralized account model — less relevant to accountless goals.
- **Keybase** `[product-docs]` `[independent-analysis]`: identity = **public key + social-media proofs** (a real DID-adjacent idea: prove you control `@handle` on other platforms). Interesting for **provable linkage**, but centralized and now largely dormant; the **proof-chain** concept is the takeaway, not the deployment.
- **Delta Chat** `[product-docs]`: uses **email accounts as transport/identity** (Autocrypt/PGP-style key exchange over email). Relevant as **"reuse existing account as identity"** — opposite of FreeLayer's accountless aim, but a useful contrast on discovery.

## Appendix B — Cwtch note (the chosen extra system)

**Cwtch** `[product-docs]` `[marketing]`: metadata-resistant, **peer-to-peer over Tor v3 onion services**, with **per-conversation pseudonymous** profiles and no central server. Closest in spirit to FreeLayer's per-context, serverless, metadata-minimizing goals. **[UNCERTAIN]** on exact key/identity internals, multi-device story, and maturity — verify against Cwtch's documentation/source before relying on any specific behavior above.

---

## Re-verification checklist before TECH-ID-02

- [ ] Signal: current username/KT rollout state; SVR/SGX trust model; multi-device primacy changes → `[protocol-spec]` `[security-audit]`
- [ ] Matrix: whether any standardized key transparency landed; current cross-signing/SSSS UX → `[protocol-spec]`
- [ ] SimpleX: whether "server can't build social graph" is protocol-guaranteed; recovery/continuity + multi-device maturity → `[protocol-spec]` `[security-audit]`
- [ ] Session: swarm storage + onion routing metadata posture; Sybil/abuse controls → `[protocol-spec]` `[independent-analysis]`
- [ ] Briar: backup/migration capabilities current state → `[product-docs]` `[source-code]`
- [ ] Cwtch: identity/key internals and multi-device → `[product-docs]` `[source-code]`
- [ ] Threema/Keybase/Delta Chat: confirm the specific claims cited above.
