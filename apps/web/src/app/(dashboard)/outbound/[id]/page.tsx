"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { outboundStatusTone } from "~/lib/statusTone";
import { friendlyOutboundStatus } from "~/lib/friendly";
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
  const router = useRouter();
  const deleteOrder = trpc.outbound.delete.useMutation({
    onSuccess: () => {
      utils.outbound.list.invalidate();
      router.push("/outbound");
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

      {/* Workflow stepper — every action the order will pass through
          is visible at once. Each row shows its status (done / current
          / upcoming) and the button to advance from that step. Buttons
          for steps that aren't yet reachable are disabled with a hint
          rather than hidden, so users always see the full path. */}
      {order && (
        <Card t={t}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Order progress
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(() => {
              const generatedPicks = (picksQ.data?.length ?? 0) > 0;
              const completedPicks = (picksQ.data ?? []).filter(
                (p) => p.completedAt,
              ).length;
              const totalPicks = picksQ.data?.length ?? 0;
              const steps: Array<{
                n: number;
                title: string;
                sub: string;
                state: "done" | "current" | "upcoming";
                action: React.ReactNode;
              }> = [
                {
                  n: 1,
                  title: "Generate picks",
                  sub: generatedPicks
                    ? `${totalPicks} pick(s) created`
                    : status === "picking"
                      ? "No picks were allocated last try — receive stock and retry"
                      : "Allocate pallets to this order",
                  state:
                    status === "draft" ||
                    status === "open" ||
                    (status === "picking" && !generatedPicks)
                      ? "current"
                      : "done",
                  action: (
                    <Btn
                      t={t}
                      variant={
                        status === "draft" ||
                        status === "open" ||
                        (status === "picking" && !generatedPicks)
                          ? "accent"
                          : "secondary"
                      }
                      size="sm"
                      icon={Ic.Spark}
                      disabled={
                        genPicks.isPending ||
                        !(
                          status === "draft" ||
                          status === "open" ||
                          (status === "picking" && !generatedPicks)
                        ) ||
                        lines.length === 0
                      }
                      onClick={() =>
                        genPicks.mutate({ outboundOrderId: id })
                      }
                    >
                      {genPicks.isPending ? "Generating…" : "Generate"}
                    </Btn>
                  ),
                },
                {
                  n: 2,
                  title: "Complete picks",
                  sub: generatedPicks
                    ? `${completedPicks}/${totalPicks} done`
                    : "After picks are generated",
                  state:
                    status === "picking" && !allLinesPicked
                      ? "current"
                      : status === "picking" && allLinesPicked
                        ? "done"
                        : completedPicks >= totalPicks && totalPicks > 0
                          ? "done"
                          : status === "draft" || status === "open"
                            ? "upcoming"
                            : "done",
                  action: (
                    <Btn
                      t={t}
                      variant={
                        status === "picking" && !allLinesPicked
                          ? "accent"
                          : "secondary"
                      }
                      size="sm"
                      icon={Ic.Arrow}
                      disabled={!generatedPicks}
                      onClick={() =>
                        document
                          .getElementById("picks-section")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
                      }
                    >
                      View picks
                    </Btn>
                  ),
                },
                {
                  n: 3,
                  title: "Mark packed",
                  sub:
                    status === "packed" || status === "shipped"
                      ? "Packed"
                      : "When staging is ready for carrier",
                  state:
                    status === "packed" || status === "shipped"
                      ? "done"
                      : status === "picking" && allLinesPicked
                        ? "current"
                        : "upcoming",
                  action: (
                    <Btn
                      t={t}
                      variant={
                        status === "picking" && allLinesPicked
                          ? "accent"
                          : "secondary"
                      }
                      size="sm"
                      icon={Ic.Package}
                      disabled={
                        pack.isPending ||
                        !(status === "picking" && allLinesPicked)
                      }
                      onClick={() => pack.mutate({ id })}
                    >
                      {pack.isPending ? "Packing…" : "Mark packed"}
                    </Btn>
                  ),
                },
                {
                  n: 4,
                  title: "Ship",
                  sub:
                    status === "shipped"
                      ? "Shipped"
                      : "Enter carrier + tracking; BOL generated automatically",
                  state:
                    status === "shipped"
                      ? "done"
                      : status === "packed"
                        ? "current"
                        : "upcoming",
                  action:
                    status === "packed" ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <TextField
                          t={t}
                          placeholder="Carrier"
                          value={carrier}
                          onChange={(e) => setCarrier(e.target.value)}
                          style={{ width: 110, fontSize: 12.5 }}
                        />
                        <TextField
                          t={t}
                          placeholder="Tracking #"
                          value={tracking}
                          onChange={(e) => setTracking(e.target.value)}
                          style={{ width: 130, fontSize: 12.5 }}
                        />
                        <Btn
                          t={t}
                          variant="accent"
                          size="sm"
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
                          {ship.isPending ? "Shipping…" : "Confirm"}
                        </Btn>
                      </div>
                    ) : (
                      <Btn
                        t={t}
                        variant="secondary"
                        size="sm"
                        icon={Ic.Truck}
                        disabled
                      >
                        Ship
                      </Btn>
                    ),
                },
                {
                  n: 5,
                  title: "Close & invoice",
                  sub: qbStatus.data?.connected
                    ? "Export invoice to QuickBooks"
                    : "QuickBooks not connected — settings → integrations",
                  state: status === "shipped" ? "current" : "upcoming",
                  action: (
                    <Btn
                      t={t}
                      variant={status === "shipped" ? "accent" : "secondary"}
                      size="sm"
                      icon={Ic.Dollar}
                      disabled={
                        !qbStatus.data?.connected ||
                        exportOutbound.isPending ||
                        status !== "shipped"
                      }
                      onClick={() =>
                        exportOutbound.mutate({ outboundOrderId: id })
                      }
                    >
                      {exportOutbound.isPending
                        ? "Exporting…"
                        : "Export to QB"}
                    </Btn>
                  ),
                },
              ];
              return steps.map((s) => {
                const badgeBg =
                  s.state === "done"
                    ? t.mint
                    : s.state === "current"
                      ? t.primary
                      : t.surfaceAlt;
                const badgeFg =
                  s.state === "current"
                    ? t.primaryText
                    : s.state === "done"
                      ? t.ink
                      : t.muted;
                return (
                  <div
                    key={s.n}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 12px",
                      background:
                        s.state === "current" ? t.primarySoft : "transparent",
                      borderRadius: 10,
                      border:
                        s.state === "current"
                          ? `1.5px solid ${t.primary}`
                          : `1.5px dashed ${t.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: badgeBg,
                        color: badgeFg,
                        fontFamily: FONTS.mono,
                        fontWeight: 700,
                        fontSize: 13,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {s.state === "done" ? "✓" : s.n}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: s.state === "upcoming" ? t.muted : t.ink,
                        }}
                      >
                        {s.title}
                      </div>
                      <div style={{ fontSize: 12, color: t.muted }}>{s.sub}</div>
                    </div>
                    <div>{s.action}</div>
                  </div>
                );
              });
            })()}
          </div>

          {genPicks.error && (
            <div
              style={{
                marginTop: 10,
                background: t.coralSoft,
                color: t.coral,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {genPicks.error.message}
            </div>
          )}
          {ship.error && (
            <div
              style={{
                marginTop: 10,
                background: t.coralSoft,
                color: t.coral,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {ship.error.message}
            </div>
          )}
          {pack.error && (
            <div
              style={{
                marginTop: 10,
                background: t.coralSoft,
                color: t.coral,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {pack.error.message}
            </div>
          )}
          {exportOutbound.error && (
            <div
              style={{
                marginTop: 10,
                background: t.coralSoft,
                color: t.coral,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {exportOutbound.error.message}
            </div>
          )}
          {exportOutbound.data && (
            <div
              style={{
                marginTop: 10,
                background: t.primarySoft,
                color: t.ink,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              Exported as Invoice {exportOutbound.data.qboId}
            </div>
          )}
        </Card>
      )}
      {isTerminal && order && (
        <Card t={t} tint={status === "shipped" ? "mint" : "coral"}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
            Order is {status}.{" "}
            {status === "shipped"
              ? "Download the BOL below or export the invoice to QuickBooks."
              : order.cancelReason
                ? `Reason: ${order.cancelReason}`
                : "No further actions."}
          </div>
        </Card>
      )}

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
      {genPicks.data && genPicks.data.created > 0 && (
        <div style={{ marginTop: 12 }}>
          <Tag t={t} tone="mint">
            Created {genPicks.data.created} pick(s)
          </Tag>
        </div>
      )}
      {genPicks.data && genPicks.data.created === 0 && (
        <div
          style={{
            marginTop: 12,
            background: t.coralSoft,
            color: t.coral,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            No stock to allocate.
          </div>
          The allocator couldn&apos;t find any stored pallets matching the
          products on this order. Receive an inbound order with the
          right products first, then click Generate again — the order
          stayed in its current status so you can retry.
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
      {isManager && status !== "shipped" && (
        <div style={{ marginTop: 16 }}>
          <Card t={t}>
            <div style={{ fontWeight: 600, color: t.ink, marginBottom: 4 }}>
              Delete order
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 10 }}>
              Permanently removes the order, its lines, and any pending
              picks/shipments. Refused if any pick is already complete (use
              cancel + reason to preserve the audit trail).
            </div>
            <Btn
              t={t}
              variant="danger"
              size="md"
              icon={Ic.X}
              disabled={deleteOrder.isPending}
              onClick={() => {
                if (
                  confirm(
                    "Delete this outbound order permanently? This can't be undone.",
                  )
                ) {
                  deleteOrder.mutate({ id });
                }
              }}
            >
              {deleteOrder.isPending ? "Deleting…" : "Delete order"}
            </Btn>
            {deleteOrder.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
                {deleteOrder.error.message}
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

    </div>
  );
}
