"use client";

import { use, useMemo } from "react";
import { FShell } from "~/components/floor-shell";
import { FCard, FBtn, FPill, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS, Cubby } from "~/lib/theme";
import { Ic } from "~/components/icons";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Inbound detail at /floor/inbound/[ref]. Route param is
 * the order UUID; filename keeps [ref] for handoff parity.
 *
 * inbound.byId returns { order, lines }. Lines are raw with only
 * productId; product.search gives us the bulk product map. Variance
 * pills are computed from (qtyReceived - qtyExpected) per line.
 */

export default function FloorInboundDetail({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref: id } = use(params);
  const detail = trpc.inbound.byId.useQuery(
    { id },
    { enabled: !!id, refetchInterval: 30_000 },
  );
  const products = trpc.product.search.useQuery({ q: "", limit: 500 });

  const productMap = useMemo(() => {
    const m = new Map<string, { sku: string | null; name: string }>();
    for (const p of products.data ?? []) m.set(p.id, { sku: p.sku, name: p.name });
    return m;
  }, [products.data]);

  if (detail.isLoading || products.isLoading) {
    return (
      <FShell eyebrow="Receiving" title="Loading…">
        <Skeleton t={t} lines={6} rowHeight={64} />
      </FShell>
    );
  }
  if (!detail.data) {
    return (
      <FShell eyebrow="Receiving" title="Not found">
        <FCard t={t}>
          <EmptyState t={t} title="Order not found" />
        </FCard>
      </FShell>
    );
  }

  const { order, lines } = detail.data;
  const totalExp = lines.reduce((n, l) => n + l.qtyExpected, 0);
  const totalRecv = lines.reduce((n, l) => n + l.qtyReceived, 0);
  const variance = totalRecv - totalExp;
  const shortLines = lines.filter((l) => l.qtyReceived < l.qtyExpected).length;

  return (
    <FShell
      eyebrow={`Receiving · ${order.reference}`}
      title={order.reference}
      subtitle={
        order.supplier
          ? `${order.supplier}${variance !== 0 ? ` · ${variance > 0 ? "+" : ""}${variance} variance` : ""}`
          : undefined
      }
      actions={
        <>
          {order.status === "receiving" && (
            <FBtn t={t} variant="primary" size="md" icon={Ic.Check}>
              Close order
            </FBtn>
          )}
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Lines */}
        <FCard t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "32px 110px 1fr 80px 80px 110px",
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
            <div>Exp.</div>
            <div>Recv.</div>
            <div style={{ textAlign: "right" }}>Variance</div>
          </div>
          {lines.length === 0 && <EmptyState t={t} title="No lines on this order" />}
          {lines.map((l, i) => {
            const v = l.qtyReceived - l.qtyExpected;
            const matched = v === 0 && l.qtyReceived > 0;
            const short = v < 0;
            const product = productMap.get(l.productId);
            return (
              <div
                key={l.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 110px 1fr 80px 80px 110px",
                  gap: 12,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: `1px dashed ${t.border}`,
                  background: short
                    ? t.coralSoft
                    : matched
                      ? t.mintSoft
                      : undefined,
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
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.body,
                  }}
                >
                  {l.qtyExpected}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 800,
                    color: t.ink,
                  }}
                >
                  {l.qtyReceived}
                </span>
                <span style={{ textAlign: "right" }}>
                  {l.qtyReceived === 0 ? (
                    <FPill t={t} tone="neutral" size="sm">
                      pending
                    </FPill>
                  ) : matched ? (
                    <FPill t={t} tone="mint" size="sm">
                      MATCHED
                    </FPill>
                  ) : short ? (
                    <FPill t={t} tone="coral" size="sm">
                      −{Math.abs(v)} short
                    </FPill>
                  ) : (
                    <FPill t={t} tone="primary" size="sm">
                      +{v} over
                    </FPill>
                  )}
                </span>
              </div>
            );
          })}
        </FCard>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Variance Cubby — shown when there's a short */}
          {shortLines > 0 && (
            <FCard
              t={t}
              padding={20}
              style={{
                borderTop: `2px solid ${t.coral}`,
                boxShadow: `0 8px 24px rgba(255,107,91,.15), 0 1px 0 rgba(255,255,255,.03)`,
              }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <Cubby size={48} t={t} mood="wow" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <FPill t={t} tone="coral" size="sm">
                    HEADS UP · VARIANCE
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
                    Heads up —{" "}
                    <strong style={{ color: t.ink }}>
                      {Math.abs(variance)} units short
                    </strong>{" "}
                    across {shortLines} line{shortLines > 1 ? "s" : ""}.
                    {order.status === "receiving" &&
                      " Log a reason before closing."}
                  </div>
                  {order.status === "receiving" && (
                    <div style={{ marginTop: 14 }}>
                      <FBtn t={t} variant="danger" size="md" full>
                        Log reason
                      </FBtn>
                    </div>
                  )}
                </div>
              </div>
            </FCard>
          )}

          {/* Status meta */}
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
              Order info
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <Stat
                label="Status"
                value={order.status}
                mono
              />
              <Stat label="Lines" value={String(lines.length)} mono />
              <Stat
                label="Expected"
                value={
                  order.expectedAt
                    ? new Date(order.expectedAt).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"
                }
                mono
              />
              <Stat
                label="Received"
                value={
                  order.receivedAt
                    ? new Date(order.receivedAt).toLocaleDateString()
                    : "—"
                }
                mono
              />
              <Stat label="Supplier" value={order.supplier ?? "—"} />
              <Stat
                label="Total qty"
                value={`${totalRecv} / ${totalExp}`}
                mono
              />
            </div>
          </FCard>

          {order.closeReason && (
            <FCard t={t} padding={20}>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: t.muted,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Close reason
              </div>
              <div style={{ fontSize: 13, color: t.body, lineHeight: 1.5 }}>
                {order.closeReason}
              </div>
            </FCard>
          )}
        </div>
      </div>
    </FShell>
  );
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
