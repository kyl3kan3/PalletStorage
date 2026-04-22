"use client";

import { use } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, StatBig, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = theme;
  const { id } = use(params);
  const utils = trpc.useUtils();
  const q = trpc.supplier.byId.useQuery({ id });
  const deactivate = trpc.supplier.deactivate.useMutation({
    onSuccess: () => {
      utils.supplier.byId.invalidate({ id });
      utils.supplier.list.invalidate();
    },
  });

  const s = q.data?.supplier;

  return (
    <div>
      <BackLink href="/suppliers" label="Back to suppliers" />
      <PageTitle
        eyebrow={s?.active ? "Active vendor" : "Inactive"}
        title={s?.name ?? "Supplier"}
        subtitle={s?.contactName ?? undefined}
        right={
          s?.active ? (
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
          ) : (
            <Tag t={t} tone="neutral">inactive</Tag>
          )
        }
      />

      <div style={{ marginBottom: 20 }}>
        <StatBig t={t} label="Inbound orders" value={q.data?.inboundOrders ?? "—"} tint="primary" />
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
          <Field label="Email" value={s?.email} mono />
          <Field label="Phone" value={s?.phone} />
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
            Address
          </div>
          {(() => {
            const any = [
              s?.addressLine1,
              s?.addressLine2,
              s?.city,
              s?.region,
              s?.postalCode,
              s?.country,
            ].some(Boolean);
            if (!any) return <div style={{ fontSize: 13, color: t.muted }}>No address on file.</div>;
            return (
              <div style={{ fontSize: 13.5, color: t.ink, lineHeight: 1.5 }}>
                {s?.addressLine1 && <div>{s.addressLine1}</div>}
                {s?.addressLine2 && <div>{s.addressLine2}</div>}
                {[s?.city, s?.region].filter(Boolean).join(", ")}
                {s?.postalCode ? ` ${s.postalCode}` : ""}
                <br />
                {s?.country}
              </div>
            );
          })()}
        </Card>

        {s?.notes && (
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
              {s.notes}
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
