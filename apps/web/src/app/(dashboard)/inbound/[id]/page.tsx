"use client";

import { use, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { inboundStatusTone } from "~/lib/statusTone";

export default function InboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = theme;
  const { id } = use(params);
  const utils = trpc.useUtils();
  const detail = trpc.inbound.byId.useQuery({ id });
  const closeOrder = trpc.inbound.close.useMutation({
    onSuccess: () => utils.inbound.byId.invalidate({ id }),
  });
  const cancelOrder = trpc.inbound.cancel.useMutation({
    onSuccess: () => utils.inbound.byId.invalidate({ id }),
  });
  const exportInbound = trpc.quickbooks.exportInbound.useMutation();
  const qbStatus = trpc.quickbooks.status.useQuery();

  const [closeReason, setCloseReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const order = detail.data?.order;
  const lines = detail.data?.lines ?? [];
  const hasShort = lines.some((l) => l.qtyReceived < l.qtyExpected);
  const status = order?.status ?? "…";
  const isTerminal = status === "closed" || status === "cancelled";

  return (
    <div>
      <PageTitle
        eyebrow={order?.reference ? `Ref ${order.reference}` : "Inbound"}
        title={`Inbound ${id.slice(0, 8)}`}
        right={
          <Tag t={t} tone={inboundStatusTone(status)}>
            {status}
          </Tag>
        }
      />

      {/* Lines table */}
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
          <div>Expected</div>
          <div>Received</div>
          <div>Variance</div>
        </div>
        {lines.map((l, i) => {
          const v = l.qtyReceived - l.qtyExpected;
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
                {l.qtyExpected}
              </span>
              <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                {l.qtyReceived}
              </span>
              <span>
                {v === 0 ? (
                  <Tag t={t} tone="mint">
                    on target
                  </Tag>
                ) : v < 0 ? (
                  <Tag t={t} tone="coral">
                    short {v}
                  </Tag>
                ) : (
                  <Tag t={t} tone="sky">
                    over +{v}
                  </Tag>
                )}
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

      {!isTerminal && (
        <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <Card t={t}>
            <div style={{ fontWeight: 600, color: t.ink, marginBottom: 8 }}>Close order</div>
            {hasShort && (
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  color: t.coral,
                  background: t.coralSoft,
                  padding: "6px 10px",
                  borderRadius: 8,
                }}
              >
                Under-received — a reason is required to short-close.
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <TextField
                t={t}
                placeholder={hasShort ? "Short-close reason (required)" : "Reason (optional)"}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                style={{ flex: 1 }}
              />
              <Btn
                t={t}
                variant="primary"
                size="md"
                icon={Ic.Check}
                disabled={closeOrder.isPending || (hasShort && !closeReason.trim())}
                onClick={() =>
                  closeOrder.mutate({ id, closeReason: closeReason.trim() || undefined })
                }
              >
                {closeOrder.isPending ? "Closing…" : "Close"}
              </Btn>
            </div>
            {closeOrder.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
                {closeOrder.error.message}
              </div>
            )}
          </Card>

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

      {isTerminal && order?.closeReason && (
        <div style={{ marginTop: 16 }}>
          <Card t={t} tint="coral">
            <div style={{ fontSize: 11, color: t.muted, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>
              Reason
            </div>
            <div style={{ color: t.ink, marginTop: 4 }}>{order.closeReason}</div>
          </Card>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <a
              href={`/api/inbound-orders/${id}/receipt.pdf`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
            >
              <Btn t={t} variant="secondary" size="md" icon={Ic.Download}>
                Download receipt
              </Btn>
            </a>
            <Btn
              t={t}
              variant="secondary"
              size="md"
              icon={Ic.Download}
              disabled={!qbStatus.data?.connected || exportInbound.isPending || status !== "closed"}
              onClick={() => exportInbound.mutate({ inboundOrderId: id })}
            >
              {exportInbound.isPending ? "Exporting…" : "Export to QuickBooks"}
            </Btn>
            {exportInbound.data && (
              <Tag t={t} tone="mint">
                Exported as Bill {exportInbound.data.qboId}
              </Tag>
            )}
            {exportInbound.error && (
              <span style={{ fontSize: 12, color: t.coral }}>{exportInbound.error.message}</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
