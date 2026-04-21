"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, SquircleIcon, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";

/**
 * Dev tools. The only operation here is seeding the dedicated test
 * account with realistic fake WMS data. The button will 403 for
 * anyone who isn't signed in as test@test.com.
 */
export default function DevPage() {
  const t = theme;
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isTestAccount = email === "test@test.com";

  const [force, setForce] = useState(false);
  const seed = trpc.dev.seed.useMutation();

  return (
    <div>
      <PageTitle
        eyebrow="Dev tools"
        title="Sample data"
        subtitle="Populate a demo tenant with warehouses, products, pallets, orders, movements, and cycle counts."
      />

      <Card t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <SquircleIcon
            t={t}
            icon={Ic.Spark}
            tint={isTestAccount ? "primary" : "neutral"}
            size={48}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: t.ink, fontSize: 15 }}>
              {isTestAccount
                ? "Ready to seed"
                : "Only test@test.com can run this"}
            </div>
            <div style={{ fontSize: 12.5, color: t.muted }}>
              Signed in as{" "}
              <span style={{ fontFamily: FONTS.mono }}>{email ?? "—"}</span>. The
              seed operation is gated server-side so real tenants can't be
              polluted by accident.
            </div>
          </div>
          {isTestAccount && (
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, color: t.muted }}>
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
              Force re-seed
            </label>
          )}
          <Btn
            t={t}
            variant="accent"
            size="md"
            icon={Ic.Plus}
            disabled={!isTestAccount || seed.isPending}
            onClick={() => seed.mutate({ force })}
          >
            {seed.isPending ? "Seeding…" : "Load sample data"}
          </Btn>
        </div>

        {seed.data?.summary && (
          <Card t={t} tint="mint">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SquircleIcon t={t} icon={Ic.Check} tint="mint" size={40} />
              <div>
                <div style={{ fontWeight: 600, color: t.ink }}>Seed complete</div>
                <div style={{ fontSize: 12, color: t.muted, fontFamily: FONTS.mono }}>
                  {seed.data.summary.warehouses} warehouses ·{" "}
                  {seed.data.summary.locations} locations ·{" "}
                  {seed.data.summary.products} products ·{" "}
                  {seed.data.summary.pallets} pallets ·{" "}
                  {seed.data.summary.inboundOrders} inbounds ·{" "}
                  {seed.data.summary.outboundOrders} outbounds ·{" "}
                  {seed.data.summary.movements} movements ·{" "}
                  {seed.data.summary.cycleCounts} cycle counts
                </div>
              </div>
            </div>
          </Card>
        )}
        {seed.error && (
          <Card t={t} tint="coral">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Ic.X size={16} color={t.coral} />
              <span style={{ color: t.ink, fontSize: 13 }}>{seed.error.message}</span>
            </div>
          </Card>
        )}
      </Card>

      <div style={{ marginTop: 20 }}>
        <Card t={t} tint="alt">
          <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: t.ink, marginBottom: 4 }}>
              How to use this
            </div>
            1. Create a user <b>test@test.com</b> in your Clerk dashboard
            (Users → Add user, set a password).
            <br />
            2. Sign in as that user. Clerk will auto-create a new
            organization for them on first load.
            <br />
            3. Come back to this page and click <b>Load sample data</b>. Every
            other dashboard page will then have something to show.
            <br />
            4. Run <b>Force re-seed</b> to append more data (most tables use
            upserts; orders, pallets, and movements accumulate).
          </div>
        </Card>
      </div>
    </div>
  );
}
