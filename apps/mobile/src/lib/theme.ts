// Stacks brand tokens — mobile (React Native / Expo).
//
// Source of truth: Stacks/design_handoff_stacks_floor_mode/brand.jsx
// (themeFor('dark') branch). Floor staff use the app in low-light dock
// environments, so dark is the default — there is no light variant on
// mobile right now. Mirror of apps/web/src/lib/theme.tsx token names so
// shared docs / cross-platform components can use the same identifiers.

export const palette = {
  marigold: "#FFB23E",
  marigoldDeep: "#E88F10",
  coral: "#FF6B5B",
  mint: "#7FD8A8",
  sky: "#7BB4E8",
  lilac: "#C9B8F0",
  ink: "#1F1A17",
  charcoal: "#2E2824",
  slate: "#5A4F46",
  fog: "#8B7F73",
  pebble: "#C9BFB3",
  cream: "#FAF6EE",
  paper: "#F5EFE2",
  snow: "#FFFDF8",
} as const;

// Font family strings used in StyleSheet `fontFamily`. The fonts must
// be loaded separately via `expo-font` (e.g. in app/_layout.tsx) before
// they actually render — until then RN falls back to system fonts,
// which is acceptable for v1.
export const FONTS = {
  display: "Fraunces",
  sans: "Geist",
  mono: "JetBrainsMono",
} as const;

export interface Theme {
  mode: "dark";
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceAlt: string;
  surfaceLift: string;
  border: string;
  borderStrong: string;
  ink: string;
  body: string;
  muted: string;
  mutedSoft: string;
  primary: string;
  primaryText: string;
  primaryDeep: string;
  primarySoft: string;
  /** Marigold glow used for primary-CTA shadow (iOS only on mobile). */
  primaryGlow: string;
  coral: string;
  coralSoft: string;
  mint: string;
  mintSoft: string;
  sky: string;
  skySoft: string;
  lilac: string;
}

// The mobile theme. Per the handoff README the mobile canvas is
// `#0F0C0A` (slightly warmer than the web floor canvas `#0B0907`) —
// keeping that distinction so the two surfaces feel adjacent rather
// than identical.
export const theme: Theme = {
  mode: "dark",
  bg: "#0F0C0A",
  bgAlt: "#1A1613",
  surface: "rgba(255,255,255,.04)",
  surfaceAlt: "rgba(255,255,255,.07)",
  surfaceLift: "rgba(255,255,255,.06)",
  border: "rgba(255,255,255,.08)",
  borderStrong: "rgba(255,255,255,.16)",
  ink: "#FBF5E9",
  body: "#E8DFCF",
  muted: "rgba(255,255,255,.55)",
  mutedSoft: "rgba(255,255,255,.32)",
  primary: palette.marigold,
  primaryText: "#1F1308",
  primaryDeep: palette.marigoldDeep,
  primarySoft: "rgba(255,178,62,.12)",
  primaryGlow: "rgba(255,178,62,.35)",
  coral: palette.coral,
  coralSoft: "rgba(255,107,91,.14)",
  mint: palette.mint,
  mintSoft: "rgba(127,216,168,.14)",
  sky: palette.sky,
  skySoft: "rgba(123,180,232,.14)",
  lilac: palette.lilac,
};

// Type scale — same px values as the web tokens. RN takes plain numbers
// for fontSize, so callers can do `fontSize: TYPE.kpi`.
export const TYPE = {
  hero: 44,
  pageTitle: 36,
  lpnHero: 30,
  cardTitle: 24,
  siteName: 22,
  inlineTitle: 18,
  btnLg: 17,
  section: 16,
  body: 14,
  small: 13,
  meta: 12,
  pill: 11,
  dense: 10,
  // Mono numeric scale
  locHero: 64,
  locHeroAlt: 56,
  kpi: 40,
  lpn: 30,
  ringCenter: 22,
  siteStat: 18,
  tableNum: 14,
} as const;

// Spacing scale (px). Per the handoff: 2 4 6 8 10 12 14 16 18 20 22 24 28.
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
} as const;

// Border radii (px). Floor mode uses larger radii (12-22) than the
// legacy warm-cream direction.
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  hero: 18,
  scan: 22,
} as const;
