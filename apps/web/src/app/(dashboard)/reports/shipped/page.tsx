"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle } from "~/components/kit";
import { Ic } from "~/components/icons";
import { ReportsNav } from "~/components/reports-nav";
import { DateRangeControl, type DateRange } from "~/components/date-range";
import { downloadCsv } from "~/lib/csv";

export default function ShippedReportPage() {
  const t = theme;
  const [range, setRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    to: new Date(),
  });
  const q = trpc.report.shippedOrders.useQuery(range);
  const rows = q.data ?? [];
  const totalCents = rows.reduce((s, r) => s + (r.totalCents ?? 0), 0);

  return (
    <div>
      <ReportsNav />
      <PageTitle
        eyebrow="Sales"
        title="Shipped orders"
        subtitle="Every outbound shipped in the selected window. Picked-qty × unit price gives the line total."
        right={
          <Btn
            t={t}
            variant="secondary"
            size="sm"
            icon={Ic.Download}
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `shipped-${new Date().toISOString().slice(0, 10)}.csv`,
                rows,
                [
                  { key: "reference", header: "Reference" },
                  { key: "customer", header: "Customer" },
                  {
                    key: "shippedAt",
                    header: "Shipped",
                    format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : ""),
                  },
                  { key: "lineCount", header: "Lines" },
                  { key: "qtyPicked", header: "Qty" },
                  {
                    key: "totalCents",
                    header: "Total ($)",
                    format: (v) => (typeof v === "number" ? (v / 100).toFixed(2) : "0"),
                  },
                ],
              )
            }
          >
            Download CSV
          </Btn>
        }
      />

      <Card t={t}>
        <DateRangeControl value={range} onChange={setRange} />
      </Card>

      <div style={{ height: 16 }} />

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1.4fr 120px 80px 100px 130px",
            gap: 14,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        >
          <div>Reference</div>
          <div>Customer</div>
          <div>Shipped</div>
          <div style={{ textAlign: "right" }}>Lines</div>
          <div style={{ textAlign: "right" }}>Qty</div>
          <div style={{ textAlign: "right" }}>Total</div>
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
            No shipments in this window.
          </div>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1.4fr 120px 80px 100px 130px",
              gap: 14,
              padding: "12px 20px",
              alignItems: "center",
              borderTop: `1.5px dashed ${t.border}`,
              fontSize: 13.5,
            }}
          >
            <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
              {r.reference}
            </span>
            <span>{r.customer ?? "—"}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
              {r.shippedAt?.toLocaleDateString() ?? "—"}
            </span>
            <span style={{ textAlign: "right", fontFamily: FONTS.mono, color: t.ink }}>
              {r.lineCount}
            </span>
            <span
              style={{
                textAlign: "right",
                fontFamily: FONTS.mono,
                color: t.ink,
                fontWeight: 600,
              }}
            >
              {r.qtyPicked}
            </span>
            <span
              style={{
                textAlign: "right",
                fontFamily: FONTS.mono,
                color: t.ink,
                fontWeight: 600,
              }}
            >
              ${(r.totalCents / 100).toFixed(2)}
            </span>
          </div>
        ))}
        {rows.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1.4fr 120px 80px 100px 130px",
              gap: 14,
              padding: "14px 20px",
              borderTop: `1.5px solid ${t.border}`,
              background: t.primarySoft,
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            <span />
            <span>Total</span>
            <span />
            <span style={{ textAlign: "right", fontFamily: FONTS.mono }}>
              {rows.reduce((s, r) => s + r.lineCount, 0)}
            </span>
            <span style={{ textAlign: "right", fontFamily: FONTS.mono }}>
              {rows.reduce((s, r) => s + r.qtyPicked, 0)}
            </span>
            <span style={{ textAlign: "right", fontFamily: FONTS.mono }}>
              ${(totalCents / 100).toFixed(2)}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
