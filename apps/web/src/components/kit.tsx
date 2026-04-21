"use client";

// Core design primitives — warm, rounded, soft shadows. Ported from the
// designer's kit.jsx. Every component takes an optional `t` theme prop;
// callers typically omit it so the default light theme kicks in.

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { theme as defaultTheme, FONTS, type Theme } from "~/lib/theme";
import { Ic, type IconProps } from "./icons";

type Icon = (props: IconProps) => ReactNode;

// ───────────────────────────── Button ─────────────────────────────────
export type BtnVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type BtnSize = "sm" | "md" | "lg";

export interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  t?: Theme;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: Icon;
  full?: boolean;
}

const BTN_SIZES: Record<BtnSize, { padding: string; fontSize: number; radius: number; iconSize: number; gap: number }> = {
  sm: { padding: "6px 12px", fontSize: 12.5, radius: 10, iconSize: 13, gap: 6 },
  md: { padding: "9px 16px", fontSize: 13.5, radius: 12, iconSize: 15, gap: 7 },
  lg: { padding: "12px 20px", fontSize: 15, radius: 14, iconSize: 17, gap: 8 },
};

export function Btn({
  t = defaultTheme,
  variant = "primary",
  size = "md",
  icon,
  children,
  full,
  style,
  ...rest
}: BtnProps) {
  const sizes = BTN_SIZES[size];
  const variants: Record<BtnVariant, { bg: string; fg: string; border: string; shadow: string }> = {
    primary: {
      bg: t.ink,
      fg: t.primary,
      border: t.ink,
      shadow: "0 2px 0 rgba(0,0,0,.2), 0 4px 12px rgba(0,0,0,.12)",
    },
    accent: {
      bg: t.primary,
      fg: t.primaryText,
      border: t.primary,
      shadow: "0 2px 0 rgba(0,0,0,.15), 0 4px 12px rgba(255,178,62,.3)",
    },
    secondary: { bg: t.surface, fg: t.ink, border: t.borderStrong, shadow: "none" },
    ghost: { bg: "transparent", fg: t.ink, border: "transparent", shadow: "none" },
    danger: { bg: t.coral, fg: "#fff", border: t.coral, shadow: "none" },
  };
  const v = variants[variant];
  const Icon = icon;
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sizes.gap,
        padding: sizes.padding,
        fontSize: sizes.fontSize,
        fontFamily: FONTS.sans,
        fontWeight: 600,
        background: v.bg,
        color: v.fg,
        border: `1.5px solid ${v.border}`,
        borderRadius: sizes.radius,
        boxShadow: v.shadow,
        width: full ? "100%" : undefined,
        justifyContent: full ? "center" : undefined,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        transition: "transform .08s, box-shadow .12s",
        letterSpacing: -0.1,
        ...(style || {}),
      }}
    >
      {Icon ? <Icon size={sizes.iconSize} /> : null}
      {children}
    </button>
  );
}

// ───────────────────────────── Card ───────────────────────────────────
export type CardTint = "primary" | "mint" | "coral" | "sky" | "alt";

export interface CardProps {
  t?: Theme;
  children: ReactNode;
  padding?: number;
  radius?: number;
  interactive?: boolean;
  tint?: CardTint;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({
  t = defaultTheme,
  children,
  padding = 18,
  radius = 20,
  interactive,
  tint,
  style,
  onClick,
}: CardProps) {
  const bg =
    tint === "primary" ? t.primarySoft :
    tint === "mint" ? t.mintSoft :
    tint === "coral" ? t.coralSoft :
    tint === "sky" ? t.skySoft :
    tint === "alt" ? t.surfaceAlt :
    t.surface;
  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        borderRadius: radius,
        padding,
        border: `1.5px solid ${t.border}`,
        boxShadow: t.shadow,
        transition: interactive ? "transform .15s, box-shadow .2s" : undefined,
        cursor: interactive ? "pointer" : undefined,
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

// ───────────────────────────── Tag ────────────────────────────────────
export type TagTone = "primary" | "mint" | "coral" | "sky" | "neutral" | "ink";

export function Tag({
  t = defaultTheme,
  tone = "neutral",
  children,
  style,
}: {
  t?: Theme;
  tone?: TagTone;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const map: Record<TagTone, { bg: string; fg: string; dot: string }> = {
    primary: { bg: t.primarySoft, fg: t.primaryDeep, dot: t.primary },
    mint: { bg: t.mintSoft, fg: t.mode === "dark" ? t.mint : "#1F6B45", dot: t.mint },
    coral: { bg: t.coralSoft, fg: t.mode === "dark" ? t.coral : "#B53D30", dot: t.coral },
    sky: { bg: t.skySoft, fg: t.mode === "dark" ? t.sky : "#2C5B8A", dot: t.sky },
    neutral: { bg: t.surfaceAlt, fg: t.muted, dot: t.mutedSoft },
    ink: { bg: t.ink, fg: t.bg, dot: t.primary },
  };
  const m = map[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        background: m.bg,
        color: m.fg,
        fontSize: 11.5,
        fontWeight: 600,
        fontFamily: FONTS.sans,
        letterSpacing: 0.1,
        ...(style || {}),
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 3, background: m.dot }} />
      {children}
    </span>
  );
}

// ───────────────────────────── SquircleIcon ───────────────────────────
export type IconTint = "primary" | "mint" | "coral" | "sky" | "lilac" | "neutral";

export function SquircleIcon({
  t = defaultTheme,
  icon,
  tint = "primary",
  size = 40,
}: {
  t?: Theme;
  icon: Icon;
  tint?: IconTint;
  size?: number;
}) {
  const bg =
    tint === "primary" ? t.primarySoft :
    tint === "mint" ? t.mintSoft :
    tint === "coral" ? t.coralSoft :
    tint === "sky" ? t.skySoft :
    tint === "lilac" ? "rgba(201,184,240,.25)" :
    t.surfaceAlt;
  const fg =
    tint === "primary" ? t.primaryDeep :
    tint === "mint" ? (t.mode === "dark" ? t.mint : "#1F6B45") :
    tint === "coral" ? (t.mode === "dark" ? t.coral : "#B53D30") :
    tint === "sky" ? (t.mode === "dark" ? t.sky : "#2C5B8A") :
    tint === "lilac" ? "#6B4FB8" :
    t.ink;
  const I = icon;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: bg,
        color: fg,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <I size={Math.round(size * 0.48)} />
    </div>
  );
}

