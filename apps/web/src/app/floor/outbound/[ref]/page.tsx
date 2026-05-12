"use client";

import { use, useMemo } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS, Cubby } from "~/lib/theme";
import { Ic } from "~/components/icons";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Outbound detail at /floor/outbound/[ref]. The route param
 * is the order UUID (from the list page link); we keep the file
 * pathname [ref] for back-compat with handoff naming.
 *
 * outbound.byId returns { order, lines }; lines carry productId only
 * (no joined name/SKU). We bulk-fetch products via product.search and
 * build a client-side map for the lines table. Picks / crew aren't in
 * the byId payload, so the stepper status reflects only the order's
 * raw status field.
 */

export default function FloorOutboundDetail({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref: id } = use(params);
  const detail = trpc.outbound.byId.useQuery(
    { id },
    { enabled: !!id, refetchInterval: 30_000 },
  );
  // Bulk product lookup; capped at 500 SKUs per org (procedure limit)
  const products = trpc.product.search.useQuery({ q: "", limit: 500 });

  const productMap = useMemo(() => {
    const m = new Map<string, { sku: string | null; name: string }>();
    for (const p of products.data ?? []) m.set(p.id, { sku: p.sku, name: p.name });
    return m;
  }, [products.data]);

  if (detail.isLoading || products.isLoading) {
    return (
      <FShell eyebrow="Order detail" title="Loading…">
        <Skeleton t={t} lines={6} rowHeight={64} />
      </FShell>
    );
  }
  if (!detail.data) {
    return (
      <FShell eyebrow="Order detail" title="Not found">
        <FCard t={t}>
          <EmptyState
            t={t}
            title="Order not found"
            hint="It may have been deleted, cancelled, or belongs to a different organization."
          />
        </FCard>
      </FShell>
    );
  }

  const { order, lines } = detail.data;
  const activeStep = ORDER_STEPS.indexOf(order.status as (typeof ORDER_STEPS)[number]);

  return (
    <FShell
      eyebrow={`Order · ${order.reference}`}
      title={order.reference}
      subtitle={
        order.customer
          ? `${order.customer}${order.shipBy ? ` · ships ${formatRelative(new Date(order.shipBy))}` : ""}`
          : undefined
      }
      actions={
        <>
          {(order.status === "open" || order.status === "picking") && (
            <FBtn t={t} variant="danger" size="md">
              Cancel order
            </FBtn>
          )}
          {order.status === "picking" && (
            <FBtn t={t} variant="primary" size="md" icon={Ic.Check}>
              Mark packed
            </FBtn>
          )}
        </>
      }
    >
      {/* Stepper */}
      <FCard t={t} padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {ORDER_STEPS.map((step, i) => {
            const done = activeStep >= 0 && i < activeStep;
            const active = i === activeStep;
            return (
              <div
                key={step}
                style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 14px",
                    borderRadius: 12,
                    background: active ? t.primarySoft : done ? t.mintSoft : t.surface,
                    border: `1px solid ${active ? "rgba(255,178,62,.35)" : done ? "rgba(127,216,168,.35)" : t.border}`,
                    boxShadow: active ? `0 0 16px ${t.primaryGlow}` : undefined,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: active ? t.primary : done ? t.mint : t.surfaceAlt,
                      color: active ? t.primaryText : done ? "#0F4D2E" : t.muted,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: active ? t.primary : done ? t.mint : t.muted,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {step}
                  </span>
                </div>
                {i < ORDER_STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 3,
                      background: done ? t.mint : t.surfaceAlt,
                      borderRadius: 2,
                      boxShadow: done ? `0 0 8px rgba(127,216,168,.4)` : undefined,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </FCard>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Lines */}
        <FCard t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "32px 110px 1fr 70px 70px 1fr",
              gap: 12,
              padding: "14px 20px",
              fontFamily: FONTS.mono,
              fontSize: 10,
              fontWeight: 700,
              color: t.muted,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            <div>#</div>
            <div>SKU</div>
            <div>Name</div>
            <div>Ord</div>
            <div>Picked</div>
            <div>Progress</div>
          </div>
          {lines.length === 0 && (
            <EmptyState t={t} title="No lines on this order" />
          )}
          {lines.map((l, i) => {
            const product = productMap.get(l.productId);
            const pct = l.qtyOrdered ? l.qtyPicked / l.qtyOrdered : 0;
            const done = pct >= 1;
            const active = !done && order.status === "picking" && l.qtyPicked > 0;
            return (
              <div
                key={l.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 110px 1fr 70px 70px 1fr",
                  gap: 12,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: `1px dashed ${t.border}`,
                  background: active ? t.primarySoft : undefined,
                }}
              >
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>
                  {i + 1}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: t.ink,
                  }}
                >
                  {product?.sku ?? "—"}
                </span>
                <span style={{ fontSize: 13, color: t.body }}>
                  {product?.name ?? `Product ${l.productId.slice(0, 8)}`}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 800,
                    color: t.ink,
                  }}
                >
                  {l.qtyOrdered}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 800,
                    color: done ? t.mint : t.ink,
                  }}
                >
                  {l.qtyPicked}
                </span>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: t.surfaceAlt,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, pct * 100)}%`,
                      height: "100%",
                      background: done ? t.mint : t.primary,
                      boxShadow: active ? `0 0 8px ${t.primaryGlow}` : undefined,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </FCard>

        {/* Right column: status meta */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FCard t={t} padding={20}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <Cubby
                size={52}
                t={t}
                mood={
                  order.status === "shipped"
                    ? "happy"
                    : order.status === "cancelled"
                      ? "sleep"
                      : "think"
                }
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <FPill
                  t={t}
                  tone={
                    order.status === "shipped"
                      ? "mint"
                      : order.status === "cancelled"
                        ? "coral"
                        : "primary"
                  }
                  size="sm"
                >
                  {order.status}
                </FPill>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    color: t.body,
                    lineHeight: 1.5,
                  }}
                >
                  {statusBlurb(order)}
                </div>
              </div>
            </div>
          </FCard>

          {/* Ship info */}
          <FCard t={t} padding={20}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10.5,
                fontWeight: 800,
                color: t.muted,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Ship info
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <Stat
                label="Ship by"
                value={
                  order.shipBy
                    ? new Date(order.shipBy).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"
                }
                mono
              />
              <Stat
                label="Shipped"
                value={
                  order.shippedAt
                    ? new Date(order.shippedAt).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"
                }
                mono
              />
              <Stat label="Customer" value={order.customer ?? "—"} />
              <Stat label="Lines" value={String(lines.length)} mono />
            </div>
          </FCard>
        </div>
      </div>
    </FShell>
  );
}

const ORDER_STEPS = ["open", "picking", "packed", "shipped"] as const;

function statusBlurb(order: {
  status: string;
  shipBy: Date | null;
  shippedAt: Date | null;
  cancelledAt: Date | null;
}): string {
  if (order.status === "shipped" && order.shippedAt) {
    return `Shipped ${formatRelative(new Date(order.shippedAt))}.`;
  }
  if (order.status === "cancelled" && order.cancelledAt) {
    return `Cancelled ${formatRelative(new Date(order.cancelledAt))}.`;
  }
  if (order.status === "picking") {
    return order.shipBy
      ? `In picking — ships ${formatRelative(new Date(order.shipBy))}.`
      : "In picking.";
  }
  if (order.status === "packed") return "Packed and staged for loading.";
  if (order.status === "open") return "Open. Generate picks to allocate stock.";
  return "Draft.";
}

function formatRelative(date: Date): string {
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  if (mins < 60)
    return diff > 0 ? `in ${mins}m` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24)
    return diff > 0 ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          color: t.mutedSoft,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: mono ? FONTS.mono : FONTS.sans,
          fontSize: 13,
          fontWeight: mono ? 800 : 600,
          color: t.ink,
          letterSpacing: mono ? 0.3 : -0.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
