"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { FPill } from "./kit";
import { Ic, type IconProps } from "./icons";

/**
 * Cmd+K command palette for floor mode.
 *
 * Listens for ⌘K / Ctrl+K globally and opens a top-centered overlay
 * with a mono search input. The input is *navigation-first*: detect
 * the prefix of what the user typed and offer a direct route as the
 * top action. Enter commits.
 *
 * Prefix routing (per the handoff README, mapped to actual app routes):
 *   - P-…            → /inventory/stock?lpn=…   (pallet detail)
 *   - SO-…           → /outbound?q=…             (outbound list filtered)
 *   - PO-…           → /inbound?q=…              (inbound list filtered)
 *   - SKU-…          → /products?q=…             (product list filtered)
 *   - A1-01-A regex  → /inventory/stock?loc=…    (location)
 *   - Anything else  → fuzzy search across all of the above
 *
 * Plumbing: wraps children in <CmdKProvider>. Any descendant can call
 * `useCmdK().open()` to fire the palette (e.g. clicking the FShell
 * search slot). Mount the provider once at the layout level.
 */

// ─── Context ──────────────────────────────────────────────

interface CmdKContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const CmdKContext = createContext<CmdKContextValue | null>(null);

export function useCmdK(): CmdKContextValue {
  const ctx = useContext(CmdKContext);
  if (!ctx) {
    throw new Error("useCmdK must be used inside <CmdKProvider>");
  }
  return ctx;
}

export function CmdKProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Bind ⌘K / Ctrl+K globally. Toggle whether or not the palette is
  // already open so the same key closes it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <CmdKContext.Provider value={value}>
      {children}
      <CmdKPalette />
    </CmdKContext.Provider>
  );
}

// ─── Palette ──────────────────────────────────────────────

type Icon = (props: IconProps) => ReactNode;

interface PaletteAction {
  key: string;
  icon: Icon;
  primary: string;
  secondary: string;
  /** Pretty pill tone for the inline kind hint. */
  tone: "primary" | "mint" | "coral" | "sky" | "neutral" | "lilac";
  kind: string;
  href: Route;
}

/**
 * Static "go to" entries — shown when the input is empty, also act as
 * keyword-matched fallbacks for free-text queries. Match the FShell
 * sidebar order so the affordance feels consistent.
 */
const GO_TO: PaletteAction[] = [
  { key: "home", icon: Ic.Home, primary: "Home", secondary: "Live operations dashboard", tone: "primary", kind: "PAGE", href: "/floor" as Route },
  { key: "ops", icon: Ic.Chart, primary: "Operations", secondary: "KPIs, throughput, ledger", tone: "primary", kind: "PAGE", href: "/floor/operations" as Route },
  { key: "inv", icon: Ic.Scan, primary: "Inventory", secondary: "Scan or paste a code", tone: "primary", kind: "PAGE", href: "/floor/inventory" as Route },
  { key: "in", icon: Ic.Inbound, primary: "Inbound", secondary: "Receiving orders", tone: "sky", kind: "PAGE", href: "/inbound" as Route },
  { key: "out", icon: Ic.Outbound, primary: "Outbound", secondary: "Shipping orders", tone: "mint", kind: "PAGE", href: "/outbound" as Route },
  { key: "prod", icon: Ic.Boxes, primary: "Products", secondary: "Item catalog", tone: "neutral", kind: "PAGE", href: "/products" as Route },
  { key: "wh", icon: Ic.Warehouse, primary: "Warehouses", secondary: "Sites + capacity", tone: "neutral", kind: "PAGE", href: "/warehouses" as Route },
  { key: "cc", icon: Ic.Clipboard, primary: "Cycle counts", secondary: "Audit + accuracy", tone: "lilac", kind: "PAGE", href: "/inventory/counts" as Route },
];

const LOC_REGEX = /^[A-Z][0-9]+-[0-9]+-[A-Z]$/i;

/**
 * Resolve a query string into a single primary action plus a list of
 * keyword matches against GO_TO. The primary action is what Enter
 * commits to; the matches are shown below as a "go to" suggestion list.
 */
