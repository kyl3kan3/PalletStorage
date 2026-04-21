"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { theme, FONTS } from "~/lib/theme";
import { Ic } from "./icons";

/**
 * Horizontal sub-nav for the Settings area. Rendered at the top of
 * every /settings/* page so people can hop between Company / Team /
 * Integrations without going back to the hub.
 */
const TABS: Array<{ href: Route; label: string; icon: (p: { size?: number; color?: string }) => React.ReactNode }> = [
  { href: "/settings", label: "Overview", icon: Ic.Home },
  { href: "/settings/company", label: "Company", icon: Ic.Warehouse },
  { href: "/settings/team", label: "Team", icon: Ic.User },
  { href: "/settings/integrations", label: "Integrations", icon: Ic.Dollar },
];

export function SettingsNav() {
  const pathname = usePathname();
  const t = theme;

  return (
    <div
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        background: t.surfaceAlt,
        border: `1.5px solid ${t.border}`,
        borderRadius: 12,
        marginBottom: 20,
      }}
    >
      {TABS.map((tab) => {
        const on = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 9,
              background: on ? t.surface : "transparent",
              color: on ? t.ink : t.muted,
              boxShadow: on ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              fontFamily: FONTS.sans,
              fontSize: 12.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Icon size={14} color={on ? t.primaryDeep : t.muted} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
