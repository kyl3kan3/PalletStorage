"use client";

// StickyActionBar: on mobile (≤ 1023px to match the rest of the app's
// breakpoint), pin its children to the bottom of the viewport so the
// primary CTA stays in reach on long detail pages. On desktop it
// returns its children inline so the existing layout is unchanged.
//
// Sized to clear the iOS home indicator with `paddingBottom:
// max(env(safe-area-inset-bottom), 12px)` and stacked above the
// cubby-chat FAB by leaving the FAB's bottom: 20px alone — the bar
// covers the FAB only while it's open, which is acceptable.

import type { ReactNode } from "react";
import { theme as defaultTheme, type Theme } from "~/lib/theme";
import { useMatchMedia } from "~/lib/useMatchMedia";

export function StickyActionBar({
  t = defaultTheme,
  children,
}: {
  t?: Theme;
  children: ReactNode;
}) {
  const isMobile = useMatchMedia("(max-width: 1023px)");
  if (!isMobile) {
    return <>{children}</>;
  }
  return (
    <>
      {/* Render the original children inline as a spacer so the page
          layout reserves space — without this the sticky bar would
          overlap the bottom of the page content. */}
      <div style={{ visibility: "hidden", pointerEvents: "none" }}>{children}</div>
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          background: t.surface,
          borderTop: `1.5px solid ${t.border}`,
          padding: "10px 14px",
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          boxShadow: "0 -4px 16px rgba(0,0,0,.08)",
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {children}
      </div>
    </>
  );
}
