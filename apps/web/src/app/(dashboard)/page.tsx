"use client";

import { useUser } from "@clerk/nextjs";
import { theme, FONTS } from "~/lib/theme";
import { PageTitle } from "~/components/kit";
import { OverviewDashboard } from "~/components/overview-dashboard";

/**
 * Home — the signed-in operator's daily dashboard. KPI tiles,
 * throughput chart, dock-to-stock ring, top SKUs, recent movements.
 * (Moved here from /reports/overview now that "Home" and "Overview"
 * are one concept rather than two nav entries.)
 */
export default function HomePage() {
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
        subtitle="Numbers for today, rolled up and easy to scan."
      />
      <OverviewDashboard />
    </div>
  );
}

// Suppress unused-import warning if theme/FONTS aren't referenced
// directly after the greeting strings shift; keeps style parity with
// other dashboard pages so future tweaks have easy access.
void theme;
void FONTS;
