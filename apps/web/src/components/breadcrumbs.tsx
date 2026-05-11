"use client";

// Breadcrumbs: simple Home › Section › Detail trail at the top of
// detail pages. The deep pages (1100+ lines) made it easy to lose
// track of where you are; this restores parent navigation in one click.

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { theme as defaultTheme, FONTS, type Theme } from "~/lib/theme";

export interface BreadcrumbItem {
  label: ReactNode;
  /** Omit href to render as plain text (the current page). */
  href?: Route | string;
}

export function Breadcrumbs({
  items,
  t = defaultTheme,
}: {
  items: BreadcrumbItem[];
  t?: Theme;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        fontFamily: FONTS.sans,
        fontSize: 12.5,
        color: t.muted,
        marginBottom: 8,
      }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {item.href && !isLast ? (
              <Link
                href={item.href as Route}
                style={{
                  color: t.primaryDeep,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: isLast ? t.ink : t.muted, fontWeight: isLast ? 600 : 500 }}>
                {item.label}
              </span>
            )}
            {!isLast && <span style={{ color: t.mutedSoft }}>›</span>}
          </span>
        );
      })}
    </nav>
  );
}
