"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { ReportsNav } from "~/components/reports-nav";
import { DateRangeControl, type DateRange } from "~/components/date-range";
import { downloadCsv } from "~/lib/csv";

export default function ReceivedReportPage() {
  const t = theme;
  const [range, setRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    to: new Date(),
  });
  const q = trpc.report.receivedOrders.useQuery(range);
  const rows = q.data ?? [];

  return (
    <div>
      <ReportsNav />
      <PageTitle
        eyebrow="Receiving"
        title="Received orders"
        subtitle="Every inbound closed in the selected window, with expected vs received and any short-close reason."
        right={
          <Btn
            t={t}
            variant="secondary"
            size="sm"
            icon={Ic.Download}
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `received-${new Date().toISOString().slice(0, 10)}.csv`,
                rows,
                [
                  { key: "reference", header: "Reference" },
                  { key: "supplier", header: "Supplier" },
                  {
                    key: "closedAt",
                    header: "Closed",
                    format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : ""),
                  },
                  { key: "qtyExpected", header: "Expected" },
                  { key: "qtyReceived", header: "Received" },
                  {
                    key: "qtyReceived",
                    header: "Variance",
                    format: (_, row) =>
                      String((row.qtyReceived ?? 0) - (row.qtyExpected ?? 0)),
                  },
                  { key: "closeReason", header: "Close reason" },
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
            gridTemplateColumns: "160px 1.4fr 120px 90px 90px 100px 1fr",
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
          <div>Supplier</div>
          <div>Closed</div>
          <div style={{ textAlign: "right" }}>Expected</div>
          <div style={{ textAlign: "right" }}>Received</div>
          <div>Variance</div>
          <div>Reason</div>
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
            No receipts closed in this window.
          </div>
        )}
        {rows.map((r) => {
          const variance = r.qtyReceived - r.qtyExpected;
          return (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1.4fr 120px 90px 90px 100px 1fr",
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
              <span>{r.supplier ?? "—"}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
                {r.closedAt?.toLocaleDateString() ?? "—"}
              </span>
              <span style={{ textAlign: "right", fontFamily: FONTS.mono, color: t.ink }}>
                {r.qtyExpected}
              </span>
              <span
                style={{
                  textAlign: "right",
                  fontFamily: FONTS.mono,
                  color: t.ink,
                  fontWeight: 600,
                }}
              >
                {r.qtyReceived}
              </span>
              <span>
                {variance === 0 ? (
                  <Tag t={t} tone="mint">
                    on target
                  </Tag>
                ) : variance < 0 ? (
                  <Tag t={t} tone="coral">
                    {variance}
                  </Tag>
                ) : (
                  <Tag t={t} tone="sky">
                    +{variance}
                  </Tag>
                )}
              </span>
              <span style={{ fontSize: 12, color: t.muted }}>{r.closeReason ?? "—"}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
