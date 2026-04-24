"use client";

import { use, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { outboundStatusTone } from "~/lib/statusTone";
import { friendlyOutboundStatus, nextOutboundStep } from "~/lib/friendly";
import { NextStepCard } from "~/components/next-step-card";
import { useIsManager } from "~/lib/useRole";
import { qtyUnitLabel } from "@wms/core";

export default function OutboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = theme;
  const { id } = use(params);
  const utils = trpc.useUtils();
  const detail = trpc.outbound.byId.useQuery({ id });
  const genPicks = trpc.outbound.generatePicks.useMutation({
    onSuccess: () => {
      utils.outbound.byId.invalidate({ id });
      utils.outbound.picksForOrder.invalidate({ outboundOrderId: id });
    },
  });
  const cancelOrder = trpc.outbound.cancel.useMutation({
    onSuccess: () => {
      utils.outbound.byId.invalidate({ id });
      utils.outbound.picksForOrder.invalidate({ outboundOrderId: id });
    },
  });
  const pack = trpc.outbound.pack.useMutation({
    onSuccess: () => utils.outbound.byId.invalidate({ id }),
  });
  const ship = trpc.outbound.ship.useMutation({
    onSuccess: () => {
      utils.outbound.byId.invalidate({ id });
      utils.outbound.shipments.invalidate({ outboundOrderId: id });
      utils.outbound.picksForOrder.invalidate({ outboundOrderId: id });
    },
  });
  const shipmentsQ = trpc.outbound.shipments.useQuery({ outboundOrderId: id });
  const picksQ = trpc.outbound.picksForOrder.useQuery({ outboundOrderId: id });
  const completePick = trpc.outbound.completePick.useMutation({
    onSuccess: () => {
      utils.outbound.byId.invalidate({ id });
      utils.outbound.picksForOrder.invalidate({ outboundOrderId: id });
    },
  });
  const exportOutbound = trpc.quickbooks.exportOutbound.useMutation();
  const qbStatus = trpc.quickbooks.status.useQuery();

  const [cancelReason, setCancelReason] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [stagingByPick, setStagingByPick] = useState<Record<string, string>>({});

  const order = detail.data?.order;
  const lines = detail.data?.lines ?? [];
  const status = order?.status ?? "…";
  const isTerminal = status === "shipped" || status === "cancelled";
  const isManager = useIsManager();
  // Cancelling an order is a manager+ action.
  const canCancel =
    isManager && (status === "draft" || status === "open" || status === "picking");
  const allLinesPicked =
    lines.length > 0 && lines.every((l) => l.qtyPicked >= l.qtyOrdered);

  // Staging/dock locations in this order's warehouse — used by the
  // pick-completion dropdown. Only fetched once we have the order so
  // we know which warehouse to look in.
  const locations = trpc.location.listByWarehouse.useQuery(
    { warehouseId: order?.warehouseId ?? "" },
    { enabled: !!order?.warehouseId },
  );
  const stagingCandidates = (locations.data ?? []).filter(
    (l) => l.type === "dock" || l.type === "staging",
  );

  return (
    <div>
      <PageTitle
        eyebrow={order?.reference ? `Ref ${order.reference} · ${order.customer ?? "—"}` : "Outbound"}
        title={`Outbound ${id.slice(0, 8)}`}
        right={
          <Tag t={t} tone={outboundStatusTone(status)}>
            {friendlyOutboundStatus(status)}
          </Tag>
        }
      />

      {/* Next step card — surfaces the single primary action for the
          current status so a basic user doesn't have to scan a row of
          five buttons. Secondary actions stay available below. */}
      {order && !isTerminal && (() => {
        const step = nextOutboundStep(status, allLinesPicked);
        if (!step) return null;
        return (
          <div style={{ marginBottom: 16 }}>
            <NextStepCard step={step}>
              {status === "open" || status === "draft" ? (
                <Btn
                  t={t}
                  variant="accent"
                  size="md"
                  icon={Ic.Spark}
                  onClick={() => genPicks.mutate({ outboundOrderId: id })}
                  disabled={genPicks.isPending}
                >
                  {genPicks.isPending ? "Generating…" : "Generate picks"}
                </Btn>
              ) : null}
              {status === "picking" && allLinesPicked ? (
                <Btn
                  t={t}
                  variant="accent"
                  size="md"
                  icon={Ic.Package}
                  disabled={pack.isPending}
                  onClick={() => pack.mutate({ id })}
                >
                  {pack.isPending ? "Marking packed…" : "Mark packed"}
                </Btn>
              ) : null}
              {status === "picking" && !allLinesPicked ? (
                <Btn
                  t={t}
                  variant="accent"
                  size="md"
                  icon={Ic.Arrow}
                  onClick={() =>
                    document
                      .getElementById("picks-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  Complete picks
                </Btn>
              ) : null}
              {status === "packed" ? (
                <>
                  <TextField
                    t={t}
                    placeholder="Carrier"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    style={{ minWidth: 160 }}
                  />
                  <TextField
                    t={t}
                    placeholder="Tracking #"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    style={{ minWidth: 180 }}
                  />
                  <Btn
                    t={t}
                    variant="accent"
                    size="md"
                    icon={Ic.Truck}
                    disabled={ship.isPending}
                    onClick={() =>
                      ship.mutate({
                        id,
                        carrier: carrier.trim() || undefined,
                        trackingNumber: tracking.trim() || undefined,
                      })
                    }
                  >
                    {ship.isPending ? "Shipping…" : "Confirm ship"}
                  </Btn>
                </>
              ) : null}
            </NextStepCard>
          </div>
        );
      })()}

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 1fr 1fr",
            gap: 16,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        >
          <div>Line</div>
          <div>Ordered</div>
          <div>Picked</div>
          <div>Fill</div>
        </div>
        {lines.map((l, i) => {
          const pct = l.qtyOrdered > 0 ? Math.min(1, l.qtyPicked / l.qtyOrdered) : 0;
          return (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr 1fr 1fr",
                gap: 16,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
              }}
            >
              <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>#{i + 1}</span>
              <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                {l.qtyOrdered} {qtyUnitLabel(l.qtyUnit, l.qtyOrdered !== 1)}
              </span>
              <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                {l.qtyPicked}
              </span>
              <span>
                <Tag t={t} tone={pct === 1 ? "mint" : pct > 0 ? "primary" : "neutral"}>
                  {Math.round(pct * 100)}%
                </Tag>
              </span>
            </div>
          );
        })}
        {lines.length === 0 && (
          <div
            style={{
              padding: "24px 20px",
              borderTop: `1.5px dashed ${t.border}`,
              color: t.muted,
              fontSize: 13,
            }}
          >
            No lines on this order.
          </div>
        )}
      </Card>

      {/* Picks list — shown once generatePicks has run so the user can
          confirm each pick as it's pulled from its source location.
          Completed picks stay visible to give the closer a full trail. */}
      {picksQ.data && picksQ.data.length > 0 && (
        <div id="picks-section" style={{ marginTop: 20, scrollMarginTop: 80 }}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Picks ({picksQ.data.filter((p) => p.completedAt).length}/
            {picksQ.data.length} complete)
          </div>
          <Card t={t} padding={0}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 1fr 80px 1fr 200px",
                gap: 12,
                padding: "12px 16px",
                fontSize: 10.5,
                color: t.muted,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontWeight: 600,
              }}
            >
              <div>#</div>
              <div>From</div>
              <div>Pallet</div>
              <div>Qty</div>
              <div>Status</div>
              <div />
            </div>
            {picksQ.data.map((p, idx) => {
              const done = !!p.completedAt;
              const stagingId = stagingByPick[p.pickId] ?? "";
              return (
                <div
                  key={p.pickId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 1fr 80px 1fr 200px",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: `1.5px dashed ${t.border}`,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      color: t.muted,
                      fontFamily: FONTS.mono,
                      fontSize: 12,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 13 }}>
                    {p.fromLocationCode ?? "—"}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 12,
                      color: t.body,
                    }}
                  >
                    {p.palletLpn ?? "—"}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontWeight: 600,
                      color: t.ink,
                    }}
                  >
                    {p.qty}
                  </span>
                  <span>
                    {done ? (
                      <Tag t={t} tone="mint">
                        picked
                      </Tag>
                    ) : (
                      <Tag t={t} tone="primary">
                        pending
                      </Tag>
                    )}
                  </span>
                  {done ? (
                    <span style={{ fontSize: 11, color: t.muted }}>
                      {p.completedAt?.toLocaleString()}
                    </span>
                  ) : !isTerminal ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        value={stagingId}
                        onChange={(e) =>
                          setStagingByPick((prev) => ({
                            ...prev,
                            [p.pickId]: e.target.value,
                          }))
                        }
                        aria-label="Staging location"
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: 8,
                          background: t.surfaceAlt,
                          border: `1.5px solid ${t.border}`,
                          fontSize: 12,
                          color: t.ink,
                        }}
                      >
                        <option value="">Staging…</option>
                        {stagingCandidates.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code} ({l.type})
                          </option>
                        ))}
                      </select>
                      <Btn
                        t={t}
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={Ic.Check}
                        disabled={!stagingId || completePick.isPending}
                        onClick={() =>
                          completePick.mutate({
                            pickId: p.pickId,
                            stagingLocationId: stagingId,
                          })
                        }
                      >
                        {completePick.isPending ? "…" : "Done"}
                      </Btn>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: t.muted }}>—</span>
                  )}
                </div>
              );
            })}
          </Card>
          {completePick.error && (
            <div
              style={{
                marginTop: 8,
                background: t.coralSoft,
                color: t.coral,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {completePick.error.message}
            </div>
          )}
          {stagingCandidates.length === 0 && !locations.isLoading && (
            <div style={{ marginTop: 8, fontSize: 12, color: t.muted }}>
              No staging/dock locations in this warehouse yet — add one at{" "}
              <a href="/warehouses" style={{ color: t.primaryDeep, fontWeight: 600 }}>
                /warehouses
              </a>{" "}
              before confirming picks.
            </div>
          )}
        </div>
      )}

      {/* Confirmation toasts that used to live on the old action cards.
          Kept as inline notices because the buttons themselves now live
          in the Next-step card at the top. */}
      {genPicks.data && (
        <div style={{ marginTop: 12 }}>
          <Tag t={t} tone="mint">
            Created {genPicks.data.created} pick(s)
          </Tag>
        </div>
      )}
      {ship.error && (
        <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
          {ship.error.message}
        </div>
      )}
      {pack.error && (
        <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
          {pack.error.message}
        </div>
      )}

      {canCancel && (
        <div style={{ marginTop: 16 }}>
          <Card t={t}>
            <div style={{ fontWeight: 600, color: t.ink, marginBottom: 8 }}>Cancel order</div>
            <div style={{ display: "flex", gap: 8 }}>
              <TextField
                t={t}
                placeholder="Cancel reason (required)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ flex: 1 }}
              />
              <Btn
                t={t}
                variant="danger"
                size="md"
                icon={Ic.X}
                disabled={cancelOrder.isPending || !cancelReason.trim()}
                onClick={() => cancelOrder.mutate({ id, reason: cancelReason.trim() })}
              >
                {cancelOrder.isPending ? "Cancelling…" : "Cancel"}
              </Btn>
            </div>
            {cancelOrder.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
                {cancelOrder.error.message}
              </div>
            )}
          </Card>
        </div>
      )}

      {status === "cancelled" && order?.cancelReason && (
        <div style={{ marginTop: 16 }}>
          <Card t={t} tint="coral">
            <div style={{ fontSize: 11, color: t.muted, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>
              Cancel reason
            </div>
            <div style={{ color: t.ink, marginTop: 4 }}>{order.cancelReason}</div>
          </Card>
        </div>
      )}

      {shipmentsQ.data && shipmentsQ.data.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card t={t} padding={0}>
            <div style={{ padding: "16px 20px 10px", fontWeight: 600, color: t.ink }}>
              Shipments
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 1fr 120px 120px",
                gap: 16,
                padding: "10px 20px",
                fontSize: 11,
                color: t.muted,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontWeight: 600,
                borderTop: `1.5px dashed ${t.border}`,
              }}
            >
              <div>Shipping #</div>
              <div>Carrier</div>
              <div>Tracking</div>
              <div>Shipped</div>
              <div>Print</div>
            </div>
            {shipmentsQ.data.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr 1fr 120px 120px",
                  gap: 16,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: `1.5px dashed ${t.border}`,
                  fontSize: 13,
                }}
              >
                <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                  {s.bolNumber}
                </span>
                <span>{s.carrier ?? "—"}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 12 }}>{s.trackingNumber ?? "—"}</span>
                <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
                  {s.shippedAt.toLocaleDateString()}
                </span>
                <a
                  href={`/api/shipments/${s.id}/bol`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: t.primaryDeep, fontWeight: 600, textDecoration: "none" }}
                >
                  Download →
                </a>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Btn
              t={t}
              variant="secondary"
              size="md"
              icon={Ic.Download}
              disabled={!qbStatus.data?.connected || exportOutbound.isPending || status !== "shipped"}
              onClick={() => exportOutbound.mutate({ outboundOrderId: id })}
            >
              {exportOutbound.isPending ? "Exporting…" : "Export to QuickBooks"}
            </Btn>
            {exportOutbound.data && (
              <Tag t={t} tone="mint">
                Exported as Invoice {exportOutbound.data.qboId}
              </Tag>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
