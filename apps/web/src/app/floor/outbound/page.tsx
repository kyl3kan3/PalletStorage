"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FShell, type FShellTab } from "~/components/floor-shell";
import { FCard, FPill, KPI, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Outbound list at /floor/outbound. Wired to outbound.list
 * which returns one row per order (no lines/picks aggregates). The
 * Lines / Progress / Crew columns aren't available without joining
 * outbound_lines + picks; we render the columns the procedure gives us
 * and link to the detail page for the rest.
 */

type OutStatus = "draft" | "open" | "picking" | "packed" | "shipped" | "cancelled";

export default function FloorOutboundList() {
  const [tab, setTab] = useState("active");
  const list = trpc.outbound.list.useQuery({}, { refetchInterval: 30_000 });

  const buckets = useMemo(() => {
    const all = list.data ?? [];
    return {
      active: all.filter(
        (o) => o.status === "open" || o.status === "picking" || o.status === "packed",
      ),
      ready: all.filter((o) => o.status === "packed"),
      shipped: all.filter((o) => o.status === "shipped"),
      cancelled: all.filter((o) => o.status === "cancelled"),
      all,
    };
  }, [list.data]);

  const tabs: FShellTab[] = [
    { key: "active", label: "Active", count: buckets.active.length },
    { key: "ready", label: "Ready", count: buckets.ready.length },
    { key: "shipped", label: "Shipped", count: buckets.shipped.length },
    { key: "cancelled", label: "Cancelled", count: buckets.cancelled.length },
  ];
  const visible =
    tab === "active"
      ? buckets.active
      : tab === "ready"
        ? buckets.ready
        : tab === "shipped"
          ? buckets.shipped
          : buckets.cancelled;

  const openCount = buckets.active.length;
  const pickingCount = (list.data ?? []).filter((o) => o.status === "picking").length;
  const readyCount = buckets.ready.length;

  return (
    <FShell
      eyebrow="Order pipeline"
      title="Outbound"
      subtitle={
        list.isLoading
          ? "Loading…"
          : `${openCount} active · ${pickingCount} picking · ${readyCount} ready`
      }
      tabs={tabs}
      tabActive={tab}
      onTabChange={setTab}
    >
      <div
        data-collapse-grid
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <KPI t={t} label="Active" value={openCount} />
        <KPI t={t} label="Picking" value={pickingCount} />
        <KPI t={t} label="Ready" value={readyCount} />
      </div>

      <FCard t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1.4fr 100px 130px 24px",
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
          <div>Ref</div>
          <div>Customer</div>
          <div>Status</div>
          <div>Ship by</div>
          <div />
        </div>
        {list.isLoading && (
          <div style={{ padding: 20 }}>
            <Skeleton t={t} lines={5} rowHeight={48} />
          </div>
        )}
        {!list.isLoading && visible.length === 0 && (
          <EmptyState
            t={t}
            title={`No ${tab} orders`}
            hint={
              tab === "active"
                ? "Hit the legacy /outbound/new page to create one — the floor design is still preview-only for order creation."
                : "Switch tabs to see other order states."
            }
          />
        )}
        {visible.map((o) => {
          const isPicking = o.status === "picking";
          const shipBy = o.shipBy ? new Date(o.shipBy) : null;
          const urgent =
            shipBy != null &&
            isPicking &&
            shipBy.getTime() - Date.now() < 4 * 3600 * 1000; // <4h
          return (
            <Link
              key={o.id}
              href={`/floor/outbound/${o.id}` as Route}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1.4fr 100px 130px 24px",
                gap: 14,
                padding: "14px 20px",
                alignItems: "center",
                borderTop: `1px dashed ${t.border}`,
                background: isPicking ? t.primarySoft : undefined,
                textDecoration: "none",
                color: t.body,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: 0.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {o.reference}
              </span>
              <span style={{ fontSize: 13, color: t.body }}>{o.customer ?? "—"}</span>
              <span>
                <FPill t={t} tone={statusTone(o.status as OutStatus)} size="sm">
                  {o.status}
                </FPill>
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: urgent ? t.coral : t.body,
                }}
              >
                {shipBy ? shipBy.toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—"}
              </span>
              <span
                style={{
                  color: t.mutedSoft,
                  textAlign: "right",
                  fontSize: 14,
                }}
              >
                →
              </span>
            </Link>
          );
        })}
      </FCard>
    </FShell>
  );
}

function statusTone(s: OutStatus): "primary" | "mint" | "sky" | "neutral" | "coral" {
  if (s === "picking") return "primary";
  if (s === "packed") return "mint";
  if (s === "open" || s === "draft") return "sky";
  if (s === "cancelled") return "coral";
  return "neutral";
}
