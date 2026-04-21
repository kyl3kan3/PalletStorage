"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Card, PageTitle } from "~/components/kit";
import { ReportsNav } from "~/components/reports-nav";
import { DateRangeControl, type DateRange } from "~/components/date-range";
import { ReportExports } from "~/components/report-exports";

export default function ProductivityReportPage() {
  const t = theme;
  const [range, setRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    to: new Date(),
  });
  const q = trpc.report.operatorProductivity.useQuery(range);
  const org = trpc.organization.current.useQuery();
  const rows = q.data ?? [];
  const maxTotal = Math.max(1, ...rows.map((r) => r.picks + r.counts));

  return (
    <div>
      <ReportsNav />
      <PageTitle
        eyebrow="Team performance"
        title="Operator productivity"
        subtitle="Completed picks and approved cycle counts per user. Zero-activity users are hidden."
        right={
          <ReportExports
            baseName="productivity"
            rows={rows}
            csvColumns={[
              { key: "name", header: "Name" },
              { key: "email", header: "Email" },
              { key: "picks", header: "Picks" },
              { key: "counts", header: "Cycle counts" },
              {
                key: "picks",
                header: "Total",
                format: (_, row) => String(row.picks + row.counts),
              },
            ]}
            pdfProps={() => ({
              title: "Operator productivity",
              subtitle: "Completed picks and approved cycle counts per user",
              organizationName: org.data?.name ?? undefined,
              dateRange: range,
              columns: [
                { key: "name", header: "Name", width: 24 },
                { key: "email", header: "Email", width: 36 },
                { key: "picks", header: "Picks", align: "right", width: 14 },
                { key: "counts", header: "Cycle counts", align: "right", width: 14 },
                {
                  key: "picks",
                  header: "Total",
                  align: "right",
                  width: 12,
                  format: (_, row) => String(row.picks + row.counts),
                },
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
            gridTemplateColumns: "1.2fr 1.6fr 100px 140px 1fr",
            gap: 14,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        >
          <div>Name</div>
          <div>Email</div>
          <div style={{ textAlign: "right" }}>Picks</div>
          <div style={{ textAlign: "right" }}>Cycle counts</div>
          <div>Share</div>
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
            No completed work in this window.
          </div>
        )}
        {rows.map((r) => {
          const total = r.picks + r.counts;
          return (
            <div
              key={r.user_id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.6fr 100px 140px 1fr",
                gap: 14,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
                fontSize: 13.5,
              }}
            >
              <span style={{ color: t.ink, fontWeight: 600 }}>{r.name ?? "—"}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
                {r.email}
              </span>
              <span style={{ textAlign: "right", fontFamily: FONTS.mono, color: t.ink }}>
                {r.picks}
              </span>
              <span style={{ textAlign: "right", fontFamily: FONTS.mono, color: t.ink }}>
                {r.counts}
              </span>
              <span>
                <div
                  style={{
                    position: "relative",
                    height: 10,
                    background: t.surfaceAlt,
                    borderRadius: 6,
                    overflow: "hidden",
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <div
                    style={{
                      width: `${(total / maxTotal) * 100}%`,
                      height: "100%",
                      background: t.primary,
                    }}
                  />
                </div>
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
