"use client";

import { useMemo, useState } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill, KPI, LiveAgo, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Operations dashboard at /floor/operations. Wires:
 *   - KPI row → report.summary
 *   - Throughput chart → report.throughput (movements grouped by day)
 *   - Dock-to-stock ring → report.dockToStock
 *   - Top stock → report.stockOnHand
 *   - Movement ledger → movement.recent
 *
 * All queries refetch every 30s so the dashboard stays close to live.
 */

export default function FloorOperationsPreview() {
  const [tab, setTab] = useState<"in" | "out" | "both">("both");

  const summary = trpc.report.summary.useQuery(undefined, { refetchInterval: 30_000 });
  const throughput = trpc.report.throughput.useQuery(
    { days: 12 },
    { refetchInterval: 30_000 },
  );
  const dockToStock = trpc.report.dockToStock.useQuery(
    { days: 7 },
    { refetchInterval: 30_000 },
  );
  const topStock = trpc.report.stockOnHand.useQuery(
    { limit: 4 },
    { refetchInterval: 30_000 },
  );
  const ledger = trpc.movement.recent.useQuery(
    { limit: 7 },
    { refetchInterval: 30_000 },
  );

  // Throughput rows come back as { day, reason, n } per day-reason combo.
  // Bucket into hours-ish (we got days back since that's what throughput
  // currently aggregates) and split in/out for the chart.
  const chart = useMemo(() => {
    const rows = throughput.data ?? [];
    const byDay = new Map<string, { in: number; out: number }>();
    for (const r of rows) {
      const day = String(r.day ?? "").slice(0, 10);
      const reason = String(r.reason ?? "");
      const n = Number(r.n ?? 0);
      const slot = byDay.get(day) ?? { in: 0, out: 0 };
      if (reason === "receive") slot.in += n;
      else if (reason === "ship" || reason === "pick") slot.out += n;
      byDay.set(day, slot);
    }
    // Last 12 days, oldest first.
    const sorted = Array.from(byDay.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    return sorted.map(([day, v]) => ({ label: day.slice(5), ...v }));
  }, [throughput.data]);

  const maxBar = useMemo(
    () => Math.max(1, ...chart.flatMap((c) => [c.in, c.out])),
    [chart],
  );

  return (
    <FShell
      eyebrow="Live operations"
      title="Operations"
      subtitle={
        <span>
          Live · <LiveAgo t={t} prefix="updated" />
        </span>
      }
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
        {summary.isLoading || !summary.data ? (
          <>
            <Skeleton t={t} lines={1} rowHeight={120} />
            <Skeleton t={t} lines={1} rowHeight={120} />
            <Skeleton t={t} lines={1} rowHeight={120} />
            <Skeleton t={t} lines={1} rowHeight={120} />
          </>
        ) : (
          <>
            <KPI
              t={t}
              label="Pallets stored"
              value={summary.data.storedPallets.toLocaleString()}
            />
            <KPI t={t} label="Open inbound" value={summary.data.openInbound} />
            <KPI t={t} label="Picking" value={summary.data.outboundPicking} />
            <KPI t={t} label="Moves / 24h" value={summary.data.movements24h} />
          </>
        )}
      </div>

      {/* Throughput chart + Dock-to-stock ring */}
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
                Throughput · last 12 days
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
                Receives vs picks/ships
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

          {throughput.isLoading ? (
            <Skeleton t={t} lines={1} rowHeight={200} />
          ) : chart.length === 0 ? (
            <EmptyState t={t} title="No movements in the last 12 days" />
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 200 }}>
              {chart.map((c, i) => {
                const isCurrent = i === chart.length - 1;
                const inH = (c.in / maxBar) * 100;
                const outH = (c.out / maxBar) * 100;
                const showIn = tab !== "out";
                const showOut = tab !== "in";
                return (
                  <div
                    key={c.label}
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
                      {c.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
          {dockToStock.isLoading || !dockToStock.data ? (
            <Skeleton t={t} lines={1} rowHeight={140} />
          ) : dockToStock.data.n === 0 ? (
            <EmptyState
              t={t}
              title="No matched receives"
              hint="Need at least one pallet received + putaway in the last 7 days."
            />
          ) : (
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <DockToStockRing value={dockToStock.data.avg_seconds} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  flex: 1,
                }}
              >
                <RingStat
                  label="P50"
                  value={fmtSeconds(dockToStock.data.p50_seconds)}
                />
                <RingStat
                  label="P95"
                  value={fmtSeconds(dockToStock.data.p95_seconds)}
                />
                <RingStat label="N pallets" value={String(dockToStock.data.n)} />
              </div>
            </div>
          )}
        </FCard>
      </div>

      {/* Top stock + Ledger */}
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
          {topStock.isLoading ? (
            <div style={{ padding: 20 }}>
              <Skeleton t={t} lines={4} rowHeight={36} />
            </div>
          ) : (topStock.data ?? []).length === 0 ? (
            <EmptyState t={t} title="No stored stock" />
          ) : (
            (topStock.data ?? []).map((s) => (
              <div
                key={s.productId}
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
                  }}
                >
                  {s.sku ?? "—"}
                </span>
                <span style={{ fontSize: 13, color: t.body }}>{s.name}</span>
                <span>
                  <FPill t={t} tone="neutral" size="sm">
                    {String(s.palletCount)}
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
                  {s.qty.toLocaleString()}
                </span>
              </div>
            ))
          )}
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
          {ledger.isLoading ? (
            <div style={{ padding: 20 }}>
              <Skeleton t={t} lines={5} rowHeight={36} />
            </div>
          ) : (ledger.data ?? []).length === 0 ? (
            <EmptyState t={t} title="No recent movements" />
          ) : (
            (ledger.data ?? []).map((row) => {
              const dot = ledgerColor(row.reason);
              return (
                <div
                  key={row.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "16px 80px 1fr 70px",
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
                  <span
                    style={{
                      fontSize: 12.5,
                      color: t.body,
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.notes ??
                      `Pallet ${row.palletId?.slice(0, 8) ?? "—"}`}
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
                    {formatAgo(new Date(row.createdAt))}
                  </span>
                </div>
              );
            })
          )}
        </FCard>
      </div>
    </FShell>
  );
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function ledgerColor(reason: string): string {
  if (reason === "pick") return t.primary;
  if (reason === "receive") return t.sky;
  if (reason === "putaway") return t.lilac;
  if (reason === "adjust") return t.coral;
  if (reason === "ship") return t.mint;
  return t.muted;
}

function DockToStockRing({ value }: { value: number }) {
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Cap at 8h for the ring (most warehouses target ≤ 60min)
  const TARGET_HOURS = 8;
  const frac = Math.min(1, value / (TARGET_HOURS * 3600));
  const dash = c * (1 - frac); // shorter dash = faster (better)
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
        style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 22,
            fontWeight: 800,
            color: t.ink,
            letterSpacing: -0.5,
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {fmtSeconds(value)}
          <div style={{ fontSize: 9, color: t.muted, marginTop: 4 }}>AVG</div>
        </div>
      </div>
    </div>
  );
}

function RingStat({ label, value }: { label: string; value: string }) {
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
          color: t.ink,
          letterSpacing: -0.4,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
