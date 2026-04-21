"use client";

import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, SquircleIcon, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";

export default function IntegrationsPage() {
  const t = theme;
  const status = trpc.quickbooks.status.useQuery();
  const authorize = trpc.quickbooks.authorizeUrl.useQuery(undefined, { enabled: false });
  const disconnect = trpc.quickbooks.disconnect.useMutation({
    onSuccess: () => status.refetch(),
  });
  const history = trpc.quickbooks.history.useQuery({ limit: 50 });

  async function connect() {
    const res = await authorize.refetch();
    if (res.data?.url) window.location.href = res.data.url;
  }

  const connected = !!status.data?.connected;

  return (
    <div>
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
