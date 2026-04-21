"use client";

import Link from "next/link";
import type { Route } from "next";
import { theme, FONTS } from "~/lib/theme";
import { Ic } from "./icons";

/**
 * Small "← Back to X" link rendered above a PageTitle. Replaces the
 * ReportsNav / SettingsNav tab strips on sub-pages where a tile hub
 * at the parent route is the canonical entry point.
 */
export function BackLink({ href, label }: { href: Route; label: string }) {
  const t = theme;
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px 4px 6px",
        borderRadius: 999,
        background: "transparent",
        color: t.muted,
        fontSize: 12.5,
        fontFamily: FONTS.sans,
        fontWeight: 600,
        textDecoration: "none",
        marginBottom: 10,
      }}
    >
      <Ic.Arrow size={12} color={t.muted} style={{ transform: "rotate(180deg)" }} />
      {label}
    </Link>
  );
}
