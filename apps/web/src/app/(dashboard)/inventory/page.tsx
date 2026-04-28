"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { theme } from "~/lib/theme";
import { Card, PageTitle, SquircleIcon, type IconTint } from "~/components/kit";
import { Ic } from "~/components/icons";

/**
 * Inventory hub — tiles for the day-to-day operator actions that
 * touch stock. Scan lookup, cycle counts, and eventually stock-on-hand
 * / aging reports will live here. Matches the /reports and /settings
 * hub pattern so nav stays predictable.
 */
export default function InventoryPage() {
  return (
    <div>
      <PageTitle
        eyebrow="What's on the floor"
        title="Inventory"
        subtitle="Scan labels, run cycle counts, and check stock — one place for anything touching pallets in place."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <Tile
          href="/inventory/scan"
          icon={Ic.Scan}
          tint="primary"
          title="Scan"
          desc="Resolve a pallet LPN or location label to its record."
        />
        <Tile
          href={"/inventory/stock" as Route}
          icon={Ic.Boxes}
          tint="mint"
          title="Stock on hand"
          desc="What the system thinks is in your warehouses — by product or by pallet."
        />
        <Tile
          href="/inventory/counts"
          icon={Ic.Clipboard}
          tint="sky"
          title="Cycle counts"
          desc="Open and in-progress stock takes. Submit counts, approve variances."
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
  tint: IconTint;
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
