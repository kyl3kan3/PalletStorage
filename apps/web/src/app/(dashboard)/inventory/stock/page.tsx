"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { useIsManager } from "~/lib/useRole";

/**
 * Stock-on-hand view. Two tabs:
 *   - By product: total qty per SKU, broken out by status. Useful for
 *     'do we have enough Vanilla to fill this order'.
 *   - By pallet: every pallet_item row with location/lpn/lot/expiry,
 *     so the operator can see exactly where stock physically lives.
 *     Qty / lot / expiry on each row are click-to-edit; a qty change
 *     records a movement with reason='adjust' for audit.
 *
 * Both views support a free-text search and a warehouse filter.
 * By-pallet adds a status filter so the dock pile (received but not
 * stored) is a one-click filter.
 */
export default function StockPage() {
  const t = theme;
  const sp = useSearchParams();
  // Default to "By pallet" when arriving with a customer / status / warehouse
  // pre-selected, so the inventory column is visible immediately.
  const [tab, setTab] = useState<"product" | "pallet">(
    sp.get("customer") || sp.get("status") || sp.get("warehouse") ? "pallet" : "product",
  );
  const [q, setQ] = useState("");
  const [warehouseId, setWarehouseId] = useState<string>(sp.get("warehouse") ?? "");
  const [customerId, setCustomerId] = useState<string>(sp.get("customer") ?? "");
  const initialStatus = sp.get("status");
  const [status, setStatus] = useState<
    "" | "in_transit" | "received" | "stored" | "picked" | "shipped" | "damaged"
  >(
    initialStatus === "in_transit" ||
      initialStatus === "received" ||
      initialStatus === "stored" ||
      initialStatus === "picked" ||
      initialStatus === "shipped" ||
      initialStatus === "damaged"
      ? initialStatus
      : "",
  );

  const warehouses = trpc.warehouse.list.useQuery();
  const customers = trpc.customer.list.useQuery();
  const utils = trpc.useUtils();
  const movePallet = trpc.pallet.move.useMutation({
    onSuccess: () => {
      utils.inventory.byPallet.invalidate();
      utils.inventory.byProduct.invalidate();
    },
  });
  const updateItem = trpc.pallet.updateItem.useMutation({
    onSuccess: () => {
      utils.inventory.byPallet.invalidate();
      utils.inventory.byProduct.invalidate();
    },
  });
  const deletePallet = trpc.pallet.delete.useMutation({
    onSuccess: () => {
      utils.inventory.byPallet.invalidate();
      utils.inventory.byProduct.invalidate();
    },
  });
  const isManager = useIsManager();
  const byProduct = trpc.inventory.byProduct.useQuery(
    {
      q,
      warehouseId: warehouseId || undefined,
      customerId: customerId || undefined,
    },
    { enabled: tab === "product" },
  );
  const byPallet = trpc.inventory.byPallet.useQuery(
    {
      q,
      warehouseId: warehouseId || undefined,
      customerId: customerId || undefined,
      status: status || undefined,
    },
    { enabled: tab === "pallet" },
  );

  // Pull rack locations for the active warehouse so each "Put away"
  // row can offer a destination dropdown. If no warehouse is filtered,
  // the location list is empty and the action shows a hint instead.
  const racks = trpc.location.listByWarehouse.useQuery(
    { warehouseId: warehouseId || "" },
    { enabled: !!warehouseId },
  );
  const [putawayChoice, setPutawayChoice] = useState<Record<string, string>>({});

  return (
    <div>
      <PageTitle
        eyebrow="Stock on hand"
        title="Inventory"
        subtitle="Everything the system thinks is in your warehouses, by product and by pallet. Click a qty, lot, or expiry cell on the By-pallet tab to edit in place."
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
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          style={selectStyle(t)}
        >
          <option value="">All customers</option>
          {customers.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {!c.active ? " (inactive)" : ""}
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

      {updateItem.error && (
        <div
          style={{
            marginBottom: 12,
            background: t.coralSoft,
            color: t.coral,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12.5,
          }}
        >
          {updateItem.error.message}
        </div>
      )}

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
              gridTemplateColumns: "120px 1.4fr 1.1fr 100px 90px 90px 100px 100px 200px",
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
            <div>Customer</div>
            <div>Location</div>
            <div>Status</div>
            <div>Qty</div>
            <div>Lot</div>
            <div>Expiry</div>
            <div>Action</div>
          </div>
          {(byPallet.data ?? []).map((r) => (
            <div
              key={r.palletItemId}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1.4fr 1.1fr 100px 90px 90px 100px 100px 200px",
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
              <div style={{ fontSize: 12.5, color: r.customerName ? t.body : t.muted }}>
                {r.customerName ?? "—"}
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
              <EditableQty
                t={t}
                value={r.qty}
                onSave={(next) =>
                  updateItem.mutate({ palletItemId: r.palletItemId, qty: next })
                }
              />
              <EditableText
                t={t}
                value={r.lot ?? ""}
                placeholder="—"
                onSave={(next) =>
                  updateItem.mutate({
                    palletItemId: r.palletItemId,
                    lot: next.trim() || null,
                  })
                }
              />
              <EditableDate
                t={t}
                value={r.expiry ? new Date(r.expiry) : null}
                onSave={(next) =>
                  updateItem.mutate({
                    palletItemId: r.palletItemId,
                    expiry: next,
                  })
                }
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {(r.palletStatus === "received" ||
                  r.palletStatus === "in_transit") && (
                  warehouseId ? (
                    racks.data && racks.data.filter((l) => l.type === "rack").length > 0 ? (
                      <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 0 }}>
                        <select
                          value={putawayChoice[r.palletId] ?? ""}
                          onChange={(e) =>
                            setPutawayChoice((prev) => ({
                              ...prev,
                              [r.palletId]: e.target.value,
                            }))
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "4px 6px",
                            borderRadius: 6,
                            background: t.surfaceAlt,
                            border: `1.5px solid ${t.border}`,
                            fontFamily: FONTS.mono,
                            fontSize: 11,
                            color: t.ink,
                          }}
                        >
                          <option value="">— rack —</option>
                          {racks.data
                            .filter((l) => l.type === "rack")
                            .slice()
                            .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""))
                            .map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.code}
                              </option>
                            ))}
                        </select>
                        <Btn
                          t={t}
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={Ic.Check}
                          disabled={
                            !putawayChoice[r.palletId] || movePallet.isPending
                          }
                          onClick={() =>
                            movePallet.mutate({
                              palletId: r.palletId,
                              toLocationId: putawayChoice[r.palletId]!,
                              reason: "putaway",
                            })
                          }
                        >
                          Put away
                        </Btn>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: t.muted }}>
                        no racks
                      </span>
                    )
                  ) : (
                    <span style={{ fontSize: 11, color: t.muted }}>
                      filter to a warehouse
                    </span>
                  )
                )}
                {isManager && (
                  <Btn
                    t={t}
                    type="button"
                    variant="danger"
                    size="sm"
                    icon={Ic.X}
                    disabled={deletePallet.isPending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete pallet ${r.palletLpn}? This removes the pallet, its items, label, and movement history — it cannot be undone. Past billing reports that included this pallet will recompute.`,
                        )
                      )
                        return;
                      deletePallet.mutate({ palletId: r.palletId });
                    }}
                  >
                    Delete
                  </Btn>
                )}
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

/**
 * Click-to-edit qty cell. Saves a non-negative integer on Enter/blur.
 * The server emits a movement row with reason='adjust' whenever the
 * qty actually changes — see pallet.updateItem.
 *
 * The button fills the grid cell so clicking anywhere in the column
 * starts the edit, not just the digits themselves. On hover the cell
 * gets a marigold dashed underline to advertise that it's editable.
 */
function EditableQty({
  t,
  value,
  onSave,
}: {
  t: typeof theme;
  value: number;
  onSave: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const n = Number.parseInt(draft, 10);
    if (Number.isFinite(n) && n >= 0 && n !== value) onSave(n);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className="inline-edit-cell"
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "5px 6px",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 13,
          color: t.ink,
          borderRadius: 6,
          borderBottom: `1.5px dashed transparent`,
        }}
        title="Click to adjust qty"
      >
        {value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      type="number"
      min={0}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      style={{
        width: "100%",
        padding: "5px 8px",
        borderRadius: 8,
        background: t.surfaceAlt,
        border: `1.5px solid ${t.primary}`,
        fontFamily: FONTS.mono,
        fontSize: 12.5,
        color: t.ink,
        outline: "none",
      }}
    />
  );
}

function EditableText({
  t,
  value,
  placeholder,
  onSave,
}: {
  t: typeof theme;
  value: string;
  placeholder: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="inline-edit-cell"
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "5px 6px",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: FONTS.mono,
          fontSize: 11.5,
          color: value ? t.body : t.muted,
          borderRadius: 6,
          borderBottom: `1.5px dashed transparent`,
        }}
        title="Click to edit lot"
      >
        {value || placeholder}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "5px 8px",
        borderRadius: 8,
        background: t.surfaceAlt,
        border: `1.5px solid ${t.primary}`,
        fontFamily: FONTS.mono,
        fontSize: 12,
        color: t.ink,
        outline: "none",
      }}
    />
  );
}

function EditableDate({
  t,
  value,
  onSave,
}: {
  t: typeof theme;
  value: Date | null;
  onSave: (next: Date | null) => void;
}) {
  const initial = value ? value.toISOString().slice(0, 10) : "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);

  function commit() {
    if (draft === initial) {
      setEditing(false);
      return;
    }
    if (!draft) {
      onSave(null);
    } else {
      const d = new Date(`${draft}T00:00:00Z`);
      if (!Number.isNaN(d.getTime())) onSave(d);
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(initial);
          setEditing(true);
        }}
        className="inline-edit-cell"
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "5px 6px",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: FONTS.mono,
          fontSize: 11.5,
          color: value ? t.body : t.muted,
          borderRadius: 6,
          borderBottom: `1.5px dashed transparent`,
        }}
        title="Click to edit expiry"
      >
        {value ? value.toLocaleDateString() : "—"}
      </button>
    );
  }
  return (
    <input
      autoFocus
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      style={{
        width: "100%",
        padding: "4px 6px",
        borderRadius: 8,
        background: t.surfaceAlt,
        border: `1.5px solid ${t.primary}`,
        fontFamily: FONTS.mono,
        fontSize: 11.5,
        color: t.ink,
        outline: "none",
      }}
    />
  );
}
