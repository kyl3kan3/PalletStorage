"use client";

import Link from "next/link";
import type { Route } from "next";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill, KPI, LiveAgo } from "~/components/kit";
import { floorTheme as t, FONTS, Cubby } from "~/lib/theme";
import { Ic } from "~/components/icons";

/**
 * Floor-mode Home preview. Live operations dashboard — what's happening
 * right now.
 *
 * Layout matches the handoff README:
 *   - Hero card (60%) — throughput pill + 44px headline + CTAs + sparkline panel
 *   - Needs-you card (40%) — coral-pinned, 3 urgent items
 *   - KPI row (4 tiles) — Received / Shipped / Dock-to-stock / On-time
 *   - Active waves table (60%) — live picks/receives with progress bars
 *   - Cubby ops card (40%) — mascot + suggested actions
 *
 * Phase 2 ships with mock data (constants below). A later phase wires
 * these to the home.summary / ops.* tRPC queries listed in the
 * handoff README's "tRPC procedures the developer should expect".
 */

// ─── Mock data (replace with home.summary / ops.* queries) ───────────
const KPIS = [
  { label: "Received", value: 284, delta: "+12 today", spark: [40, 55, 35, 60, 70, 55, 80, 95] },
  { label: "Shipped", value: 412, delta: "+38 today", spark: [50, 60, 45, 75, 65, 80, 75, 90] },
  {
    label: "Dock-to-stock",
    value: 47,
    suffix: "min",
    delta: "−6 vs avg",
    deltaTone: "mint" as const,
    spark: [70, 60, 80, 55, 65, 50, 45, 40],
  },
  {
    label: "On-time",
    value: 96,
    suffix: "%",
    delta: "+2pt week",
    spark: [80, 75, 85, 88, 90, 92, 94, 96],
  },
];

const NEEDS_YOU = [
  {
    title: "PO-58812 short-received",
    sub: "18 units missing on 2 lines · ACME Corp",
    icon: Ic.Inbound,
    tint: "coral" as const,
    age: "12 min ago",
    href: "/inbound" as Route,
  },
  {
    title: "CC-204 overdue",
    sub: "Cycle count on A2 zone · assigned 3h ago",
    icon: Ic.Clipboard,
    tint: "sky" as const,
    age: "3 hours ago",
    href: "/inventory" as Route,
  },
  {
    title: "4 invoices ready for QBO",
    sub: "Mar billing · $14,820 total",
    icon: Ic.Dollar,
    tint: "primary" as const,
    age: "today",
    href: "/reports/billing" as Route,
  },
];

const ACTIVE_WAVES = [
  {
    ref: "SO-24881",
    type: "PICK",
    customer: "Northgate Foods",
    progress: 0.59,
    shipBy: "17:00",
    urgent: true,
    crew: ["MR", "KT"],
    lines: "13/22",
  },
  {
    ref: "PO-58901",
    type: "RECV",
    customer: "Pacific Supply",
    progress: 0.4,
    shipBy: "—",
    urgent: false,
    crew: ["JN"],
    lines: "2/5",
  },
  {
    ref: "SO-24882",
    type: "PICK",
    customer: "Westcoast Mart",
    progress: 0.85,
    shipBy: "16:30",
    urgent: false,
    crew: ["AS", "MR"],
    lines: "17/20",
  },
  {
    ref: "PO-58910",
    type: "RECV",
    customer: "Atlas Distribution",
    progress: 0.2,
    shipBy: "—",
    urgent: false,
    crew: ["—"],
    lines: "1/5",
  },
];

const HOURLY_SPARK = [38, 45, 58, 70, 62, 75, 88, 95, 78, 72, 65, 50];