function resolveQuery(rawInput: string): {
  primary: PaletteAction | null;
  matches: PaletteAction[];
} {
  const q = rawInput.trim();
  if (!q) {
    return { primary: null, matches: GO_TO };
  }
  const upper = q.toUpperCase();

  let primary: PaletteAction | null = null;
  if (/^P-/.test(upper)) {
    primary = {
      key: "lpn",
      icon: Ic.Scan,
      primary: `Open pallet ${upper}`,
      secondary: "Pallet detail in Inventory · Stock",
      tone: "primary",
      kind: "PALLET",
      href: `/inventory/stock?lpn=${encodeURIComponent(upper)}` as Route,
    };
  } else if (/^SO-/.test(upper)) {
    primary = {
      key: "so",
      icon: Ic.Outbound,
      primary: `Open outbound ${upper}`,
      secondary: "Filter outbound list to this ref",
      tone: "mint",
      kind: "OUTBOUND",
      href: `/outbound?q=${encodeURIComponent(upper)}` as Route,
    };
  } else if (/^PO-/.test(upper)) {
    primary = {
      key: "po",
      icon: Ic.Inbound,
      primary: `Open inbound ${upper}`,
      secondary: "Filter inbound list to this ref",
      tone: "sky",
      kind: "INBOUND",
      href: `/inbound?q=${encodeURIComponent(upper)}` as Route,
    };
  } else if (/^SKU-/.test(upper)) {
    primary = {
      key: "sku",
      icon: Ic.Boxes,
      primary: `Open product ${upper}`,
      secondary: "Filter product list to this SKU",
      tone: "neutral",
      kind: "PRODUCT",
      href: `/products?q=${encodeURIComponent(upper)}` as Route,
    };
  } else if (LOC_REGEX.test(upper)) {
    primary = {
      key: "loc",
      icon: Ic.Warehouse,
      primary: `Open location ${upper}`,
      secondary: "Filter stock to this location code",
      tone: "lilac",
      kind: "LOCATION",
      href: `/inventory/stock?loc=${encodeURIComponent(upper)}` as Route,
    };
  }

  const matches = GO_TO.filter(
    (g) =>
      g.primary.toLowerCase().includes(q.toLowerCase()) ||
      g.kind.toLowerCase().includes(q.toLowerCase()),
  );

  return { primary, matches };
}

