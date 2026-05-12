"use client";

import { useState } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { Ic } from "~/components/icons";

/**
 * Floor-mode Inventory / Scan preview at /floor/inventory.
 *
 * Paste an LPN, SKU, location, or PO and see everything. Layout from
 * the handoff:
 *   - Hero scan field (45%): marigold-bordered input with mono LPN,
 *     valid-prefix hint, recent scans list (5 items).
 *   - Result card (55%): 60-px squircle pallet icon, big LPN, location
 *     pill, 6-cell metadata grid, contents table, action row.
 *
 * Mock data only; later phase prefix-routes the input (P- → pallet,
 * SO- → outbound, PO- → inbound, SKU- → product, location regex →
 * location detail) and pulls pallet.byLpn / location.byCode.
 */

interface ScanResult {
  lpn: string;
  status: "stored" | "received" | "in_transit" | "picked" | "shipped" | "damaged";
  location: string;
  receivedAt: string;
  lot: string;
  weight: string;
  fromPo: string;
  ageDays: number;
  contents: Array<{ sku: string; name: string; qty: string }>;
}

const SAMPLE: ScanResult = {
  lpn: "P-9QK4X72L",
  status: "stored",
  location: "A2-02-B",
  receivedAt: "Mar 12 · 09:14",
  lot: "LOT-2026-Q1",
  weight: "312 kg",
  fromPo: "PO-58812",
  ageDays: 4,
  contents: [
    { sku: "SKU-00041", name: "Vanilla Extract 8oz", qty: "120 ea" },
    { sku: "SKU-00102", name: "Cane Sugar 50lb", qty: "8 cs" },
    { sku: "SKU-00211", name: "Whole Tomatoes #10", qty: "12 cs" },
  ],
};

const RECENT_SCANS: Array<{
  code: string;
  type: "pallet" | "location" | "sku" | "po" | "so";
  desc: string;
  ago: string;
}> = [
  { code: "P-9QK4X72L", type: "pallet", desc: "Vanilla Extract · A2-02-B", ago: "just now" },
  { code: "A2-04-B", type: "location", desc: "3 pallets stored · 78% full", ago: "2m" },
  { code: "PO-58812", type: "po", desc: "ACME Corp · receiving", ago: "4m" },
  { code: "SKU-00041", type: "sku", desc: "Vanilla Extract 8oz · 2,880 ea on hand", ago: "12m" },
  { code: "SO-24881", type: "so", desc: "Northgate Foods · picking 13/22", ago: "18m" },
];

