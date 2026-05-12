"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FShell, type FShellTab } from "~/components/floor-shell";
import { FCard, FPill } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";

/**
 * Floor-mode Inbound list preview at /floor/inbound.
 *
 * Layout per the handoff:
 *   - Dock door status strip (4 cards: D-01 .. D-04) above the table
 *   - Table: Ref | Supplier | Status | Expected | Lines | Door | Progress | →
 *
 * Mock data; later phase wires order.inboundList({ warehouseId, status })
 * + dock.status({ warehouseId }).
 */

type InStatus = "open" | "receiving" | "closed" | "cancelled";

interface DockDoor {
  code: string;
  state: "idle" | "active" | "blocked";
  current?: string;
  progress?: number;
}

const DOCKS: DockDoor[] = [
  { code: "D-01", state: "active", current: "PO-58812 · 12/24 cs", progress: 0.5 },
  { code: "D-02", state: "active", current: "PO-58901 · 2/5 pallets", progress: 0.4 },
  { code: "D-03", state: "idle" },
  { code: "D-04", state: "blocked", current: "Maintenance" },
];

const ROWS: Array<{
  ref: string;
  supplier: string;
  status: InStatus;
  expected: string;
  lines: number;
  door: string | null;
  progress: number;
}> = [
  { ref: "PO-58812", supplier: "ACME Corp", status: "receiving", expected: "today", lines: 6, door: "D-01", progress: 0.5 },
  { ref: "PO-58901", supplier: "Pacific Supply", status: "receiving", expected: "today", lines: 5, door: "D-02", progress: 0.4 },
  { ref: "PO-58910", supplier: "Atlas Distribution", status: "open", expected: "tmw 11:00", lines: 5, door: null, progress: 0 },
  { ref: "PO-58915", supplier: "Northern Goods", status: "open", expected: "tmw 14:00", lines: 8, door: null, progress: 0 },
  { ref: "PO-58820", supplier: "Sunrise Foods", status: "closed", expected: "Mar 11", lines: 12, door: null, progress: 1 },
  { ref: "PO-58818", supplier: "Coastal Imports", status: "closed", expected: "Mar 10", lines: 9, door: null, progress: 1 },
];

const TABS: FShellTab[] = [
  { key: "active", label: "Active", count: 4 },
  { key: "closed", label: "Closed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function FloorInboundList() {
  const [tab, setTab] = useState("active");

  return (
    <FShell
      eyebrow="Receiving pipeline"
      title="Inbound"
      subtitle="8 open · 2 at dock"
      tabs={TABS}
      tabActive={tab}
      onTabChange={setTab}
    >
      {/* Dock door strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {DOCKS.map((d) => {
          const isActive = d.state === "active";
          const isBlocked = d.state === "blocked";
          const dot = isActive ? t.primary : isBlocked ? t.coral : t.mint;
          return (
            <FCard
              key={d.code}
              t={t}
              padding={14}
              accent={isActive}
              style={
                isActive
                  ? { boxShadow: `0 0 16px ${t.primaryGlow}, 0 8px 24px rgba(0,0,0,.4)` }
                  : undefined
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: dot,
                    boxShadow: `0 0 8px ${dot}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 800,
                    color: t.ink,
                    letterSpacing: 0.5,
                  }}
                >
                  {d.code}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  <FPill
                    t={t}
                    tone={isActive ? "primary" : isBlocked ? "coral" : "mint"}
                    size="sm"
                  >
                    {d.state}
                  </FPill>
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: t.muted, lineHeight: 1.4, minHeight: 32 }}>
                {d.current ?? "Open · awaiting truck"}
              </div>
              {d.progress != null && d.progress > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    height: 4,
                    borderRadius: 2,
                    background: t.surfaceAlt,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${d.progress * 100}%`,
                      height: "100%",
                      background: isActive ? t.primary : t.muted,
                      boxShadow: isActive ? `0 0 6px ${t.primaryGlow}` : undefined,
                    }}
                  />
                </div>
              )}
            </FCard>
          );
        })}
      </div>

      <FCard t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1.4fr 110px 110px 60px 70px 1fr 24px",
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
          <div>Supplier</div>
          <div>Status</div>
          <div>Expected</div>
          <div>Lines</div>
          <div>Door</div>
          <div>Progress</div>
          <div />
        </div>
        {ROWS.map((r) => {
          const isReceiving = r.status === "receiving";
          return (
            <Link
              key={r.ref}
              href={`/floor/inbound/${r.ref}` as Route}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1.4fr 110px 110px 60px 70px 1fr 24px",
                gap: 12,
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
                }}
              >
                {r.ref}
              </span>
              <span style={{ fontSize: 13 }}>{r.supplier}</span>
              <span>
                <FPill t={t} tone={inboundTone(r.status)} size="sm">
                  {r.status}
                </FPill>
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.body, fontWeight: 700 }}>
                {r.expected}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12.5, fontWeight: 800, color: t.ink }}>
                {r.lines}
              </span>
              <span>
                {r.door ? (
                  <FPill t={t} tone="primary" size="sm">
                    {r.door}
                  </FPill>
                ) : (
                  <span style={{ color: t.mutedSoft, fontFamily: FONTS.mono, fontSize: 11 }}>—</span>
                )}
              </span>
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
                    width: `${r.progress * 100}%`,
                    height: "100%",
                    background: r.status === "closed" ? t.mint : t.primary,
                    boxShadow: isReceiving ? `0 0 8px ${t.primaryGlow}` : undefined,
                  }}
                />
              </div>
              <span style={{ color: t.mutedSoft, textAlign: "right", fontSize: 14 }}>→</span>
            </Link>
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
        FLOOR MODE PREVIEW · mock data · later phase wires order.inboundList +
        dock.status
      </div>
    </FShell>
  );
}

function inboundTone(s: InStatus): "primary" | "mint" | "sky" | "coral" {
  if (s === "receiving") return "primary";
  if (s === "closed") return "mint";
  if (s === "cancelled") return "coral";
  return "sky";
}
