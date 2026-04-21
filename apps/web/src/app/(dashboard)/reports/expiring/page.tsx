"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { ReportsNav } from "~/components/reports-nav";
import { downloadCsv } from "~/lib/csv";

export default function ExpiringReportPage() {
  const t = theme;
  const [days, setDays] = useState(30);
  const q = trpc.report.expiringStock.useQuery({ days });
  const rows = q.data ?? [];
  const now = Date.now();

  return (
    <div>
      <ReportsNav />
      <PageTitle
        eyebrow="At risk"
        title="Expiring stock"
        subtitle="Pallet items with an expiry date inside the window. Sorted soonest first."
        right={
          <Btn
            t={t}
            variant="secondary"
            size="sm"
            icon={Ic.Download}
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `expiring-${days}d-${new Date().toISOString().slice(0, 10)}.csv`,
                rows,
                [
                  { key: "sku", header: "SKU" },
                  { key: "productName", header: "Name" },
                  { key: "lpn", header: "LPN" },
                  { key: "lot", header: "Lot" },
                  { key: "qty", header: "Qty" },
                  {
                    key: "expiry",
                    header: "Expiry",
                    format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : ""),
                  },
                  { key: "locationPath", header: "Location" },
                ],
              )
            }
          >
            Download CSV
          </Btn>
        }
      />

      <Card t={t}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: t.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Window
          </span>
          {[7, 14, 30, 60, 90].map((d) => {
            const on = days === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: on ? t.primarySoft : t.surfaceAlt,
                  color: on ? t.primaryDeep : t.muted,
                  border: `1.5px solid ${on ? t.primaryDeep : t.border}`,
                  fontFamily: FONTS.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {d} days
              </button>
            );
          })}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1.2fr 140px 100px 80px 120px 1fr",
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
          <div>LPN</div>
          <div>Lot</div>
          <div style={{ textAlign: "right" }}>Qty</div>
          <div>Expiry</div>
          <div>Location</div>
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
            Nothing expiring in the next {days} days. Nice.
          </div>
        )}
        {rows.map((r) => {
          const daysLeft = r.expiry
            ? Math.max(0, Math.ceil((r.expiry.getTime() - now) / (24 * 3600 * 1000)))
            : 0;
          return (
            <div
              key={r.palletItemId}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1.2fr 140px 100px 80px 120px 1fr",
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
              <span>{r.productName}</span>
              <span style={{ fontFamily: FONTS.mono, color: t.ink }}>{r.lpn}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
                {r.lot ?? "—"}
              </span>
              <span style={{ textAlign: "right", fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                {r.qty}
              </span>
              <span>
                <Tag
                  t={t}
                  tone={daysLeft <= 7 ? "coral" : daysLeft <= 14 ? "primary" : "sky"}
                >
                  {daysLeft}d · {r.expiry?.toLocaleDateString()}
                </Tag>
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
                {r.locationPath ?? "—"}
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
