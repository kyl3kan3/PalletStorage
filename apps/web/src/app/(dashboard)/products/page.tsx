"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, Input, PageHeader, Table, Td, Th } from "~/components/ui";

export default function ProductsPage() {
  const utils = trpc.useUtils();
  const [q, setQ] = useState("");
  const list = trpc.product.search.useQuery({ q, limit: 50 });
  const create = trpc.product.create.useMutation({
    onSuccess: () => utils.product.search.invalidate(),
  });
  const bulk = trpc.product.bulkImport.useMutation({
    onSuccess: () => utils.product.search.invalidate(),
  });

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const [header, ...rows] = lines;
    if (!header) return;
    const cols = header.split(",").map((c) => c.trim().toLowerCase());
    const idx = {
      sku: cols.indexOf("sku"),
      name: cols.indexOf("name"),
      barcode: cols.indexOf("barcode"),
      weight: cols.indexOf("weight_kg"),
      velocity: cols.indexOf("velocity_class"),
    };
    if (idx.sku < 0 || idx.name < 0) {
      alert("CSV must have at least `sku` and `name` columns");
      return;
    }
    type Row = { sku: string; name: string; barcode?: string; weightKg?: number; velocityClass?: "A" | "B" | "C" };
    const products: Row[] = rows
      .map((row): Row | null => {
        const cells = row.split(",").map((c) => c.trim());
        const sku = cells[idx.sku] ?? "";
        const name = cells[idx.name] ?? "";
        if (!sku || !name) return null;
        const velocityRaw = idx.velocity >= 0 ? cells[idx.velocity] : undefined;
        const weight = idx.weight >= 0 ? Number(cells[idx.weight]) : undefined;
        const velocity =
          velocityRaw === "A" || velocityRaw === "B" || velocityRaw === "C" ? velocityRaw : undefined;
        return {
          sku,
          name,
          barcode: idx.barcode >= 0 ? cells[idx.barcode] || undefined : undefined,
          weightKg: Number.isFinite(weight) ? (weight as number) : undefined,
          velocityClass: velocity,
        };
      })
      .filter((p): p is Row => p !== null);
    if (products.length === 0) {
      alert("No valid rows in CSV");
      return;
    }
    await bulk.mutateAsync({ products });
    e.target.value = "";
  }

  return (
    <div>
      <PageHeader title="Products">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <span className="rounded-md border border-slate-300 bg-white px-3 py-1.5 shadow-sm hover:bg-slate-50">
            {bulk.isPending ? "Importing..." : "Import CSV"}
          </span>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
      </PageHeader>

      <Card>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ sku, name, barcode: barcode || undefined });
            setSku("");
            setName("");
            setBarcode("");
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">SKU</span>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Barcode</span>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </label>
          <Button type="submit" disabled={create.isPending}>
            Add product
          </Button>
        </form>
      </Card>

      <div className="mt-6">
        <Input
          placeholder="Search SKU, name, or barcode..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3 w-80"
        />
        <Table>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Name</Th>
              <Th>Barcode</Th>
              <Th>Weight (kg)</Th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((p) => (
              <tr key={p.id}>
                <Td>{p.sku}</Td>
                <Td>{p.name}</Td>
                <Td>{p.barcode ?? ""}</Td>
                <Td>{p.weightKg ?? ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