export default function FloorInventoryPreview() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ScanResult | null>(SAMPLE);

  function handleScan(code: string) {
    setInput(code);
    // In a later phase: prefix-route to /inventory?lpn=... or call
    // pallet.byLpn / location.byCode. For preview, just show the
    // sample card whenever input is non-empty.
    setResult(code.trim() ? SAMPLE : null);
  }

  return (
    <FShell
      active="inventory"
      eyebrow="Scan · paste · type"
      title="What are we looking at?"
      subtitle="LPN · SKU · location · order"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr",
          gap: 16,
        }}
      >
        {/* ─── Hero scan field + recent scans ───────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FCard t={t} padding={22}>
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
              Scan or paste
            </div>
            <div
              style={{
                position: "relative",
                border: `2px solid ${input ? t.primary : "rgba(255,178,62,.4)"}`,
                background: t.surfaceAlt,
                borderRadius: 16,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: input ? `0 0 24px ${t.primaryGlow}` : undefined,
                transition: "box-shadow .15s, border-color .15s",
              }}
            >
              <Ic.Scan size={28} color={t.primary} />
              <input
                value={input}
                onChange={(e) => handleScan(e.target.value)}
                placeholder="P-… · SO-… · SKU-… · A2-02-B"
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: FONTS.mono,
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  color: t.ink,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: 0,
                }}
              />
              {result && (
                <FPill t={t} tone="mint">
                  {result.status}
                </FPill>
              )}
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: t.mutedSoft,
                letterSpacing: 0.4,
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: t.muted }}>P-</strong> pallet ·{" "}
              <strong style={{ color: t.muted }}>SO-</strong> outbound ·{" "}
              <strong style={{ color: t.muted }}>PO-</strong> inbound ·{" "}
              <strong style={{ color: t.muted }}>SKU-</strong> product ·{" "}
              <strong style={{ color: t.muted }}>A2-02-B</strong> location
            </div>
          </FCard>

          {/* Recent scans */}
          <FCard t={t} padding={0}>
            <div
              style={{
                padding: "16px 20px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  fontWeight: 800,
                  color: t.ink,
                  letterSpacing: -0.2,
                }}
              >
                Recent scans
              </div>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  color: t.mutedSoft,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {RECENT_SCANS.length} in last hour
              </span>
            </div>
            {RECENT_SCANS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleScan(s.code)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "16px 130px 1fr 50px",
                  gap: 10,
                  padding: "10px 20px",
                  width: "100%",
                  alignItems: "center",
                  borderTop: `1px dashed ${t.border}`,
                  background: "transparent",
                  border: "none",
                  borderBottom: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: t.body,
                }}
              >
                <Ic.Clipboard size={12} color={t.mutedSoft} />
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: t.ink,
                    letterSpacing: 0.2,
                  }}
                >
                  {s.code}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                    color: t.muted,
                    minWidth: 0,
                  }}
                >
                  <FPill t={t} tone="neutral" size="sm">
                    {s.type}
                  </FPill>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.desc}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10.5,
                    color: t.mutedSoft,
                    textAlign: "right",
                  }}
                >
                  {s.ago}
                </span>
              </button>
            ))}
          </FCard>
        </div>

        {/* ─── Result card ─────────────────────────────────────── */}
        {result ? (
          <FCard t={t} padding={24}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 24 }}>
              <PalletSquircle />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: t.muted,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  Pallet
                </div>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 30,
                    fontWeight: 800,
                    color: t.ink,
                    letterSpacing: 2.5,
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {result.lpn}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <FPill t={t} tone="primary">
                    {result.location}
                  </FPill>
                  <FPill t={t} tone="mint">
                    {result.status}
                  </FPill>
                </div>
              </div>
            </div>

            {/* 3×2 metadata grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
                padding: "16px 0",
                borderTop: `1px solid ${t.border}`,
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <Meta label="Location" value={result.location} mono />
              <Meta label="Received" value={result.receivedAt} />
              <Meta label="Lot" value={result.lot} mono />
              <Meta label="Weight" value={result.weight} mono />
              <Meta label="From PO" value={result.fromPo} mono />
              <Meta label="Age" value={`${result.ageDays} days`} />
            </div>

            {/* Contents */}
            <div style={{ padding: "18px 0 16px" }}>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: t.muted,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Contents · {result.contents.length} SKUs
              </div>
              {result.contents.map((c) => (
                <div
                  key={c.sku}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 1fr 90px",
                    gap: 12,
                    padding: "10px 0",
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
                    {c.sku}
                  </span>
                  <span style={{ fontSize: 13, color: t.body }}>{c.name}</span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 14,
                      fontWeight: 800,
                      color: t.ink,
                      textAlign: "right",
                      letterSpacing: -0.3,
                    }}
                  >
                    {c.qty}
                  </span>
                </div>
              ))}
            </div>

            {/* Action row */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
              <FBtn t={t} variant="primary" size="md" icon={Ic.Plus}>
                Move
              </FBtn>
              <FBtn t={t} variant="ghost" size="md" icon={Ic.Settings}>
                Adjust
              </FBtn>
              <FBtn t={t} variant="ghost" size="md" icon={Ic.Clipboard}>
                Cycle count
              </FBtn>
              <FBtn t={t} variant="ghost" size="md" icon={Ic.Download}>
                Label
              </FBtn>
            </div>
          </FCard>
        ) : (
          <FCard t={t} padding={36}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                textAlign: "center",
                color: t.muted,
              }}
            >
              <Ic.Search size={32} color={t.mutedSoft} />
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: t.mutedSoft,
                }}
              >
                Scan or paste a code
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 320 }}>
                Drop a pallet LPN, location code, SKU, or order ref in the box
                on the left. Recent scans replay with one tap.
              </div>
            </div>
          </FCard>
        )}
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
        FLOOR MODE PREVIEW · mock data · later phase wires pallet.byLpn /
        location.byCode + prefix routing
      </div>
    </FShell>
  );
}

// ─── Bits ──────────────────────────────────────────────────

function PalletSquircle() {
  // 60×60 stylized stacked-pallet icon, marigold tint. Matches the
  // squircle motif from the design handoff.
  return (
    <div
      style={{
        width: 60,
        height: 60,
        borderRadius: 18,
        background: t.primarySoft,
        border: `1px solid rgba(255,178,62,.35)`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width={30} height={30}>
        <rect x="3" y="14" width="18" height="6" rx="1.5" fill={t.primary} />
        <rect x="5" y="7" width="14" height="6" rx="1.5" fill={t.primaryDeep} />
        <rect x="7" y="0" width="10" height="6" rx="1.5" fill={t.primary} opacity={0.65} />
        <rect x="3" y="20" width="18" height="2" rx="1" fill={t.primaryDeep} />
      </svg>
    </div>
  );
}

function Meta({
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
          fontFamily: mono ? FONTS.mono : FONTS.sans,
          fontSize: 14,
          fontWeight: mono ? 800 : 600,
          color: t.ink,
          letterSpacing: mono ? 0.4 : -0.2,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}
