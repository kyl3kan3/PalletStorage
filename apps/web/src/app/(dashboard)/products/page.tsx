"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Search, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";

export default function ProductsPage() {
  const t = theme;
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
    type Row = {
      sku: string;
      name: string;
      barcode?: string;
      weightKg?: number;
      velocityClass?: "A" | "B" | "C";
    };
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
      <PageTitle
        eyebrow="Catalog"
        title="Products"
        subtitle="SKUs, barcodes, and velocity classes."
        right={
          <label style={{ display: "inline-flex", cursor: "pointer" }}>
            <span>
              <Btn t={t} variant="secondary" size="md" icon={Ic.Download}>
                {bulk.isPending ? "Importing…" : "Import CSV"}
              </Btn>
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              style={{ display: "none" }}
            />
          </label>
        }
      />

      <Card t={t}>
        <form
          style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ sku, name, barcode: barcode || undefined });
            setSku("");
            setName("");
            setBarcode("");
          }}
        >
          <Field label="SKU">
            <TextField
              t={t}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU-00001"
              required
            />
          </Field>
          <Field label="Name">
            <TextField
              t={t}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Widget"
              required
            />
          </Field>
          <Field label="Barcode">
            <TextField
              t={t}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="optional"
            />
          </Field>
          <Btn t={t} variant="accent" size="md" icon={Ic.Plus} type="submit" disabled={create.isPending}>
            Add product
          </Btn>
        </form>
      </Card>

      <div style={{ marginTop: 20, marginBottom: 12 }}>
        <Search
          t={t}
          value={q}
          placeholder="Search SKU, name, or barcode…"
          width={360}
          onChange={setQ}
        />
      </div>

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 140px 90px 120px",
            gap: 16,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        >
          <div>SKU</div>
          <div>Name</div>
          <div>Barcode</div>
          <div>Weight</div>
          <div>Unit price</div>
        </div>
        {(list.data?.length ?? 0) === 0 && (
          <div
            style={{
              padding: "28px 20px",
              color: t.muted,
              fontSize: 13,
              borderTop: `1.5px dashed ${t.border}`,
              textAlign: "center",
            }}
          >
            No products match.
          </div>
        )}
        {list.data?.map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}
      </Card>
    </div>
  );
}

/**
 * Inline-editable row. Price is the only field editable here for now —
 * SKU, name, barcode, weight are all set at product creation.
 */
function ProductRow({
  product,
}: {
  product: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    weightKg: string | null;
    velocityClass: string | null;
    unitPriceCents: number | null;
  };
}) {
  const t = theme;
  const utils = trpc.useUtils();
  const setPrice = trpc.product.setPrice.useMutation({
    onSuccess: () => utils.product.search.invalidate(),
  });
  const [draft, setDraft] = useState(
    product.unitPriceCents != null ? (product.unitPriceCents / 100).toFixed(2) : "",
  );
  const [editing, setEditing] = useState(false);

  function commit() {
    const parsed = draft.trim() === "" ? null : Math.round(Number.parseFloat(draft) * 100);
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) return;
    setPrice.mutate({ id: product.id, unitPriceCents: parsed });
    setEditing(false);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr 140px 90px 120px",
        gap: 16,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: `1.5px dashed ${t.border}`,
        fontSize: 13.5,
        color: t.body,
      }}
    >
      <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>{product.sku}</span>
      <span>
        {product.name}
        {product.velocityClass && (
          <span style={{ marginLeft: 8 }}>
            <Tag
              t={t}
              tone={
                product.velocityClass === "A"
                  ? "primary"
                  : product.velocityClass === "B"
                    ? "sky"
                    : "neutral"
              }
            >
              {product.velocityClass}
            </Tag>
          </span>
        )}
      </span>
      <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
        {product.barcode ?? "—"}
      </span>
      <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
        {product.weightKg ?? "—"}
      </span>
      <span>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="0.00"
            style={{
              width: 90,
              padding: "6px 10px",
              borderRadius: 10,
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              outline: "none",
              fontFamily: FONTS.mono,
              fontSize: 13,
              color: t.ink,
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: FONTS.mono,
              fontSize: 13,
              color: product.unitPriceCents != null ? t.ink : t.muted,
              fontWeight: 600,
            }}
          >
            {product.unitPriceCents != null ? `$${(product.unitPriceCents / 100).toFixed(2)}` : "set…"}
          </button>
        )}
      </span>
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
