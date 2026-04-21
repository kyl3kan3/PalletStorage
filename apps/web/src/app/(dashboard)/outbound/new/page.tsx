"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";

interface Line {
  productId: string;
  qtyOrdered: number;
}

export default function NewOutboundPage() {
  const t = theme;
  const router = useRouter();
  const warehouses = trpc.warehouse.list.useQuery();
  const products = trpc.product.search.useQuery({ q: "", limit: 100 });
  const create = trpc.outbound.create.useMutation({
    onSuccess: (order) => router.push(`/outbound/${order!.id}`),
  });

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [customer, setCustomer] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  return (
    <div>
      <PageTitle eyebrow="Create a sales order" title="New outbound order" />

      <Card t={t}>
        <form
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ warehouseId, reference, customer: customer || undefined, lines });
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
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
            </Field>
            <Field label="Reference">
              <TextField
                t={t}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required
              />
            </Field>
            <Field label="Customer">
              <TextField
                t={t}
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </Field>
          </div>

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
                      {p.sku} — {p.name}
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
