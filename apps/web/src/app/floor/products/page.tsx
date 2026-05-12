"use client";

import { useMemo, useState } from "react";
import { FShell, type FShellTab } from "~/components/floor-shell";
import { FCard, FBtn, FPill, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { Ic } from "~/components/icons";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Products list at /floor/products.
 *
 * Tabs filter by velocity class (A / B / C). The product router's
 * `search` query already returns per-product `storedQty` so we render
 * "on hand" without a second roundtrip; per-product loc count isn't
 * in the procedure today so we omit the column instead of faking it.
 */

const TABS: Array<FShellTab & { vel: "A" | "B" | "C" | null }> = [
  { key: "all", label: "All", vel: null },
  { key: "A", label: "A", vel: "A" },
  { key: "B", label: "B", vel: "B" },
  { key: "C", label: "C", vel: "C" },
];

export default function FloorProductsList() {
  const [tab, setTab] = useState("all");

  // product.search currently returns id / sku / name / barcode /
  // weightKg / velocityClass / unitPriceCents / storedQty / totalQty
  // — everything we need except per-product location count.
  const list = trpc.product.search.useQuery({ q: "", limit: 500 });

  const grouped = useMemo(() => {
    const all = list.data ?? [];
    return {
      all: all.length,
      A: all.filter((p) => p.velocityClass === "A").length,
      B: all.filter((p) => p.velocityClass === "B").length,
      C: all.filter((p) => p.velocityClass === "C").length,
    };
  }, [list.data]);

  const filtered = useMemo(() => {
    const all = list.data ?? [];
    const active = TABS.find((tb) => tb.key === tab);
    if (!active?.vel) return all;
    return all.filter((p) => p.velocityClass === active.vel);
  }, [list.data, tab]);

  const tabs: FShellTab[] = TABS.map((tb) => ({
    key: tb.key,
    label: tb.label,
    count: grouped[tb.key as keyof typeof grouped],
  }));

  const totalCount = grouped.all;
  const withPrice = useMemo(
    () =>
      (list.data ?? []).filter((p) => p.unitPriceCents != null && p.unitPriceCents > 0)
        .length,
    [list.data],
  );
  const pricePct = totalCount > 0 ? Math.round((withPrice / totalCount) * 100) : 0;

  return (
    <FShell
      eyebrow="Catalog"
      title="Products"
      subtitle={
        list.isLoading
          ? "Loading…"
          : `${totalCount.toLocaleString()} SKUs · ${pricePct}% have prices`
      }
      tabs={tabs}
      tabActive={tab}
      onTabChange={setTab}
      actions={
        <FBtn t={t} variant="ghost" size="md" icon={Ic.Filter}>
          Filter
        </FBtn>
      }
    >
      <FCard t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1.4fr 140px 80px 70px 120px",
            gap: 14,
            padding: "12px 20px",
            fontFamily: FONTS.mono,
            fontSize: 10,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          <div>SKU</div>
          <div>Name</div>
          <div>Barcode</div>
          <div>Weight</div>
          <div>Vel</div>
          <div style={{ textAlign: "right" }}>On hand</div>
        </div>
        {list.isLoading && (
          <div style={{ padding: 20 }}>
            <Skeleton t={t} lines={6} rowHeight={44} />
          </div>
        )}
        {!list.isLoading && filtered.length === 0 && (
          <EmptyState
            t={t}
            title={
              tab === "all"
                ? "No products yet"
                : `No ${tab} velocity products`
            }
            hint={
              tab === "all"
                ? "Add a product on the legacy /products page to start populating the catalog."
                : "Try a different velocity tab or add velocity class to your existing products."
            }
          />
        )}
        {filtered.map((p) => (
          <div
            key={p.id}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1.4fr 140px 80px 70px 120px",
              gap: 14,
              padding: "12px 20px",
              alignItems: "center",
              borderTop: `1px dashed ${t.border}`,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: 0.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {p.sku ?? "—"}
            </span>
            <span style={{ fontSize: 13, color: t.body }}>{p.name}</span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11.5,
                color: t.muted,
              }}
            >
              {p.barcode ?? "—"}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.body }}>
              {p.weightKg ? `${p.weightKg} kg` : "—"}
            </span>
            <span>
              {p.velocityClass ? (
                <FPill t={t} tone={velocityTone(p.velocityClass)} size="sm">
                  {p.velocityClass}
                </FPill>
              ) : (
                <span style={{ color: t.mutedSoft, fontFamily: FONTS.mono, fontSize: 11 }}>
                  —
                </span>
              )}
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 14,
                fontWeight: 800,
                color: p.storedQty > 0 ? t.ink : t.muted,
                textAlign: "right",
                letterSpacing: -0.3,
              }}
            >
              {p.storedQty.toLocaleString()}
            </span>
          </div>
        ))}
      </FCard>
    </FShell>
  );
}

function velocityTone(v: string | null): "primary" | "sky" | "neutral" {
  if (v === "A") return "primary";
  if (v === "B") return "sky";
  return "neutral";
}
