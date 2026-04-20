"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, Input, PageHeader, Table, Td, Th } from "~/components/ui";

interface Line {
  productId: string;
  qtyExpected: number;
}

export default function NewInboundPage() {
  const router = useRouter();
  const warehouses = trpc.warehouse.list.useQuery();
  const products = trpc.product.search.useQuery({ q: "", limit: 100 });
  const create = trpc.inbound.create.useMutation({
    onSuccess: (order) => router.push(`/inbound/${order!.id}`),
  });

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [supplier, setSupplier] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  function addLine() {
    setLines([...lines, { productId: products.data?.[0]?.id ?? "", qtyExpected: 1 }]);
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines(lines.map((l, j) => (i === j ? { ...l, ...patch } : l)));
  }

  return (
    <div>
      <PageHeader title="New inbound" />

      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!warehouseId || lines.length === 0) return;
            create.mutate({ warehouseId, reference, supplier: supplier || undefined, lines });
          }}
        >
          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Warehouse</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
              >
                <option value="">Select...</option>
                {warehouses.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Reference / PO</span>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Supplier</span>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">Lines</h3>
              <Button type="button" onClick={addLine}>
                Add line
              </Button>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Qty expected</Th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <Td>
                      <select
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        value={l.productId}
                        onChange={(e) => updateLine(i, { productId: e.target.value })}
                      >
                        {products.data?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <Input
                        type="number"
                        min={1}
                        value={l.qtyExpected}
                        onChange={(e) => updateLine(i, { qtyExpected: Number(e.target.value) })}
                        className="w-24"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <Button type="submit" disabled={create.isPending || lines.length === 0}>
            {create.isPending ? "Creating..." : "Create inbound"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
