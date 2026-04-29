"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";

/**
 * Top-level entry point for inventory imports. Asks "which customer
 * is this for?" then routes to that customer's per-customer importer
 * (where the actual paste / upload + AI parse happens). Keeps
 * /customers/<id>/import the single source of truth for the flow
 * so we don't duplicate UI.
 */
export default function CustomerImportChooser() {
  const t = theme;
  const router = useRouter();
  const customers = trpc.customer.list.useQuery();
  const [chosen, setChosen] = useState<string>("");

  return (
    <div>
      <BackLink href="/customers" label="Back to customers" />
      <PageTitle
        eyebrow="One-time backfill"
        title="Import inventory from a sheet"
        subtitle="Pick the customer this sheet belongs to. Next page lets you upload the file or paste cells; the AI extracts pallet rows + any rates."
      />

      <Card t={t}>
        <div
          style={{
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Customer
        </div>
        <select
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "10px 14px",
            borderRadius: 12,
            background: t.surfaceAlt,
            border: `1.5px solid ${t.border}`,
            fontSize: 14,
            color: t.ink,
            fontFamily: FONTS.sans,
            cursor: "pointer",
          }}
        >
          <option value="">— select a customer —</option>
          {(customers.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.contactName ? ` — ${c.contactName}` : ""}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 14 }}>
          <Btn
            t={t}
            type="button"
            variant="accent"
            size="md"
            icon={Ic.Arrow}
            disabled={!chosen}
            onClick={() => router.push(`/customers/${chosen}/import` as Route)}
          >
            Continue
          </Btn>
        </div>

        {customers.data && customers.data.length === 0 && (
          <div
            style={{
              marginTop: 14,
              fontSize: 12.5,
              color: t.muted,
              fontStyle: "italic",
            }}
          >
            No customers yet — create one first via the &ldquo;New customer&rdquo;
            button.
          </div>
        )}
      </Card>
    </div>
  );
}
