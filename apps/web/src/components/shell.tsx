"use client";

// App shell: sidebar + top bar + content frame. Used by the dashboard
// layout. Ported from shell.jsx; the raw navigation list now points at
// real routes and uses next/link instead of plain divs.

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, SignedIn, UserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { theme, FONTS, Wordmark, Cubby } from "~/lib/theme";
import { Ic } from "./icons";
import { Search } from "./kit";

interface NavItem {
  href: Route;
  label: string;
  icon: (p: { size?: number; color?: string }) => ReactNode;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Ic.Home },
  { href: "/tasks", label: "My tasks", icon: Ic.Check },
  { href: "/reports", label: "Overview", icon: Ic.Chart },
  { href: "/inbound", label: "Inbound", icon: Ic.Inbound },
  { href: "/outbound", label: "Outbound", icon: Ic.Outbound },
  { href: "/inventory", label: "Inventory", icon: Ic.Scan },
  { href: "/products", label: "Products", icon: Ic.Boxes },
  { href: "/warehouses", label: "Warehouses", icon: Ic.Warehouse },
  { href: "/inventory/counts", label: "Cycle counts", icon: Ic.Clipboard },
  { href: "/settings", label: "Settings", icon: Ic.Settings },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = theme;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "232px 1fr",
        background: t.bg,
        color: t.body,
        fontFamily: FONTS.sans,
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          background: t.bgAlt,
          borderRight: `1.5px solid ${t.border}`,
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: "6px 8px 18px" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Wordmark t={t} size={20} />
          </Link>
        </div>

        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: t.mutedSoft,
            padding: "4px 10px",
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          Workspace
        </div>

        {NAV.map((n) => {
          // Active if exact match, or (for non-root routes) if we're nested under it.
          const on =
            pathname === n.href ||
            (n.href !== "/" && pathname.startsWith(`${n.href}/`));
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 10,
                background: on ? t.surface : "transparent",
                color: on ? t.ink : t.body,
                border: on ? `1.5px solid ${t.border}` : "1.5px solid transparent",
                boxShadow: on ? "0 1px 2px rgba(0,0,0,.04)" : "none",
                fontSize: 13.5,
                fontWeight: on ? 600 : 500,
                position: "relative",
                textDecoration: "none",
              }}
            >
              {on && (
                <div
                  style={{
                    position: "absolute",
                    left: -16,
                    top: 10,
                    bottom: 10,
                    width: 3,
                    borderRadius: 2,
                    background: t.primary,
                  }}
                />
              )}
              <Icon size={16} color={on ? t.primaryDeep : t.muted} />
              <span style={{ flex: 1 }}>{n.label}</span>
            </Link>
          );
        })}

        <div style={{ flex: 1 }} />

        <div
          style={{
            background: t.primarySoft,
            borderRadius: 16,
            padding: 14,
            border: `1.5px solid ${t.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Cubby size={40} t={t} mood="happy" />
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: t.ink,
                  fontFamily: FONTS.display,
                  fontStyle: "italic",
                }}
              >
                Hi, I&apos;m Cubby!
              </div>
              <div style={{ fontSize: 11, color: t.muted }}>Warehouse buddy</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 28px",
            borderBottom: `1.5px solid ${t.border}`,
            background: t.bg,
            position: "sticky",
            top: 0,
            zIndex: 5,
          }}
        >
          <Search t={t} placeholder="Search pallets, SKUs, orders…" width={320} />
          <div style={{ flex: 1 }} />
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/"
            organizationProfileMode="navigation"
            organizationProfileUrl="/settings/team"
            createOrganizationMode="modal"
            appearance={{ elements: { rootBox: "flex" } }}
          />
          <SignedIn>
            <UserButton
              userProfileMode="navigation"
              userProfileUrl="/account"
              afterSignOutUrl="/"
            />
          </SignedIn>
        </header>

        <div style={{ padding: "28px", flex: 1 }}>{children}</div>
      </main>
    </div>
  );
}
