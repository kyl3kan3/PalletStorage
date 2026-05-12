"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill, KPI, LiveAgo, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS, Cubby } from "~/lib/theme";
import { Ic } from "~/components/icons";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Home at /floor. Aggregates several queries into the
 * dashboard the manager opens first thing in the morning:
 *
 *   - KPI row → report.summary (stored pallets / open inbound /
 *     picking / moves 24h)
 *   - Active waves table → outbound.list filtered to picking + packed
 *     and inbound.list filtered to receiving
 *   - Needs-you list → composed from short orders + overdue counts
 *   - Throughput sparkline → report.throughput (last 8 days)
 *
 * All queries refetch every 30s so the page stays close to live.
 */

export default function FloorHomePreview() {
  const summary = trpc.report.summary.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const outbounds = trpc.outbound.list.useQuery({}, { refetchInterval: 30_000 });
  const inbounds = trpc.inbound.list.useQuery({}, { refetchInterval: 30_000 });
  const counts = trpc.cycleCount.listOpen.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const throughput = trpc.report.throughput.useQuery(
    { days: 8 },
    { refetchInterval: 30_000 },
  );

  // ─── Derived ──────────────────────────────────────────────────────
  const activeWaves = useMemo(() => {
    const out = (outbounds.data ?? [])
      .filter((o) => o.status === "picking" || o.status === "packed")
      .map((o) => ({
        kind: "PICK" as const,
        ref: o.reference,
        id: o.id,
        customer: o.customer ?? "—",
        shipBy: o.shipBy ? new Date(o.shipBy) : null,
        href: `/floor/outbound/${o.id}`,
      }));
    const inb = (inbounds.data ?? [])
      .filter((o) => o.status === "receiving")
      .map((o) => ({
        kind: "RECV" as const,
        ref: o.reference,
        id: o.id,
        customer: o.supplier ?? "—",
        shipBy: o.expectedAt ? new Date(o.expectedAt) : null,
        href: `/floor/inbound/${o.id}`,
      }));
    // Sort outbound by shipBy ascending (urgent first), then inbound.
    return [...out, ...inb]
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "PICK" ? -1 : 1;
        const aT = a.shipBy?.getTime() ?? Infinity;
        const bT = b.shipBy?.getTime() ?? Infinity;
        return aT - bT;
      })
      .slice(0, 6);
  }, [outbounds.data, inbounds.data]);

  const needsYou = useMemo(() => {
    const list: Array<{
      title: string;
      sub: string;
      tint: "primary" | "coral" | "sky" | "mint";
      href: Route;
      icon: (typeof Ic)[keyof typeof Ic];
    }> = [];
    // Overdue cycle counts.
    const overdueCC = (counts.data ?? []).filter(
      (c) =>
        c.dueAt &&
        (c.status === "open" || c.status === "counting") &&
        new Date(c.dueAt) < new Date(),
    );
    if (overdueCC.length > 0) {
      list.push({
        title: `${overdueCC.length} cycle count${overdueCC.length > 1 ? "s" : ""} overdue`,
        sub: "Zones missed their due date — assign or extend.",
        tint: "coral",
        href: "/floor/counts" as Route,
        icon: Ic.Clipboard,
      });
    }
    // Inbound orders awaiting review (no expected date but open > 7d).
    const staleInbound = (inbounds.data ?? []).filter(
      (o) =>
        o.status === "open" &&
        new Date(o.createdAt).getTime() < Date.now() - 7 * 24 * 3600 * 1000,
    );
    if (staleInbound.length > 0) {
      list.push({
        title: `${staleInbound.length} stale inbound order${staleInbound.length > 1 ? "s" : ""}`,
        sub: "Open more than a week — confirm or close.",
        tint: "sky",
        href: "/floor/inbound" as Route,
        icon: Ic.Inbound,
      });
    }
    // Packed orders ready to ship.
    const packed = (outbounds.data ?? []).filter((o) => o.status === "packed");
    if (packed.length > 0) {
      list.push({
        title: `${packed.length} order${packed.length > 1 ? "s" : ""} ready to ship`,
        sub: "Packed and staged. Hit Ship to close out.",
        tint: "mint",
        href: "/floor/outbound" as Route,
        icon: Ic.Outbound,
      });
    }
    return list;
  }, [counts.data, inbounds.data, outbounds.data]);

  // Throughput sparkline: pick + ship per day (last 8), normalized.
  const hourlySpark = useMemo(() => {
    const rows = throughput.data ?? [];
    const totalsByDay = new Map<string, number>();
    for (const r of rows) {
      const day = String(r.day ?? "").slice(0, 10);
      const n = Number(r.n ?? 0);
      totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + n);
    }
    const sorted = Array.from(totalsByDay.values());
    const max = Math.max(1, ...sorted);
    return sorted.map((n) => Math.round((n / max) * 100));
  }, [throughput.data]);

  const peakHour = useMemo(() => {
    return Math.max(0, ...hourlySpark);
  }, [hourlySpark]);

  const headline = useMemo(() => {
    if (summary.isLoading) return "Loading the floor…";
    const picking = summary.data?.outboundPicking ?? 0;
    const receiving = (inbounds.data ?? []).filter((o) => o.status === "receiving")
      .length;
    if (picking === 0 && receiving === 0) {
      return "Quiet shift — nothing in flight.";
    }
    const bits: string[] = [];
    if (picking > 0)
      bits.push(`${picking} pick${picking !== 1 ? "s" : ""} in flight`);
    if (receiving > 0)
      bits.push(`${receiving} truck${receiving !== 1 ? "s" : ""} at the dock`);
    return bits.join(", ") + ".";
  }, [summary.isLoading, summary.data, inbounds.data]);

  return (
    <FShell
      active="home"
      eyebrow="Today's operations"
      title={headline}
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
      {/* Row 1: Hero + Needs you */}
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
                THROUGHPUT · LAST 8 DAYS
              </FPill>
              <h2
                style={{
                  margin: "14px 0 8px",
                  fontFamily: FONTS.sans,
                  fontSize: 28,
                  fontWeight: 800,
                  color: t.ink,
                  letterSpacing: -1.2,
                  lineHeight: 1.1,
                }}
              >
                {summary.data?.movements24h ?? "—"} moves in the last 24 hours.
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
                {summary.data
                  ? `${summary.data.storedPallets.toLocaleString()} pallets stored · ${summary.data.openInbound} open inbound · ${summary.data.outboundPicking} picking.`
                  : "Loading…"}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <Link
                  href={"/floor/operations" as Route}
                  style={{ textDecoration: "none" }}
                >
                  <FBtn t={t} variant="primary" size="md">
                    Open operations
                  </FBtn>
                </Link>
                <Link
                  href={"/floor/outbound" as Route}
                  style={{ textDecoration: "none" }}
                >
                  <FBtn t={t} variant="ghost" size="md">
                    See orders
                  </FBtn>
                </Link>
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
                Last 8 days
              </div>
              {throughput.isLoading ? (
                <Skeleton t={t} lines={1} rowHeight={80} />
              ) : hourlySpark.length === 0 ? (
                <div style={{ fontSize: 11, color: t.mutedSoft, padding: "20px 0" }}>
                  No movements
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 4,
                    flex: 1,
                    minHeight: 80,
                  }}
                >
                  {hourlySpark.map((h, i) => {
                    const isPeak = h === peakHour;
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
              )}
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10.5,
                  color: t.muted,
                }}
              >
                Daily totals
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
              NEEDS YOU · {needsYou.length}
            </FPill>
          </div>
          {needsYou.length === 0 ? (
            <div
              style={{
                padding: "20px 0",
                fontSize: 13,
                color: t.muted,
                lineHeight: 1.5,
              }}
            >
              Nothing on fire. Inbound, outbound, and cycle counts are all on
              track.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {needsYou.map((n, i) => (
                <Link
                  key={i}
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
                </Link>
              ))}
            </div>
          )}
        </FCard>
      </div>

      {/* Row 2: KPI row */}
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

      {/* Row 3: Active waves + Cubby ops */}
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "130px 1fr 70px 110px 24px",
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
            <div>Customer / Supplier</div>
            <div>Type</div>
            <div>Ship / Exp.</div>
            <div />
          </div>
          {outbounds.isLoading || inbounds.isLoading ? (
            <div style={{ padding: 20 }}>
              <Skeleton t={t} lines={4} rowHeight={36} />
            </div>
          ) : activeWaves.length === 0 ? (
            <EmptyState t={t} title="Nothing in flight" />
          ) : (
            activeWaves.map((w) => {
              const urgent =
                w.kind === "PICK" &&
                w.shipBy != null &&
                w.shipBy.getTime() - Date.now() < 4 * 3600 * 1000;
              return (
                <Link
                  key={`${w.kind}-${w.id}`}
                  href={w.href as Route}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr 70px 110px 24px",
                    gap: 12,
                    padding: "12px 20px",
                    alignItems: "center",
                    borderTop: `1px dashed ${t.border}`,
                    background: urgent ? "rgba(255,107,91,.06)" : undefined,
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
                    {w.ref}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: t.body,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {w.customer}
                  </span>
                  <span>
                    <FPill
                      t={t}
                      tone={w.kind === "PICK" ? "primary" : "sky"}
                      size="sm"
                    >
                      {w.kind}
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
                    {w.shipBy
                      ? w.shipBy.toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                  <span style={{ color: t.mutedSoft, textAlign: "right", fontSize: 14 }}>
                    →
                  </span>
                </Link>
              );
            })
          )}
        </FCard>

        {/* Cubby ops card */}
        <FCard t={t} padding={20}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Cubby
              size={56}
              t={t}
              mood={activeWaves.length === 0 ? "sleep" : "think"}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <FPill t={t} tone="primary">
                Cubby
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
                {needsYou.length === 0 && activeWaves.length === 0
                  ? "Quiet floor. Good time for cycle counts."
                  : `Watch the ${activeWaves[0]?.ref ?? "queue"} — ${
                      needsYou[0]?.title.toLowerCase() ?? "all good"
                    }.`}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 16,
            }}
          >
            <Link
              href={"/floor/counts" as Route}
              style={{ textDecoration: "none" }}
            >
              <FBtn t={t} variant="ghost" size="md" full icon={Ic.Clipboard}>
                Open cycle counts
              </FBtn>
            </Link>
            <Link
              href={"/floor/inventory" as Route}
              style={{ textDecoration: "none" }}
            >
              <FBtn t={t} variant="ghost" size="md" full icon={Ic.Scan}>
                Look up a pallet
              </FBtn>
            </Link>
          </div>
        </FCard>
      </div>
    </FShell>
  );
}

function NeedsIcon({
  icon,
  tint,
}: {
  icon: (typeof Ic)[keyof typeof Ic];
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
