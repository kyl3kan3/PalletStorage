"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Card, PageTitle } from "~/components/kit";
import { BackLink } from "~/components/back-link";
import { DateRangeControl, type DateRange } from "~/components/date-range";
import { ReportExports } from "~/components/report-exports";

export default function ShippedReportPage() {
  const t = theme;
  const [range, setRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    to: new Date(),
  });
  const q = trpc.report.shippedOrders.useQuery(range);
  const org = trpc.organization.current.useQuery();
  const rows = q.data ?? [];
  const totalCents = rows.reduce((s, r) => s + (r.totalCents ?? 0), 0);

  return (
    <div>
      <BackLink href="/reports" label="Back to reports" />
      <PageTitle
        eyebrow="Sales"
        title="Shipped orders"
        subtitle="Every outbound shipped in the selected window. Picked-qty × unit price gives the line total."
        right={
          <ReportExports
            baseName="shipped"
            rows={rows}
            csvColumns={[
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
            ]}
            pdfProps={() => ({
              title: "Shipped orders",
              subtitle: "Outbound orders shipped in the selected window",
              organizationName: org.data?.name ?? undefined,
              dateRange: range,
              columns: [
                { key: "reference", header: "Reference", width: 18 },
                { key: "customer", header: "Customer", width: 28 },
                {
                  key: "shippedAt",
                  header: "Shipped",
                  width: 14,
                  format: (v) => (v instanceof Date ? v.toLocaleDateString() : "—"),
                },
                { key: "lineCount", header: "Lines", align: "right", width: 8 },
                { key: "qtyPicked", header: "Qty", align: "right", width: 10 },
                {
                  key: "totalCents",
                  header: "Total",
                  align: "right",
                  width: 22,
                  format: (v) =>
                    typeof v === "number" ? `$${(v / 100).toFixed(2)}` : "$0.00",
                },
              ],
              footerNotes: [
                `Grand total: $${(totalCents / 100).toFixed(2)} across ${rows.length} order(s)`,
              ],
            })}
          />
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
