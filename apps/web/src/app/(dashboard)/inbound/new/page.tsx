"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
      utils.inbound.list.invalidate();
      router.push(`/inbound/${order!.id}`);
    },
  });

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [receivingLocationId, setReceivingLocationId] = useState<string>("");
  const [expectedAt, setExpectedAt] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);

  // Dock + staging locations in the selected warehouse — the candidates
  // for receiving. Fetched only once a warehouse is picked.
  const locations = trpc.location.listByWarehouse.useQuery(
    { warehouseId },
    { enabled: warehouseId.length > 0 },
  );
  const receivingCandidates = useMemo(
    () =>
      (locations.data ?? []).filter(
        (l) => l.type === "dock" || l.type === "staging",
      ),
    [locations.data],
  );

  function addLine() {
    const firstProductId = products.data?.[0]?.id;
    if (!firstProductId) return; // guarded by the banner below
    setLines((prev) => [...prev, { productId: firstProductId, qtyExpected: 1 }]);
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines(lines.map((l, j) => (i === j ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines(lines.filter((_, j) => j !== i));
  }

  // Catches the silent-save failure: the server rejects lines with
  // empty productId (fails UUID validation) and used to return a 400
  // that the form didn't display.
  const invalidLines = lines.some((l) => !l.productId);
  const canSubmit =
    !create.isPending && !!warehouseId && !!reference.trim() && lines.length > 0 && !invalidLines;

  return (
    <div>
      <PageTitle
        eyebrow="Expected shipment"
        title="New inbound"
        subtitle="Pre-register a shipment so your team can check it in on arrival."
      />

      <Card t={t}>
        {(products.data?.length ?? 0) === 0 && (
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
            before creating an inbound — you can't save an order without at least one line.
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
              supplier: supplier || undefined,
              supplierId: supplierId || undefined,
              customerId: customerId || undefined,
              receivingLocationId: receivingLocationId || undefined,
              expectedAt: expectedAt ? new Date(expectedAt) : undefined,
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
            <Field label="Order number">
              <TextField
                t={t}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="PO or reference from the supplier"
                required
              />
            </Field>
            <Field label="Expected on">
              <TextField
                t={t}
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
              />
            </Field>
          </div>

          <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
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
            </Field>
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

          <Field label="Supplier (free text; prints on receipt)">
            <TextField
              t={t}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Optional — only used if you didn't link a supplier above"
            />
          </Field>

          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, fontWeight: 600, color: t.ink }}>Lines</div>
              <Btn
                t={t}
                variant="secondary"
                size="sm"
                icon={Ic.Plus}
                type="button"
                onClick={addLine}
                disabled={(products.data?.length ?? 0) === 0}
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
                No lines yet. Add at least one to save.
              </div>
            )}

            {lines.map((l, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 32px",
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
                      {p.sku ? `${p.sku} — ${p.name}` : p.name}
                    </option>
                  ))}
                </Select>
                <TextField
                  t={t}
                  type="number"
                  min={1}
                  value={l.qtyExpected}
                  onChange={(e) =>
                    updateLine(i, { qtyExpected: Number(e.target.value) })
                  }
                  style={{ width: 120 }}
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  aria-label="Remove line"
                  style={{
                    width: 32,
                    height: 32,
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
                One or more lines is missing a product. Pick a product on every line before saving.
              </div>
            )}
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
