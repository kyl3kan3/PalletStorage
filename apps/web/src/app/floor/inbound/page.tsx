"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FShell, type FShellTab } from "~/components/floor-shell";
import { FCard, FPill, KPI, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Inbound list at /floor/inbound. Wired to inbound.list,
 * which returns one row per order. The dock-door status strip needs a
 * separate aggregate (which active POs are at which dock); without a
 * dock.status procedure we hide the strip and surface dock assignments
 * inline on the rows instead.
 */

type InStatus =
  | "draft"
  | "open"
  | "receiving"
  | "closed"
  | "cancelled";

export default function FloorInboundList() {
  const [tab, setTab] = useState("active");
  const list = trpc.inbound.list.useQuery({}, { refetchInterval: 30_000 });

  const buckets = useMemo(() => {
    const all = list.data ?? [];
    return {
      active: all.filter((o) => o.status === "open" || o.status === "receiving"),
      receiving: all.filter((o) => o.status === "receiving"),
      closed: all.filter((o) => o.status === "closed"),
      cancelled: all.filter((o) => o.status === "cancelled"),
      all,
    };
  }, [list.data]);

  const visible =
    tab === "active"
      ? buckets.active
      : tab === "closed"
        ? buckets.closed
        : buckets.cancelled;

  const tabs: FShellTab[] = [
    { key: "active", label: "Active", count: buckets.active.length },
    { key: "closed", label: "Closed", count: buckets.closed.length },
    { key: "cancelled", label: "Cancelled", count: buckets.cancelled.length },
  ];

  return (
    <FShell
      eyebrow="Receiving pipeline"
      title="Inbound"
      subtitle={
        list.isLoading
          ? "Loading…"
          : `${buckets.active.length} active · ${buckets.receiving.length} at dock`
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
        <KPI t={t} label="Active" value={buckets.active.length} />
        <KPI t={t} label="Receiving" value={buckets.receiving.length} />
        <KPI t={t} label="Closed (all-time)" value={buckets.closed.length} />
      </div>

      <FCard t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1.4fr 110px 130px 24px",
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
          <div>Supplier</div>
          <div>Status</div>
          <div>Expected</div>
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
                ? "No inbound orders open. Hit /inbound/new (legacy) or /inbound/import to create one."
                : "Switch tabs to see other states."
            }
          />
        )}
        {visible.map((o) => {
          const isReceiving = o.status === "receiving";
          return (
            <Link
              key={o.id}
              href={`/floor/inbound/${o.id}` as Route}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1.4fr 110px 130px 24px",
                gap: 14,
                padding: "14px 20px",
                alignItems: "center",
                borderTop: `1px dashed ${t.border}`,
                background: isReceiving ? t.primarySoft : undefined,
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
              <span style={{ fontSize: 13 }}>{o.supplier ?? "—"}</span>
              <span>
                <FPill t={t} tone={inboundTone(o.status as InStatus)} size="sm">
                  {o.status}
                </FPill>
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  color: t.body,
                  fontWeight: 700,
                }}
              >
                {o.expectedAt
                  ? new Date(o.expectedAt).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—"}
              </span>
              <span style={{ color: t.mutedSoft, textAlign: "right", fontSize: 14 }}>→</span>
            </Link>
          );
        })}
      </FCard>
    </FShell>
  );
}

function inboundTone(s: InStatus): "primary" | "mint" | "sky" | "coral" {
  if (s === "receiving") return "primary";
  if (s === "closed") return "mint";
  if (s === "cancelled") return "coral";
  return "sky";
}
