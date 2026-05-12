"use client";

import { useState } from "react";
import { FShell, type FShellTab } from "~/components/floor-shell";
import { FCard, FBtn, FPill, KPI } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { Ic } from "~/components/icons";

/**
 * Floor-mode Cycle counts preview at /floor/counts.
 *
 * Tabs: Open (4) · Reviewing (2) · Approved
 * KPI row: Open · Reviewing · 30-day accuracy
 * Table: Count ID | Zone | Status | Due | Items | Variance | Assigned
 * Overdue rows tinted coral-soft.
 *
 * Mock data; later phase wires cycleCount.list({ warehouseId, status }).
 */

type CCStatus = "counting" | "reviewing" | "approved" | "overdue";

interface Count {
  id: string;
  zone: string;
  status: CCStatus;
  due: string;
  items: number;
  variance: number;
  assigned: string;
}

const TABS: FShellTab[] = [
  { key: "open", label: "Open", count: 4 },
  { key: "reviewing", label: "Reviewing", count: 2 },
  { key: "approved", label: "Approved" },
];

const ROWS: Count[] = [
  { id: "CC-204", zone: "A2 · dry", status: "overdue", due: "3h ago", items: 124, variance: -8, assigned: "MR" },
  { id: "CC-205", zone: "A3 · dry", status: "counting", due: "today", items: 86, variance: 0, assigned: "JN" },
  { id: "CC-206", zone: "B1 · cold", status: "counting", due: "tmw", items: 142, variance: 0, assigned: "AS" },
  { id: "CC-207", zone: "C1 · bulk", status: "counting", due: "tmw", items: 38, variance: 0, assigned: "KT" },
  { id: "CC-202", zone: "A1 · dry", status: "reviewing", due: "—", items: 96, variance: -3, assigned: "MR" },
  { id: "CC-203", zone: "D1 · returns", status: "reviewing", due: "—", items: 22, variance: 1, assigned: "JN" },
];

export default function FloorCycleCounts() {
  const [tab, setTab] = useState("open");

  return (
    <FShell
      eyebrow="Audit"
      title="Cycle counts"
      subtitle="4 open · 2 reviewing · 98.6% 30-day accuracy"
      tabs={TABS}
      tabActive={tab}
      onTabChange={setTab}
      actions={
        <FBtn t={t} variant="primary" size="md" icon={Ic.Plus}>
          New count
        </FBtn>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <KPI t={t} label="Open" value={4} delta="+1 today" deltaTone="coral" />
        <KPI t={t} label="Reviewing" value={2} delta="−1 today" />
        <KPI t={t} label="30-day accuracy" value="98.6%" delta="+0.3pt" spark={[88, 90, 92, 94, 95, 96, 97, 98]} />
      </div>

      <FCard t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr 110px 90px 70px 90px 90px",
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
          <div>Count ID</div>
          <div>Zone</div>
          <div>Status</div>
          <div>Due</div>
          <div>Items</div>
          <div style={{ textAlign: "right" }}>Variance</div>
          <div style={{ textAlign: "right" }}>Assigned</div>
        </div>
        {ROWS.map((r) => {
          const overdue = r.status === "overdue";
          return (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr 110px 90px 70px 90px 90px",
                gap: 14,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1px dashed ${t.border}`,
                background: overdue ? t.coralSoft : undefined,
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
                {r.id}
              </span>
              <span style={{ fontSize: 13, color: t.body }}>{r.zone}</span>
              <span>
                <FPill t={t} tone={countTone(r.status)} size="sm">
                  {r.status}
                </FPill>
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: overdue ? t.coral : t.body,
                }}
              >
                {r.due}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 13,
                  fontWeight: 800,
                  color: t.ink,
                }}
              >
                {r.items}
              </span>
              <span style={{ textAlign: "right" }}>
                {r.variance === 0 ? (
                  <FPill t={t} tone="mint" size="sm">
                    MATCH
                  </FPill>
                ) : (
                  <FPill t={t} tone={r.variance < 0 ? "coral" : "primary"} size="sm">
                    {r.variance > 0 ? "+" : ""}
                    {r.variance}
                  </FPill>
                )}
              </span>
              <span style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-grid",
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: t.surfaceAlt,
                    border: `1px solid ${t.border}`,
                    color: t.ink,
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    placeItems: "center",
                    letterSpacing: 0.3,
                  }}
                >
                  {r.assigned}
                </span>
              </span>
            </div>
          );
        })}
      </FCard>

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
        FLOOR MODE PREVIEW · mock data · later phase wires cycleCount.list
      </div>
    </FShell>
  );
}

function countTone(s: CCStatus): "primary" | "mint" | "sky" | "coral" {
  if (s === "counting") return "primary";
  if (s === "reviewing") return "sky";
  if (s === "approved") return "mint";
  return "coral";
}