function CmdKPalette() {
  const { isOpen, close } = useCmdK();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [highlight, setHighlight] = useState(0);

  // Reset state every time the palette opens — gives the user a fresh
  // canvas, no stale query from a prior session.
  useEffect(() => {
    if (isOpen) {
      setInput("");
      setHighlight(0);
    }
  }, [isOpen]);

  const { primary, matches } = useMemo(() => resolveQuery(input), [input]);

  // The full action list in keyboard-nav order: primary first (if
  // any), then matches. Highlight indexes into this combined list.
  const flat = useMemo<PaletteAction[]>(() => {
    return primary ? [primary, ...matches] : matches;
  }, [primary, matches]);

  // Lock body scroll while open + global key handlers (Esc / arrows /
  // Enter). ⌘K toggle is handled by the provider, so it works whether
  // the palette has focus or not.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(flat.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const action = flat[highlight];
        if (action) {
          router.push(action.href);
          close();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close, flat, highlight, router]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "12vh 16px 16px",
        overflowY: "auto",
        fontFamily: FONTS.sans,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: t.bgAlt,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: 18,
          boxShadow: t.shadowLift,
          overflow: "hidden",
        }}
      >
        {/* Search row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 18px",
            borderBottom: `1px solid ${t.border}`,
            background: t.surface,
          }}
        >
          <Ic.Search size={18} color={t.muted} />
          <input
            autoFocus
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setHighlight(0);
            }}
            placeholder="P-… · SO-… · SKU-… · A2-02-B"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: FONTS.mono,
              fontSize: 16,
              fontWeight: 600,
              color: t.ink,
              letterSpacing: 0.5,
            }}
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close palette"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: t.surfaceAlt,
              border: `1px solid ${t.border}`,
              color: t.muted,
              fontSize: 14,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Primary action (when a prefix matches) */}
        {primary && (
          <div
            style={{
              padding: "10px 12px 4px",
              fontFamily: FONTS.mono,
              fontSize: 10,
              fontWeight: 700,
              color: t.mutedSoft,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            Best match
          </div>
        )}
        {primary && (
          <Row
            action={primary}
            active={highlight === 0}
            onHover={() => setHighlight(0)}
            onClick={() => {
              router.push(primary.href);
              close();
            }}
          />
        )}

        {/* Go to list */}
        {matches.length > 0 && (
          <>
            <div
              style={{
                padding: "10px 12px 4px",
                fontFamily: FONTS.mono,
                fontSize: 10,
                fontWeight: 700,
                color: t.mutedSoft,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                marginTop: primary ? 4 : 0,
              }}
            >
              {input.trim() ? "Pages" : "Go to"}
            </div>
            {matches.map((m, i) => {
              const idx = primary ? i + 1 : i;
              return (
                <Row
                  key={m.key}
                  action={m}
                  active={highlight === idx}
                  onHover={() => setHighlight(idx)}
                  onClick={() => {
                    router.push(m.href);
                    close();
                  }}
                />
              );
            })}
          </>
        )}

        {/* Empty state when query has no matches and no prefix */}
        {!primary && matches.length === 0 && (
          <div
            style={{
              padding: "20px 18px",
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: t.muted,
              letterSpacing: 0.3,
              lineHeight: 1.6,
            }}
          >
            No match. Try a prefix:{" "}
            <strong style={{ color: t.body }}>P-</strong>{" "}
            <strong style={{ color: t.body }}>SO-</strong>{" "}
            <strong style={{ color: t.body }}>PO-</strong>{" "}
            <strong style={{ color: t.body }}>SKU-</strong>{" "}
            <strong style={{ color: t.body }}>A2-02-B</strong>
          </div>
        )}

        {/* Footer hints */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 16px",
            borderTop: `1px solid ${t.border}`,
            background: t.surface,
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: t.mutedSoft,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          <Hint k="↵">Open</Hint>
          <Hint k="↑↓">Navigate</Hint>
          <Hint k="esc">Close</Hint>
          <span style={{ flex: 1 }} />
          <Hint k="⌘ K">Toggle</Hint>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({
  action,
  active,
  onHover,
  onClick,
}: {
  action: PaletteAction;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const I = action.icon;
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onClick}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "36px 1fr 72px 16px",
        gap: 12,
        padding: "10px 14px",
        alignItems: "center",
        background: active ? t.surfaceLift : "transparent",
        border: "none",
        borderLeft: active ? `2px solid ${t.primary}` : `2px solid transparent`,
        cursor: "pointer",
        textAlign: "left",
        color: t.body,
        fontFamily: FONTS.sans,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background:
            action.tone === "primary" ? t.primarySoft :
            action.tone === "mint" ? t.mintSoft :
            action.tone === "coral" ? t.coralSoft :
            action.tone === "sky" ? t.skySoft :
            action.tone === "lilac" ? "rgba(201,184,240,.14)" :
            t.surfaceAlt,
          color:
            action.tone === "primary" ? t.primary :
            action.tone === "mint" ? t.mint :
            action.tone === "coral" ? t.coral :
            action.tone === "sky" ? t.sky :
            action.tone === "lilac" ? t.lilac :
            t.muted,
          display: "grid",
          placeItems: "center",
        }}
      >
        <I size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {action.primary}
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.muted,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {action.secondary}
        </div>
      </div>
      <div style={{ justifySelf: "end" }}>
        <FPill t={t} tone={action.tone} size="sm">
          {action.kind}
        </FPill>
      </div>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 14,
          color: active ? t.primary : t.mutedSoft,
        }}
      >
        ↵
      </span>
    </button>
  );
}

function Hint({ k, children }: { k: string; children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 9.5,
          fontWeight: 700,
          color: t.muted,
          padding: "2px 6px",
          borderRadius: 4,
          background: t.surfaceAlt,
          border: `1px solid ${t.border}`,
        }}
      >
        {k}
      </span>
      {children}
    </span>
  );
}
