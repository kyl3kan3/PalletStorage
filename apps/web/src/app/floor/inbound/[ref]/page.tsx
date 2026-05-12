"use client";

import { use } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill } from "~/components/kit";
import { floorTheme as t, FONTS, Cubby } from "~/lib/theme";
import { Ic } from "~/components/icons";

/**
 * Floor-mode Inbound detail preview at /floor/inbound/[ref].
 *
 * Layout per the handoff:
 *   - Lines table (60%): 6-col grid with variance pill per row.
 *     Short lines tinted coral-soft; matched lines show mint.
 *   - Right column (40%):
 *     - Variance Cubby (coral-pinned, mood=wow, "Log reason" CTA)
 *     - Putaway plan (3 zones with mini progress bars)
 *     - Truck card (2×2 grid: carrier / trailer / driver / ETA-out)
 *
 * Mock data; later phase wires order.inbound + order.inboundLines.
 */

interface Line {
  line: number;
  sku: string;
  name: string;
  expected: number;
  received: number;
}

const LINES: Line[] = [
  { line: 1, sku: "SKU-00041", name: "Vanilla Extract 8oz", expected: 120, received: 120 },
  { line: 2, sku: "SKU-00102", name: "Cane Sugar 50lb", expected: 40, received: 36 },
  { line: 3, sku: "SKU-00038", name: "Coffee Beans 5lb", expected: 30, received: 30 },
  { line: 4, sku: "SKU-00211", name: "Whole Tomatoes #10", expected: 24, received: 10 },
  { line: 5, sku: "SKU-00150", name: "Olive Oil 1L", expected: 18, received: 18 },
  { line: 6, sku: "SKU-00078", name: "Sea Salt 16oz", expected: 48, received: 0 },
];

const PUTAWAY = [
  { zone: "A2 · dry", suggested: 6, planned: 4 },
  { zone: "A3 · dry", suggested: 3, planned: 2 },
  { zone: "C1 · bulk", suggested: 2, planned: 1 },
];

export default function FloorInboundDetail({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = use(params);
  const totalExp = LINES.reduce((n, l) => n + l.expected, 0);
  const totalRecv = LINES.reduce((n, l) => n + l.received, 0);
  const varianceTotal = totalRecv - totalExp;

  return (
    <FShell
      eyebrow={`Receiving · ${ref}`}
      title={ref}
      subtitle={`ACME Corp · D-01 · ${varianceTotal} variance`}
      actions={
        <>
          <FBtn t={t} variant="ghost" size="md">
            Cancel
          </FBtn>
          <FBtn t={t} variant="primary" size="md" icon={Ic.Check}>
            Close order
          </FBtn>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Lines table */}
        <FCard t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "32px 110px 1fr 80px 80px 110px",
              gap: 12,
              padding: "14px 20px",
              fontFamily: FONTS.mono,
              fontSize: 10,
              fontWeight: 700,
              color: t.muted,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            <div>#</div>
            <div>SKU</div>
            <div>Name</div>
            <div>Exp.</div>
            <div>Recv.</div>
            <div style={{ textAlign: "right" }}>Variance</div>
          </div>
          {LINES.map((l) => {
            const v = l.received - l.expected;
            const matched = v === 0;
            const short = v < 0;
            return (
              <div
                key={l.line}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 110px 1fr 80px 80px 110px",
                  gap: 12,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: `1px dashed ${t.border}`,
                  background: short ? t.coralSoft : matched ? t.mintSoft : undefined,
                }}
              >
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>
                  {l.line}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: t.ink,
                  }}
                >
                  {l.sku}
                </span>
                <span style={{ fontSize: 13, color: t.body }}>{l.name}</span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.body,
                  }}
                >
                  {l.expected}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 800,
                    color: t.ink,
                  }}
                >
                  {l.received}
                </span>
                <span style={{ textAlign: "right" }}>
                  {matched ? (
                    <FPill t={t} tone="mint" size="sm">
                      MATCHED
                    </FPill>
                  ) : short ? (
                    <FPill t={t} tone="coral" size="sm">
                      −{Math.abs(v)} short
                    </FPill>
                  ) : (
                    <FPill t={t} tone="primary" size="sm">
                      +{v} over
                    </FPill>
                  )}
                </span>
              </div>
            );
          })}
        </FCard>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Variance Cubby */}
          <FCard
            t={t}
            padding={20}
            style={{
              borderTop: `2px solid ${t.coral}`,
              boxShadow: `0 8px 24px rgba(255,107,91,.15), 0 1px 0 rgba(255,255,255,.03)`,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <Cubby size={48} t={t} mood="wow" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <FPill t={t} tone="coral" size="sm">
                  HEADS UP · VARIANCE
                </FPill>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    color: t.body,
                    lineHeight: 1.5,
                  }}
                >
                  Heads up — <strong style={{ color: t.ink }}>52 units short</strong>{" "}
                  across 2 lines. Log a reason before closing.
                </div>
                <div style={{ marginTop: 14 }}>
                  <FBtn t={t} variant="danger" size="md" full>
                    Log reason
                  </FBtn>
                </div>
              </div>
            </div>
          </FCard>

          {/* Putaway plan */}
          <FCard t={t} padding={20}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10.5,
                fontWeight: 800,
                color: t.muted,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Putaway plan
            </div>
            {PUTAWAY.map((z) => {
              const pct = z.planned / z.suggested;
              return (
                <div
                  key={z.zone}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 50px",
                    gap: 10,
                    padding: "10px 0",
                    alignItems: "center",
                    borderTop: `1px dashed ${t.border}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 600, marginBottom: 4 }}>
                      {z.zone}
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 2,
                        background: t.surfaceAlt,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct * 100}%`,
                          height: "100%",
                          background: t.primary,
                        }}
                      />
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: t.body,
                      textAlign: "right",
                    }}
                  >
                    {z.planned} / {z.suggested}
                  </span>
                </div>
              );
            })}
          </FCard>

          {/* Truck */}
          <FCard t={t} padding={20}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10.5,
                fontWeight: 800,
                color: t.muted,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Truck · D-01
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <TruckStat label="Carrier" value="ODFL" />
              <TruckStat label="Trailer" value="ODFL-47291" mono />
              <TruckStat label="Driver" value="J. Holm" />
              <TruckStat label="ETA out" value="16:30" mono />
            </div>
          </FCard>
        </div>
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
        FLOOR MODE PREVIEW · mock data · later phase wires order.inbound({"{ref}"})
      </div>
    </FShell>
  );
}

function TruckStat({
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
          fontSize: 13,
          fontWeight: mono ? 800 : 600,
          color: t.ink,
          letterSpacing: mono ? 0.3 : -0.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
