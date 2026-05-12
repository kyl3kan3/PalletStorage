"use client";

import { useMemo } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS, Cubby } from "~/lib/theme";
import { Ic } from "~/components/icons";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Warehouses grid at /floor/warehouses.
 *
 * Each site card needs aggregate stats (pallet count, today's moves)
 * that warehouse.list alone doesn't return. We pair it with
 * inventory.byPallet (one row per pallet_item per site) and count the
 * distinct pallets per warehouse client-side. Utilization is a rough
 * estimate vs a fixed 10k-pallet capacity until a real capacity field
 * lands on the warehouses table.
 */

const ASSUMED_CAPACITY = 10_000;

export default function FloorWarehousesGrid() {
  const warehouses = trpc.warehouse.list.useQuery();
  // One row per pallet_item across all warehouses, scoped to the org.
  // We only need the warehouseId + palletId, so the byPallet query is
  // a bit wasteful (returns SKU/name/etc too) but it's the procedure
  // that's already available without adding a new one.
  const palletRows = trpc.inventory.byPallet.useQuery({});

  const stats = useMemo(() => {
    const palletsByWh = new Map<string, Set<string>>();
    for (const row of palletRows.data ?? []) {
      if (!row.warehouseId) continue;
      const set = palletsByWh.get(row.warehouseId) ?? new Set<string>();
      set.add(row.palletId);
      palletsByWh.set(row.warehouseId, set);
    }
    return palletsByWh;
  }, [palletRows.data]);

  const loading = warehouses.isLoading || palletRows.isLoading;
  const sites = warehouses.data ?? [];

  return (
    <FShell
      eyebrow="Sites"
      title="Warehouses"
      subtitle={
        loading
          ? "Loading…"
          : `${sites.length} ${sites.length === 1 ? "site" : "sites"}`
      }
      actions={
        <FBtn t={t} variant="primary" size="md" icon={Ic.Plus}>
          Add site
        </FBtn>
      }
    >
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <Skeleton t={t} lines={1} rowHeight={220} />
          <Skeleton t={t} lines={1} rowHeight={220} />
        </div>
      ) : sites.length === 0 ? (
        <FCard t={t} padding={0}>
          <EmptyState
            t={t}
            title="No warehouses yet"
            hint="Add a site to start receiving and shipping pallets. Operators pick which site they're working at on the legacy dashboard."
          />
        </FCard>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {sites.map((s) => {
            const pallets = stats.get(s.id)?.size ?? 0;
            const utilPct = Math.min(100, Math.round((pallets / ASSUMED_CAPACITY) * 100));
            return (
              <SiteCard
                key={s.id}
                code={s.code}
                name={s.name}
                timezone={s.timezone}
                pallets={pallets}
                utilPct={utilPct}
              />
            );
          })}
        </div>
      )}
    </FShell>
  );
}

function SiteCard({
  code,
  name,
  timezone,
  pallets,
  utilPct,
}: {
  code: string;
  name: string;
  timezone: string;
  pallets: number;
  utilPct: number;
}) {
  const utilFrac = utilPct / 100;
  const hot = utilPct > 80;
  const sleepy = utilPct < 50;
  const mood = hot ? "wow" : sleepy ? "sleep" : "happy";

  return (
    <FCard
      t={t}
      padding={20}
      style={hot ? { borderTop: `2px solid ${t.coral}` } : {}}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
        <Cubby size={56} t={t} mood={mood} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 22,
                fontWeight: 800,
                color: t.ink,
                letterSpacing: -0.6,
              }}
            >
              {name}
            </span>
            <FPill t={t} tone={hot ? "coral" : sleepy ? "sky" : "mint"} size="sm">
              {utilPct}% full
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
            <span style={{ fontWeight: 800, color: t.body }}>{code}</span>
            <span>·</span>
            <span>{timezone}</span>
          </div>
        </div>
      </div>

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
          <SiteStat label="Pallets" value={pallets.toLocaleString()} mono />
          <SiteStat
            label="Capacity"
            value={ASSUMED_CAPACITY.toLocaleString()}
            mono
            hint="est"
          />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <FBtn t={t} variant="ghost" size="md" full>
          Open {code}
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
          style={{
            filter: `drop-shadow(0 0 6px ${color === t.coral ? "rgba(255,107,91,.4)" : t.primaryGlow})`,
          }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
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
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
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
        {hint && (
          <span style={{ marginLeft: 6, color: t.muted, fontWeight: 500 }}>· {hint}</span>
        )}
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
