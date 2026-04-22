"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { HelpText } from "~/components/address-fields";

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

  return (
    <div>
      <PageTitle
        eyebrow="Sales order"
        title="New outbound order"
        subtitle="Set up what's going out and to whom. The shipping label prints automatically once you ship."
      />

      <Card t={t}>
        <form
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              warehouseId,
              reference,
              customer: customer || undefined,
              customerId: customerId || undefined,
              lines,
            });
          }}
        >
          {/* Essentials first. */}
          <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
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
            <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Customer (3PL client)">
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">— none —</option>
                  {customers.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <HelpText>Whose stock is this? Set up in Catalog → Customers.</HelpText>
              </Field>
              <Field label="Ship to (prints on shipping label)">
                <TextField
                  t={t}
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Receiver name, e.g. 'Main St Grocery'"
                />
                <HelpText>Who receives the truck at the other end. Often different from the customer account.</HelpText>
              </Field>
            </div>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, fontWeight: 600, color: t.ink }}>Lines</div>
              <Btn
                t={t}
                variant="secondary"
                size="sm"
                icon={Ic.Plus}
                type="button"
                onClick={() =>
                  setLines([...lines, { productId: products.data?.[0]?.id ?? "", qtyOrdered: 1 }])
                }
              >
                Add line
              </Btn>
            </div>

            {lines.length === 0 && (
              <div
                style={{
                  background: t.surfaceAlt,
                  borderRadius: 12,
                  padding: "16px",
                  border: `1.5px dashed ${t.border}`,
                  color: t.muted,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                No lines yet.
              </div>
            )}

            {lines.map((l, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px",
                  gap: 10,
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : `1.5px dashed ${t.border}`,
                  alignItems: "center",
                }}
              >
                <Select
                  value={l.productId}
                  onChange={(e) =>
                    setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))
                  }
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
                  style={{ width: 120 }}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, j) =>
                        j === i ? { ...x, qtyOrdered: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>

          <div>
            <Btn
              t={t}
              variant="accent"
              size="md"
              icon={Ic.Check}
              type="submit"
              disabled={create.isPending || lines.length === 0}
            >
              {create.isPending ? "Creating…" : "Create order"}
            </Btn>
          </div>
        </form>
      </Card>
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
