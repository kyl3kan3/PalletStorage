"use client";

import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";

export default function SuppliersPage() {
  const t = theme;
  const list = trpc.supplier.list.useQuery();
  const rows = list.data ?? [];

  return (
    <div>
      <PageTitle
        eyebrow="Inbound vendors"
        title="Suppliers"
        subtitle="Vendors you receive inbound shipments from. Link them to inbound orders for receipts and reports."
        right={
          <Link href="/suppliers/new" style={{ textDecoration: "none" }}>
            <Btn t={t} variant="accent" size="md" icon={Ic.Plus}>
              New supplier
            </Btn>
          </Link>
        }
      />

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1.3fr 1.3fr 110px 24px",
            gap: 16,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <div>Name</div>
          <div>Contact</div>
          <div>City / Region</div>
          <div>Status</div>
          <div />
        </div>
        {rows.length === 0 && (
          <div
            style={{
              padding: "28px 20px",
              color: t.muted,
              fontSize: 13,
              borderTop: `1.5px dashed ${t.border}`,
              textAlign: "center",
            }}
          >
            No suppliers yet. Add your first to link inbound orders.
          </div>
        )}
        {rows.map((s) => (
          <Link
            key={s.id}
            href={`/suppliers/${s.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1.3fr 1.3fr 110px 24px",
              gap: 16,
              padding: "14px 20px",
              alignItems: "center",
              borderTop: `1.5px dashed ${t.border}`,
              textDecoration: "none",
              color: t.body,
              fontSize: 13.5,
            }}
          >
            <span style={{ color: t.ink, fontWeight: 600 }}>{s.name}</span>
            <span style={{ color: t.muted, fontSize: 12.5 }}>
              {s.contactName ?? "—"}
              {s.email ? (
                <span style={{ fontFamily: FONTS.mono, marginLeft: 6 }}>{s.email}</span>
              ) : null}
            </span>
            <span style={{ color: t.muted, fontSize: 12.5 }}>
              {[s.city, s.region].filter(Boolean).join(", ") || "—"}
            </span>
            <span>
              <Tag t={t} tone={s.active ? "mint" : "neutral"}>
                {s.active ? "active" : "inactive"}
              </Tag>
            </span>
            <Ic.Arrow size={14} color={t.muted} />
          </Link>
        ))}
      </Card>
    </div>
  );
}
