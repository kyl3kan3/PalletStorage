"use client";

import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";

/**
 * Customers list — clients of the warehouse whose pallets we store.
 * Each row links to the detail page where pallets + order history live.
 */
export default function CustomersPage() {
  const t = theme;
  const list = trpc.customer.list.useQuery();
  const rows = list.data ?? [];

  return (
    <div>
      <PageTitle
        eyebrow="Your clients"
        title="Customers"
        subtitle="Companies whose pallets you store. Link them on inbound and outbound orders to track per-client activity."
        right={
          <Link href="/customers/new" style={{ textDecoration: "none" }}>
            <Btn t={t} variant="accent" size="md" icon={Ic.Plus}>
              New customer
            </Btn>
          </Link>
        }
      />

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1.2fr 1.3fr 110px 24px",
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
            No customers yet. Add your first to link pallets and orders.
          </div>
        )}
        {rows.map((c) => (
          <Link
            key={c.id}
            href={`/customers/${c.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1.2fr 1.3fr 110px 24px",
              gap: 16,
              padding: "14px 20px",
              alignItems: "center",
              borderTop: `1.5px dashed ${t.border}`,
              textDecoration: "none",
              color: t.body,
              fontSize: 13.5,
            }}
          >
            <span style={{ color: t.ink, fontWeight: 600 }}>{c.name}</span>
            <span style={{ color: t.muted, fontSize: 12.5 }}>
              {c.contactName ?? "—"}
              {c.email ? (
                <span style={{ fontFamily: FONTS.mono, marginLeft: 6 }}>{c.email}</span>
              ) : null}
            </span>
            <span style={{ color: t.muted, fontSize: 12.5 }}>
              {[c.billingCity, c.billingRegion].filter(Boolean).join(", ") || "—"}
            </span>
            <span>
              <Tag t={t} tone={c.active ? "mint" : "neutral"}>
                {c.active ? "active" : "inactive"}
              </Tag>
            </span>
            <Ic.Arrow size={14} color={t.muted} />
          </Link>
        ))}
      </Card>
    </div>
  );
}
