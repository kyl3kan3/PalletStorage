"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { HelpText } from "~/components/address-fields";
import { NewCustomerModal } from "~/components/new-customer-modal";
import { NewProductModal } from "~/components/new-product-modal";

type QtyUnit = "each" | "case" | "pallet";

interface Line {
  productId: string;
  qtyExpected: number;
  qtyUnit: QtyUnit;
}

export default function NewInboundPage() {
  const t = theme;
  const router = useRouter();
  const utils = trpc.useUtils();
  const warehouses = trpc.warehouse.list.useQuery();
  const products = trpc.product.search.useQuery({ q: "", limit: 100 });
  const customers = trpc.customer.search.useQuery({ q: "", limit: 100 });
  const create = trpc.inbound.create.useMutation({
    onSuccess: (order) => {
      utils.inbound.list.invalidate();
      router.push(`/inbound/${order!.id}`);
    },
  });

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [receivingLocationId, setReceivingLocationId] = useState<string>("");
  const [expectedAt, setExpectedAt] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newProductRow, setNewProductRow] = useState<number | null>(null);

  const locations = trpc.location.listByWarehouse.useQuery(
    { warehouseId },
    { enabled: warehouseId.length > 0 },
  );
  const receivingCandidates = useMemo(
    () =>
      (locations.data ?? []).filter((l) => l.type === "dock" || l.type === "staging"),
    [locations.data],
  );

  // "+ Add another item" — appends a row with the first catalog product
  // pre-selected so the user can change it. If the catalog is empty it
  // falls through to creating a product (same popup as the big empty-
  // state button).
  function addLine() {
    const firstProductId = products.data?.[0]?.id;
    if (!firstProductId) {
      setNewProductRow(-1);
      return;
    }
    setLines((prev) => [
      ...prev,
      { productId: firstProductId, qtyExpected: 1, qtyUnit: "each" },
    ]);
  }
  function onProductCreated(id: string) {
    if (newProductRow === null) return;
    if (newProductRow === -1) {
      setLines((prev) => [...prev, { productId: id, qtyExpected: 1, qtyUnit: "each" }]);
    } else {
      const row = newProductRow;
      setLines((prev) => prev.map((l, j) => (j === row ? { ...l, productId: id } : l)));
    }
    setNewProductRow(null);
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines(lines.map((l, j) => (i === j ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines(lines.filter((_, j) => j !== i));
  }

  const invalidLines = lines.some((l) => !l.productId);
  const canSubmit =
    !create.isPending && !!warehouseId && !!reference.trim() && lines.length > 0 && !invalidLines;
  const noProducts = (products.data?.length ?? 0) === 0;

  return (
    <div>
      <PageTitle
        eyebrow="Expected shipment"
        title="New inbound"
        subtitle="Pre-register a shipment so your team can check it in on arrival."
      />

      <Card t={t}>
        {noProducts && (
          <div
            style={{
              background: t.coralSoft,
              color: t.ink,
              padding: "10px 14px",
              borderRadius: 10,
              marginBottom: 14,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>No products in your catalog yet. Add one now to keep going.</span>
            <Btn
              t={t}
              type="button"
              variant="secondary"
              size="sm"
              icon={Ic.Plus}
              onClick={() => setNewProductRow(-1)}
            >
              New product
            </Btn>
          </div>
        )}

        <form
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            create.mutate({
              warehouseId,
              reference,
              customerId: customerId || undefined,
              receivingLocationId: receivingLocationId || undefined,
              expectedAt: expectedAt ? new Date(expectedAt) : undefined,
              lines,
            });
          }}
        >
          {/* Essentials. */}
          <div
            data-collapse-grid
            style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}
          >
            <Field label="Warehouse">
              <Select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {warehouses.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </Select>
              <HelpText>Where the shipment is arriving.</HelpText>
            </Field>
            <Field label="Order number">
              <TextField
                t={t}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="PO or reference from the sender"
                required
              />
              <HelpText>The PO number or any code on the paperwork.</HelpText>
            </Field>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: t.primaryDeep,
              fontSize: 12.5,
              fontWeight: 600,
              padding: 0,
              textAlign: "left",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {showAdvanced ? "▾" : "▸"} More details (customer, dock, date)
          </button>

          {showAdvanced && (
            <>
              <div
                data-collapse-grid
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
              >
                <Field label="Expected on">
                  <TextField
                    t={t}
                    type="date"
                    value={expectedAt}
                    onChange={(e) => setExpectedAt(e.target.value)}
                  />
                  <HelpText>When you expect the truck to arrive.</HelpText>
                </Field>
                <Field label="Receiving location">
                  <Select
                    value={receivingLocationId}
                    onChange={(e) => setReceivingLocationId(e.target.value)}
                    disabled={!warehouseId}
                  >
                    <option value="">— none —</option>
                    {receivingCandidates.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} ({l.type})
                      </option>
                    ))}
                  </Select>
                  <HelpText>Which dock door or staging bin it&apos;s headed to.</HelpText>
                </Field>
              </div>

              <Field label="Customer (3PL client)">
                <div style={{ display: "flex", gap: 8 }}>
                  <Select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">— none —</option>
                    {customers.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Btn
                    t={t}
                    type="button"
                    variant="secondary"
                    size="md"
                    icon={Ic.Plus}
                    onClick={() => setNewCustomerOpen(true)}
                  >
                    New
                  </Btn>
                </div>
                <HelpText>
                  Who <em>owns</em> the pallets once they land. Leave blank if it&apos;s your own stock —
                  only needed when warehousing on behalf of a client.
                </HelpText>
              </Field>
            </>
          )}

          {/* Items section — the big clickable empty state IS the "add
              item" button, so there's no separate button above to
              hunt for. With items, a smaller link appears at the
              bottom of the list for adding another. */}
          <div>
            <div
              style={{
                fontSize: 11,
                color: t.muted,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              Items on this shipment
            </div>

            {lines.length === 0 ? (
              <button
                type="button"
                onClick={() => setNewProductRow(-1)}
                style={{
                  width: "100%",
                  padding: "28px 16px",
                  borderRadius: 14,
                  background: t.primarySoft,
                  border: `2px dashed ${t.primaryDeep}`,
                  cursor: "pointer",
                  color: t.primaryDeep,
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: t.primary,
                    color: t.primaryText,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  +
                </div>
                <div>Add an item to this shipment</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.muted }}>
                  Click to create a new product and add it to this shipment
                </div>
              </button>
            ) : (
              <Card t={t} padding={0}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 180px 36px",
                    gap: 10,
                    padding: "10px 16px",
                    fontSize: 10.5,
                    color: t.muted,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    fontWeight: 600,
                  }}
                >
                  <div>#</div>
                  <div>Product</div>
                  <div>Expected qty</div>
                  <div />
                </div>
                {lines.map((l, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 180px 36px",
                      gap: 10,
                      padding: "10px 16px",
                      borderTop: `1.5px dashed ${t.border}`,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
                      {i + 1}
                    </span>
                    <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
                      <Select
                        value={l.productId}
                        onChange={(e) => updateLine(i, { productId: e.target.value })}
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        {products.data?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku ? `${p.sku} — ${p.name}` : p.name}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        onClick={() => setNewProductRow(i)}
                        title="Add a new product"
                        aria-label="Add a new product"
                        style={{
                          width: 34,
                          minWidth: 34,
                          borderRadius: 10,
                          background: t.surfaceAlt,
                          border: `1.5px solid ${t.border}`,
                          color: t.primaryDeep,
                          cursor: "pointer",
                          fontSize: 16,
                          fontWeight: 700,
                          lineHeight: 1,
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
                      <TextField
                        t={t}
                        type="number"
                        min={1}
                        value={l.qtyExpected}
                        onChange={(e) =>
                          updateLine(i, { qtyExpected: Number(e.target.value) })
                        }
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <Select
                        value={l.qtyUnit}
                        onChange={(e) =>
                          updateLine(i, { qtyUnit: e.target.value as QtyUnit })
                        }
                        aria-label="Unit"
                        style={{ width: 90 }}
                      >
                        <option value="each">items</option>
                        <option value="case">cases</option>
                        <option value="pallet">pallets</option>
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      aria-label="Remove item"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: "transparent",
                        border: `1.5px solid ${t.border}`,
                        color: t.muted,
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLine}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    borderTop: `1.5px dashed ${t.border}`,
                    background: "transparent",
                    border: "none",
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    color: t.primaryDeep,
                    fontFamily: FONTS.sans,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  + Add another item
                </button>
              </Card>
            )}
          </div>

          <div>
            <Btn
              t={t}
              variant="accent"
              size="md"
              icon={Ic.Check}
              type="submit"
              disabled={!canSubmit}
            >
              {create.isPending ? "Creating…" : "Create inbound"}
            </Btn>
            {create.error && (
              <div
                style={{
                  marginTop: 10,
                  color: t.coral,
                  fontSize: 13,
                  background: t.coralSoft,
                  padding: "8px 12px",
                  borderRadius: 8,
                }}
              >
                {create.error.message}
              </div>
            )}
            {invalidLines && (
              <div style={{ marginTop: 8, color: t.coral, fontSize: 12 }}>
                One or more items is missing a product. Pick a product on every row before saving.
              </div>
            )}
          </div>
        </form>
      </Card>

      <NewCustomerModal
        open={newCustomerOpen}
        onClose={() => setNewCustomerOpen(false)}
        onCreated={(id) => setCustomerId(id)}
      />

      <NewProductModal
        open={newProductRow !== null}
        onClose={() => setNewProductRow(null)}
        onCreated={onProductCreated}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          color: theme.muted,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  style,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      style={{
        padding: "9px 14px",
        borderRadius: 12,
        background: theme.surfaceAlt,
        border: `1.5px solid ${theme.border}`,
        outline: "none",
        fontFamily: FONTS.sans,
        fontSize: 13.5,
        color: theme.ink,
        cursor: "pointer",
        ...(style || {}),
      }}
    />
  );
}
