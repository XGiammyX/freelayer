# FAQ

## Can I use FreeLayer now?

No. There is no release and no product — only architecture, scaffolding and documentation. The web shell is a status page.

## Is FreeLayer safe for real secrets?

**No.** No cryptography is implemented, nothing is audited, and the project itself tells you not to. See the [Trust Center](https://github.com/XGiammyX/freelayer/blob/main/docs/TRUST_CENTER.md).

## Why isn't the encryption written yet? Isn't that the whole point?

Deliberately. Cryptographic code written before design review is the classic failure of privacy projects. FreeLayer locked this as a constitutional rule ([ADR-0004](https://github.com/XGiammyX/freelayer/blob/main/docs/adr/ADR-0004-no-crypto-implementation-before-review.md)): design first, cite prior art, review, then implement — with test vectors, behind one facade.

## Is FreeLayer anonymous?

FreeLayer avoids identifiers (no phone/email/account) and works to reduce metadata — but it **does not claim anonymity**. A strong observer can still correlate traffic. Honest limits live in the [Threat Model](https://github.com/XGiammyX/freelayer/blob/main/docs/THREAT_MODEL.md).

## Does it stop screenshots and spyware?

Planned: **ScreenShield** reduces capture risk where platforms allow (some can block screenshots, some can only detect and redact) and always reports its real capability. It cannot defeat a compromised device or a camera pointed at the screen — and will never claim to.

## Is this a blockchain project?

No. No chain, no tokens, ever. "Decentralized" here means *no required infrastructure*, not consensus machinery.

## How is this different from Signal?

Signal is mature, audited, excellent software you can use today — FreeLayer is not. The difference is design direction: FreeLayer aims for no required server at all, no identifiers, rooms (docs/tasks/decisions) instead of only chats, capsules over any courier, and endpoint defense as a first-class layer. See [Comparisons](Comparisons).

## Why AGPL?

So privacy-weakening closed forks are license violations: anyone distributing modified FreeLayer — including over a network — must publish their source. Rationale: [ADR-0011](https://github.com/XGiammyX/freelayer/blob/main/docs/adr/ADR-0011-license-strategy.md).

## Who runs the servers?

Nobody — that's the point. FreeLayer-the-project runs no infrastructure. Optional relays exist in the design as *one* courier type; anyone can host one, none is required, and files/QR/USB work with zero servers.

## How can I help?

Pick a task: [Contributor Tasks](https://github.com/XGiammyX/freelayer/blob/main/docs/CONTRIBUTOR_TASKS.md). Verifying one comparison row against official docs is a perfect first PR.
