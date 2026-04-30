"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, StatBig, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";
import { useIsAdmin, useIsManager } from "~/lib/useRole";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = theme;
  const router = useRouter();
  const { id } = use(params);
  const utils = trpc.useUtils();
  const q = trpc.customer.byId.useQuery({ id });
  const deactivate = trpc.customer.deactivate.useMutation({
    onSuccess: () => {
      utils.customer.byId.invalidate({ id });
      utils.customer.list.invalidate();
    },
  });
  const deleteCustomer = trpc.customer.delete.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      router.push("/customers");
    },
  });
  const updateCustomer = trpc.customer.update.useMutation({
    onSuccess: () => utils.customer.byId.invalidate({ id }),
  });

  const c = q.data?.customer;
  const isManager = useIsManager();
  const isAdmin = useIsAdmin();

  function handleDelete() {
    if (!c) return;
    const typed = window.prompt(
      `This permanently deletes ${c.name}. Stored pallets and open orders will become unassigned.\n\nType the customer name to confirm:`,
    );
    if (typed === null) return; // cancel
    if (typed.trim().toLowerCase() !== c.name.trim().toLowerCase()) {
      window.alert("Name didn't match — delete cancelled.");
      return;
    }
    deleteCustomer.mutate(
      { id },
      {
        onError: (err) => {
          if (err.data?.code !== "PRECONDITION_FAILED") return;
          const proceed = window.confirm(
            `${err.message}\n\nDelete anyway and orphan them?`,
          );
          if (proceed) deleteCustomer.mutate({ id, force: true });
        },
      },
    );
  }

  // Billing-rate edit state. Stored in DOLLARS as a string so the
  // input is friendly; converted to integer cents on save.
  const [storageRate, setStorageRate] = useState("");
  const [receiveRate, setReceiveRate] = useState("");
  const [shipRate, setShipRate] = useState("");
  useEffect(() => {
    if (!c) return;
    setStorageRate(centsToDollars(c.storageRateCentsPerPalletMonth));
    setReceiveRate(centsToDollars(c.receiveRateCentsPerPallet));
    setShipRate(centsToDollars(c.shipRateCentsPerPallet));
  }, [
    c?.storageRateCentsPerPalletMonth,
    c?.receiveRateCentsPerPallet,
    c?.shipRateCentsPerPallet,
  ]);
  function saveRates() {
    if (!c) return;
    updateCustomer.mutate({
      id,
      name: c.name,
      storageRateCentsPerPalletMonth: dollarsToCents(storageRate),
      receiveRateCentsPerPallet: dollarsToCents(receiveRate),
      shipRateCentsPerPallet: dollarsToCents(shipRate),
    });
  }

  return (
    <div>
      <BackLink href="/customers" label="Back to customers" />
      <PageTitle
        eyebrow={c?.active ? "Active client" : "Inactive"}
        title={c?.name ?? "Customer"}
        subtitle={c?.contactName ?? undefined}
        right={
          c ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!c.active && (
                <Tag t={t} tone="neutral">
                  inactive
                </Tag>
              )}
              {c.active && isManager && (
                <>
                  <a
                    href={`/customers/import?customerId=${id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Btn t={t} variant="secondary" size="sm" icon={Ic.Upload}>
                      Import sheet
                    </Btn>
                  </a>
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
                </>
              )}
              {isAdmin && (
                <Btn
                  t={t}
                  variant="danger"
                  size="sm"
                  icon={Ic.X}
                  disabled={deleteCustomer.isPending}
                  onClick={handleDelete}
                >
                  {deleteCustomer.isPending ? "Deleting…" : "Delete"}
                </Btn>
              )}
            </div>
          ) : null
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
            Billing rates
          </div>
          <div
            style={{ fontSize: 12, color: t.muted, marginBottom: 10 }}
          >
            Per-pallet rates used by the monthly statement on{" "}
            <span style={{ fontFamily: FONTS.mono }}>/reports/billing</span>.
            All fields are dollars.
          </div>
          {isManager ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <RateField
                label="Storage / pallet / month"
                value={storageRate}
                onChange={setStorageRate}
              />
              <RateField
                label="Inbound / pallet"
                value={receiveRate}
                onChange={setReceiveRate}
              />
              <RateField
                label="Outbound / pallet"
                value={shipRate}
                onChange={setShipRate}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <Btn
                  t={t}
                  type="button"
                  variant="accent"
                  size="sm"
                  icon={Ic.Check}
                  disabled={updateCustomer.isPending}
                  onClick={saveRates}
                >
                  {updateCustomer.isPending ? "Saving…" : "Save rates"}
                </Btn>
                {updateCustomer.error && (
                  <span style={{ fontSize: 12, color: t.coral }}>
                    {updateCustomer.error.message}
                  </span>
                )}
                {updateCustomer.data && !updateCustomer.error && (
                  <Tag t={t} tone="mint">
                    saved
                  </Tag>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: t.body }}>
              <div>
                Storage:{" "}
                <strong>
                  {centsToDollars(c?.storageRateCentsPerPalletMonth) || "—"}
                </strong>{" "}
                / pallet / month
              </div>
              <div>
                Inbound:{" "}
                <strong>
                  {centsToDollars(c?.receiveRateCentsPerPallet) || "—"}
                </strong>{" "}
                / pallet
              </div>
              <div>
                Outbound:{" "}
                <strong>
                  {centsToDollars(c?.shipRateCentsPerPallet) || "—"}
                </strong>{" "}
                / pallet
              </div>
            </div>
          )}
        </Card>
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

function RateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = theme;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          fontSize: 12,
          color: t.body,
          flex: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          color: t.muted,
        }}
      >
        $
      </span>
      <TextField
        t={t}
        type="number"
        step="0.01"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        style={{ width: 110, fontFamily: FONTS.mono }}
      />
    </label>
  );
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function dollarsToCents(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
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
