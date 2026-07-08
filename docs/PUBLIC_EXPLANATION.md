# FreeLayer in plain English

[← Docs Index](README.md) · [Trust Center](TRUST_CENTER.md) · [Glossary](GLOSSARY.md) · [Roadmap](ROADMAP.md)

> [!WARNING]
> **Foundation stage.** FreeLayer is architecture and scaffolding today — not a finished app. Do not use it for real secrets yet.

*No jargon until it's needed. For the technical version of everything here, see the [docs index](README.md).*

## What is FreeLayer?

FreeLayer is an open-source project building a different kind of private communication tool.

Most chat apps work like a post office run by one company: every message goes through their building, your account lives in their filing cabinet, and you trust them to behave. FreeLayer removes the building.

In FreeLayer, a conversation is a **private room that lives on the members' devices** — not on a company server. Your phone and your friend's laptop hold the room. There is no FreeLayer headquarters holding a copy, because FreeLayer-the-project runs no servers at all.

A room is more than chat. It can hold notes, documents, files, tasks, and decisions — the things groups actually work with. Today those usually leak into cloud tools; in FreeLayer they're meant to stay inside the room.

When something in a room changes, the update is packed into a **capsule** — a sealed digital envelope. Capsules travel between devices through whatever channel is available: an internet relay, a shared folder, a QR code, even a USB stick. The channel carries the envelope; it can't read the letter.

The app's **policy engine** is the rule system deciding what the app may do: store this? send this? show a link preview? allow a copy to the clipboard? Those rules are enforced in the app's core — not by settings screens that a bug (or a rushed feature) could quietly ignore.

Later, a layer called **ScreenShield** will care about what happens *after* a message is decrypted and on your screen: screenshots, screen recording, clipboard, risky devices. Reduced risk, honestly labeled — not magic.

And to be completely clear: **FreeLayer is at the foundation stage.** The architecture, rules, and documents exist and are public; the product does not yet. Nothing here is ready to protect real secrets.

## Why not just use existing encrypted apps?

You probably should — today. Signal and similar tools are excellent, mature, audited software. FreeLayer is not a replacement for them right now.

FreeLayer exists because encryption is important but **not the whole story**:

- Most tools still need a **server** in the middle and an **account** — often a phone number or email — that identifies you.
- **Metadata** still leaks: who talks to whom, when, how often, who's online, who's typing.
- Real collaboration — documents, tasks, decisions — usually moves to **cloud workspaces** with far weaker privacy.
- And privacy usually ends at delivery: **screenshots, clipboards, screen recording, and risky devices** are treated as not the app's problem.

FreeLayer is an attempt to design for the whole story at once. Whether it succeeds is exactly what this open, slow, documented project is trying to find out.

## What is a capsule?

A sealed envelope, digitally. Everything that travels between devices — a message, a document change, an invitation — is sealed into a capsule first. Any channel can carry it: a relay can hold it temporarily, a folder can store it, a QR code can move it, a USB drive can transport it. **The courier is never trusted with the contents.** If one courier is blocked, use another; the envelope doesn't care.

## What is a Sovereign Room?

A **private workspace that lives on the members' devices**. "Sovereign" because nobody else administers it: no hosting company, no workspace admin panel, no server that could be pressured, breached, or shut down to take your room with it. The members' devices *are* the room.

## Why does serverless matter?

Because every required server is a point of failure and a point of pressure. A central database can be breached, subpoenaed, monetized, or switched off. FreeLayer's answer is structural: **there is no central company server holding the canonical room state, and no central database** — so there's nothing to breach, subpoena, or shut down at the center.

The honest trade-off: serverless is **slower, less convenient, and more complex**. Messages can take longer. Delivery is best-effort. Spam is harder to fight. FreeLayer accepts these costs deliberately, and says so.

## Why does ScreenShield matter?

Because privacy does not end when a message is decrypted. At the moment content appears on screen, it can be screenshotted, screen-recorded, copied to a clipboard some other app reads, cached by a predictive keyboard, or captured by whatever is watching the display.

ScreenShield is FreeLayer's planned answer: protected viewing modes, capture-aware redaction where the platform can detect capture, clipboard and input restrictions, and honest warnings on risky devices. **It reduces risk. It cannot defeat a fully compromised device or a camera pointed at the screen** — and FreeLayer will never claim otherwise.

## What is not solved yet?

Honesty section — read it before anything else:

- **Encryption is not implemented yet.** Deliberately: the design must pass review before code is written.
- **Messaging is not implemented.** No chat exists.
- **There has been no security audit.** There is nothing to audit yet.
- **Endpoint compromise cannot be fully solved** — by FreeLayer or by anyone. A hacked device sees what you see.
- **Metadata cannot be fully eliminated** — it can be reduced, and the limits are documented.

The always-current version of this list lives in the [Trust Center](TRUST_CENTER.md).
