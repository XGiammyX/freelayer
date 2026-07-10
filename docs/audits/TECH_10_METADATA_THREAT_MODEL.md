# TECH-10 — Metadata Threat Model

_Scope: the metadata channels the Metadata Firewall governs, and the honest limits of what an app-level boundary can do. Extends [../THREAT_MODEL.md](../THREAT_MODEL.md)._

## Application-signal leakage

| Signal | Threat | TECH-10 stance |
| --- | --- | --- |
| Read receipts | Reveals when/whether a message was read | Denied in Private+; v0 denies in all modes |
| Delivery acknowledgements | Reveals delivery timing/relationship | Must later be sealed capsule content, not transport plaintext (deferred) |
| Typing indicators | Reveals real-time activity | Denied in Private+; v0 denies all |
| Online status / presence / last seen | Reveals availability patterns | Denied in Private+; v0 denies all |
| Room activity indicators / badge counts | Reveals a room is active | Denied in strict modes; notifications denied in v0 |
| Notification previews | Content on lock screen / OS center | Denied in strict modes; v0 denies all notification metadata |

## Network metadata leakage

IP address, DNS, relay choice, relay-poll timing, request timing/frequency/size, user-agent/headers, WebRTC ICE candidates, LAN-discovery presence. **Stance:** all network-exposed metadata is denied in v0 (no network exists); `networked` sinks and network-metadata events resolve to deny; MetadataPolicy agrees with NetworkPolicy. Transport-native metadata that a future courier necessarily exposes is labeled ([../NETWORK_MODEL.md](../NETWORK_MODEL.md)), never silently accepted.

## Content-adjacent leakage

Link previews, remote images/fonts/avatars, tracking pixels, external scripts, file/document previews, thumbnails, document titles surfaced in UI/notifications. **Stance:** external fetches forbidden (ADR-0008); `link.preview` / `asset.remote_fetch` / `avatar.remote_fetch` denied every mode; `preview.generated` / `thumbnail.generated` denied in Private+ and strict/sealed (agrees with StoragePolicy preview/thumbnail cache denial). Document titles are content — never placed in metadata payloads (strings rejected).

## Local metadata leakage

Logs, crash reports, debug artifacts, local audit events, cache existence, capsule-spool existence/timestamps, protected-reveal state, screen-capture audit events, device-risk state, AI prompt/cache existence. **Stance:** crash reporting forbidden; logs/audit redacted and memory-only (no persistence in v0); spool timestamps not retained in strict modes; reveal state denied in strict/sealed; AI metadata denied (Gate I). Nothing metadata-shaped persists in v0.

## Development metadata leakage

GitHub contributor metadata, CI run timing, PR activity, package-manager logs, security-scanner output, test artifacts. **Stance:** out of the app's runtime control (accepted limitation). GitHub is a development platform, never a runtime dependency; CI egress is GitHub-only and audited ([GITHUB_ACTIONS_EGRESS_AUDIT.md](GITHUB_ACTIONS_EGRESS_AUDIT.md)). This is honest early-stage exposure, documented not hidden.

## Endpoint / display metadata (ScreenShield hooks)

Screen-capture detection, protected-content reveal state, device-risk changes, watermark/canary generation. **Stance:** memory-only, redacted; reveal state denied in strict/sealed; watermark/canary metadata must never contain raw identity/content (payload strings rejected). Full ScreenShield contracts are ADR-0012 / TECH-EDL work; TECH-10 provides policy hooks only.

## Limits (stated plainly)

- Metadata cannot be fully eliminated — only reduced.
- A **global passive adversary** is out of scope.
- Transport-native metadata remains visible to whatever transport eventually carries a capsule.
- **Malicious room members** can leak metadata about a room regardless of policy.
- Network-level timing/size correlation is only mitigated in future phases (batching/padding/cover traffic — not promised).
- TECH-10 is **app-level metadata policy, not protocol-level anonymity.** It decides; it does not yet transform traffic.
