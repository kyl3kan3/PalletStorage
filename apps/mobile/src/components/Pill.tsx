import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme as t, FONTS } from "../lib/theme";

/**
 * Mono uppercase tag — the mobile equivalent of the web FPill. Used
 * for status badges, type kickers ("LIVE", "PICK", "RECV"), and inline
 * pills in cards.
 */

export type PillTone = "primary" | "mint" | "coral" | "sky" | "neutral" | "lilac";
export type PillSize = "sm" | "md";

const MAP: Record<
  PillTone,
  { bg: string; fg: string; border: string }
> = {
  primary: { bg: t.primarySoft, fg: t.primary, border: "rgba(255,178,62,.35)" },
  mint: { bg: t.mintSoft, fg: t.mint, border: "rgba(127,216,168,.35)" },
  coral: { bg: t.coralSoft, fg: t.coral, border: "rgba(255,107,91,.4)" },
  sky: { bg: t.skySoft, fg: t.sky, border: "rgba(123,180,232,.35)" },
  neutral: { bg: t.surface, fg: t.muted, border: t.border },
  lilac: { bg: "rgba(201,184,240,.14)", fg: t.lilac, border: "rgba(201,184,240,.3)" },
};

export function Pill({
  tone = "neutral",
  size = "md",
  children,
  style,
}: {
  tone?: PillTone;
  size?: PillSize;
  children: string;
  style?: StyleProp<ViewStyle>;
}) {
  const m = MAP[tone];
  const sz = size === "sm" ? { px: 8, py: 3, fs: 10 } : { px: 12, py: 5, fs: 11 };
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: m.bg,
          borderColor: m.border,
          paddingHorizontal: sz.px,
          paddingVertical: sz.py,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: m.fg, fontSize: sz.fs }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontFamily: FONTS.mono,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
