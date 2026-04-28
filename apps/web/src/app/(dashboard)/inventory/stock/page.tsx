"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Card, PageTitle, Tag, TextField } from "~/components/kit";

/**
 * Stock-on-hand view. Two tabs:
 *   - By product: total qty per SKU, broken out by status. Useful for
 *     'do we have enough Vanilla to fill this order'.
 *   - By pallet: every pallet_item row with location/lpn/lot/expiry,
 *     so the operator can see exactly where stock physically lives.
 *
 * Both views support a free-text search and a warehouse filter.
 * By-pallet adds a status filter so the dock pile (received but not
 * stored) is a one-click filter.
 */
export default function StockPage() {
  const t = theme;
  const [tab, setTab] = useState<"product" | "pallet">("product");
  const [q, setQ] = useState("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [status, setStatus] = useState<
    "" | "in_transit" | "received" | "stored" | "picked" | "shipped" | "damaged"
  >("");

  const warehouses = trpc.warehouse.list.useQuery();
  const byProduct = trpc.inventory.byProduct.useQuery(
    { q, warehouseId: warehouseId || undefined },
    { enabled: tab === "product" },
  );
  const byPallet = trpc.inventory.byPallet.useQuery(
    {
      q,
      warehouseId: warehouseId || undefined,
      status: status || undefined,
    },
    { enabled: tab === "pallet" },
  );

  return (
    <div>
      <PageTitle
        eyebrow="Stock on hand"
        title="Inventory"
        subtitle="Everything the system thinks is in your warehouses, by product and by pallet."
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          borderBottom: `1.5px solid ${t.border}`,
        }}
      >
        {(["product", "pallet"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              background: "transparent",
              border: "none",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: FONTS.sans,
              color: tab === k ? t.ink : t.muted,
              borderBottom: tab === k ? `2px solid ${t.primary}` : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            By {k}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <TextField
          t={t}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            tab === "product"
              ? "Search SKU or name…"
              : "Search SKU, name, LPN, location, lot…"
          }
          style={{ flex: 1, minWidth: 220 }}
        />
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          style={selectStyle(t)}
        >
          <option value="">All warehouses</option>
          {warehouses.data?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
        {tab === "pallet" && (
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as typeof status)
            }
            style={selectStyle(t)}
          >
            <option value="">All statuses</option>
            <option value="stored">Stored</option>
            <option value="received">Received (on dock)</option>
            <option value="in_transit">In transit</option>
            <option value="picked">Picked</option>
            <option value="shipped">Shipped</option>
            <option value="damaged">Damaged</option>
          </select>
        )}
      </div>

      {tab === "product" && (
        <Card t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 80px 80px 80px 80px 80px 100px",
              gap: 12,
              padding: "12px 16px",
              fontSize: 10.5,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            <div>Product</div>
            <div>Stored</div>
            <div>Received</div>
            <div>In&nbsp;transit</div>
            <div>Picked</div>
            <div>Damaged</div>
            <div>Pallets</div>
          </div>
          {(byProduct.data ?? []).map((r) => (
            <div
              key={r.productId}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 80px 80px 80px 80px 80px 100px",
                gap: 12,
                padding: "10px 16px",
                borderTop: `1.5px dashed ${t.border}`,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: t.ink, fontWeight: 600 }}>
                  {r.name}
                </div>
                <div
                  style={{ fontFamily: FONTS.mono, fontSize: 11.5, color: t.muted }}
                >
                  {r.sku ?? "(no SKU)"} · id {r.productId.slice(0, 8)}
                </div>
              </div>
              <NumberCell t={t} v={r.stored} highlight={r.stored > 0} />
              <NumberCell t={t} v={r.received} />
              <NumberCell t={t} v={r.inTransit} />
              <NumberCell t={t} v={r.picked} />
              <NumberCell t={t} v={r.damaged} />
              <NumberCell t={t} v={r.palletCount} />
            </div>
          ))}
          {byProduct.data && byProduct.data.length === 0 && (
            <Empty t={t} />
          )}
        </Card>
      )}

      {tab === "pallet" && (
        <Card t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1.4fr 100px 90px 90px 100px 100px",
              gap: 12,
              padding: "12px 16px",
              fontSize: 10.5,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            <div>Pallet (LPN)</div>
            <div>Product</div>
            <div>Location</div>
            <div>Status</div>
            <div>Qty</div>
            <div>Lot</div>
            <div>Expiry</div>
          </div>
          {(byPallet.data ?? []).map((r) => (
            <div
              key={r.palletItemId}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1.4fr 100px 90px 90px 100px 100px",
                gap: 12,
                padding: "10px 16px",
                borderTop: `1.5px dashed ${t.border}`,
                alignItems: "center",
              }}
            >
              <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.ink }}>
                {r.palletLpn}
              </div>
              <div>
                <div style={{ fontSize: 13, color: t.ink, fontWeight: 600 }}>
                  {r.productName}
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>
                  {r.productSku ?? "(no SKU)"}
                </div>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 12 }}>
                {r.locationCode ?? "—"}
              </div>
              <div>
                <Tag
                  t={t}
                  tone={
                    r.palletStatus === "stored"
                      ? "mint"
                      : r.palletStatus === "received"
                        ? "primary"
                        : r.palletStatus === "shipped"
                          ? "neutral"
                          : "neutral"
                  }
                >
                  {r.palletStatus}
                </Tag>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>
                {r.qty}
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 11.5, color: t.muted }}>
                {r.lot ?? "—"}
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 11.5, color: t.muted }}>
                {r.expiry
                  ? new Date(r.expiry).toLocaleDateString()
                  : "—"}
              </div>
            </div>
          ))}
          {byPallet.data && byPallet.data.length === 0 && <Empty t={t} />}
        </Card>
      )}
    </div>
  );
}

function NumberCell({
  t,
  v,
  highlight = false,
}: {
  t: typeof theme;
  v: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? t.ink : v > 0 ? t.body : t.muted,
      }}
    >
      {v}
    </div>
  );
}

function Empty({ t }: { t: typeof theme }) {
  return (
    <div
      style={{
        padding: "20px 16px",
        fontSize: 13,
        color: t.muted,
        borderTop: `1.5px dashed ${t.border}`,
      }}
    >
      Nothing matches. If you expect stock here, check that the inbound flow
      finished receiving and (for stored qty) that the pallet was put away
      onto a rack.
    </div>
  );
}

function selectStyle(t: typeof theme): React.CSSProperties {
  return {
    padding: "9px 12px",
    borderRadius: 12,
    background: t.surfaceAlt,
    border: `1.5px solid ${t.border}`,
    fontSize: 13,
    color: t.ink,
    fontFamily: FONTS.sans,
    cursor: "pointer",
  };
}
