"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { floorTheme as ft, FONTS, Cubby } from "~/lib/theme";
import { FBtn, FPill } from "./kit";
import { Ic, type IconProps } from "./icons";
import { useCmdK } from "./cmdk-palette";

/**
 * FShell — the floor-mode dashboard chrome.
 *
 * Ported from Stacks/design_handoff_stacks_floor_mode/web-c-shell.jsx
 * (FShell). Sidebar with marigold-glow active rail, dark top bar with
 * the search slot (opens the Cmd+K palette), page title area, and the
 * children content area below.
 *
 * The page title block is opt-in: pass `title` (and optionally
 * `eyebrow`, `subtitle`, `tabs`, `actions`) and FShell renders it
 * above your content with the floor-mode display type. Pass only
 * `children` to omit it.
 *
 * Sidebar nav links to existing app routes (Operations is wired to
 * /reports for now). Active state is auto-detected from the current
 * pathname — pass `active` to override (useful for preview routes
 * that aren't at their final URL yet).
 */

type Icon = (props: IconProps) => ReactNode;

interface NavItem {
  key: string;
  label: string;
  href: Route;
  icon: Icon;
  badge?: number;
}

// Primary nav routes inside the /floor tree. The "Admin" section
// below deep-links to legacy (dashboard) pages that don't have a
// floor-mode equivalent yet (schedule, customers, reports, setup).
const NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/floor" as Route, icon: Ic.Home },
  { key: "operations", label: "Operations", href: "/floor/operations" as Route, icon: Ic.Chart },
  { key: "inbound", label: "Inbound", href: "/floor/inbound" as Route, icon: Ic.Inbound },
  { key: "outbound", label: "Outbound", href: "/floor/outbound" as Route, icon: Ic.Outbound },
  { key: "inventory", label: "Inventory", href: "/floor/inventory" as Route, icon: Ic.Scan },
  { key: "products", label: "Products", href: "/floor/products" as Route, icon: Ic.Boxes },
  { key: "warehouses", label: "Warehouses", href: "/floor/warehouses" as Route, icon: Ic.Warehouse },
  { key: "counts", label: "Cycle counts", href: "/floor/counts" as Route, icon: Ic.Clipboard },
];

// Admin / setup links that still live under the legacy (dashboard)
// shell. Clicking them leaves Floor mode and renders inside the
// original Shell sidebar (no floor-mode redesign for these yet).
const ADMIN_NAV: NavItem[] = [
  { key: "schedule", label: "Schedule", href: "/schedule" as Route, icon: Ic.Calendar },
  { key: "customers", label: "Customers", href: "/customers" as Route, icon: Ic.User },
  { key: "reports", label: "Reports", href: "/reports" as Route, icon: Ic.Chart },
  { key: "setup", label: "Setup", href: "/catalog" as Route, icon: Ic.Settings },
];

export interface FShellTab {
  key: string;
  label: string;
  count?: number;
}

