"use client";

import { useState } from "react";
import { FShell, type FShellTab } from "~/components/floor-shell";
import { FCard, FBtn, FPill } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { Ic } from "~/components/icons";

/**
 * Floor-mode Products list preview at /floor/products.
 *
 * Filter strip: All (1284) · A · B · C velocity tabs + Filter button
 * Table: SKU | Name | Barcode | Weight | Velocity | On hand | Loc count
 *
 * Mock data; later phase wires product.list({ warehouseId, vel, search }).
 */

const TABS: FShellTab[] = [
  { key: "all", label: "All", count: 1284 },
  { key: "A", label: "A", count: 184 },
  { key: "B", label: "B", count: 624 },
  { key: "C", label: "C", count: 476 },
];

const ROWS = [
  { sku: "SKU-00041", name: "Vanilla Extract 8oz", barcode: "0739410022", weight: "0.6 kg", vel: "A", onHand: "2,880 ea", locs: 6 },
  { sku: "SKU-00102", name: "Cane Sugar 50lb", barcode: "0739410089", weight: "22.7 kg", vel: "A", onHand: "1,440 cs", locs: 4 },
  { sku: "SKU-00038", name: "Coffee Beans 5lb", barcode: "0739410112", weight: "2.3 kg", vel: "B", onHand: "1,200 cs", locs: 5 },
  { sku: "SKU-00211", name: "Whole Tomatoes #10", barcode: "0739410203", weight: "3.1 kg", vel: "B", onHand: "1,008 cs", locs: 3 },
  { sku: "SKU-00150", name: "Olive Oil 1L", barcode: "0739410167", weight: "0.9 kg", vel: "A", onHand: "840 ea", locs: 4 },
  { sku: "SKU-00078", name: "Sea Salt 16oz", barcode: "0739410055", weight: "0.5 kg", vel: "C", onHand: "624 ea", locs: 2 },
  { sku: "SKU-00284", name: "Black Pepper 8oz", barcode: "0739410274", weight: "0.3 kg", vel: "C", onHand: "480 ea", locs: 2 },
  { sku: "SKU-00392", name: "Almond Flour 25lb", barcode: "0739410361", weight: "11.3 kg", vel: "B", onHand: "360 cs", locs: 2 },
];

export default function FloorProductsList() {
  const [tab, setTab] = useState("all");

  return (
    <FShell
      eyebrow="Catalog"
      title="Products"
      subtitle="1,284 SKUs · 84% have prices"
      tabs={TABS}
      tabActive={tab}
      onTabChange={setTab}
      actions={
        <FBtn t={t} variant="ghost" size="md" icon={Ic.Filter}>
          Filter
        </FBtn>
      }
    >
      <FCard t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1.4fr 130px 80px 70px 110px 80px",
            gap: 14,
            padding: "12px 20px",
            fontFamily: FONTS.mono,
            fontSize: 10,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          <div>SKU</div>
          <div>Name</div>
          <div>Barcode</div>
          <div>Weight</div>
          <div>Vel</div>
          <div style={{ textAlign: "right" }}>On hand</div>
          <div style={{ textAlign: "right" }}>Locs</div>
        </div>
        {ROWS.map((r) => (
          <div
            key={r.sku}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1.4fr 130px 80px 70px 110px 80px",
              gap: 14,
              padding: "12px 20px",
              alignItems: "center",
              borderTop: `1px dashed ${t.border}`,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: 0.2,
              }}
            >
              {r.sku}
            </span>
            <span style={{ fontSize: 13, color: t.body }}>{r.name}</span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11.5,
                color: t.muted,
              }}
            >
              {r.barcode}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.body }}>
              {r.weight}
            </span>
            <span>
              <FPill t={t} tone={velocityTone(r.vel)} size="sm">
                {r.vel}
              </FPill>
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 14,
                fontWeight: 800,
                color: t.ink,
                textAlign: "right",
                letterSpacing: -0.3,
              }}
            >
              {r.onHand}
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                color: t.muted,
                textAlign: "right",
              }}
            >
              {r.locs}
            </span>
          </div>
        ))}
      </FCard>

      <div
        style={{
          marginTop: 24,
          padding: "14px 18px",
          background: t.surface,
          border: `1px dashed ${t.border}`,
          borderRadius: 12,
          fontFamily: FONTS.mono,
          fontSize: 11,
          color: t.mutedSoft,
          letterSpacing: 0.4,
        }}
      >
        FLOOR MODE PREVIEW · mock data · later phase wires product.list
      </div>
    </FShell>
  );
}

function velocityTone(v: string): "primary" | "sky" | "neutral" {
  if (v === "A") return "primary";
  if (v === "B") return "sky";
  return "neutral";
}
