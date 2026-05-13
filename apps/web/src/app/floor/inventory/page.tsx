"use client";

import { useMemo, useState } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { Ic } from "~/components/icons";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Inventory / Scan at /floor/inventory. Wired to
 * pallet.byLpn for direct LPN lookups + product.search for the
 * contents table's product names.
 *
 * Typing in the hero input fires pallet.byLpn when the input looks
 * like an LPN (starts with P-). Other prefixes (SO- PO- SKU- location)
 * route via the Cmd+K palette already, so this page focuses on the
 * pallet detail card.
 */

export default function FloorInventoryPreview() {
  const [input, setInput] = useState("");
  const lpn = input.trim().toUpperCase();
  const isLpn = lpn.startsWith("P-") && lpn.length >= 4;

  const pallet = trpc.pallet.byLpn.useQuery(
    { lpn },
    { enabled: isLpn },
  );

  const products = trpc.product.search.useQuery({ q: "", limit: 500 });
  const productMap = useMemo(() => {
    const m = new Map<string, { sku: string | null; name: string }>();
    for (const p of products.data ?? []) m.set(p.id, { sku: p.sku, name: p.name });
    return m;
  }, [products.data]);

  return (
    <FShell
      eyebrow="Scan · paste · type"
      title="What are we looking at?"
      subtitle="LPN · SKU · location · order"
    >
      <div
        data-collapse-grid
        style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}
      >
        {/* Hero scan field */}
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
            Scan or paste a pallet LPN
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
              onChange={(e) => setInput(e.target.value)}
              placeholder="P-9QK4X72L"
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
            {pallet.data && (
              <FPill t={t} tone="mint">
                {pallet.data.pallet.status}
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
            <strong style={{ color: t.muted }}>P-…</strong> pallet lookup. For{" "}
            <strong style={{ color: t.muted }}>SO-</strong> /{" "}
            <strong style={{ color: t.muted }}>PO-</strong> /{" "}
            <strong style={{ color: t.muted }}>SKU-</strong> /{" "}
            <strong style={{ color: t.muted }}>location</strong>, hit ⌘K.
          </div>
        </FCard>

        {/* Result column */}
        {!isLpn ? (
          <FCard t={t} padding={36}>
            <EmptyState
              t={t}
              title="Start typing"
              hint="Paste a pallet LPN (e.g. P-9QK4X72L) into the box on the left, or hit ⌘K for the full prefix router."
            />
          </FCard>
        ) : pallet.isLoading ? (
          <FCard t={t} padding={24}>
            <Skeleton t={t} lines={4} rowHeight={56} />
          </FCard>
        ) : !pallet.data ? (
          <FCard t={t} padding={36}>
            <EmptyState
              t={t}
              title="LPN not found"
              hint={`No pallet matched "${lpn}" in this organization. Check the prefix and try again.`}
            />
          </FCard>
        ) : (
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
                  {pallet.data.pallet.lpn}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <FPill t={t} tone={statusTone(pallet.data.pallet.status)}>
                    {pallet.data.pallet.status}
                  </FPill>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div
              data-collapse-grid
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
                padding: "16px 0",
                borderTop: `1px solid ${t.border}`,
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <Meta
                label="Weight"
                value={pallet.data.pallet.weightKg ? `${pallet.data.pallet.weightKg} kg` : "—"}
                mono
              />
              <Meta
                label="Created"
                value={new Date(pallet.data.pallet.createdAt).toLocaleDateString()}
              />
              <Meta
                label="Pallet ID"
                value={pallet.data.pallet.id.slice(0, 8)}
                mono
              />
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
                Contents · {pallet.data.items.length} line
                {pallet.data.items.length === 1 ? "" : "s"}
              </div>
              {pallet.data.items.length === 0 ? (
                <div style={{ fontSize: 13, color: t.mutedSoft }}>
                  Empty pallet — no items recorded.
                </div>
              ) : (
                pallet.data.items.map((it) => {
                  const product = productMap.get(it.productId);
                  return (
                    <div
                      key={it.id}
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
                        {product?.sku ?? "—"}
                      </span>
                      <span style={{ fontSize: 13, color: t.body }}>
                        {product?.name ?? `Product ${it.productId.slice(0, 8)}`}
                      </span>
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
                        {it.qty} {it.qtyUnit}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                paddingTop: 14,
                borderTop: `1px solid ${t.border}`,
              }}
            >
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
        )}
      </div>
    </FShell>
  );
}

function statusTone(s: string): "primary" | "mint" | "sky" | "coral" | "neutral" {
  if (s === "stored") return "mint";
  if (s === "received") return "primary";
  if (s === "in_transit") return "sky";
  if (s === "damaged") return "coral";
  return "neutral";
}

function PalletSquircle() {
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
