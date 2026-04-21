"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@wms/api";
import { trpc } from "~/lib/trpc";

type MovementRow = inferRouterOutputs<AppRouter>["report"]["movementLog"][number];
import { theme, FONTS } from "~/lib/theme";
import { Card, PageTitle, Tag } from "~/components/kit";
import { BackLink } from "~/components/back-link";
import { DateRangeControl, type DateRange } from "~/components/date-range";
import { ReportExports } from "~/components/report-exports";
import { movementReasonTone } from "~/lib/statusTone";

const REASONS = [
  "receive",
  "putaway",
  "move",
  "pick",
  "ship",
  "adjust",
  "cycle_count",
] as const;
type Reason = (typeof REASONS)[number];

export default function MovementsReportPage() {
  const t = theme;
  const [range, setRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    to: new Date(),
  });
  const [reasons, setReasons] = useState<Reason[]>([...REASONS]);

  const q = trpc.report.movementLog.useQuery({
    from: range.from,
    to: range.to,
    reasons,
    limit: 500,
  });
  const rows: MovementRow[] = q.data ?? [];
  const org = trpc.organization.current.useQuery();

  const toggle = (r: Reason) =>
    setReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );

  return (
    <div>
      <BackLink href="/reports" label="Back to reports" />
      <PageTitle
        eyebrow="Audit"
        title="Movement log"
        subtitle="The full ledger — every receive, putaway, pick, ship, and count. Filter by reason and date."
        right={
          <ReportExports
            baseName="movements"
            rows={rows}
            csvColumns={[
              {
                key: "createdAt",
                header: "When",
                format: (v) => (v instanceof Date ? v.toISOString() : ""),
              },
              { key: "reason", header: "Reason" },
              { key: "palletId", header: "Pallet" },
              { key: "fromLocationId", header: "From" },
              { key: "toLocationId", header: "To" },
              { key: "notes", header: "Notes" },
            ]}
            pdfProps={() => ({
              title: "Movement log",
              subtitle: "Audit trail across the ledger",
              organizationName: org.data?.name ?? undefined,
              dateRange: range,
              columns: [
                {
                  key: "createdAt",
                  header: "When",
                  width: 18,
                  format: (v) => (v instanceof Date ? v.toLocaleString() : ""),
                },
                { key: "reason", header: "Reason", width: 12 },
                {
                  key: "palletId",
                  header: "Pallet",
                  width: 12,
                  format: (v) => (typeof v === "string" ? v.slice(0, 8) : ""),
                },
                {
                  key: "fromLocationId",
                  header: "From",
                  width: 12,
                  format: (v) => (typeof v === "string" ? v.slice(0, 8) : "—"),
                },
                {
                  key: "toLocationId",
                  header: "To",
                  width: 12,
                  format: (v) => (typeof v === "string" ? v.slice(0, 8) : "—"),
                },
                { key: "notes", header: "Notes", width: 34 },
              ],
            })}
          />
        }
      />

      <Card t={t}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DateRangeControl value={range} onChange={setRange} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: t.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Reason
            </span>
            {REASONS.map((r) => {
              const on = reasons.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(r)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: on ? t.primarySoft : t.surfaceAlt,
                    color: on ? t.primaryDeep : t.muted,
                    border: `1.5px solid ${on ? t.primaryDeep : t.border}`,
                    fontFamily: FONTS.sans,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 120px 140px 1fr 1fr",
            gap: 14,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        >
          <div>When</div>
          <div>Reason</div>
          <div>Pallet</div>
          <div>From → To</div>
          <div>Notes</div>
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
            No movements match these filters.
          </div>
        )}
        {rows.map((m) => (
          <div
            key={m.id}
            style={{
              display: "grid",
              gridTemplateColumns: "160px 120px 140px 1fr 1fr",
              gap: 14,
              padding: "12px 20px",
              alignItems: "center",
              borderTop: `1.5px dashed ${t.border}`,
              fontSize: 13,
            }}
          >
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
              {m.createdAt.toLocaleString()}
            </span>
            <span>
              <Tag t={t} tone={movementReasonTone(m.reason)}>
                {m.reason}
              </Tag>
            </span>
            <span style={{ fontFamily: FONTS.mono, color: t.ink }}>
              {m.palletId.slice(0, 8)}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
              {m.fromLocationId?.slice(0, 8) ?? "—"} → {m.toLocationId?.slice(0, 8) ?? "—"}
            </span>
            <span style={{ color: t.muted, fontSize: 12 }}>{m.notes ?? ""}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