// ───────────────────────────── StatBig ────────────────────────────────
export function StatBig({
  t = defaultTheme,
  label,
  value,
  delta,
  deltaTone = "mint",
  tint,
}: {
  t?: Theme;
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "mint" | "coral";
  tint?: CardTint;
}) {
  return (
    <Card t={t} tint={tint} padding={20}>
      <div style={{ fontSize: 12, fontWeight: 500, color: t.muted, letterSpacing: 0.2 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 38,
            fontWeight: 600,
            color: t.ink,
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        {delta && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color:
                deltaTone === "coral"
                  ? t.coral
                  : t.mode === "dark"
                    ? t.mint
                    : "#1F6B45",
            }}
          >
            {delta}
          </span>
        )}
      </div>
    </Card>
  );
}

// ───────────────────────────── Ring ───────────────────────────────────
export function Ring({
  t = defaultTheme,
  size = 64,
  value = 0.5,
  stroke = 7,
  color,
  label,
}: {
  t?: Theme;
  size?: number;
  value?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * value;
  const col = color || t.primary;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.surfaceAlt} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontFamily: FONTS.mono,
            fontSize: 13,
            fontWeight: 600,
            color: t.ink,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Tabs ───────────────────────────────────
export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({
  t = defaultTheme,
  items,
  active,
  onChange,
}: {
  t?: Theme;
  items: TabItem[];
  active: string;
  onChange?: (key: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 4,
        background: t.surfaceAlt,
        borderRadius: 12,
        border: `1.5px solid ${t.border}`,
      }}
    >
      {items.map((it) => {
        const on = active === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange && onChange(it.key)}
            style={{
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: FONTS.sans,
              color: on ? t.ink : t.muted,
              background: on ? t.surface : "transparent",
              border: "none",
              borderRadius: 9,
              cursor: "pointer",
              boxShadow: on ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {it.label}
            {it.count != null && (
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────── TextField ──────────────────────────────
export function TextField({
  t = defaultTheme,
  style,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { t?: Theme }) {
  return (
    <input
      {...rest}
      style={{
        padding: "9px 14px",
        borderRadius: 12,
        background: t.surfaceAlt,
        border: `1.5px solid ${t.border}`,
        outline: "none",
        fontFamily: FONTS.sans,
        fontSize: 13.5,
        color: t.ink,
        ...(style || {}),
      }}
    />
  );
}

// ───────────────────────────── Search ─────────────────────────────────
export function Search({
  t = defaultTheme,
  value,
  placeholder = "Search…",
  width,
  onChange,
}: {
  t?: Theme;
  value?: string;
  placeholder?: string;
  width?: number | string;
  onChange?: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 12,
        background: t.surfaceAlt,
        border: `1.5px solid ${t.border}`,
        width,
      }}
    >
      <Ic.Search size={14} color={t.muted} />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        style={{
          border: "none",
          background: "transparent",
          outline: "none",
          flex: 1,
          fontFamily: FONTS.sans,
          fontSize: 13,
          color: t.ink,
        }}
      />
    </div>
  );
}

// ───────────────────────────── PageTitle ──────────────────────────────
export function PageTitle({
  t = defaultTheme,
  eyebrow,
  title,
  subtitle,
  right,
}: {
  t?: Theme;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div style={{ flex: 1 }}>
          {eyebrow && (
            <div
              style={{
                fontSize: 11,
                color: t.muted,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 32,
              fontWeight: 600,
              color: t.ink,
              letterSpacing: -0.8,
              lineHeight: 1.05,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 14, color: t.muted, marginTop: 6, maxWidth: 560 }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>{right}</div>
      </div>
    </div>
  );
}
