"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { theme } from "~/lib/theme";
import { Card, PageTitle, SquircleIcon, type IconTint } from "~/components/kit";
import { Ic } from "~/components/icons";

/**
 * Reports hub — tiles to each report. Replaces the old horizontal tab
 * strip with a layout consistent with /settings. Each sub-report gets
 * a "← Back to reports" link (via BackLink) instead of repeating the
 * full tab list at the top of every page.
 */
export default function ReportsPage() {
  const t = theme;
  return (
    <div>
      <PageTitle
        eyebrow="Drill into the data"
        title="Reports"
        subtitle="Pick a report to drill into. Each one has date filters, totals, and CSV + PDF download. The day-to-day KPI dashboard lives on Home."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <Tile
          href="/reports/shipped"
          icon={Ic.Truck}
          tint="coral"
          title="Shipped orders"
          desc="Outbounds shipped in a window, per-order $ totals."
        />
        <Tile
          href="/reports/received"
          icon={Ic.Inbound}
          tint="mint"
          title="Inbound orders"
          desc="Every inbound, any status — with expected vs received and any short-close reason."
        />
        <Tile
          href="/reports/valuation"
          icon={Ic.Dollar}
          tint="primary"
          title="Inventory valuation"
          desc="Qty × unit price per SKU, plus a grand-total summary."
        />
        <Tile
          href="/reports/productivity"
          icon={Ic.User}
          tint="sky"
          title="Operator productivity"
          desc="Completed picks and approved cycle counts per user."
        />
        <Tile
          href="/reports/movements"
          icon={Ic.Clock}
          tint="lilac"
          title="Movement log"
          desc="Full audit trail. Filter by reason and date range."
        />
        <Tile
          href="/reports/expiring"
          icon={Ic.Calendar}
          tint="coral"
          title="Expiring stock"
          desc="Pallet items expiring in the next N days, soonest first."
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
