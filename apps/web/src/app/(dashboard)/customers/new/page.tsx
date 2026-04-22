"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme } from "~/lib/theme";
import { Btn, Card, PageTitle } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";
import { FormGrid, FormSection, Input } from "~/components/address-fields";

export default function NewCustomerPage() {
  const t = theme;
  const router = useRouter();
  const utils = trpc.useUtils();
  const create = trpc.customer.create.useMutation({
    onSuccess: (row) => {
      utils.customer.list.invalidate();
      utils.customer.search.invalidate();
      router.push(`/customers/${row!.id}`);
    },
  });

  const [f, setF] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    taxId: "",
    billingLine1: "",
    billingLine2: "",
    billingCity: "",
    billingRegion: "",
    billingPostalCode: "",
    billingCountry: "",
    shippingLine1: "",
    shippingLine2: "",
    shippingCity: "",
    shippingRegion: "",
    shippingPostalCode: "",
    shippingCountry: "",
    notes: "",
  });
  const [sameAsBilling, setSameAsBilling] = useState(true);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    const shipping = sameAsBilling
      ? {
          shippingLine1: f.billingLine1,
          shippingLine2: f.billingLine2,
          shippingCity: f.billingCity,
          shippingRegion: f.billingRegion,
          shippingPostalCode: f.billingPostalCode,
          shippingCountry: f.billingCountry,
        }
      : {
          shippingLine1: f.shippingLine1,
          shippingLine2: f.shippingLine2,
          shippingCity: f.shippingCity,
          shippingRegion: f.shippingRegion,
          shippingPostalCode: f.shippingPostalCode,
          shippingCountry: f.shippingCountry,
        };
    create.mutate({ ...f, ...shipping });
  }

  return (
    <div>
      <BackLink href="/customers" label="Back to customers" />
      <PageTitle
        eyebrow="Onboard a client"
        title="New customer"
        subtitle="Captures the basics you need on BOLs, invoices, and per-customer reports."
      />

      <Card t={t}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <FormSection title="Identity">
            <FormGrid>
              <Input label="Company name" value={f.name} onChange={(v) => set("name", v)} />
              <Input label="Primary contact" value={f.contactName} onChange={(v) => set("contactName", v)} />
              <Input label="Email" type="email" value={f.email} onChange={(v) => set("email", v)} />
              <Input label="Phone" value={f.phone} onChange={(v) => set("phone", v)} />
              <Input label="Tax ID / EIN" value={f.taxId} onChange={(v) => set("taxId", v)} />
            </FormGrid>
          </FormSection>

          <FormSection title="Billing address">
            <FormGrid>
              <Input label="Street" value={f.billingLine1} onChange={(v) => set("billingLine1", v)} />
              <Input label="Suite / unit" value={f.billingLine2} onChange={(v) => set("billingLine2", v)} />
              <Input label="City" value={f.billingCity} onChange={(v) => set("billingCity", v)} />
              <Input label="State / region" value={f.billingRegion} onChange={(v) => set("billingRegion", v)} />
              <Input label="Postal code" value={f.billingPostalCode} onChange={(v) => set("billingPostalCode", v)} />
              <Input label="Country" value={f.billingCountry} onChange={(v) => set("billingCountry", v)} />
            </FormGrid>
          </FormSection>

          <FormSection title="Shipping address">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: t.ink }}>
              <input
                type="checkbox"
                checked={sameAsBilling}
                onChange={(e) => setSameAsBilling(e.target.checked)}
              />
              Same as billing
            </label>
            {!sameAsBilling && (
              <FormGrid>
                <Input label="Street" value={f.shippingLine1} onChange={(v) => set("shippingLine1", v)} />
                <Input label="Suite / unit" value={f.shippingLine2} onChange={(v) => set("shippingLine2", v)} />
                <Input label="City" value={f.shippingCity} onChange={(v) => set("shippingCity", v)} />
                <Input label="State / region" value={f.shippingRegion} onChange={(v) => set("shippingRegion", v)} />
                <Input label="Postal code" value={f.shippingPostalCode} onChange={(v) => set("shippingPostalCode", v)} />
                <Input label="Country" value={f.shippingCountry} onChange={(v) => set("shippingCountry", v)} />
              </FormGrid>
            )}
          </FormSection>

          <FormSection title="Notes">
            <textarea
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Service-level notes, special handling, account manager, etc."
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                outline: "none",
                fontSize: 13.5,
                minHeight: 80,
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </FormSection>

          <div>
            <Btn
              t={t}
              type="submit"
              variant="accent"
              size="md"
              icon={Ic.Check}
              disabled={create.isPending || !f.name.trim()}
            >
              {create.isPending ? "Creating…" : "Create customer"}
            </Btn>
            {create.error && (
              <div style={{ marginTop: 8, color: t.coral, fontSize: 13 }}>
                {create.error.message}
              </div>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
