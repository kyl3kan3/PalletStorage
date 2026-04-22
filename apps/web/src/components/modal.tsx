"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { theme, FONTS } from "~/lib/theme";

/**
 * Lightweight modal dialog. Renders through a portal on document.body
 * so stacking is independent of the caller's container. Locks body
 * scroll while open. Closes on backdrop click and Escape.
 *
 * Not a full accessibility primitive — no focus-trap — but fine for
 * short forms like "Add customer" where the user is in-and-out in
 * seconds.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: number;
}) {
  const t = theme;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(31, 26, 23, 0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8vh 16px 16px",
        overflowY: "auto",
        fontFamily: FONTS.sans,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface,
          borderRadius: 20,
          border: `1.5px solid ${t.border}`,
          boxShadow: t.shadowLift,
          width: "100%",
          maxWidth,
          padding: 20,
          color: t.body,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 20,
                fontWeight: 600,
                color: t.ink,
                letterSpacing: -0.3,
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              color: t.muted,
              cursor: "pointer",
              lineHeight: 1,
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
