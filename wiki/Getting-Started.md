# Getting Started

> ⚠️ There is nothing to install as a user yet — FreeLayer is architecture, scaffolding and documentation. "Getting started" today means understanding the project or contributing to it.

## Understand it in 10 minutes

1. Read [FreeLayer in plain English](https://github.com/XGiammyX/freelayer/blob/main/docs/PUBLIC_EXPLANATION.md) — the no-jargon overview.
2. Skim the [Glossary](https://github.com/XGiammyX/freelayer/blob/main/docs/GLOSSARY.md) — every term with its real implementation status.
3. Check the [Trust Center](https://github.com/XGiammyX/freelayer/blob/main/docs/TRUST_CENTER.md) — what exists, what doesn't, what's verified.

## The mental model

**Room → Capsule → Courier → Device.**

You create a private room; its data lives on members' devices. Every update is sealed into a capsule (a digital envelope). Any courier can carry the capsule — an internet relay, a shared folder, a QR code, a USB stick — and none of them can read it. On arrival, only room members can open it.

The app's **policy engine** enforces the privacy rules in the core: what gets stored, what touches the network, what can be previewed, copied or shown. Stricter always wins.

## Developer setup

```bash
git clone https://github.com/XGiammyX/freelayer.git
cd freelayer
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm audit:privacy   # the privacy guardrails
```

Node.js ≥ 20 and pnpm ≥ 9 required. Full details: [INSTALLATION.md](https://github.com/XGiammyX/freelayer/blob/main/docs/INSTALLATION.md).

## What you'll find in the code

A strictly-typed monorepo: 12 packages (core, privacy, storage, transports, crypto, protocol, capsules, rooms, ai, security, ui, sdk) and 4 app shells — all scaffolding with fail-closed placeholders. The crypto provider deliberately throws; the AI provider deliberately rejects; storage and transports refuse calls without a policy decision. That's the anti-bypass architecture, visible from the first line.
