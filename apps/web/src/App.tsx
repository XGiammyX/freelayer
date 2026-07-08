/**
 * FreeLayer web shell — local-only status page. No storage, no networking,
 * no chat, no AI, no link previews. Content is bundled; nothing is fetched.
 */

import { createFreeLayerClient } from "@freelayer/sdk";
import {
  Badge,
  Card,
  PillarList,
  StatusPanel,
  WarningBanner,
  type PillarItem,
  type StatusItem,
} from "@freelayer/ui";

const PILLARS: readonly PillarItem[] = [
  {
    name: "Sovereign Rooms",
    summary: "encrypted, local-first operational spaces — more than group chat.",
  },
  {
    name: "CapsuleNet / Blind Courier",
    summary: "data crosses devices as encrypted capsules over any byte-carrying medium.",
  },
  {
    name: "Privacy Modes",
    summary: "Standard to Bunker — enforced by core policy, not UI toggles.",
  },
  {
    name: "Identity Firewall",
    summary: "no phone number, no email, no central account, no address book upload.",
  },
  {
    name: "Metadata Firewall",
    summary: "reduce receipts, presence, previews, timing and size leakage — not just encrypt.",
  },
  {
    name: "Local AI (future)",
    summary: "optional, local-only, disabled by default, policy-governed.",
  },
];

export function App() {
  const status = createFreeLayerClient().describeStatus();

  const statusItems: readonly StatusItem[] = [
    { label: "Cryptography", value: "not implemented (blocked by design review)" },
    { label: "Product features", value: "none implemented" },
    { label: "Release", value: "none" },
    { label: "Stage", value: "foundation only" },
  ];

  return (
    <main className="shell">
      <header className="masthead">
        <h1>FreeLayer</h1>
        <Badge label="Research and foundation stage" />
      </header>

      <WarningBanner>Do not use with real secrets yet.</WarningBanner>

      <Card title="What FreeLayer is">
        <p className="lede">
          Serverless private communication. Sovereign rooms. Encrypted capsules. No central backend.
        </p>
        <PillarList items={PILLARS} />
      </Card>

      <Card title="Current status">
        <StatusPanel items={statusItems} />
        <p className="footnote">
          SDK reports: {status.stage} — {status.warning}
        </p>
      </Card>
    </main>
  );
}
