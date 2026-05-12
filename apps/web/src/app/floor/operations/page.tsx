"use client";

import { useState } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill, KPI } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { Ic } from "~/components/icons";

/**
 * Floor-mode Operations preview at /floor/operations.
 *
 * Rolled-up KPIs + ledger for the manager. Layout from the handoff:
 *   - KPI row (4): Pallets stored / Open inbound / Picking / Moves 24h
 *   - Throughput chart (66%): 12-hour in/out bars, current hour glows
 *   - Dock-to-stock ring (33%): SVG ring + p50 / p95 / Δ-week stacked
 *   - Top stock table (55%): top SKUs by on-hand
 *   - Movement ledger (45%): live activity feed with colored dots
 *
 * Mock data only; later phase wires ops.kpis / ops.throughput /
 * ops.dockToStock / ops.topStock / movement.recent.
 */

// 12 hourly buckets, [inCount, outCount] per hour. Current hour is the
// last entry (index 11).
const HOURS: Array<{ hour: string; inCount: number; outCount: number }> = [
  { hour: "06", inCount: 8, outCount: 5 },
  { hour: "07", inCount: 12, outCount: 9 },
  { hour: "08", inCount: 18, outCount: 14 },
  { hour: "09", inCount: 22, outCount: 19 },
  { hour: "10", inCount: 28, outCount: 24 },
  { hour: "11", inCount: 31, outCount: 26 },
  { hour: "12", inCount: 24, outCount: 30 },
  { hour: "13", inCount: 26, outCount: 32 },
  { hour: "14", inCount: 30, outCount: 38 },
  { hour: "15", inCount: 22, outCount: 34 },
  { hour: "16", inCount: 18, outCount: 28 },
  { hour: "17", inCount: 12, outCount: 22 },
];

const KPIS = [
  { label: "Pallets stored", value: "8,420", delta: "+126 wk", spark: [55, 60, 58, 65, 62, 70, 72, 78] },
  { label: "Open inbound", value: 14, delta: "−3 today", deltaTone: "mint" as const, spark: [60, 70, 65, 75, 60, 55, 50, 40] },
  { label: "Picking", value: 12, delta: "+4 hr", spark: [40, 45, 50, 55, 60, 70, 75, 80] },
  { label: "Moves / 24h", value: 1284, delta: "+9%", spark: [50, 55, 60, 65, 70, 75, 82, 90] },
];

const TOP_STOCK = [
  { sku: "SKU-00041", name: "Vanilla Extract 8oz", pallets: 24, onHand: "2,880 ea" },
  { sku: "SKU-00102", name: "Cane Sugar 50lb", pallets: 18, onHand: "1,440 cs" },
  { sku: "SKU-00038", name: "Coffee Beans 5lb", pallets: 15, onHand: "1,200 cs" },
  { sku: "SKU-00211", name: "Whole Tomatoes #10", pallets: 12, onHand: "1,008 cs" },
];

const LEDGER = [
  { reason: "PICK", color: "primary", text: "MR picked 12 ea of Vanilla 8oz for SO-24881", ago: "00:42" },
  { reason: "RECV", color: "sky", text: "JN received pallet P-9QK4X72L · 40 cs Sugar", ago: "01:08" },
  { reason: "PUTAWAY", color: "lilac", text: "AS putaway P-7H82MR3K → A2-04-B", ago: "02:15" },
  { reason: "ADJUST", color: "coral", text: "KT adjusted P-3MN91X22 qty 24 → 22", ago: "03:50" },
  { reason: "SHIP", color: "mint", text: "Truck departed Dock D-02 · SO-24879 closed", ago: "06:12" },
  { reason: "PICK", color: "primary", text: "AS picked 4 cs of Coffee Beans for SO-24882", ago: "07:55" },
  { reason: "RECV", color: "sky", text: "JN received pallet P-2L4Z88PR · 36 cs Tomatoes", ago: "09:30" },
] as const;

