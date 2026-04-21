"use client";

import { useEffect, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { SettingsNav } from "~/components/settings-nav";

interface Form {
  name: string;
  legalName: string;
  billingEmail: string;
  phone: string;
  taxId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  timezone: string;
  logoUrl: string;
}

const empty: Form = {
  name: "",
  legalName: "",
  billingEmail: "",
  phone: "",
  taxId: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  timezone: "UTC",
  logoUrl: "",
};

export default function CompanyPage() {
  const t = theme;
  const utils = trpc.useUtils();
  const org = trpc.organization.current.useQuery();
  const save = trpc.organization.updateProfile.useMutation({
    onSuccess: () => utils.organization.current.invalidate(),
  });

  const [form, setForm] = useState<Form>(empty);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!org.data) return;
    setForm({
      name: org.data.name ?? "",
      legalName: org.data.legalName ?? "",
      billingEmail: org.data.billingEmail ?? "",
      phone: org.data.phone ?? "",
      taxId: org.data.taxId ?? "",
      addressLine1: org.data.addressLine1 ?? "",
      addressLine2: org.data.addressLine2 ?? "",
      city: org.data.city ?? "",
      region: org.data.region ?? "",
      postalCode: org.data.postalCode ?? "",
      country: org.data.country ?? "",
      timezone: org.data.timezone ?? "UTC",
      logoUrl: org.data.logoUrl ?? "",
    });
    setDirty(false);
  }, [org.data]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({
      name: form.name,
      legalName: form.legalName,
      billingEmail: form.billingEmail,
      phone: form.phone,
      taxId: form.taxId,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      region: form.region,
      postalCode: form.postalCode,
      country: form.country,
      timezone: form.timezone,
      logoUrl: form.logoUrl,
    });
  }

  return (
    <div>
      <SettingsNav />
      <PageTitle
        eyebrow="Company profile"
        title={form.name || "Your company"}
        subtitle="Shown on Bills Of Lading and QuickBooks exports. Manager or admin role required to edit."
        right={
          save.data ? (
            <Tag t={t} tone="mint">
              Saved
            </Tag>
          ) : undefined
        }
      />

      <Card t={t}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="Identity">
            <Row>
              <Field label="Display name">
                <TextField
                  t={t}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
              <Field label="Legal name">
                <TextField
                  t={t}
                  value={form.legalName}
                  onChange={(e) => update("legalName", e.target.value)}
                  placeholder="Optional — used on BOLs if set"
                />
              </Field>
            </Row>
            <Row>
              <Field label="Tax ID / EIN">
                <TextField
                  t={t}
                  value={form.taxId}
                  onChange={(e) => update("taxId", e.target.value)}
                />
              </Field>
              <Field label="Billing email">
                <TextField
                  t={t}
                  type="email"
                  value={form.billingEmail}
                  onChange={(e) => update("billingEmail", e.target.value)}
                />
              </Field>
            </Row>
            <Row>
              <Field label="Phone">
                <TextField
                  t={t}
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </Field>
              <Field label="Logo URL">
                <TextField
                  t={t}
                  type="url"
                  value={form.logoUrl}
                  placeholder="https://…"
                  onChange={(e) => update("logoUrl", e.target.value)}
                />
              </Field>
            </Row>
          </Section>

          <Section title="Address">
            <Row>
              <Field label="Street">
                <TextField
                  t={t}
                  value={form.addressLine1}
                  onChange={(e) => update("addressLine1", e.target.value)}
                />
              </Field>
              <Field label="Suite / unit">
                <TextField
                  t={t}
                  value={form.addressLine2}
                  onChange={(e) => update("addressLine2", e.target.value)}
                />
              </Field>
            </Row>
            <Row>
              <Field label="City">
                <TextField
                  t={t}
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </Field>
              <Field label="State / region">
                <TextField
                  t={t}
                  value={form.region}
                  onChange={(e) => update("region", e.target.value)}
                />
              </Field>
            </Row>
            <Row>
              <Field label="Postal code">
                <TextField
                  t={t}
                  value={form.postalCode}
                  onChange={(e) => update("postalCode", e.target.value)}
                />
              </Field>
              <Field label="Country">
                <TextField
                  t={t}
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                />
              </Field>
            </Row>
          </Section>

          <Section title="Locale">
            <Row>
              <Field label="Timezone">
                <TextField
                  t={t}
                  value={form.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                  placeholder="America/Los_Angeles"
                />
              </Field>
              <div />
            </Row>
          </Section>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Btn
              t={t}
              type="submit"
              variant="accent"
              size="md"
              icon={Ic.Check}
              disabled={!dirty || save.isPending}
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </Btn>
            {save.error && (
              <span style={{ color: t.coral, fontSize: 13 }}>{save.error.message}</span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          color: theme.muted,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
