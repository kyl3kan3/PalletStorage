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
    if (idx.name < 0) {
      alert("CSV must have at least a `name` column (`sku` is optional)");
      return;
    }
    type Row = {
      sku?: string;
      name: string;
      barcode?: string;
      weightKg?: number;
      velocityClass?: "A" | "B" | "C";
    };
    const products: Row[] = rows
      .map((row): Row | null => {
        const cells = row.split(",").map((c) => c.trim());
        const skuCell = idx.sku >= 0 ? cells[idx.sku] ?? "" : "";
        const name = cells[idx.name] ?? "";
        if (!name) return null; // name is the only required field now
        const velocityRaw = idx.velocity >= 0 ? cells[idx.velocity] : undefined;
        const weight = idx.weight >= 0 ? Number(cells[idx.weight]) : undefined;
        const velocity =
          velocityRaw === "A" || velocityRaw === "B" || velocityRaw === "C" ? velocityRaw : undefined;
        return {
          sku: skuCell || undefined,
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
        subtitle="Your item catalog. SKU (item code) is optional; velocity class A/B/C marks fast/medium/slow movers."
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
            create.mutate({ sku: sku.trim() || undefined, name, barcode: barcode || undefined });
            setSku("");
            setName("");
            setBarcode("");
          }}
        >
          <Field label="SKU (optional)">
            <TextField
              t={t}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. SKU-00001 — leave blank if unknown"
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
 * Inline-editable row. SKU, name, and unit price can all be edited
 * in place by clicking the value — Enter to save, Esc to cancel.
 * Weight is set at create-time / via CSV import and left read-only
 * here to keep the row uncluttered.
 */
function ProductRow({
  product,
}: {
  product: {
    id: string;
    sku: string | null;
    name: string;
    barcode: string | null;
    weightKg: string | null;
    velocityClass: string | null;
    unitPriceCents: number | null;
  };
}) {
  const t = theme;
  const utils = trpc.useUtils();
  const update = trpc.product.update.useMutation({
    onSuccess: () => utils.product.search.invalidate(),
  });

  // Each editable cell tracks its own draft + edit-mode flag; we
  // resync the draft whenever the row's underlying value changes
  // (e.g. after a successful save) so we never display stale text.
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
      <InlineText
        value={product.sku ?? ""}
        placeholder="(no SKU)"
        mono
        onSave={(next) =>
          update.mutate({ id: product.id, sku: next.trim() || null })
        }
      />
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <InlineText
          value={product.name}
          placeholder="name"
          onSave={(next) => {
            const trimmed = next.trim();
            if (trimmed && trimmed !== product.name) {
              update.mutate({ id: product.id, name: trimmed });
            }
          }}
        />
        {product.velocityClass && (
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
        )}
      </span>
      <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
        {product.barcode ?? "—"}
      </span>
      <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
        {product.weightKg ?? "—"}
      </span>
      <InlinePrice
        cents={product.unitPriceCents}
        onSave={(cents) =>
          update.mutate({ id: product.id, unitPriceCents: cents })
        }
      />
      {update.error && (
        <div
          style={{
            gridColumn: "1 / -1",
            fontSize: 11.5,
            color: t.coral,
            marginTop: 4,
          }}
        >
          {update.error.message}
        </div>
      )}
    </div>
  );
}

function InlineText({
  value,
  placeholder,
  onSave,
  mono = false,
}: {
  value: string;
  placeholder: string;
  onSave: (next: string) => void;
  mono?: boolean;
}) {
  const t = theme;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "text",
          textAlign: "left",
          color: value ? t.ink : t.muted,
          fontFamily: mono ? FONTS.mono : FONTS.sans,
          fontWeight: 600,
          fontSize: mono ? 13 : 13.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minWidth: 0,
          maxWidth: "100%",
        }}
        title={value || placeholder}
      >
        {value || placeholder}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "6px 10px",
        borderRadius: 8,
        background: t.surfaceAlt,
        border: `1.5px solid ${t.border}`,
        outline: "none",
        fontFamily: mono ? FONTS.mono : FONTS.sans,
        fontSize: 13,
        color: t.ink,
        minWidth: 0,
      }}
    />
  );
}

function InlinePrice({
  cents,
  onSave,
}: {
  cents: number | null;
  onSave: (next: number | null) => void;
}) {
  const t = theme;
  const initial = cents != null ? (cents / 100).toFixed(2) : "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (cents != null) onSave(null);
    } else {
      const n = Math.round(Number.parseFloat(trimmed) * 100);
      if (Number.isFinite(n) && n >= 0 && n !== cents) onSave(n);
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(initial);
          setEditing(true);
        }}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: FONTS.mono,
          fontSize: 13,
          color: cents != null ? t.ink : t.muted,
          fontWeight: 600,
        }}
      >
        {cents != null ? `$${(cents / 100).toFixed(2)}` : "set…"}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
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
