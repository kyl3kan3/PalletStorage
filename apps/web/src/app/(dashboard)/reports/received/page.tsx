"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Card, PageTitle, Tag, type TagTone } from "~/components/kit";
import { BackLink } from "~/components/back-link";
import { DateRangeControl, type DateRange } from "~/components/date-range";
import { ReportExports } from "~/components/report-exports";
import { inboundStatusTone } from "~/lib/statusTone";

type Status = "open" | "receiving" | "closed" | "cancelled";

const STATUS_GROUPS: Array<{ key: "all" | Status; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "receiving", label: "Receiving" },
  { key: "closed", label: "Closed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function InboundReportPage() {
  const t = theme;
  const [range, setRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    to: new Date(),
  });
  const [filter, setFilter] = useState<"all" | Status>("all");

  const q = trpc.report.receivedOrders.useQuery({
    from: range.from,
    to: range.to,
    statuses: filter === "all" ? undefined : [filter],
  });
  const org = trpc.organization.current.useQuery();
  const suppliers = trpc.supplier.search.useQuery({ q: "", limit: 200 });
  const customers = trpc.customer.search.useQuery({ q: "", limit: 200 });

  const rows = q.data ?? [];
  const supplierName = useMemo(() => {
    const byId = new Map(suppliers.data?.map((s) => [s.id, s.name]) ?? []);
    return (id: string | null, fallback: string | null) =>
      id ? byId.get(id) ?? fallback ?? "—" : fallback ?? "—";
  }, [suppliers.data]);
  const customerName = useMemo(() => {
    const byId = new Map(customers.data?.map((c) => [c.id, c.name]) ?? []);
    return (id: string | null) => (id ? byId.get(id) ?? "—" : "—");
  }, [customers.data]);

  return (
    <div>
      <BackLink href="/reports" label="Back to reports" />
      <PageTitle
        eyebrow="Receiving"
        title="Inbound orders"
        subtitle="Every inbound order, any status — with expected vs received, any short-close reason, and who it was from."
        right={
          <ReportExports
            baseName="inbound"
            rows={rows}
            csvColumns={[
              { key: "reference", header: "Reference" },
              { key: "status", header: "Status" },
              { key: "supplier", header: "Supplier (text)" },
              {
                key: "supplierId",
                header: "Supplier (linked)",
                format: (v, row) => supplierName(v as string | null, row.supplier ?? null),
              },
              {
                key: "customerId",
                header: "Customer",
                format: (v) => customerName(v as string | null),
              },
              {
                key: "createdAt",
                header: "Created",
                format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : ""),
              },
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
                format: (_, row) => String((row.qtyReceived ?? 0) - (row.qtyExpected ?? 0)),
              },
              { key: "closeReason", header: "Close reason" },
            ]}
            pdfProps={() => ({
              title: "Inbound orders",
              subtitle:
                filter === "all"
                  ? "Every inbound order in the selected window"
                  : `Inbound orders · status = ${filter}`,
              organizationName: org.data?.name ?? undefined,
              dateRange: range,
              columns: [
                { key: "reference", header: "Reference", width: 14 },
                { key: "status", header: "Status", width: 10 },
                {
                  key: "supplierId",
                  header: "Supplier",
                  width: 20,
                  format: (v, row) =>
                    supplierName(v as string | null, row.supplier ?? null),
                },
                {
                  key: "customerId",
                  header: "Customer",
                  width: 16,
                  format: (v) => customerName(v as string | null),
                },
                {
                  key: "closedAt",
                  header: "Closed",
                  width: 10,
                  format: (v) => (v instanceof Date ? v.toLocaleDateString() : "—"),
                },
                { key: "qtyExpected", header: "Exp", align: "right", width: 7 },
                { key: "qtyReceived", header: "Rcvd", align: "right", width: 7 },
                {
                  key: "qtyReceived",
                  header: "Var",
                  align: "right",
                  width: 6,
                  format: (_, row) =>
                    String((row.qtyReceived ?? 0) - (row.qtyExpected ?? 0)),
                },
                { key: "closeReason", header: "Reason", width: 10 },
              ],
            })}
          />
        }
      />

      <Card t={t}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DateRangeControl value={range} onChange={setRange} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                color: t.muted,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontWeight: 600,
                alignSelf: "center",
              }}
            >
              Status
            </span>
            {STATUS_GROUPS.map((s) => {
              const on = filter === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setFilter(s.key)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: on ? t.primarySoft : t.surfaceAlt,
                    color: on ? t.primaryDeep : t.muted,
                    border: `1.5px solid ${on ? t.primaryDeep : t.border}`,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
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
            gridTemplateColumns: "130px 110px 1.3fr 1fr 100px 90px 90px 100px 24px",
            gap: 12,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        >
          <div>Reference</div>
          <div>Status</div>
          <div>Supplier</div>
          <div>Customer</div>
          <div>Date</div>
          <div style={{ textAlign: "right" }}>Exp</div>
          <div style={{ textAlign: "right" }}>Rcvd</div>
          <div>Variance</div>
          <div />
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
            No orders in this window.
          </div>
        )}
        {rows.map((r) => {
          const variance = r.qtyReceived - r.qtyExpected;
          const date = r.closedAt ?? r.createdAt;
          const tone: TagTone = inboundStatusTone(r.status);
          return (
            <Link
              key={r.id}
              href={`/inbound/${r.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "130px 110px 1.3fr 1fr 100px 90px 90px 100px 24px",
                gap: 12,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
                textDecoration: "none",
                color: t.body,
                fontSize: 13.5,
              }}
            >
              <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                {r.reference}
              </span>
              <Tag t={t} tone={tone}>
                {r.status}
              </Tag>
              <span style={{ color: t.body }}>
                {supplierName(r.supplierId, r.supplier ?? null)}
              </span>
              <span style={{ color: t.body }}>
                {customerName(r.customerId)}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
                {date?.toLocaleDateString() ?? "—"}
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
              <span style={{ color: t.muted, fontSize: 14 }}>→</span>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
