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

export default function OutboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = theme;
  const { id } = use(params);
  const utils = trpc.useUtils();
  const detail = trpc.outbound.byId.useQuery({ id });
  const genPicks = trpc.outbound.generatePicks.useMutation({
    onSuccess: () => utils.outbound.byId.invalidate({ id }),
  });
  const cancelOrder = trpc.outbound.cancel.useMutation({
    onSuccess: () => utils.outbound.byId.invalidate({ id }),
  });
  const pack = trpc.outbound.pack.useMutation({
    onSuccess: () => utils.outbound.byId.invalidate({ id }),
  });
  const ship = trpc.outbound.ship.useMutation({
    onSuccess: () => {
      utils.outbound.byId.invalidate({ id });
      utils.outbound.shipments.invalidate({ outboundOrderId: id });
    },
  });
  const shipmentsQ = trpc.outbound.shipments.useQuery({ outboundOrderId: id });
  const exportOutbound = trpc.quickbooks.exportOutbound.useMutation();
  const qbStatus = trpc.quickbooks.status.useQuery();

  const [cancelReason, setCancelReason] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");

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
                {l.qtyOrdered}
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
                  href={`/api/shipments/${s.id}/bol.pdf`}
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