export function FShell({
  active,
  eyebrow,
  title,
  subtitle,
  actions,
  tabs,
  tabActive,
  onTabChange,
  children,
}: {
  /** Override the auto-detected active nav key. */
  active?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: FShellTab[];
  tabActive?: string;
  onTabChange?: (key: string) => void;
  children: ReactNode;
}) {
  const t = ft;
  const pathname = usePathname() ?? "/";
  // Auto-detect active nav by longest-prefix match against the current
  // pathname so /floor/inbound/123 still highlights "Inbound". The
  // "home" entry (/floor) has the shortest href, so by sorting
  // longest-first it only matches when nothing more specific does.
  const autoActive =
    [...NAV, ...ADMIN_NAV]
      .slice()
      .sort((a, b) => b.href.length - a.href.length)
      .find((n) => pathname.startsWith(n.href as string))?.key;
  const activeKey = active ?? autoActive;

  return (
    <div
      data-fshell
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        background: t.bg,
        color: t.body,
        fontFamily: FONTS.sans,
      }}
    >
      {/* ─── Sidebar ─────────────────────────────── */}
      <aside
        data-fshell-sidebar
        style={{
          background: t.bgAlt,
          borderRight: `1px solid ${t.border}`,
          padding: "22px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div
          style={{
            padding: "4px 10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Cubby size={26} t={t} />
          <span
            style={{
              fontFamily: FONTS.display,
              fontStyle: "italic",
              fontSize: 20,
              fontWeight: 600,
              color: t.ink,
              letterSpacing: -0.5,
            }}
          >
            stacks<span style={{ color: t.primary }}>.</span>
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: FONTS.mono,
              fontSize: 9,
              fontWeight: 700,
              color: t.primary,
              letterSpacing: 1,
              padding: "2px 6px",
              borderRadius: 4,
              background: t.primarySoft,
              border: "1px solid rgba(255,178,62,.3)",
            }}
          >
            OPS
          </span>
        </div>

        <FBtn
          t={t}
          size="md"
          icon={Ic.Scan}
          style={{ marginBottom: 14, justifyContent: "flex-start" }}
        >
          Open scanner
        </FBtn>

        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 9.5,
            fontWeight: 700,
            color: t.mutedSoft,
            padding: "6px 10px",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Workspace
        </div>

        {NAV.map((n) => (
          <FloorNavLink key={n.key} item={n} active={activeKey === n.key} t={t} />
        ))}

        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 9.5,
            fontWeight: 700,
            color: t.mutedSoft,
            padding: "14px 10px 6px",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Admin
        </div>
        {ADMIN_NAV.map((n) => (
          <FloorNavLink key={n.key} item={n} active={activeKey === n.key} t={t} />
        ))}

        <div style={{ flex: 1 }} />

        {/* Live status footer */}
        <FloorLiveStatus />
      </aside>

      {/* ─── Main column ──────────────────────────── */}
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile-only nav strip — hidden by CSS at ≥1024px. Horizontal
            scrolling list of the same nav targets the sidebar uses on
            desktop, so the floor pages stay reachable from a phone. */}
        <nav
          data-fshell-mobile-nav
          style={{
            display: "none",
            gap: 6,
            padding: "10px 14px",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            background: t.bgAlt,
            borderBottom: `1px solid ${t.border}`,
            position: "sticky",
            top: 0,
            zIndex: 3,
          }}
        >
          {NAV.map((n) => (
            <FloorMobileNavLink
              key={n.key}
              item={n}
              active={activeKey === n.key}
              t={t}
            />
          ))}
        </nav>

        {/* Top bar */}
        <div
          data-fshell-topbar
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 28px",
            borderBottom: `1px solid ${t.border}`,
            background: t.bg,
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          {/* Search slot — clicking it (or hitting ⌘K anywhere) opens
              the command palette. Looks like an input but isn't —
              keeps the real text-entry to a focus-trapped overlay. */}
          <SearchSlot />

          <div style={{ flex: 1 }} />

          {actions}

          {/* User chip — Clerk integration wires in a later phase */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px 6px 12px",
              borderRadius: 12,
              background: t.surface,
              border: `1px solid ${t.border}`,
            }}
          >
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: t.ink, fontWeight: 600 }}>
                Manager
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted }}>
                OPS · WH-01
              </div>
            </div>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: t.primary,
                color: t.primaryText,
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              JR
            </div>
          </div>
        </div>

        {/* Page title block */}
        {(title || eyebrow) && (
          <div data-fshell-title style={{ padding: "24px 28px 14px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {eyebrow && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: FONTS.mono,
                      fontSize: 10.5,
                      color: t.primary,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      fontWeight: 800,
                      marginBottom: 8,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: t.primarySoft,
                      border: "1px solid rgba(255,178,62,.3)",
                    }}
                  >
                    {eyebrow}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <h1
                    data-fshell-h1
                    style={{
                      margin: 0,
                      fontFamily: FONTS.sans,
                      fontSize: 36,
                      fontWeight: 800,
                      color: t.ink,
                      letterSpacing: -1.4,
                      lineHeight: 1,
                    }}
                  >
                    {title}
                  </h1>
                  {subtitle && (
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 12,
                        color: t.muted,
                        letterSpacing: 0.3,
                      }}
                    >
                      {subtitle}
                    </span>
                  )}
                </div>
              </div>
              {actions && !tabs && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
            </div>
            {tabs && tabs.length > 0 && (
              <div
                style={{
                  marginTop: 18,
                  display: "inline-flex",
                  gap: 4,
                  padding: 4,
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                }}
              >
                {tabs.map((tb) => {
                  const isActive = (tabActive ?? tabs[0]?.key) === tb.key;
                  return (
                    <button
                      key={tb.key}
                      type="button"
                      onClick={() => onTabChange?.(tb.key)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        background: isActive ? t.primary : "transparent",
                        color: isActive ? t.primaryText : t.muted,
                        fontFamily: FONTS.mono,
                        fontSize: 11.5,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {tb.label}
                      {tb.count != null && (
                        <span
                          style={{
                            fontSize: 10,
                            color: isActive ? t.primaryText : t.mutedSoft,
                            opacity: 0.7,
                          }}
                        >
                          {tb.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div data-fshell-body style={{ flex: 1, padding: "0 28px 28px" }}>{children}</div>
      </main>
    </div>
  );
}

function FloorNavLink({
  item,
  active,
  t,
}: {
  item: NavItem;
  active: boolean;
  t: typeof ft;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "9px 10px",
        borderRadius: 10,
        cursor: "pointer",
        background: active ? t.surfaceLift : "transparent",
        color: active ? t.ink : t.body,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        position: "relative",
        letterSpacing: -0.1,
        textDecoration: "none",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            left: -14,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 2,
            background: t.primary,
            boxShadow: `0 0 12px ${t.primaryGlow}`,
          }}
        />
      )}
      <Icon size={16} color={active ? t.primary : t.muted} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge != null && (
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            fontWeight: 700,
            color: active ? t.primary : t.muted,
            background: active ? t.primarySoft : t.surface,
            padding: "2px 7px",
            borderRadius: 6,
            border: `1px solid ${active ? "rgba(255,178,62,.3)" : t.border}`,
          }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/**
 * Pill-shaped nav link rendered in the mobile-only horizontal nav
 * strip. Icon + label, compact, with a primary-tinted background when
 * active. Hidden on desktop via the `data-fshell-mobile-nav` CSS.
 */
function FloorMobileNavLink({
  item,
  active,
  t,
}: {
  item: NavItem;
  active: boolean;
  t: typeof ft;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        borderRadius: 999,
        background: active ? t.primarySoft : t.surface,
        border: `1px solid ${active ? "rgba(255,178,62,.35)" : t.border}`,
        color: active ? t.primary : t.body,
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: -0.1,
        textDecoration: "none",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={14} color={active ? t.primary : t.muted} />
      {item.label}
    </Link>
  );
}

/**
 * Live status footer in the sidebar. Shows a green pulse + on-floor
 * count + warehouse + current time + shift. Pure cosmetic for now —
 * later phases hook this to a `home.summary` tRPC query.
 */
function FloorLiveStatus() {
  const t = ft;
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: t.surface,
        border: `1px solid ${t.border}`,
      }}
    >
      <FPill t={t} tone="mint" size="sm">
        ● LIVE · 42 ON FLOOR
      </FPill>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10.5,
          color: t.muted,
          marginTop: 8,
        }}
      >
        WH-01 · TACOMA
      </div>
      <ShiftClock />
    </div>
  );
}

/**
 * Top-bar search slot. Visually a search input, functionally a button
 * that opens the Cmd+K palette. Keeps the live text entry inside the
 * palette (where focus management + keyboard navigation already live)
 * instead of having two places that accept typed input.
 */
function SearchSlot() {
  const t = ft;
  const { open } = useCmdK();
  return (
    <button
      type="button"
      onClick={open}
      data-fshell-search
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 14px",
        borderRadius: 12,
        background: t.surface,
        border: `1px solid ${t.border}`,
        width: 360,
        color: t.muted,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: FONTS.sans,
      }}
    >
      <Ic.Search size={14} color={t.muted} />
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 12,
          letterSpacing: 0.2,
          flex: 1,
        }}
      >
        P-… · SO-… · SKU-… · A2-02-B
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          color: t.mutedSoft,
          padding: "2px 6px",
          borderRadius: 4,
          background: t.surface,
          border: `1px solid ${t.border}`,
        }}
      >
        ⌘ K
      </span>
    </button>
  );
}

function ShiftClock() {
  // Render `--:--` during SSR; replace with real time after hydration.
  // Keeps the markup deterministic so React doesn't warn.
  const t = ft;
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: 10.5,
        color: t.muted,
      }}
      suppressHydrationWarning
    >
      {typeof window === "undefined"
        ? "--:-- · SHIFT 2 OF 3"
        : `${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })} · SHIFT 2 OF 3`}
    </div>
  );
}
