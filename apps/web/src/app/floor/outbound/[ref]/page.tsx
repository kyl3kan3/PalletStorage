"use client";

import { use } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill } from "~/components/kit";
import { floorTheme as t, FONTS, Cubby } from "~/lib/theme";
import { Ic } from "~/components/icons";

/**
 * Floor-mode Outbound detail preview at /floor/outbound/[ref].
 *
 * Layout per the handoff:
 *   - Header: ref title + customer/countdown subtitle + Cancel/Mark-packed
 *   - Stepper (full width): Open ✓ · Picking (active, marigold) · Packed · Shipped
 *   - Lines table (60%): #, SKU, name, ordered, picked, progress bar
 *   - Right column (40%): Cubby ETA, Crew, Ship info
 *
 * Mock data; later phase wires order.outbound({ ref }) +
 * order.outboundLines({ ref }).
 */

const LINES = [
  { line: 1, sku: "SKU-00041", name: "Vanilla Extract 8oz", ordered: 24, picked: 24 },
  { line: 2, sku: "SKU-00102", name: "Cane Sugar 50lb", ordered: 12, picked: 12 },
  { line: 3, sku: "SKU-00038", name: "Coffee Beans 5lb", ordered: 18, picked: 18 },
  { line: 4, sku: "SKU-00211", name: "Whole Tomatoes #10", ordered: 14, picked: 8, active: true },
  { line: 5, sku: "SKU-00150", name: "Olive Oil 1L", ordered: 20, picked: 0 },
  { line: 6, sku: "SKU-00078", name: "Sea Salt 16oz", ordered: 36, picked: 0 },
];

const STEPS = ["Open", "Picking", "Packed", "Shipped"] as const;
const ACTIVE_STEP = 1; // "Picking"

export default function FloorOutboundDetail({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = use(params);
  return (
    <FShell
      eyebrow={`Order · ${ref}`}
      title={ref}
      subtitle="Northgate Foods · ships in 1h 12m"
      actions={
        <>
          <FBtn t={t} variant="danger" size="md">
            Cancel order
          </FBtn>
          <FBtn t={t} variant="primary" size="md" icon={Ic.Check}>
            Mark packed
          </FBtn>
        </>
      }
    >
      {/* Stepper */}
      <FCard t={t} padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {STEPS.map((step, i) => {
            const done = i < ACTIVE_STEP;
            const active = i === ACTIVE_STEP;
            return (
              <div key={step} style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 14px",
                    borderRadius: 12,
                    background: active ? t.primarySoft : done ? t.mintSoft : t.surface,
                    border: `1px solid ${active ? "rgba(255,178,62,.35)" : done ? "rgba(127,216,168,.35)" : t.border}`,
                    boxShadow: active ? `0 0 16px ${t.primaryGlow}` : undefined,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: active ? t.primary : done ? t.mint : t.surfaceAlt,
                      color: active ? t.primaryText : done ? "#0F4D2E" : t.muted,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: active ? t.primary : done ? t.mint : t.muted,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 3,
                      background: done ? t.mint : t.surfaceAlt,
                      borderRadius: 2,
                      boxShadow: done ? `0 0 8px rgba(127,216,168,.4)` : undefined,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </FCard>

      {/* Lines + right column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <FCard t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "32px 110px 1fr 70px 70px 1fr",
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
            <div>Ord</div>
            <div>Picked</div>
            <div>Progress</div>
          </div>
          {LINES.map((l) => {
            const pct = l.ordered ? l.picked / l.ordered : 0;
            const done = pct === 1;
            return (
              <div
                key={l.line}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 110px 1fr 70px 70px 1fr",
                  gap: 12,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: `1px dashed ${t.border}`,
                  background: l.active ? t.primarySoft : undefined,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                    color: t.muted,
                  }}
                >
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
                    fontSize: 14,
                    fontWeight: 800,
                    color: t.ink,
                  }}
                >
                  {l.ordered}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 800,
                    color: done ? t.mint : t.ink,
                  }}
                >
                  {done ? "✓" : ""} {l.picked}
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
                      width: `${pct * 100}%`,
                      height: "100%",
                      background: done ? t.mint : t.primary,
                      boxShadow: l.active ? `0 0 8px ${t.primaryGlow}` : undefined,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </FCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Cubby ETA */}
          <FCard t={t} padding={20}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <Cubby size={52} t={t} mood="happy" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <FPill t={t} tone="primary" size="sm">
                  ETA · 14 MIN
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
                  Pickers on pace — ready by{" "}
                  <strong style={{ color: t.ink }}>16:24</strong>, with a
                  36-minute buffer.
                </div>
              </div>
            </div>
          </FCard>

          {/* Crew */}
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
              Crew
            </div>
            <CrewRow initials="MR" name="Maya Rivera" progress={0.6} count="9 / 15" />
            <CrewRow initials="KT" name="Kenji Tanaka" progress={0.43} count="3 / 7" />
          </FCard>

          {/* Ship info */}
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
              Ship info
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <Stat label="Carrier" value="ODFL · LTL" />
              <Stat label="Dock" value="D-02" />
              <Stat label="Ship to" value="Tacoma · WA" />
              <Stat label="Weight" value="312 kg" mono />
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
        FLOOR MODE PREVIEW · mock data · later phase wires order.outbound({"{ref}"})
      </div>
    </FShell>
  );
}

function CrewRow({
  initials,
  name,
  progress,
  count,
}: {
  initials: string;
  name: string;
  progress: number;
  count: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "30px 1fr 60px",
        gap: 10,
        padding: "8px 0",
        alignItems: "center",
        borderTop: `1px dashed ${t.border}`,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: t.primary,
          color: t.primaryText,
          fontFamily: FONTS.mono,
          fontSize: 10.5,
          fontWeight: 800,
          display: "grid",
          placeItems: "center",
        }}
      >
        {initials}
      </div>
      <div>
        <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 600 }}>
          {name}
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: t.surfaceAlt,
            overflow: "hidden",
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: t.primary,
            }}
          />
        </div>
      </div>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          fontWeight: 700,
          color: t.muted,
          textAlign: "right",
        }}
      >
        {count}
      </span>
    </div>
  );
}

function Stat({
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