// ─── Page ──────────────────────────────────────────────────
export default function FloorHomePreview() {
  return (
    <FShell
      active="home"
      eyebrow="Today's operations"
      title="42 picks in flight, 2 trucks at the dock."
      subtitle={<LiveAgo t={t} />}
      actions={
        <>
          <FBtn t={t} variant="ghost" size="md">
            Open shift report
          </FBtn>
          <FBtn t={t} variant="primary" size="md" icon={Ic.Check}>
            Today&apos;s plan
          </FBtn>
        </>
      }
    >
      {/* ─── Row 1: Hero + Needs you ───────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <FCard t={t} padding={24}>
          <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <FPill t={t} tone="primary">
                THROUGHPUT · AHEAD OF PACE
              </FPill>
              <h2
                style={{
                  margin: "14px 0 8px",
                  fontFamily: FONTS.sans,
                  fontSize: 32,
                  fontWeight: 800,
                  color: t.ink,
                  letterSpacing: -1.2,
                  lineHeight: 1.05,
                }}
              >
                Up <span style={{ color: t.primary }}>18%</span> against
                yesterday&apos;s hourly pace.
              </h2>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: t.body,
                  maxWidth: 420,
                }}
              >
                Peak hour was 14:00 with 56 picks confirmed. Two trucks
                inbound at Dock D-02 with 38 expected pallets between
                them.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <FBtn t={t} variant="primary" size="md">
                  Open shift plan
                </FBtn>
                <FBtn t={t} variant="ghost" size="md">
                  Today&apos;s report
                </FBtn>
              </div>
            </div>
            {/* Sparkline panel */}
            <div
              style={{
                width: 180,
                padding: "14px 16px",
                background: t.surfaceAlt,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  color: t.muted,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Last 8 hours
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 4,
                  flex: 1,
                  minHeight: 80,
                }}
              >
                {HOURLY_SPARK.map((h, i) => {
                  const isPeak = h === Math.max(...HOURLY_SPARK);
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${h}%`,
                        background: isPeak ? t.primary : "rgba(255,255,255,.16)",
                        borderRadius: 2,
                        boxShadow: isPeak ? `0 0 12px ${t.primaryGlow}` : undefined,
                      }}
                    />
                  );
                })}
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10.5,
                  color: t.muted,
                }}
              >
                Peak 14:00 · 56 picks
              </div>
            </div>
          </div>
        </FCard>

        {/* Needs you card */}
        <FCard t={t} padding={20} accent>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <FPill t={t} tone="coral">
              NEEDS YOU · {NEEDS_YOU.length}
            </FPill>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {NEEDS_YOU.map((n) => (
              <Link
                key={n.title}
                href={n.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 10,
                  borderRadius: 10,
                  background: t.surfaceAlt,
                  border: `1px solid ${t.border}`,
                  textDecoration: "none",
                  color: t.body,
                }}
              >
                <NeedsIcon icon={n.icon} tint={n.tint} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: t.ink,
                      fontSize: 13.5,
                      fontWeight: 700,
                      letterSpacing: -0.1,
                    }}
                  >
                    {n.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: t.muted,
                      marginTop: 2,
                    }}
                  >
                    {n.sub}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    color: t.mutedSoft,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.age}
                </div>
              </Link>
            ))}
          </div>
        </FCard>
      </div>

      {/* ─── Row 2: KPI row ─────────────────────────────────────── */}
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
            suffix={k.suffix}
            delta={k.delta}
            deltaTone={k.deltaTone}
            spark={k.spark}
          />
        ))}
      </div>

      {/* ─── Row 3: Active waves + Cubby ops ─────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
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
              Active waves
            </div>
            <FPill t={t} tone="mint" size="sm">
              ● LIVE
            </FPill>
          </div>
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 60px 1fr 70px 80px 60px",
              gap: 12,
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
            <div>Ref</div>
            <div>Customer</div>
            <div>Type</div>
            <div>Progress</div>
            <div>Lines</div>
            <div>Ship by</div>
            <div>Crew</div>
          </div>
          {ACTIVE_WAVES.map((w) => (
            <div
              key={w.ref}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr 60px 1fr 70px 80px 60px",
                gap: 12,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1px dashed ${t.border}`,
                background: w.urgent ? "rgba(255,107,91,.06)" : undefined,
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
                {w.ref}
              </span>
              <span style={{ fontSize: 13, color: t.body }}>{w.customer}</span>
              <span>
                <FPill t={t} tone={w.type === "PICK" ? "primary" : "sky"} size="sm">
                  {w.type}
                </FPill>
              </span>
              <ProgressBar value={w.progress} urgent={w.urgent} />
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  color: t.body,
                  fontWeight: 700,
                }}
              >
                {w.lines}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: w.urgent ? t.coral : t.body,
                }}
              >
                {w.shipBy}
              </span>
              <div style={{ display: "flex", gap: 2 }}>
                {w.crew.map((c, i) => (
                  <CrewChip key={i} initials={c} />
                ))}
              </div>
            </div>
          ))}
        </FCard>

        {/* Cubby ops card */}
        <FCard t={t} padding={20}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Cubby size={56} t={t} mood="think" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <FPill t={t} tone="primary">
                Cubby suggests
              </FPill>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: t.body,
                }}
              >
                A2 zone is{" "}
                <strong style={{ color: t.ink }}>87% full</strong>. Schedule a
                cycle count before the C-1 truck arrives at 16:00.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <FBtn t={t} variant="ghost" size="md" full icon={Ic.Clipboard}>
              Schedule cycle count for A2
            </FBtn>
            <FBtn t={t} variant="ghost" size="md" full icon={Ic.Inbound}>
              Divert C-1 truck to WH-02
            </FBtn>
          </div>
        </FCard>
      </div>

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
        FLOOR MODE PREVIEW · all numbers are mock data · later phase wires
        home.summary / ops.* tRPC queries
      </div>
    </FShell>
  );
}

// ─── Bits ──────────────────────────────────────────────────

function NeedsIcon({
  icon,
  tint,
}: {
  icon: typeof Ic.Inbound;
  tint: "primary" | "coral" | "sky" | "mint";
}) {
  const map = {
    primary: { bg: t.primarySoft, fg: t.primary },
    coral: { bg: t.coralSoft, fg: t.coral },
    sky: { bg: t.skySoft, fg: t.sky },
    mint: { bg: t.mintSoft, fg: t.mint },
  };
  const m = map[tint];
  const I = icon;
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: m.bg,
        color: m.fg,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <I size={18} />
    </div>
  );
}

function ProgressBar({ value, urgent }: { value: number; urgent?: boolean }) {
  const pct = Math.max(0, Math.min(1, value));
  const fill = urgent ? t.coral : t.primary;
  const glow = urgent ? "rgba(255,107,91,.5)" : t.primaryGlow;
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
          background: fill,
          borderRadius: 3,
          boxShadow: pct > 0.5 ? `0 0 8px ${glow}` : undefined,
        }}
      />
    </div>
  );
}

function CrewChip({ initials }: { initials: string }) {
  if (initials === "—") {
    return (
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          color: t.mutedSoft,
        }}
      >
        —
      </span>
    );
  }
  return (
    <div
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
      {initials}
    </div>
  );
}
