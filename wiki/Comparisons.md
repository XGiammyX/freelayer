# Comparisons

*Respectful by rule: no project is attacked, and FreeLayer — being unimplemented — never claims to be better today. Full versions: [readable comparison](https://github.com/XGiammyX/freelayer/blob/main/docs/PUBLIC_COMPARISON.md) · [research-grade comparison](https://github.com/XGiammyX/freelayer/blob/main/docs/COMPETITOR_COMPARISON.md).*

## The one-table version

| Common model today | FreeLayer's design direction |
| --- | --- |
| A server is the source of truth | Members' devices own the room state |
| The network defines the app | Sealed capsules move through any courier — relay, file, QR, USB |
| Phone/email identifies users | Local identities and per-room aliases |
| Settings screens control privacy | The app core enforces policy on every side effect |
| Encryption stops at delivery | ScreenShield (planned) considers screenshots, clipboard and capture |
| Collaboration lives in the cloud | Docs, tasks and decisions live inside encrypted local rooms |

## What FreeLayer learns from others

- **Signal** — protocol discipline and review culture (which is why FreeLayer's crypto waits for review instead of shipping early).
- **SimpleX** — identifier-free design is viable.
- **Briar** — offline is a feature, not a fallback.
- **Matrix / Quiet** — rooms are the right unit of collaboration.
- **Delta Chat / Reticulum** — transports can be reused and abstracted much further than usual.
- **Magic Wormhole / OnionShare** — simplicity earns trust.

## The honest cost

Serverless, multi-courier design pays real prices: slower delivery, best-effort reliability, harder spam control, and a long careful build. If you need private messaging **today**, use a mature audited tool — and FreeLayer's own docs say exactly that.
