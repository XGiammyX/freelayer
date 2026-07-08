/**
 * FreeLayer web shell — local-only landing page.
 *
 * No storage, no networking, no chat, no AI, no link previews. Everything is
 * bundled; nothing is fetched. Anchor links to the GitHub repository are
 * plain user-initiated navigation, not loaded assets (ADR-0008).
 */

import { createFreeLayerClient } from "@freelayer/sdk";

const REPO = "https://github.com/XGiammyX/freelayer";

const PROBLEMS = [
  {
    title: "Servers become the center",
    body: "Most tools route everything through a company service that can be breached, pressured or shut down.",
  },
  {
    title: "Metadata still leaks",
    body: "Even with encryption: who talks to whom, when, how often, who is online, who is typing.",
  },
  {
    title: "Collaboration moves to the cloud",
    body: "Documents, tasks and decisions escape to workspaces that can read everything.",
  },
  {
    title: "Screenshots and devices still matter",
    body: "Privacy usually ends at decryption. Screens, clipboards and risky devices stay exposed.",
  },
] as const;

const FLOW = [
  { step: "Room", text: "A private workspace that lives on members' devices." },
  { step: "Capsule", text: "Every update is sealed into a digital envelope." },
  { step: "Courier", text: "Any channel carries it — relay, file, QR, USB — without reading it." },
  { step: "Device", text: "Only room members can open it, on their own devices." },
] as const;

const PILLARS = [
  {
    name: "Sovereign Rooms",
    text: "Private workspaces on your devices — chat, notes, docs, tasks, decisions.",
  },
  {
    name: "Capsules",
    text: "Sealed digital envelopes for everything that travels between devices.",
  },
  {
    name: "Policy Engine",
    text: "Core rules decide what may be stored, sent, previewed, copied or shown.",
  },
  { name: "Identity Firewall", text: "No phone number, no email, no central account. Ever." },
  {
    name: "Metadata Firewall",
    text: "Fewer silent leaks: typing, receipts, presence, link previews.",
  },
  {
    name: "ScreenShield",
    text: "Future protection for screenshots, clipboard, capture and risky devices.",
  },
  {
    name: "Local AI (future)",
    text: "Optional, on-device only, disabled by default, policy-gated.",
  },
] as const;

const COMPARED = [
  { common: "Server is the source of truth", freelayer: "Devices own the room state" },
  { common: "Network defines the app", freelayer: "Capsules can move through many couriers" },
  { common: "Phone/email identifies users", freelayer: "Local identities and aliases" },
  { common: "UI controls privacy", freelayer: "Core policy controls side effects" },
  {
    common: "Encryption stops at delivery",
    freelayer: "ScreenShield considers display, copy and capture risks",
  },
] as const;

const LINKS = [
  { label: "Plain-English overview", href: `${REPO}/blob/main/docs/PUBLIC_EXPLANATION.md` },
  { label: "Roadmap", href: `${REPO}/blob/main/docs/ROADMAP.md` },
  { label: "Trust Center", href: `${REPO}/blob/main/docs/TRUST_CENTER.md` },
  { label: "Architecture", href: `${REPO}/blob/main/docs/ARCHITECTURE.md` },
] as const;

export function App() {
  const status = createFreeLayerClient().describeStatus();

  return (
    <div className="page">
      <main className="shell">
        <header className="hero">
          <p className="brand">FreeLayer</p>
          <h1 className="hero-title">
            Private communication
            <br />
            <span className="hero-accent">without a central server.</span>
          </h1>
          <p className="hero-sub">
            A research-stage open-source project for user-owned rooms, sealed capsules and privacy
            rules enforced on the device.
          </p>
          <p className="warning-pill" role="status">
            Foundation stage · Not ready for real secrets
          </p>
          <nav className="cta-row" aria-label="Project links">
            {LINKS.map((link) => (
              <a key={link.label} className="cta" href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </header>

        <section className="section" aria-labelledby="problem-h">
          <h2 id="problem-h">The problem</h2>
          <div className="grid grid-4">
            {PROBLEMS.map((p) => (
              <article key={p.title} className="card">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="idea-h">
          <h2 id="idea-h">The FreeLayer idea</h2>
          <ol className="flow">
            {FLOW.map((f) => (
              <li key={f.step} className="flow-step">
                <span className="flow-name">{f.step}</span>
                <span className="flow-text">{f.text}</span>
              </li>
            ))}
          </ol>
          <p className="aside">
            Think of a capsule like a sealed envelope: a courier can carry it, a folder can store
            it, a QR code can move it — but the courier is never trusted with the letter inside.
          </p>
        </section>

        <section className="section" aria-labelledby="pillars-h">
          <h2 id="pillars-h">Core pillars</h2>
          <div className="grid grid-3">
            {PILLARS.map((p) => (
              <article key={p.name} className="card">
                <h3>{p.name}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="compare-h">
          <h2 id="compare-h">Compared simply</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Common model</th>
                  <th scope="col">FreeLayer direction</th>
                </tr>
              </thead>
              <tbody>
                {COMPARED.map((row) => (
                  <tr key={row.common}>
                    <td>{row.common}</td>
                    <td>{row.freelayer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="aside">
            Not an attack on other tools — a different design direction, documented honestly in the
            repository.
          </p>
        </section>

        <section className="section" aria-labelledby="status-h">
          <h2 id="status-h">Current status</h2>
          <p className="status-line">
            No release. No real crypto. No messaging yet. No audit. Foundation only.
          </p>
          <p className="aside">
            The SDK reports: {status.stage} — {status.warning}
          </p>
        </section>

        <section className="section" aria-labelledby="contrib-h">
          <h2 id="contrib-h">For contributors</h2>
          <p>
            We are building slowly because privacy/security software should not be rushed. Research
            before code, documentation before implementation, and no reckless security claims —
            every limitation is written down before every feature.
          </p>
        </section>

        <footer className="footer">
          <p>
            AGPL-3.0-or-later · docs CC BY-SA 4.0 · no telemetry, no external assets, no tracking
          </p>
        </footer>
      </main>
    </div>
  );
}