export default function FloorOperationsPreview() {
  const [tab, setTab] = useState<"in" | "out" | "both">("both");
  const maxBar = Math.max(...HOURS.flatMap((h) => [h.inCount, h.outCount]));

  return (
    <FShell
      active="operations"
      eyebrow="Live operations"
      title="Operations"
      subtitle="WH-01 · TACOMA · updated 4s ago"
    >
      {/* ─── KPI row ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 16,
        }}
      >
        {KPIS.map((k) => (
          <KPI
            key={k.label}
            t={t}
            label={k.label}
            value={k.value}
            delta={k.delta}
            deltaTone={k.deltaTone}
            spark={k.spark}
          />
        ))}
      </div>

      {/* ─── Throughput chart + Dock-to-stock ring ────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <FCard t={t} padding={20}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 16,
                  fontWeight: 800,
                  color: t.ink,
                  letterSpacing: -0.3,
                }}
              >
                Throughput · last 12 hours
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10.5,
                  color: t.mutedSoft,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                In / Out movements grouped by hour
              </div>
            </div>
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                padding: 4,
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
              }}
            >
              {(["in", "out", "both"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  style={{
                    padding: "5px 10px",
                    fontFamily: FONTS.mono,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    background: tab === k ? t.primary : "transparent",
                    color: tab === k ? t.primaryText : t.muted,
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {k === "both" ? "Both" : k === "in" ? "In" : "Out"}
                </button>
              ))}
            </div>
          </div>

          {/* Bar chart */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 200 }}>
            {HOURS.map((h, i) => {
              const isCurrent = i === HOURS.length - 1;
              const inH = (h.inCount / maxBar) * 100;
              const outH = (h.outCount / maxBar) * 100;
              const showIn = tab !== "out";
              const showOut = tab !== "in";
              return (
                <div
                  key={h.hour}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 2,
                      alignItems: "flex-end",
                      width: "100%",
                      height: 170,
                      justifyContent: "center",
                    }}
                  >
                    {showIn && (
                      <div
                        style={{
                          width: 10,
                          height: `${inH}%`,
                          background: isCurrent ? t.primary : "rgba(123,180,232,.7)",
                          borderRadius: 2,
                          boxShadow: isCurrent ? `0 0 12px ${t.primaryGlow}` : undefined,
                        }}
                      />
                    )}
                    {showOut && (
                      <div
                        style={{
                          width: 10,
                          height: `${outH}%`,
                          background: isCurrent ? t.primary : "rgba(127,216,168,.7)",
                          borderRadius: 2,
                          boxShadow: isCurrent ? `0 0 12px ${t.primaryGlow}` : undefined,
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 10,
                      color: isCurrent ? t.primary : t.mutedSoft,
                      fontWeight: isCurrent ? 800 : 500,
                      letterSpacing: 0.4,
                    }}
                  >
                    {h.hour}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 18,
              marginTop: 12,
              fontFamily: FONTS.mono,
              fontSize: 10.5,
              color: t.muted,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "rgba(123,180,232,.7)",
                  borderRadius: 2,
                }}
              />
              In
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "rgba(127,216,168,.7)",
                  borderRadius: 2,
                }}
              />
              Out
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: t.primary,
                  borderRadius: 2,
                  boxShadow: `0 0 6px ${t.primaryGlow}`,
                }}
              />
              Current hour
            </span>
          </div>
        </FCard>

        {/* Dock-to-stock ring */}
        <FCard t={t} padding={20}>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 16,
              fontWeight: 800,
              color: t.ink,
              letterSpacing: -0.3,
              marginBottom: 4,
            }}
          >
            Dock-to-stock
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10.5,
              color: t.mutedSoft,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Last 7 days
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <DockToStockRing value={0.78} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <RingStat label="P50" value="38 min" />
              <RingStat label="P95" value="92 min" />
              <RingStat label="Δ week" value="−6 min" delta="mint" />
            </div>
          </div>
        </FCard>
      </div>

      {/* ─── Top stock + Ledger ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <FCard t={t} padding={0}>
          <div
            style={{
              padding: "16px 20px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 16,
                fontWeight: 800,
                color: t.ink,
                letterSpacing: -0.3,
              }}
            >
              Top stock on hand
            </div>
            <FBtn t={t} variant="ghost" size="sm">
              See all
            </FBtn>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 80px 120px",
              gap: 14,
              padding: "10px 20px",
              fontFamily: FONTS.mono,
              fontSize: 10,
              fontWeight: 700,
              color: t.muted,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              borderTop: `1px solid ${t.border}`,
            }}
          >
            <div>SKU</div>
            <div>Name</div>
            <div>Pallets</div>
            <div style={{ textAlign: "right" }}>On hand</div>
          </div>
          {TOP_STOCK.map((s) => (
            <div
              key={s.sku}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr 80px 120px",
                gap: 14,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1px dashed ${t.border}`,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: 0.2,
                }}
              >
                {s.sku}
              </span>
              <span style={{ fontSize: 13, color: t.body }}>{s.name}</span>
              <span>
                <FPill t={t} tone="neutral" size="sm">
                  {s.pallets}
                </FPill>
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 14,
                  fontWeight: 800,
                  color: t.ink,
                  letterSpacing: -0.4,
                  textAlign: "right",
                }}
              >
                {s.onHand}
              </span>
            </div>
          ))}
        </FCard>

        {/* Movement ledger */}
        <FCard t={t} padding={0}>
          <div
            style={{
              padding: "16px 20px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 16,
                fontWeight: 800,
                color: t.ink,
                letterSpacing: -0.3,
              }}
            >
              Movement ledger
            </div>
            <FPill t={t} tone="mint" size="sm">
              ● LIVE
            </FPill>
          </div>
          <div>
            {LEDGER.map((row, i) => {
              const dot =
                row.color === "primary" ? t.primary :
                row.color === "sky" ? t.sky :
                row.color === "mint" ? t.mint :
                row.color === "coral" ? t.coral :
                row.color === "lilac" ? t.lilac :
                t.muted;
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "16px 70px 1fr 60px",
                    gap: 10,
                    padding: "10px 20px",
                    alignItems: "center",
                    borderTop: `1px dashed ${t.border}`,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: dot,
                      boxShadow: `0 0 6px ${dot}`,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 9.5,
                      fontWeight: 800,
                      color: t.muted,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {row.reason}
                  </span>
                  <span style={{ fontSize: 12.5, color: t.body, lineHeight: 1.4 }}>
                    {row.text}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 10.5,
                      color: t.mutedSoft,
                      letterSpacing: 0.3,
                      textAlign: "right",
                    }}
                  >
                    {row.ago}
                  </span>
                </div>
              );
            })}
          </div>
        </FCard>
      </div>

      <PreviewBanner />
    </FShell>
  );
}

// ─── Bits ──────────────────────────────────────────────────

function DockToStockRing({ value }: { value: number }) {
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * value;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={t.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: `drop-shadow(0 0 8px ${t.primaryGlow})` }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 32,
            fontWeight: 800,
            color: t.ink,
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          {Math.round(value * 100)}
          <span style={{ fontSize: 16, color: t.muted, marginLeft: 2 }}>%</span>
        </div>
      </div>
    </div>
  );
}

function RingStat({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: "mint" | "coral";
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          fontWeight: 700,
          color: t.mutedSoft,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 18,
          fontWeight: 800,
          color: delta ? (delta === "mint" ? t.mint : t.coral) : t.ink,
          letterSpacing: -0.4,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PreviewBanner() {
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
      FLOOR MODE PREVIEW · mock data · later phase wires ops.* tRPC queries
    </div>
  );
}
