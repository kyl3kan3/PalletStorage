"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FShell, type FShellTab } from "~/components/floor-shell";
import { FCard, FPill, KPI } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";

/**
 * Floor-mode Outbound list preview at /floor/outbound.
 *
 * Tabs: Active (12) · Ready (4) · Shipped · Cancelled
 * KPI row: Open / Picking / Ready / On-time
 * Table: Ref | Customer | Status | Ship by | Lines | Progress | Crew | →
 * Picking rows get a marigold-soft tint + a glow on the progress bar.
 *
 * Mock data; later phase wires order.outboundList({ warehouseId, status }).
 */

type OutStatus = "open" | "picking" | "ready" | "shipped" | "cancelled";

interface OutRow {
  ref: string;
  customer: string;
  status: OutStatus;
  shipBy: string;
  urgent: boolean;
  lines: string;
  progress: number;
  crew: string[];
}

const ROWS: OutRow[] = [
  { ref: "SO-24881", customer: "Northgate Foods", status: "picking", shipBy: "17:00", urgent: true, lines: "13/22", progress: 0.59, crew: ["MR", "KT"] },
  { ref: "SO-24882", customer: "Westcoast Mart", status: "picking", shipBy: "16:30", urgent: false, lines: "17/20", progress: 0.85, crew: ["AS"] },
  { ref: "SO-24883", customer: "Pacific Greens", status: "ready", shipBy: "tmw 09:00", urgent: false, lines: "8/8", progress: 1.0, crew: ["JN"] },
  { ref: "SO-24884", customer: "Sound Grocers", status: "open", shipBy: "tmw 14:00", urgent: false, lines: "0/14", progress: 0.0, crew: ["—"] },
  { ref: "SO-24885", customer: "Olympic Mkt", status: "open", shipBy: "Mon 09:00", urgent: false, lines: "0/9", progress: 0.0, crew: ["—"] },
  { ref: "SO-24886", customer: "Cascade Foods", status: "picking", shipBy: "17:30", urgent: true, lines: "4/18", progress: 0.22, crew: ["MR"] },
  { ref: "SO-24887", customer: "Northgate Foods", status: "ready", shipBy: "tmw 11:00", urgent: false, lines: "12/12", progress: 1.0, crew: ["KT"] },
];

const TABS: FShellTab[] = [
  { key: "active", label: "Active", count: 12 },
  { key: "ready", label: "Ready", count: 4 },
  { key: "shipped", label: "Shipped" },
  { key: "cancelled", label: "Cancelled" },
];

export default function FloorOutboundList() {
  const [tab, setTab] = useState("active");

  return (
    <FShell
      eyebrow="Order pipeline"
      title="Outbound"
      subtitle="34 open · 12 picking · 4 ready"
      tabs={TABS}
      tabActive={tab}
      onTabChange={setTab}
    >
      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <KPI t={t} label="Open" value={34} delta="+5 today" />
        <KPI t={t} label="Picking" value={12} delta="+4 hr" spark={[40, 50, 55, 60, 70, 75, 80, 88]} />
        <KPI t={t} label="Ready" value={4} delta="−2 vs avg" deltaTone="coral" />
        <KPI t={t} label="On-time" value={96} suffix="%" delta="+2pt week" spark={[80, 82, 86, 88, 90, 92, 94, 96]} />
      </div>

      <FCard t={t} padding={0}>
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1.4fr 90px 100px 70px 1fr 70px 24px",
            gap: 12,
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
          <div>Lines</div>
          <div>Progress</div>
          <div>Crew</div>
          <div />
        </div>
        {ROWS.map((r) => {
          const isPicking = r.status === "picking";
          return (
            <Link
              key={r.ref}
              href={`/floor/outbound/${r.ref}` as Route}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1.4fr 90px 100px 70px 1fr 70px 24px",
                gap: 12,
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
                }}
              >
                {r.ref}
              </span>
              <span style={{ fontSize: 13, color: t.body }}>{r.customer}</span>
              <span>
                <FPill t={t} tone={statusTone(r.status)} size="sm">
                  {r.status}
                </FPill>
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: r.urgent ? t.coral : t.body,
                }}
              >
                {r.shipBy}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: t.ink,
                }}
              >
                {r.lines}
              </span>
              <ProgressBar value={r.progress} glow={isPicking} />
              <CrewStack initials={r.crew} />
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

      <PreviewBanner what="order.outboundList" />
    </FShell>
  );
}

function statusTone(s: OutStatus): "primary" | "mint" | "sky" | "neutral" | "coral" {
  if (s === "picking") return "primary";
  if (s === "ready") return "mint";
  if (s === "open") return "sky";
  if (s === "cancelled") return "coral";
  return "neutral";
}

function ProgressBar({ value, glow }: { value: number; glow?: boolean }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: t.surfaceAlt,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          background: t.primary,
          borderRadius: 3,
          boxShadow: glow && pct > 0 ? `0 0 8px ${t.primaryGlow}` : undefined,
        }}
      />
    </div>
  );
}

function CrewStack({ initials }: { initials: string[] }) {
  if (initials.length === 1 && initials[0] === "—") {
    return (
      <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.mutedSoft }}>—</span>
    );
  }
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {initials.map((c, i) => (
        <div
          key={i}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: t.surfaceAlt,
            border: `1px solid ${t.border}`,
            color: t.ink,
            fontFamily: FONTS.mono,
            fontSize: 9.5,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            letterSpacing: 0.3,
          }}
        >
          {c}
        </div>
      ))}
    </div>
  );
}

export function PreviewBanner({ what }: { what: string }) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: "14px 18px",
        background: t.surface,
        border: `1px dashed ${t.border}`,
        borderRadius: 12,
        fontFamily: FONTS.mono,
        fontSize: 11,
        color: t.mutedSoft,
        letterSpacing: 0.4,
      }}
    >
      FLOOR MODE PREVIEW · mock data · later phase wires {what}
    </div>
  );
}
