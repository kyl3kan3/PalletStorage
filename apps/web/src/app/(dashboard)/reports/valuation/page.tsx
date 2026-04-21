"use client";

import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, StatBig, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { ReportsNav } from "~/components/reports-nav";
import { downloadCsv } from "~/lib/csv";

export default function ValuationReportPage() {
  const t = theme;
  const q = trpc.report.inventoryValuation.useQuery();
  const rows = q.data ?? [];
  const totalCents = rows.reduce((s, r) => s + r.valueCents, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const pricedSkus = rows.filter((r) => (r.unitPriceCents ?? 0) > 0).length;

  return (
    <div>
      <ReportsNav />
      <PageTitle
        eyebrow="Finance"
        title="Inventory valuation"
        subtitle="On-hand qty × unit price for every SKU. SKUs without a price valuation show as $0 — set prices on /products."
        right={
          <Btn
            t={t}
            variant="secondary"
            size="sm"
            icon={Ic.Download}
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `valuation-${new Date().toISOString().slice(0, 10)}.csv`,
                rows,
                [
                  { key: "sku", header: "SKU" },
                  { key: "name", header: "Name" },
                  { key: "qty", header: "On hand" },
                  {
                    key: "unitPriceCents",
                    header: "Unit price ($)",
                    format: (v) =>
                      typeof v === "number" ? (v / 100).toFixed(2) : "0",
                  },
                  {
                    key: "valueCents",
                    header: "Value ($)",
                    format: (v) =>
                      typeof v === "number" ? (v / 100).toFixed(2) : "0",
                  },
                ],
              )
            }
          >
            Download CSV
          </Btn>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatBig t={t} label="Total value" value={`$${(totalCents / 100).toFixed(2)}`} tint="primary" />
        <StatBig t={t} label="Units on hand" value={totalQty.toLocaleString()} />
        <StatBig t={t} label="SKUs priced" value={`${pricedSkus} / ${rows.length}`} tint="mint" />
      </div>

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr 100px 130px 130px",
            gap: 14,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        >
          <div>SKU</div>
          <div>Name</div>
          <div style={{ textAlign: "right" }}>On hand</div>
          <div style={{ textAlign: "right" }}>Unit price</div>
          <div style={{ textAlign: "right" }}>Value</div>
        </div>
        {rows.length === 0 && (
          <div
            style={{
              padding: "28px 20px",
              color: t.muted,
              fontSize: 13,
              borderTop: `1.5px dashed ${t.border}`,
              textAlign: "center",
            }}
          >
            No products yet.
          </div>
        )}
        {rows.map((r) => (
          <div
            key={r.productId}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr 100px 130px 130px",
              gap: 14,
              padding: "12px 20px",
              alignItems: "center",
              borderTop: `1.5px dashed ${t.border}`,
              fontSize: 13.5,
            }}
          >
            <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
              {r.sku}
            </span>
            <span>{r.name}</span>
            <span style={{ textAlign: "right", fontFamily: FONTS.mono, color: t.ink }}>
              {r.qty}
            </span>
            <span style={{ textAlign: "right", fontFamily: FONTS.mono, color: t.ink }}>
              {r.unitPriceCents ? (
                `$${(r.unitPriceCents / 100).toFixed(2)}`
              ) : (
                <Tag t={t} tone="coral">
                  no price
                </Tag>
              )}
            </span>
            <span
              style={{
                textAlign: "right",
                fontFamily: FONTS.mono,
                color: t.ink,
                fontWeight: 600,
              }}
            >
              ${(r.valueCents / 100).toFixed(2)}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
