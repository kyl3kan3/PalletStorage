"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { theme, FONTS } from "~/lib/theme";
import { Card, PageTitle, SquircleIcon, type IconTint } from "~/components/kit";
import { Ic } from "~/components/icons";
import { OverviewDashboard } from "~/components/overview-dashboard";
import { OnboardingChecklist } from "~/components/onboarding-checklist";

/**
 * Home — greeting + "Quick actions" shortcut bar + overview
 * dashboard. Quick actions are the four things a warehouse operator
 * does every day; surfacing them here means they're one click from
 * anywhere, not buried inside tiles.
 */
export default function HomePage() {
  const t = theme;
  const { user } = useUser();
  const firstName = user?.firstName ?? null;

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "You're up early" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageTitle
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        subtitle="What would you like to do today?"
      />

      <OnboardingChecklist />

      <div
        data-collapse-grid
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <QuickAction
          href="/inbound/new"
          icon={Ic.Inbound}
          tint="primary"
          title="Receive a shipment"
          desc="Start a new inbound from a supplier or PO."
        />
        <QuickAction
          href="/outbound/new"
          icon={Ic.Outbound}
          tint="coral"
          title="Ship an order"
          desc="Create a new outbound for a customer."
        />
        <QuickAction
          href="/inventory/scan"
          icon={Ic.Scan}
          tint="mint"
          title="Find a pallet"
          desc="Scan or paste a pallet code to look it up."
        />
        <QuickAction
          href="/inventory/counts"
          icon={Ic.Clipboard}
          tint="sky"
          title="Count a bin"
          desc="Open or continue a cycle count."
        />
      </div>

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
        How the floor is doing
      </div>
      <OverviewDashboard />
    </div>
  );
}

function QuickAction({
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
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <SquircleIcon t={t} icon={icon} tint={tint} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15.5,
                fontWeight: 600,
                color: t.ink,
                fontFamily: FONTS.sans,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 12.5, color: t.muted, marginTop: 4, lineHeight: 1.4 }}>
              {desc}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
