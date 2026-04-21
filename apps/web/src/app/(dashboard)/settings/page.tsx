"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { theme } from "~/lib/theme";
import { Card, PageTitle, SquircleIcon } from "~/components/kit";
import { Ic } from "~/components/icons";
import { SettingsNav } from "~/components/settings-nav";

/**
 * Settings landing page — entry points to each area. Each tile links to
 * a nested route; the left nav only shows a single "Settings" entry so
 * we don't clutter the sidebar with one item per sub-page.
 */
export default function SettingsPage() {
  const t = theme;
  return (
    <div>
      <SettingsNav />
      <PageTitle
        eyebrow="Configure"
        title="Settings"
        subtitle="Company info, team, integrations — the boring but important stuff."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        <Tile
          href="/settings/company"
          icon={Ic.Warehouse}
          tint="primary"
          title="Company profile"
          desc="Legal name, address, tax info — used on BOLs and QBO exports."
        />
        <Tile
          href="/settings/team"
          icon={Ic.User}
          tint="mint"
          title="Team & permissions"
          desc="Invite people and set their role (admin / manager / operator)."
        />
        <Tile
          href="/settings/integrations"
          icon={Ic.Dollar}
          tint="sky"
          title="Integrations"
          desc="Connect QuickBooks Online and see recent activity."
        />
      </div>
    </div>
  );
}

function Tile({
  href,
  icon,
  tint,
  title,
  desc,
}: {
  href: Route;
  icon: (p: { size?: number }) => ReactNode;
  tint: "primary" | "mint" | "coral" | "sky" | "lilac" | "neutral";
  title: string;
  desc: string;
}) {
  const t = theme;
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <Card t={t} padding={18} interactive>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SquircleIcon t={t} icon={icon} tint={tint} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{title}</div>
            <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>{desc}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
