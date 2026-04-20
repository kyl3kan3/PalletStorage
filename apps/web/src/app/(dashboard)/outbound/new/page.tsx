"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, Input, PageHeader, Table, Td, Th } from "~/components/ui";

interface Line {
  productId: string;
  qtyOrdered: number;
}

export default function NewOutboundPage() {
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
      <PageHeader title="New outbound order" />
      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ warehouseId, reference, customer: customer || undefined, lines });
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
              <span className="text-xs text-slate-500">Reference</span>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Customer</span>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">Lines</h3>
              <Button
                type="button"
                onClick={() =>
                  setLines([...lines, { productId: products.data?.[0]?.id ?? "", qtyOrdered: 1 }])
                }
              >
                Add line
              </Button>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Qty ordered</Th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <Td>
                      <select
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
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
                      </select>
                    </Td>
                    <Td>
                      <Input
                        type="number"
                        min={1}
                        value={l.qtyOrdered}
                        className="w-24"
                        onChange={(e) =>
                          setLines(
                            lines.map((x, j) =>
                              j === i ? { ...x, qtyOrdered: Number(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <Button type="submit" disabled={create.isPending || lines.length === 0}>
            Create order
          </Button>
        </form>
      </Card>
    </div>
  );
}
