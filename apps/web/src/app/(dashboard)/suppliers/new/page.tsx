"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme } from "~/lib/theme";
import { Btn, Card, PageTitle } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";
import { FormGrid, FormSection, Input } from "~/components/address-fields";

export default function NewSupplierPage() {
  const t = theme;
  const router = useRouter();
  const utils = trpc.useUtils();
  const create = trpc.supplier.create.useMutation({
    onSuccess: (row) => {
      utils.supplier.list.invalidate();
      utils.supplier.search.invalidate();
      router.push(`/suppliers/${row!.id}`);
    },
  });

  const [f, setF] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
    notes: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    create.mutate(f);
  }

  return (
    <div>
      <BackLink href="/suppliers" label="Back to suppliers" />
      <PageTitle
        eyebrow="Add a vendor"
        title="New supplier"
        subtitle="Who ships product to your docks. You'll see their name on inbound orders and receipts."
      />

      <Card t={t}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <FormSection title="Identity">
            <FormGrid>
              <Input label="Company name" value={f.name} onChange={(v) => set("name", v)} />
              <Input label="Primary contact" value={f.contactName} onChange={(v) => set("contactName", v)} />
              <Input label="Email" type="email" value={f.email} onChange={(v) => set("email", v)} />
              <Input label="Phone" value={f.phone} onChange={(v) => set("phone", v)} />
            </FormGrid>
          </FormSection>

          <FormSection title="Address">
            <FormGrid>
              <Input label="Street" value={f.addressLine1} onChange={(v) => set("addressLine1", v)} />
              <Input label="Suite / unit" value={f.addressLine2} onChange={(v) => set("addressLine2", v)} />
              <Input label="City" value={f.city} onChange={(v) => set("city", v)} />
              <Input label="State / region" value={f.region} onChange={(v) => set("region", v)} />
              <Input label="Postal code" value={f.postalCode} onChange={(v) => set("postalCode", v)} />
              <Input label="Country" value={f.country} onChange={(v) => set("country", v)} />
            </FormGrid>
          </FormSection>

          <FormSection title="Notes">
            <textarea
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Dock windows, delivery instructions, account manager, etc."
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
              {create.isPending ? "Creating…" : "Create supplier"}
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
