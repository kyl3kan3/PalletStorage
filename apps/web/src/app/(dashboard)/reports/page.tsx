"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Ring, StatBig, Tabs, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { formatDuration, movementReasonTone } from "~/lib/statusTone";

export default function ReportsPage() {
  const t = theme;
  const [tab, setTab] = useState("week");
  const summary = trpc.report.summary.useQuery();
  const soh = trpc.report.stockOnHand.useQuery({ limit: 20 });
  const dts = trpc.report.dockToStock.useQuery({ days: 30 });
  const movements = trpc.movement.recent.useQuery({ limit: 50 });
  const throughput = trpc.report.throughput.useQuery({ days: 14 });

  const bars = collapseThroughput(throughput.data ?? []);

  // For dock-to-stock ring: arbitrary target = 60 min p95; show how close
  // p95 is to that target (1.0 = at target, less = faster).
  const dtsP95 = dts.data?.p95_seconds ?? 0;
  const ringValue = Math.min(1, dtsP95 / (60 * 60));

  return (
    <div>
      <PageTitle
        eyebrow="How the floor is doing"
        title="Overview"
        subtitle="Numbers for this week, rolled up and easy to scan."
        right={
          <>
            <Btn t={t} variant="secondary" size="sm" icon={Ic.Calendar}>
              Last 30 days
            </Btn>
            <Btn t={t} variant="secondary" size="sm" icon={Ic.Download}>
              Export
            </Btn>
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatBig t={t} label="Stored pallets" value={summary.data?.storedPallets ?? "—"} tint="primary" />
        <StatBig t={t} label="Open inbound" value={summary.data?.openInbound ?? "—"} />
        <StatBig t={t} label="Picking" value={summary.data?.outboundPicking ?? "—"} />
        <StatBig t={t} label="Moves · 24h" value={summary.data?.movements24h ?? "—"} tint="mint" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card t={t} padding={22}>
          <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <SectionEyebrow t={t}>Throughput</SectionEyebrow>
              <SectionTitle t={t}>Movements over the last 14 days</SectionTitle>
            </div>
            <Tabs
              t={t}
              items={[
                { key: "week", label: "Week" },
                { key: "month", label: "Month" },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              height: 160,
              padding: "0 4px",
            }}
          >
            {bars.length === 0 ? (
              <div style={{ color: t.muted, fontSize: 13 }}>No movement data yet.</div>
            ) : (
              bars.map((b, i) => {
                const max = Math.max(...bars.map((x) => x.total), 1);
                const h = Math.max(6, (b.total / max) * 150);
                const peak = i === bars.length - 1;
                return (
                  <div
                    key={b.day}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: h,
                        background: peak ? t.primary : t.primarySoft,
                        borderRadius: 8,
                        border: `1.5px solid ${peak ? t.primaryDeep : t.border}`,
                      }}
                    />
                    <div style={{ fontSize: 10, color: t.muted, fontFamily: FONTS.mono }}>
                      {b.day.slice(5)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card t={t} padding={22}>
          <SectionEyebrow t={t}>Dock-to-stock</SectionEyebrow>
          <SectionTitle t={t}>
            {dts.data?.n ? "Based on real receipts" : "No receipts yet"}
          </SectionTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 18 }}>
            <Ring
              t={t}
              size={96}
              value={ringValue}
              stroke={10}
              label={formatDuration(dts.data?.avg_seconds)}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              <Pair label="p50" value={formatDuration(dts.data?.p50_seconds)} />
              <Pair label="p95" value={formatDuration(dts.data?.p95_seconds)} />
              <Pair label="n" value={String(dts.data?.n ?? 0)} />
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
        <Card t={t} padding={0}>
          <div style={{ padding: "16px 22px 10px" }}>
            <SectionEyebrow t={t}>Top stock</SectionEyebrow>
            <SectionTitle t={t}>Most on hand</SectionTitle>
          </div>
          {(soh.data?.length ?? 0) === 0 && (
            <div style={{ padding: "20px 22px", color: t.muted, fontSize: 13 }}>
              No stored stock yet — receive some pallets to populate.
            </div>
          )}
          {soh.data?.slice(0, 8).map((r, i) => (
            <div
              key={r.productId}
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr auto auto",
                gap: 14,
                padding: "12px 22px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
              }}
            >
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.ink, fontWeight: 600 }}>
                {r.sku}
              </span>
              <span style={{ color: t.body, fontSize: 13 }}>{r.name}</span>
              <Tag t={t} tone={i === 0 ? "primary" : "neutral"}>
                {r.palletCount} pallets
              </Tag>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  color: t.ink,
                  fontWeight: 600,
                  minWidth: 60,
                  textAlign: "right",
                }}
              >
                {(r.qty ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </Card>

        <Card t={t} padding={0}>
          <div style={{ padding: "16px 22px 10px" }}>
            <SectionEyebrow t={t}>Movements</SectionEyebrow>
            <SectionTitle t={t}>Recent activity</SectionTitle>
          </div>
          {(movements.data?.length ?? 0) === 0 && (
            <div style={{ padding: "20px 22px", color: t.muted, fontSize: 13 }}>
              No movements in the ledger yet.
            </div>
          )}
          {movements.data?.slice(0, 12).map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 22px",
                borderTop: `1.5px dashed ${t.border}`,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 48,
                  textAlign: "right",
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  color: t.muted,
                }}
              >
                {formatAgo(m.createdAt)}
              </div>
              <Tag t={t} tone={movementReasonTone(m.reason)}>
                {m.reason}
              </Tag>
              <div
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontFamily: FONTS.mono,
                  color: t.ink,
                  minWidth: 0,
                }}
              >
                {m.palletId.slice(0, 8)}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function SectionEyebrow({ t, children }: { t: typeof theme; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: t.muted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ t, children }: { t: typeof theme; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONTS.display,
        fontSize: 20,
        fontWeight: 600,
        color: t.ink,
        letterSpacing: -0.3,
      }}
    >
      {children}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: theme.muted }}>{label}</span>{" "}
      <b style={{ fontFamily: FONTS.mono, color: theme.ink }}>{value}</b>
    </div>
  );
}

/** Group the throughput rows (one per day+reason) into a single daily total. */
function collapseThroughput(
  rows: ReadonlyArray<{ day: string; reason: string; n: number }>,
): Array<{ day: string; total: number }> {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.n);
  return [...byDay.entries()]
    .map(([day, total]) => ({ day, total }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

function formatAgo(when: Date): string {
  const delta = Math.max(0, Date.now() - when.getTime());
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
