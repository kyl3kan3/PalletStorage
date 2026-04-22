"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";

interface Line {
  productId: string;
  qtyExpected: number;
}

export default function NewInboundPage() {
  const t = theme;
  const router = useRouter();
  const utils = trpc.useUtils();
  const warehouses = trpc.warehouse.list.useQuery();
  const products = trpc.product.search.useQuery({ q: "", limit: 100 });
  const suppliers = trpc.supplier.search.useQuery({ q: "", limit: 100 });
  const customers = trpc.customer.search.useQuery({ q: "", limit: 100 });
  const create = trpc.inbound.create.useMutation({
    onSuccess: (order) => {
      // Invalidate the list so "/inbound" reflects the new order the
      // next time it's visited (React Query's cache would otherwise
      // keep serving stale rows until the page remounts or refocuses).
      utils.inbound.list.invalidate();
      router.push(`/inbound/${order!.id}`);
    },
  });

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);

  function addLine() {
    setLines([...lines, { productId: products.data?.[0]?.id ?? "", qtyExpected: 1 }]);
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines(lines.map((l, j) => (i === j ? { ...l, ...patch } : l)));
  }

  return (
    <div>
      <PageTitle eyebrow="Create an ASN" title="New inbound" />

      <Card t={t}>
        <form
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!warehouseId || lines.length === 0) return;
            create.mutate({
              warehouseId,
              reference,
              supplier: supplier || undefined,
              supplierId: supplierId || undefined,
              customerId: customerId || undefined,
              lines,
            });
          }}
        >
          <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
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
            <Field label="Reference / PO">
              <TextField
                t={t}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required
              />
            </Field>
            <Field label="Supplier (free text)">
              <TextField
                t={t}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Legacy label; optional"
              />
            </Field>
          </div>

          <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Link supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— none —</option>
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Link customer (3PL client)">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— none —</option>
                {customers.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, fontWeight: 600, color: t.ink }}>Lines</div>
              <Btn t={t} variant="secondary" size="sm" icon={Ic.Plus} type="button" onClick={addLine}>
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
                No lines yet. Add at least one to save.
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
                  onChange={(e) => updateLine(i, { productId: e.target.value })}
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
                  value={l.qtyExpected}
                  onChange={(e) => updateLine(i, { qtyExpected: Number(e.target.value) })}
                  style={{ width: 120 }}
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
              {create.isPending ? "Creating…" : "Create inbound"}
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
