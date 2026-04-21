"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tabs, Tag, type TabItem } from "~/components/kit";
import { Ic } from "~/components/icons";
import { inboundStatusTone } from "~/lib/statusTone";

export default function InboundListPage() {
  const t = theme;
  const list = trpc.inbound.list.useQuery({});
  const [tab, setTab] = useState("all");

  const tabs: TabItem[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of list.data ?? []) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return [
      { key: "all", label: "All", count: list.data?.length ?? 0 },
      { key: "open", label: "Open", count: counts.open ?? 0 },
      { key: "receiving", label: "Receiving", count: counts.receiving ?? 0 },
      { key: "closed", label: "Closed", count: counts.closed ?? 0 },
      { key: "cancelled", label: "Cancelled", count: counts.cancelled ?? 0 },
    ];
  }, [list.data]);

  const filtered = (list.data ?? []).filter((o) => tab === "all" || o.status === tab);

  return (
    <div>
      <PageTitle
        eyebrow="Receiving"
        title="Inbound"
        subtitle="POs on the way in, plus what's already on the dock."
        right={
          <Link href="/inbound/new" style={{ textDecoration: "none" }}>
            <Btn t={t} variant="accent" size="md" icon={Ic.Plus}>
              New inbound
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
            gridTemplateColumns: "1.2fr 1.3fr 140px 130px 24px",
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
          <div>Supplier</div>
          <div>Status</div>
          <div>Expected</div>
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
            Nothing here yet.
          </div>
        )}
        {filtered.map((o) => (
          <Link
            key={o.id}
            href={`/inbound/${o.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.3fr 140px 130px 24px",
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
            <span>{o.supplier ?? "—"}</span>
            <span>
              <Tag t={t} tone={inboundStatusTone(o.status)}>
                {o.status}
              </Tag>
            </span>
            <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
              {o.expectedAt?.toLocaleDateString() ?? "—"}
            </span>
            <Ic.Arrow size={14} color={t.muted} />
          </Link>
        ))}
      </Card>
    </div>
  );
}
