"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { useIsManager } from "~/lib/useRole";

/**
 * Per-customer monthly billing report. Default window is the
 * current calendar month from day 1 → now ("month-to-date") so the
 * user can see what's accruing live. Picking a past month flips
 * the upper bound to the end of that month for a final close-out.
 *
 * Three actions per customer row: download a PDF statement, push the
 * invoice to QuickBooks, or jump to /customers/[id] to set/edit
 * their per-pallet rates.
 */
export default function BillingReportPage() {
  const t = theme;
  const isManager = useIsManager();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { from, to, isCurrentMonth } = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y!, m! - 1, 1));
    const lastDay = new Date(Date.UTC(y!, m!, 0));
    lastDay.setUTCHours(23, 59, 59, 999);
    const now = new Date();
    const isCurrent =
      now.getUTCFullYear() === y && now.getUTCMonth() + 1 === m;
    return {
      from: first,
      to: isCurrent ? now : lastDay,
      isCurrentMonth: isCurrent,
    };
  }, [month]);

  const billing = trpc.report.customerBilling.useQuery({ from, to });
  const utils = trpc.useUtils();
  const exportToQb = trpc.report.exportCustomerBillToQuickbooks.useMutation({
    onSuccess: () => utils.report.customerBilling.invalidate(),
  });
  const [exportedFor, setExportedFor] = useState<Record<string, string>>({});

  const totalRevenueCents = (billing.data?.rows ?? []).reduce(
    (n, r) => n + r.totalChargeCents,
    0,
  );

  return (
    <div>
      <PageTitle
        eyebrow="Monthly statements"
        title="Customer billing"
        subtitle="Peak pallets stored, plus in and out movements, scored against each customer's per-pallet rates."
      />

      <Card t={t}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            Billing month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                fontSize: 14,
                color: t.ink,
                fontFamily: FONTS.sans,
              }}
            />
          </label>
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 13,
              color: t.muted,
              textAlign: "right",
            }}
          >
            <div>
              {from.toLocaleDateString()} – {to.toLocaleDateString()}
              {isCurrentMonth && (
                <span style={{ marginLeft: 6, color: t.primaryDeep }}>
                  (month-to-date)
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 18,
                fontWeight: 700,
                color: t.ink,
                marginTop: 2,
              }}
            >
              {fmtCents(totalRevenueCents)} total
            </div>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.6fr 70px 70px 70px 70px 70px 100px 90px 90px 110px 220px",
              gap: 10,
              padding: "12px 16px",
              fontSize: 10.5,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            <div>Customer</div>
            <div>Open</div>
            <div>Curr.</div>
            <div>Peak</div>
            <div>In</div>
            <div>Out</div>
            <div>Storage&nbsp;$</div>
            <div>In&nbsp;$</div>
            <div>Out&nbsp;$</div>
            <div>Total&nbsp;$</div>
            <div>Actions</div>
          </div>
          {(billing.data?.rows ?? []).map((r) => {
            const exportedQboId = exportedFor[r.customerId];
            return (
              <div
                key={r.customerId}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1.6fr 70px 70px 70px 70px 70px 100px 90px 90px 110px 220px",
                  gap: 10,
                  padding: "12px 16px",
                  borderTop: `1.5px dashed ${t.border}`,
                  alignItems: "center",
                }}
              >
                <div>
                  <Link
                    href={`/customers/${r.customerId}` as Route}
                    style={{
                      color: t.ink,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    {r.customerName}
                  </Link>
                  {!r.hasRates && (
                    <div style={{ marginTop: 2 }}>
                      <Tag t={t} tone="coral">
                        rates not set
                      </Tag>
                    </div>
                  )}
                </div>
                <Mono v={r.openingCount} t={t} />
                <Mono v={r.currentCount} t={t} />
                <Mono v={r.peakCount} t={t} highlight />
                <Mono v={r.receives} t={t} />
                <Mono v={r.ships} t={t} />
                <MonoCents v={r.storageChargeCents} t={t} />
                <MonoCents v={r.receiveChargeCents} t={t} />
                <MonoCents v={r.shipChargeCents} t={t} />
                <MonoCents v={r.totalChargeCents} t={t} highlight />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <a
                    href={`/api/customers/${r.customerId}/bill?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <Btn t={t} type="button" variant="secondary" size="sm" icon={Ic.Download}>
                      Bill
                    </Btn>
                  </a>
                  <Btn
                    t={t}
                    type="button"
                    variant={exportedQboId ? "secondary" : "primary"}
                    size="sm"
                    icon={Ic.Dollar}
                    title={
                      !r.hasRates
                        ? "Set rates on /customers/[id] first"
                        : !isManager
                          ? "Manager-only action"
                          : ""
                    }
                    disabled={
                      !r.hasRates ||
                      !isManager ||
                      r.totalChargeCents <= 0 ||
                      exportToQb.isPending
                    }
                    onClick={() =>
                      exportToQb.mutate(
                        {
                          customerId: r.customerId,
                          from,
                          to,
                        },
                        {
                          onSuccess: (res) =>
                            setExportedFor((prev) => ({
                              ...prev,
                              [r.customerId]: res.qboId,
                            })),
                        },
                      )
                    }
                  >
                    {exportedQboId ? `Inv ${exportedQboId}` : "Push QB"}
                  </Btn>
                </div>
              </div>
            );
          })}
          {billing.data && billing.data.rows.length === 0 && (
            <div
              style={{
                padding: "20px 16px",
                fontSize: 13,
                color: t.muted,
                borderTop: `1.5px dashed ${t.border}`,
              }}
            >
              No customers in this org yet — add one at{" "}
              <Link
                href={"/customers/new" as Route}
                style={{ color: t.primaryDeep, fontWeight: 600 }}
              >
                /customers/new
              </Link>
              .
            </div>
          )}
        </Card>
        {exportToQb.error && (
          <div
            style={{
              marginTop: 10,
              background: t.coralSoft,
              color: t.coral,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {exportToQb.error.message}
          </div>
        )}
      </div>
    </div>
  );
}

function Mono({
  v,
  t,
  highlight = false,
}: {
  v: number;
  t: typeof theme;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? t.ink : v > 0 ? t.body : t.muted,
      }}
    >
      {v}
    </div>
  );
}

function MonoCents({
  v,
  t,
  highlight = false,
}: {
  v: number;
  t: typeof theme;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? t.ink : v > 0 ? t.body : t.muted,
      }}
    >
      {fmtCents(v)}
    </div>
  );
}

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
