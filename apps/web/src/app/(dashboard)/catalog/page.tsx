"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { theme } from "~/lib/theme";
import { Card, PageTitle, SquircleIcon, type IconTint } from "~/components/kit";
import { Ic } from "~/components/icons";

/**
 * Reference-data hub. Everything that's "a directory of things" (as
 * opposed to an operational view of the floor) lives here so the main
 * sidebar doesn't grow one entry per entity type.
 */
export default function CatalogPage() {
  return (
    <div>
      <PageTitle
        eyebrow="Your reference data"
        title="Catalog"
        subtitle="The directories behind every order and pallet. Change these once; they show up everywhere."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <Tile
          href="/products"
          icon={Ic.Boxes}
          tint="primary"
          title="Products"
          desc="SKUs, barcodes, velocity classes, unit prices used on Bills and Invoices."
        />
        <Tile
          href="/customers"
          icon={Ic.User}
          tint="mint"
          title="Customers"
          desc="3PL clients whose pallets you store. Linked from outbound and inbound orders."
        />
        <Tile
          href="/suppliers"
          icon={Ic.Truck}
          tint="coral"
          title="Suppliers"
          desc="Upstream vendors. Populates the supplier block on receiving receipts."
        />
        <Tile
          href="/warehouses"
          icon={Ic.Warehouse}
          tint="sky"
          title="Warehouses"
          desc="Sites, zones, racks, and the locations within them."
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
