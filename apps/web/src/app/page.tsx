"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { theme, FONTS, Wordmark, Cubby } from "~/lib/theme";
import { Btn, Card, SquircleIcon, Tag, type IconTint } from "~/components/kit";
import { Ic } from "~/components/icons";

export default function HomePage() {
  const t = theme;

  return (
    <main style={{ minHeight: "100vh", padding: "32px 28px", fontFamily: FONTS.sans }}>
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          marginBottom: 40,
        }}
      >
        <Wordmark t={t} size={24} />
        <div style={{ flex: 1 }} />
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Btn t={t} variant="primary" size="md" icon={Ic.Arrow}>
              Sign in
            </Btn>
          </SignInButton>
        </SignedOut>
      </div>

      <SignedOut>
        <div style={{ maxWidth: 760, margin: "80px auto 0", textAlign: "center" }}>
          <div style={{ display: "inline-block", marginBottom: 24 }}>
            <Cubby size={120} t={t} mood="wow" />
          </div>
          <Tag t={t} tone="primary" style={{ marginBottom: 20 }}>
            <Ic.Spark size={10} /> warehouse that feels good
          </Tag>
          <h1
            className="hero-title"
            style={{
              fontFamily: FONTS.display,
              fontSize: 64,
              fontWeight: 600,
              color: t.ink,
              letterSpacing: -2,
              lineHeight: 1.02,
              fontStyle: "italic",
              margin: "12px 0 16px",
            }}
          >
            Stack pallets,
            <br />
            not paperwork.
          </h1>
          <p
            style={{
              fontSize: 18,
              color: t.muted,
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            A warm, honest WMS for small &amp; mid-sized warehouses. Receiving,
            putaway, picking, shipping &mdash; all in one friendly place.
          </p>
          <div style={{ marginTop: 28 }}>
            <SignInButton mode="modal">
              <Btn t={t} variant="accent" size="lg" icon={Ic.Arrow}>
                Sign in to continue
              </Btn>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Jump in
          </div>
          <h2
            style={{
              fontFamily: FONTS.display,
              fontSize: 36,
              fontWeight: 600,
              color: t.ink,
              letterSpacing: -1,
              marginBottom: 24,
            }}
          >
            Where to next?
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            <Tile href="/warehouses" icon={Ic.Warehouse} tint="primary" title="Warehouses" desc="Sites, zones, racks" />
            <Tile href="/inventory" icon={Ic.Scan} tint="mint" title="Inventory" desc="Pallets & locations" />
            <Tile href="/products" icon={Ic.Boxes} tint="lilac" title="Products" desc="SKU catalog" />
            <Tile href="/inbound" icon={Ic.Inbound} tint="primary" title="Inbound" desc="Receiving & putaway" />
            <Tile href="/outbound" icon={Ic.Outbound} tint="coral" title="Outbound" desc="Picking & shipping" />
            <Tile href="/reports" icon={Ic.Chart} tint="sky" title="Reports" desc="KPIs & throughput" />
            <Tile href="/inventory/counts" icon={Ic.Clipboard} tint="sky" title="Cycle counts" desc="Stock takes" />
            <Tile href="/settings/integrations" icon={Ic.Settings} tint="neutral" title="Settings" desc="QuickBooks & more" />
          </div>
        </div>
      </SignedIn>
    </main>
  );
}

function Tile({
  href,
  icon,
  tint,
  title,
  desc,
}: {
  href: Route;
  icon: (p: { size?: number }) => ReactNode;
  tint: IconTint;
  title: string;
  desc: string;
}) {
  const t = theme;
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <Card t={t} padding={18} interactive>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SquircleIcon t={t} icon={icon} tint={tint} size={44} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{title}</div>
            <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>{desc}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
