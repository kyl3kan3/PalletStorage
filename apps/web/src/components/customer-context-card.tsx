"use client";

// CustomerContextCard: when a 3PL customer is selected on a new
// inbound/outbound, surface their standing notes, billing rates, and
// contact info inline so the manager doesn't have to bounce to the
// customer detail page in another tab.
//
// Reuses `customer.byId` (already returns counts), so this card adds
// no new server-side surface area.

import { trpc } from "~/lib/trpc";
import { theme as defaultTheme, FONTS, type Theme } from "~/lib/theme";
import { Card, Tag } from "./kit";

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function CustomerContextCard({
  customerId,
  t = defaultTheme,
}: {
  customerId: string;
  t?: Theme;
}) {
  const detail = trpc.customer.byId.useQuery({ id: customerId }, { enabled: customerId.length > 0 });
  if (!customerId) return null;
  if (detail.isLoading) {
    return (
      <Card t={t} tint="alt" padding={14}>
        <div style={{ fontSize: 12.5, color: t.muted, fontFamily: FONTS.sans }}>Loading customer…</div>
      </Card>
    );
  }
  if (!detail.data) return null;
  const c = detail.data.customer;
  const hasRates =
    c.storageRateCentsPerPalletMonth != null ||
    c.receiveRateCentsPerPallet != null ||
    c.shipRateCentsPerPallet != null;

  return (
    <Card t={t} tint="alt" padding={14}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: hasRates || c.notes ? 10 : 0,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 14,
            fontWeight: 600,
            color: t.ink,
          }}
        >
          {c.name}
        </div>
        <Tag t={t} tone="neutral">
          {detail.data.storedPallets} stored pallet{detail.data.storedPallets === 1 ? "" : "s"}
        </Tag>
        {!hasRates && (
          <Tag t={t} tone="coral">
            No billing rates set
          </Tag>
        )}
        {(c.email || c.phone) && (
          <span style={{ fontSize: 12.5, color: t.muted, fontFamily: FONTS.mono }}>
            {[c.email, c.phone].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      {hasRates && (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: t.muted,
            fontFamily: FONTS.sans,
            marginBottom: c.notes ? 10 : 0,
          }}
        >
          <span>
            Storage <strong style={{ color: t.ink }}>{formatCents(c.storageRateCentsPerPalletMonth)}</strong>/pallet/mo
          </span>
          <span>
            Receive <strong style={{ color: t.ink }}>{formatCents(c.receiveRateCentsPerPallet)}</strong>/pallet
          </span>
          <span>
            Ship <strong style={{ color: t.ink }}>{formatCents(c.shipRateCentsPerPallet)}</strong>/pallet
          </span>
        </div>
      )}

      {c.notes && (
        <div
          style={{
            fontSize: 12.5,
            color: t.ink,
            background: t.surface,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            whiteSpace: "pre-wrap",
          }}
        >
          <span style={{ color: t.muted, fontWeight: 600, marginRight: 6 }}>Notes:</span>
          {c.notes}
        </div>
      )}
    </Card>
  );
}
