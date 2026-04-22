"use client";

import { use } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, StatBig, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";
import { useIsManager } from "~/lib/useRole";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = theme;
  const { id } = use(params);
  const utils = trpc.useUtils();
  const q = trpc.customer.byId.useQuery({ id });
  const deactivate = trpc.customer.deactivate.useMutation({
    onSuccess: () => {
      utils.customer.byId.invalidate({ id });
      utils.customer.list.invalidate();
    },
  });

  const c = q.data?.customer;
  const isManager = useIsManager();

  return (
    <div>
      <BackLink href="/customers" label="Back to customers" />
      <PageTitle
        eyebrow={c?.active ? "Active client" : "Inactive"}
        title={c?.name ?? "Customer"}
        subtitle={c?.contactName ?? undefined}
        right={
          c?.active ? (
            isManager ? (
              <Btn
                t={t}
                variant="secondary"
                size="sm"
                icon={Ic.X}
                disabled={deactivate.isPending}
                onClick={() => deactivate.mutate({ id })}
              >
                {deactivate.isPending ? "Deactivating…" : "Deactivate"}
              </Btn>
            ) : null
          ) : (
            <Tag t={t} tone="neutral">
              inactive
            </Tag>
          )
        }
      />

      <div
        data-collapse-grid
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatBig t={t} label="Stored pallets" value={q.data?.storedPallets ?? "—"} tint="primary" />
        <StatBig t={t} label="Outbound orders" value={q.data?.outboundOrders ?? "—"} tint="mint" />
        <StatBig t={t} label="Inbound orders" value={q.data?.inboundOrders ?? "—"} />
      </div>

      <div
        data-collapse-grid
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <Card t={t}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Contact
          </div>
          <Field label="Email" value={c?.email} mono />
          <Field label="Phone" value={c?.phone} />
          <Field label="Tax ID" value={c?.taxId} mono />
        </Card>

        <Card t={t}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Billing address
          </div>
          <AddressBlock
            line1={c?.billingLine1}
            line2={c?.billingLine2}
            city={c?.billingCity}
            region={c?.billingRegion}
            postal={c?.billingPostalCode}
            country={c?.billingCountry}
          />
        </Card>

        <Card t={t}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Shipping address
          </div>
          <AddressBlock
            line1={c?.shippingLine1}
            line2={c?.shippingLine2}
            city={c?.shippingCity}
            region={c?.shippingRegion}
            postal={c?.shippingPostalCode}
            country={c?.shippingCountry}
          />
        </Card>

        {c?.notes && (
          <Card t={t}>
            <div
              style={{
                fontSize: 11,
                color: t.muted,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              Notes
            </div>
            <div style={{ fontSize: 13, color: t.body, whiteSpace: "pre-wrap" }}>
              {c.notes}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const t = theme;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: t.muted,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: t.ink,
          marginTop: 2,
          fontFamily: mono ? FONTS.mono : undefined,
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function AddressBlock({
  line1,
  line2,
  city,
  region,
  postal,
  country,
}: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal?: string | null;
  country?: string | null;
}) {
  const t = theme;
  const empty = ![line1, line2, city, region, postal, country].some(Boolean);
  if (empty) return <div style={{ fontSize: 13, color: t.muted }}>No address on file.</div>;
  return (
    <div style={{ fontSize: 13.5, color: t.ink, lineHeight: 1.5 }}>
      {line1 && <div>{line1}</div>}
      {line2 && <div>{line2}</div>}
      {[city, region].filter(Boolean).join(", ")}
      {postal ? ` ${postal}` : ""}
      <br />
      {country}
    </div>
  );
}
