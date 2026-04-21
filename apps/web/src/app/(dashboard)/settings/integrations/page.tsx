"use client";

import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, SquircleIcon, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";

export default function IntegrationsPage() {
  const t = theme;
  const utils = trpc.useUtils();
  const status = trpc.quickbooks.status.useQuery();
  const disconnect = trpc.quickbooks.disconnect.useMutation({
    onSuccess: () => status.refetch(),
  });
  const history = trpc.quickbooks.history.useQuery({ limit: 50 });
  const webhooks = trpc.quickbooks.webhookHistory.useQuery({ limit: 30 });
  const ready = trpc.quickbooks.readyToExport.useQuery(undefined, {
    enabled: !!status.data?.connected,
  });

  const refetchReady = () => {
    utils.quickbooks.readyToExport.invalidate();
    utils.quickbooks.history.invalidate();
  };
  const exportInbound = trpc.quickbooks.exportInbound.useMutation({
    onSuccess: refetchReady,
  });
  const exportOutbound = trpc.quickbooks.exportOutbound.useMutation({
    onSuccess: refetchReady,
  });
  const exportCycleCount = trpc.quickbooks.exportCycleCount.useMutation({
    onSuccess: refetchReady,
  });

  // The authorize route derives the redirect_uri from the current origin
  // (so no env var to misconfigure) and sets a CSRF nonce cookie before
  // bouncing the browser to Intuit's consent screen.
  function connect() {
    window.location.href = "/api/quickbooks/authorize";
  }

  const connected = !!status.data?.connected;

  return (
    <div>
      <BackLink href="/settings" label="Back to settings" />
      <PageTitle
        eyebrow="Outside services"
        title="Integrations"
        subtitle="Hook stacks up to your accounting tools."
      />

      <Card t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SquircleIcon t={t} icon={Ic.Dollar} tint={connected ? "mint" : "neutral"} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: t.ink }}>
                QuickBooks Online
              </div>
              <Tag t={t} tone={connected ? "mint" : "neutral"}>
                {connected ? "connected" : "not connected"}
              </Tag>
            </div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
              {connected
                ? `Realm ${status.data?.realmId}`
                : "Link a QBO realm to export bills and invoices from finished orders."}
            </div>
          </div>
          {connected ? (
            <Btn
              t={t}
              variant="secondary"
              size="md"
              icon={Ic.X}
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              Disconnect
            </Btn>
          ) : (
            <Btn t={t} variant="accent" size="md" icon={Ic.Arrow} onClick={connect}>
              Connect
            </Btn>
          )}
        </div>
      </Card>

      {connected && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Ready to export
          </div>

          <Card t={t} padding={0}>
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <SquircleIcon t={t} icon={Ic.Inbound} tint="primary" size={32} />
              <div style={{ flex: 1, fontWeight: 600, color: t.ink }}>Closed inbounds · Bills</div>
              <Tag t={t} tone="neutral">
                {ready.data?.inbound.length ?? 0}
              </Tag>
            </div>
            {(ready.data?.inbound ?? []).length === 0 && (
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: `1.5px dashed ${t.border}`,
                  color: t.muted,
                  fontSize: 13,
                }}
              >
                No closed inbounds waiting. Close an inbound on its detail page to queue a Bill.
              </div>
            )}
            {ready.data?.inbound.map((o) => (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 20px",
                  borderTop: `1.5px dashed ${t.border}`,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: t.ink, fontWeight: 600, fontFamily: FONTS.mono, fontSize: 13 }}>
                    {o.reference}
                  </div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    {o.supplier ?? "no supplier"}
                    {o.closedAt ? ` · closed ${o.closedAt.toLocaleDateString()}` : ""}
                  </div>
                </div>
                <Btn
                  t={t}
                  variant="primary"
                  size="sm"
                  icon={Ic.Download}
                  disabled={exportInbound.isPending}
                  onClick={() => exportInbound.mutate({ inboundOrderId: o.id })}
                >
                  {exportInbound.isPending && exportInbound.variables?.inboundOrderId === o.id
                    ? "Exporting…"
                    : "Export as Bill"}
                </Btn>
              </div>
            ))}
          </Card>

          <div style={{ height: 12 }} />

          <Card t={t} padding={0}>
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <SquircleIcon t={t} icon={Ic.Outbound} tint="coral" size={32} />
              <div style={{ flex: 1, fontWeight: 600, color: t.ink }}>Shipped outbounds · Invoices</div>
              <Tag t={t} tone="neutral">
                {ready.data?.outbound.length ?? 0}
              </Tag>
            </div>
            {(ready.data?.outbound ?? []).length === 0 && (
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: `1.5px dashed ${t.border}`,
                  color: t.muted,
                  fontSize: 13,
                }}
              >
                No shipped outbounds waiting. Ship an outbound to queue an Invoice.
              </div>
            )}
            {ready.data?.outbound.map((o) => (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 20px",
                  borderTop: `1.5px dashed ${t.border}`,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: t.ink, fontWeight: 600, fontFamily: FONTS.mono, fontSize: 13 }}>
                    {o.reference}
                  </div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    {o.customer ?? "no customer"}
                    {o.shippedAt ? ` · shipped ${o.shippedAt.toLocaleDateString()}` : ""}
                  </div>
                </div>
                <Btn
                  t={t}
                  variant="primary"
                  size="sm"
                  icon={Ic.Download}
                  disabled={exportOutbound.isPending}
                  onClick={() => exportOutbound.mutate({ outboundOrderId: o.id })}
                >
                  {exportOutbound.isPending && exportOutbound.variables?.outboundOrderId === o.id
                    ? "Exporting…"
                    : "Export as Invoice"}
                </Btn>
              </div>
            ))}
          </Card>

          <div style={{ height: 12 }} />

          <Card t={t} padding={0}>
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <SquircleIcon t={t} icon={Ic.Clipboard} tint="sky" size={32} />
              <div style={{ flex: 1, fontWeight: 600, color: t.ink }}>
                Approved cycle counts · Inventory adjustments
              </div>
              <Tag t={t} tone="neutral">
                {ready.data?.cycleCounts.length ?? 0}
              </Tag>
            </div>
            {(ready.data?.cycleCounts ?? []).length === 0 && (
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: `1.5px dashed ${t.border}`,
                  color: t.muted,
                  fontSize: 13,
                }}
              >
                No approved counts waiting. Close a cycle count to queue a QBO
                inventory adjustment (only counts with variance push any change).
              </div>
            )}
            {ready.data?.cycleCounts.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 20px",
                  borderTop: `1.5px dashed ${t.border}`,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: t.ink,
                      fontWeight: 600,
                      fontFamily: FONTS.mono,
                      fontSize: 13,
                    }}
                  >
                    {c.id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    {c.approvedAt ? `approved ${c.approvedAt.toLocaleDateString()}` : "approved"}
                  </div>
                </div>
                <Btn
                  t={t}
                  variant="primary"
                  size="sm"
                  icon={Ic.Download}
                  disabled={exportCycleCount.isPending}
                  onClick={() => exportCycleCount.mutate({ cycleCountId: c.id })}
                >
                  {exportCycleCount.isPending &&
                  exportCycleCount.variables?.cycleCountId === c.id
                    ? "Exporting…"
                    : "Push QtyOnHand"}
                </Btn>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <div
          style={{
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Activity from QuickBooks
        </div>

        <Card t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 160px 120px 1fr",
              gap: 16,
              padding: "14px 20px",
              fontSize: 11,
              color: t.muted,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            <div>When</div>
            <div>Entity</div>
            <div>Op</div>
            <div>Changed in QBO</div>
          </div>
          {(webhooks.data?.length ?? 0) === 0 && (
            <div
              style={{
                padding: "20px",
                borderTop: `1.5px dashed ${t.border}`,
                color: t.muted,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              No webhook events yet. Make sure the webhook endpoint is registered in
              your Intuit developer dashboard and the verifier token is set in Vercel.
            </div>
          )}
          {webhooks.data?.map((e) => (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 160px 120px 1fr",
                gap: 16,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
                fontSize: 13,
              }}
            >
              <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
                {e.receivedAt.toLocaleString()}
              </span>
              <span>
                <Tag
                  t={t}
                  tone={
                    e.entityName === "Invoice"
                      ? "primary"
                      : e.entityName === "Bill"
                        ? "sky"
                        : e.entityName === "Item"
                          ? "mint"
                          : "neutral"
                  }
                >
                  {e.entityName}
                </Tag>{" "}
                <span style={{ fontFamily: FONTS.mono, color: t.ink }}>{e.entityId}</span>
              </span>
              <span>
                <Tag
                  t={t}
                  tone={
                    e.operation === "Create"
                      ? "mint"
                      : e.operation === "Delete" || e.operation === "Void"
                        ? "coral"
                        : "neutral"
                  }
                >
                  {e.operation}
                </Tag>
              </span>
              <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
                {e.lastUpdated?.toLocaleString() ?? "—"}
              </span>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <div
          style={{
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Export history
        </div>

        <Card t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1.2fr 1.2fr 120px",
              gap: 16,
              padding: "14px 20px",
              fontSize: 11,
              color: t.muted,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            <div>When</div>
            <div>Source</div>
            <div>QBO entity</div>
            <div>Status</div>
          </div>
          {(history.data?.length ?? 0) === 0 && (
            <div
              style={{
                padding: "20px",
                borderTop: `1.5px dashed ${t.border}`,
                color: t.muted,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              No exports yet.
            </div>
          )}
          {history.data?.map((h) => (
            <div
              key={h.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1.2fr 1.2fr 120px",
                gap: 16,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
                fontSize: 13,
              }}
            >
              <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
                {h.createdAt.toLocaleString()}
              </span>
              <span>
                <span style={{ color: t.muted }}>{h.sourceType}</span>{" "}
                <span style={{ fontFamily: FONTS.mono, color: t.ink }}>
                  {h.sourceId.slice(0, 8)}
                </span>
              </span>
              <span>
                <span style={{ color: t.muted }}>{h.qboEntityType}</span>{" "}
                <span style={{ fontFamily: FONTS.mono, color: t.ink }}>{h.qboEntityId}</span>
              </span>
              <span>
                <Tag t={t} tone={h.status === "success" ? "mint" : "coral"}>
                  {h.status}
                </Tag>
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
