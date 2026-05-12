"use client";

import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill } from "~/components/kit";
import { floorTheme as t, FONTS, Cubby } from "~/lib/theme";
import { Ic } from "~/components/icons";

/**
 * Floor-mode Warehouses preview at /floor/warehouses.
 *
 * 2-column grid of site cards. Each card:
 *   - 56px Cubby (mood reflects utilization — wow >80%, sleep <50%)
 *   - Site name + code + location pin + util pill
 *   - 96px ring chart + 2×2 stats (Pallets / Capacity / Today / Avg dwell)
 *   - Open button
 *   - Hot sites (>80% util) get a coral top-border accent
 *
 * Mock data; later phase wires warehouse.list().
 */

interface Site {
  code: string;
  name: string;
  city: string;
  utilPct: number;
  pallets: number;
  capacity: number;
  todayMoves: number;
  avgDwellDays: number;
}

const SITES: Site[] = [
  { code: "WH-01", name: "Tacoma Distribution", city: "Tacoma · WA", utilPct: 87, pallets: 8420, capacity: 9680, todayMoves: 412, avgDwellDays: 4.2 },
  { code: "WH-02", name: "Portland Hub", city: "Portland · OR", utilPct: 64, pallets: 4318, capacity: 6750, todayMoves: 218, avgDwellDays: 5.8 },
  { code: "WH-03", name: "Sacramento Annex", city: "Sacramento · CA", utilPct: 92, pallets: 5520, capacity: 6000, todayMoves: 296, avgDwellDays: 3.1 },
  { code: "WH-04", name: "Spokane Outpost", city: "Spokane · WA", utilPct: 41, pallets: 1240, capacity: 3000, todayMoves: 64, avgDwellDays: 9.4 },
];

export default function FloorWarehousesGrid() {
  return (
    <FShell
      eyebrow="Sites"
      title="Warehouses"
      subtitle="4 sites · 19,498 stored pallets"
      actions={
        <FBtn t={t} variant="primary" size="md" icon={Ic.Plus}>
          Add site
        </FBtn>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
        }}
      >
        {SITES.map((s) => (
          <SiteCard key={s.code} site={s} />
        ))}
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
        FLOOR MODE PREVIEW · mock data · later phase wires warehouse.list
      </div>
    </FShell>
  );
}

function SiteCard({ site: s }: { site: Site }) {
  const utilFrac = s.utilPct / 100;
  const hot = s.utilPct > 80;
  const sleepy = s.utilPct < 50;
  const mood = hot ? "wow" : sleepy ? "sleep" : "happy";

  return (
    <FCard
      t={t}
      padding={20}
      style={{
        ...(hot ? { borderTop: `2px solid ${t.coral}` } : {}),
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
        <Cubby size={56} t={t} mood={mood} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 22,
                fontWeight: 800,
                color: t.ink,
                letterSpacing: -0.6,
              }}
            >
              {s.name}
            </span>
            <FPill t={t} tone={hot ? "coral" : sleepy ? "sky" : "mint"} size="sm">
              {s.utilPct}% full
            </FPill>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginTop: 6,
              color: t.muted,
              fontFamily: FONTS.mono,
              fontSize: 11,
              letterSpacing: 0.4,
            }}
          >
            <span style={{ fontWeight: 800, color: t.body }}>{s.code}</span>
            <span>·</span>
            <span>{s.city}</span>
          </div>
        </div>
      </div>

      {/* Body: ring + stats */}
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <UtilRing value={utilFrac} hot={hot} />
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <SiteStat label="Pallets" value={s.pallets.toLocaleString()} mono />
          <SiteStat label="Capacity" value={s.capacity.toLocaleString()} mono />
          <SiteStat label="Today" value={`${s.todayMoves} moves`} />
          <SiteStat label="Avg dwell" value={`${s.avgDwellDays.toFixed(1)} d`} mono />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <FBtn t={t} variant="ghost" size="md" full>
          Open {s.code}
        </FBtn>
      </div>
    </FCard>
  );
}

function UtilRing({ value, hot }: { value: number; hot: boolean }) {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * value;
  const color = hot ? t.coral : t.primary;
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
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
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color === t.coral ? "rgba(255,107,91,.4)" : t.primaryGlow})` }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 22,
            fontWeight: 800,
            color: t.ink,
            letterSpacing: -0.5,
            lineHeight: 1,
          }}
        >
          {Math.round(value * 100)}
          <span style={{ fontSize: 11, color: t.muted, marginLeft: 2 }}>%</span>
        </div>
      </div>
    </div>
  );
}

function SiteStat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          color: t.mutedSoft,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: mono ? FONTS.mono : FONTS.sans,
          fontSize: 18,
          fontWeight: 800,
          color: t.ink,
          letterSpacing: mono ? 0.2 : -0.3,
        }}
      >
        {value}
      </div>
    </div>
  );
}
