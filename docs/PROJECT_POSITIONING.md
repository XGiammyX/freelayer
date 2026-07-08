# Project Positioning

## Purpose

One document that answers, without marketing: what FreeLayer is, what it is not, who it is for, and why it exists.

> FreeLayer is not trying to become a centralized SaaS. It is trying to become a client-owned communication layer where private rooms, encrypted capsules and policy-controlled side effects are the foundation.

## What FreeLayer is

- An **open-source, serverless, local-first, privacy-controlled communication platform** — in the research and foundation stage.
- A place where a conversation can become a **private operational room**: chat, notes, documents, files, tasks, decisions, polls, room memory.
- An architecture where **every cross-device object is an encrypted capsule** that any byte-carrying medium can deliver, and where **every side effect passes a core policy check**.

## What FreeLayer is not

- **Not just another chat app.** Chat is one object type inside rooms, not the product.
- **Not a social network.** No feeds, no follower graphs, no public discovery, no engagement mechanics.
- **Not a blockchain or token project.** No chain, no coin, no token, ever — decentralization here means *no required infrastructure*, not consensus machinery.
- **Not a centralized SaaS.** There is no FreeLayer-hosted service to subscribe to, and there never will be a *required* one.
- **Not a promise of absolute anonymity or unbreakable encryption.** The threat model states limits explicitly.
- **Not a substitute for operational security.**
- **Not production software today.** Foundation stage; do not use for real secrets.

## Primary audience

1. **People and small groups who need private collaboration, not just private chat** — activists, journalists, researchers, small teams, families handling sensitive matters.
2. **Users in constrained or untrusted network environments** — where a specific relay network may be blocked, but files, QR codes, and USB sticks still move.
3. **Privacy-conscious technologists and researchers** who want an auditable, honestly-documented architecture to inspect, criticize, and build on.

## Long-term vision

A communication layer that users own outright: rooms that live on their devices, capsules that travel any road, policies the core actually enforces, and — later — local AI that serves the room without reporting to anyone. The project succeeds when losing every server on the internet is an inconvenience, not an outage.

## Why not "just another chat"

Message streams lose decisions, tasks, and documents to cloud tools with different (usually worse) privacy properties. FreeLayer's answer is the Sovereign Room: the collaboration happens *inside* the encrypted, local-first space, so nothing needs to escape to a third-party workspace to be useful.

## Why serverless / local-first

Every required server is a point of pressure: subpoena, breach, monetization, shutdown. FreeLayer removes the point of pressure by removing the requirement ([ADR-0001](adr/ADR-0001-no-project-owned-infrastructure.md)). Local-first means users hold the authoritative copy of their own data — the project could not hand it over even if compelled, because it never has it.

## Why Sovereign Rooms matter

Rooms are the unit of trust in real life — a family, a team, a working group. Making the room (not the message, not the account) the primary object aligns the architecture with how private groups actually operate: shared documents, standing decisions, running tasks, institutional memory — all encrypted, all local ([ADR-0006](adr/ADR-0006-sovereign-rooms-as-primary-product-model.md)).

## Why CapsuleNet matters

One sealed format for everything that crosses a device boundary means transports are interchangeable and censorship-resistance is structural: a relay is convenient, a QR code is sovereign. The transport is a blind courier — trusted with nothing but ciphertext ([ADR-0003](adr/ADR-0003-capsules-as-only-cross-device-format.md)).

## Why GitHub / open-source transparency matters

A privacy project asking for trust must be inspectable: the threat model, the ADR constitution, the Privacy Bill of Materials, the CI guards that fail on telemetry or external assets — all public, all versioned, all reviewable. GitHub is the **development and publication platform only**: the FreeLayer runtime has no GitHub dependency, and contributors should know that developing in public exposes contributor metadata (accounts, timestamps) — noted honestly in [PBOM.md](PBOM.md).

## Status

Foundation stage. No release, no crypto, no product features. See [TRUST_CENTER.md](TRUST_CENTER.md) for the current trust level.
