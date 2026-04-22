"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { HelpText } from "~/components/address-fields";
import { NewCustomerModal } from "~/components/new-customer-modal";

interface Line {
  productId: string;
  qtyOrdered: number;
}

export default function NewOutboundPage() {
  const t = theme;
  const router = useRouter();
  const utils = trpc.useUtils();
  const warehouses = trpc.warehouse.list.useQuery();
  const products = trpc.product.search.useQuery({ q: "", limit: 100 });
  const customers = trpc.customer.search.useQuery({ q: "", limit: 100 });
  const create = trpc.outbound.create.useMutation({
    onSuccess: (order) => {
      utils.outbound.list.invalidate();
      router.push(`/outbound/${order!.id}`);
    },
  });

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  function addLine() {
    const firstProductId = products.data?.[0]?.id;
    if (!firstProductId) return;
    setLines((prev) => [...prev, { productId: firstProductId, qtyOrdered: 1 }]);
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
        eyebrow="Sales order"
        title="New outbound order"
        subtitle="Set up what's going out and to whom. The shipping label prints automatically once you ship."
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
            }}
          >
            No products in your catalog yet. Add one at{" "}
            <a href="/products" style={{ color: t.primaryDeep, fontWeight: 600 }}>
              /products
            </a>{" "}
            before creating an outbound — orders need at least one item.
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
              customer: customer || undefined,
              customerId: customerId || undefined,
              lines,
            });
          }}
        >
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
              <HelpText>Where the stock is stored now.</HelpText>
            </Field>
            <Field label="Order number">
              <TextField
                t={t}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. SO-12345"
                required
              />
              <HelpText>Your internal order or SO number.</HelpText>
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
            {showAdvanced ? "▾" : "▸"} More details (customer, ship-to)
          </button>

          {showAdvanced && (
            <>
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
                <HelpText>Whose stock is this? Leave blank for your own stock.</HelpText>
              </Field>
              <Field label="Ship to (prints on shipping label)">
                <TextField
                  t={t}
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Receiver name, e.g. 'Main St Grocery'"
                />
                <HelpText>
                  Who receives the truck at the other end. Often different from the customer account.
                </HelpText>
              </Field>
            </>
          )}

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
              Items on this order
            </div>

            {lines.length === 0 ? (
              <button
                type="button"
                onClick={addLine}
                disabled={noProducts}
                style={{
                  width: "100%",
                  padding: "28px 16px",
                  borderRadius: 14,
                  background: noProducts ? t.surfaceAlt : t.primarySoft,
                  border: `2px dashed ${noProducts ? t.border : t.primaryDeep}`,
                  cursor: noProducts ? "not-allowed" : "pointer",
                  color: noProducts ? t.muted : t.primaryDeep,
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
                    background: noProducts ? t.surface : t.primary,
                    color: noProducts ? t.muted : t.primaryText,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  +
                </div>
                <div>Add an item to this order</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.muted }}>
                  {noProducts
                    ? "Add a product to your catalog first"
                    : "Click to pick a product and set the ordered quantity"}
                </div>
              </button>
            ) : (
              <Card t={t} padding={0}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 120px 36px",
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
                  <div>Ordered qty</div>
                  <div />
                </div>
                {lines.map((l, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 120px 36px",
                      gap: 10,
                      padding: "10px 16px",
                      borderTop: `1.5px dashed ${t.border}`,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
                      {i + 1}
                    </span>
                    <Select
                      value={l.productId}
                      onChange={(e) => updateLine(i, { productId: e.target.value })}
                    >
                      {products.data?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku ? `${p.sku} — ${p.name}` : p.name}
                        </option>
                      ))}
                    </Select>
                    <TextField
                      t={t}
                      type="number"
                      min={1}
                      value={l.qtyOrdered}
                      onChange={(e) =>
                        updateLine(i, { qtyOrdered: Number(e.target.value) })
                      }
                    />
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
                  disabled={noProducts}
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
                    cursor: noProducts ? "not-allowed" : "pointer",
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
              {create.isPending ? "Creating…" : "Create order"}
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
