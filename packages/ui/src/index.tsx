/**
 * @freelayer/ui — minimal local-only components.
 *
 * No external assets of any kind: no remote fonts, no icon CDNs, no remote
 * images, no analytics (ADR-0008, docs/NO_EXTERNAL_ASSETS_POLICY.md). Styling
 * is inline and uses the system font stack so nothing is fetched, ever.
 * Boundary rule: this package imports no workspace side-effect packages.
 */

import type { CSSProperties, ReactNode } from "react";

const palette = {
  ink: "#1a1d21",
  soft: "#5c6570",
  line: "#d8dde3",
  paper: "#ffffff",
  warnBg: "#fff7e6",
  warnLine: "#e0a63c",
  badgeBg: "#eef1f4",
} as const;

export function Badge({ label }: { readonly label: string }) {
  const style: CSSProperties = {
    display: "inline-block",
    padding: "0.15rem 0.6rem",
    borderRadius: "999px",
    background: palette.badgeBg,
    color: palette.ink,
    fontSize: "0.8rem",
    border: `1px solid ${palette.line}`,
  };
  return <span style={style}>{label}</span>;
}

export function Card({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const style: CSSProperties = {
    border: `1px solid ${palette.line}`,
    borderRadius: "8px",
    padding: "1rem 1.25rem",
    background: palette.paper,
    marginBottom: "1rem",
  };
  return (
    <section style={style}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", color: palette.ink }}>{title}</h2>
      {children}
    </section>
  );
}

export function WarningBanner({ children }: { readonly children: ReactNode }) {
  const style: CSSProperties = {
    border: `1px solid ${palette.warnLine}`,
    borderRadius: "8px",
    background: palette.warnBg,
    padding: "0.75rem 1.25rem",
    color: palette.ink,
    marginBottom: "1rem",
    fontWeight: 600,
  };
  return <div style={style}>{children}</div>;
}

export interface PillarItem {
  readonly name: string;
  readonly summary: string;
}

export function PillarList({ items }: { readonly items: readonly PillarItem[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: "1.2rem", color: palette.soft, lineHeight: 1.6 }}>
      {items.map((item) => (
        <li key={item.name}>
          <strong style={{ color: palette.ink }}>{item.name}</strong> — {item.summary}
        </li>
      ))}
    </ul>
  );
}

export interface StatusItem {
  readonly label: string;
  readonly value: string;
}

export function StatusPanel({ items }: { readonly items: readonly StatusItem[] }) {
  return (
    <dl style={{ margin: 0, color: palette.soft }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", gap: "0.5rem", padding: "0.15rem 0" }}>
          <dt style={{ minWidth: "12rem", fontWeight: 600, color: palette.ink }}>{item.label}</dt>
          <dd style={{ margin: 0 }}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
