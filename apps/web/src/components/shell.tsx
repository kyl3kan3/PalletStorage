"use client";

// App shell: sidebar + top bar + content frame. Responsive:
//   >= 1024px — sidebar is sticky, always visible, 232px wide
//   <  1024px — sidebar is hidden; a hamburger in the top bar slides
//               it in as a modal drawer with a backdrop

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, SignedIn, UserButton } from "@clerk/nextjs";
import { useEffect, useState, type ReactNode } from "react";
import { theme, FONTS, Wordmark, Cubby } from "~/lib/theme";
import { Ic } from "./icons";
import { Search } from "./kit";
import { useMatchMedia } from "~/lib/useMatchMedia";

interface NavItem {
  href: Route;
  label: string;
  icon: (p: { size?: number; color?: string }) => ReactNode;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Ic.Home },
  { href: "/tasks", label: "My tasks", icon: Ic.Check },
  { href: "/reports", label: "Reports", icon: Ic.Chart },
  { href: "/inbound", label: "Inbound", icon: Ic.Inbound },
  { href: "/outbound", label: "Outbound", icon: Ic.Outbound },
  { href: "/inventory", label: "Inventory", icon: Ic.Scan },
  { href: "/products", label: "Products", icon: Ic.Boxes },
  { href: "/customers", label: "Customers", icon: Ic.User },
  { href: "/suppliers", label: "Suppliers", icon: Ic.Truck },
  { href: "/warehouses", label: "Warehouses", icon: Ic.Warehouse },
  { href: "/inventory/counts", label: "Cycle counts", icon: Ic.Clipboard },
  { href: "/settings", label: "Settings", icon: Ic.Settings },
];

function activeHref(pathname: string): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const n of NAV) {
    const match =
      pathname === n.href ||
      (n.href !== "/" && pathname.startsWith(`${n.href}/`));
    if (match && n.href.length > bestLen) {
      best = n.href;
      bestLen = n.href.length;
    }
  }
  return best;
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMobile = useMatchMedia("(max-width: 1023px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const t = theme;

  // Close the drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock scroll when the drawer is open on mobile.
  useEffect(() => {
    if (drawerOpen && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen, isMobile]);

  const sidebar = <Sidebar pathname={pathname} />;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "232px 1fr",
        background: t.bg,
        color: t.body,
        fontFamily: FONTS.sans,
      }}
    >
      {/* Desktop sidebar (sticky) */}
      {!isMobile && (
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
          {sidebar}
        </aside>
      )}

      {/* Mobile drawer + backdrop */}
      {isMobile && drawerOpen && (
        <>
          <button
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(31, 26, 23, 0.45)",
              zIndex: 30,
              border: "none",
              cursor: "pointer",
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: 272,
              maxWidth: "85vw",
              background: t.bgAlt,
              borderRight: `1.5px solid ${t.border}`,
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              zIndex: 31,
              boxShadow: "0 20px 60px rgba(0,0,0,.25)",
              overflowY: "auto",
            }}
          >
            {sidebar}
          </aside>
        </>
      )}

      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: isMobile ? "12px 16px" : "14px 28px",
            borderBottom: `1.5px solid ${t.border}`,
            background: t.bg,
            position: "sticky",
            top: 0,
            zIndex: 5,
          }}
        >
          {isMobile && (
            <button
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 10,
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                cursor: "pointer",
              }}
            >
              <HamburgerIcon color={t.ink} />
            </button>
          )}

          {/* Brand mark on mobile; search on desktop. */}
          {isMobile ? (
            <Link href="/" style={{ textDecoration: "none" }}>
              <Wordmark t={t} size={18} />
            </Link>
          ) : (
            <Search t={t} placeholder="Search pallets, SKUs, orders…" width={320} />
          )}

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

        <div
          style={{
            padding: isMobile ? "16px" : "28px",
            flex: 1,
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const t = theme;
  return (
    <>
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
        const on = activeHref(pathname) === n.href;
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
    </>
  );
}

function HamburgerIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
