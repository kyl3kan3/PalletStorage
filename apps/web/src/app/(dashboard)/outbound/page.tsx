"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tabs, Tag, type TabItem } from "~/components/kit";
import { Ic } from "~/components/icons";
import { outboundStatusTone } from "~/lib/statusTone";

export default function OutboundListPage() {
  const t = theme;
  const list = trpc.outbound.list.useQuery({});
  const [tab, setTab] = useState("active");

  const tabs: TabItem[] = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of list.data ?? []) c[o.status] = (c[o.status] ?? 0) + 1;
    return [
      { key: "active", label: "Active", count: (c.open ?? 0) + (c.picking ?? 0) + (c.packed ?? 0) },
      { key: "open", label: "Open", count: c.open ?? 0 },
      { key: "picking", label: "Picking", count: c.picking ?? 0 },
      { key: "packed", label: "Packed", count: c.packed ?? 0 },
      { key: "shipped", label: "Shipped", count: c.shipped ?? 0 },
      { key: "cancelled", label: "Cancelled", count: c.cancelled ?? 0 },
      { key: "all", label: "All", count: list.data?.length ?? 0 },
    ];
  }, [list.data]);

  const filtered = (list.data ?? []).filter((o) => {
    if (tab === "all") return true;
    if (tab === "active") return o.status === "open" || o.status === "picking" || o.status === "packed";
    return o.status === tab;
  });

  return (
    <div>
      <PageTitle
        eyebrow="Shipping"
        title="Outbound"
        subtitle="Customer orders — pick, pack, and ship."
        right={
          <Link href="/outbound/new" style={{ textDecoration: "none" }}>
            <Btn t={t} variant="accent" size="md" icon={Ic.Plus}>
              New order
            </Btn>
          </Link>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <Tabs t={t} items={tabs} active={tab} onChange={setTab} />
      </div>

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1.4fr 140px 130px 24px",
            gap: 16,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <div>Reference</div>
          <div>Customer</div>
          <div>Status</div>
          <div>Ship by</div>
          <div />
        </div>
        {filtered.length === 0 && (
          <div
            style={{
              padding: "28px 20px",
              color: t.muted,
              fontSize: 13,
              borderTop: `1.5px dashed ${t.border}`,
              textAlign: "center",
            }}
          >
            No orders in this bucket.
          </div>
        )}
        {filtered.map((o) => (
          <Link
            key={o.id}
            href={`/outbound/${o.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.4fr 140px 130px 24px",
              gap: 16,
              padding: "14px 20px",
              alignItems: "center",
              borderTop: `1.5px dashed ${t.border}`,
              fontSize: 13.5,
              color: t.body,
              textDecoration: "none",
            }}
          >
            <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>
              {o.reference}
            </span>
            <span>{o.customer ?? "—"}</span>
            <span>
              <Tag t={t} tone={outboundStatusTone(o.status)}>
                {o.status}
              </Tag>
            </span>
            <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
              {o.shipBy?.toLocaleDateString() ?? "—"}
            </span>
            <Ic.Arrow size={14} color={t.muted} />
          </Link>
        ))}
      </Card>
    </div>
  );
}
