import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { theme as t, FONTS } from "../lib/theme";

/**
 * Floor-mode button. Same variant set as the web FBtn: primary
 * (marigold), ghost (transparent + ink border), light (white inverted
 * for "SCAN TO CONFIRM" moments), danger (coral-soft).
 *
 * RN doesn't render CSS box-shadow, so the marigold glow degrades to a
 * subtle iOS shadow + flat marigold on Android. Big tap targets (44px+)
 * because the operator is wearing gloves.
 */

export type BtnVariant = "primary" | "ghost" | "light" | "danger";
export type BtnSize = "md" | "lg";

const SIZES: Record<BtnSize, { padH: number; padV: number; fs: number }> = {
  md: { padH: 18, padV: 12, fs: 14 },
  lg: { padH: 22, padV: 18, fs: 17 },
};

const VARIANTS: Record<
  BtnVariant,
  { bg: string; fg: string; border: string; shadow: boolean }
> = {
  primary: { bg: t.primary, fg: t.primaryText, border: t.primary, shadow: true },
  ghost: { bg: "transparent", fg: t.ink, border: t.borderStrong, shadow: false },
  light: { bg: "#fff", fg: "#0F0C0A", border: "#fff", shadow: false },
  danger: { bg: t.coralSoft, fg: t.coral, border: "rgba(255,107,91,.35)", shadow: false },
};

export function Btn({
  variant = "primary",
  size = "md",
  children,
  full,
  style,
  textStyle,
  ...rest
}: PressableProps & {
  variant?: BtnVariant;
  size?: BtnSize;
  children: React.ReactNode;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const v = VARIANTS[variant];
  const sz = SIZES[size];
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingHorizontal: sz.padH,
          paddingVertical: sz.padV,
          width: full ? "100%" : undefined,
          transform: pressed ? [{ scale: 0.98 }] : undefined,
          ...(v.shadow
            ? {
                shadowColor: t.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 14,
                elevation: 6,
              }
            : {}),
        },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text
          style={[
            styles.label,
            { color: v.fg, fontSize: sz.fs },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        <View style={styles.row}>{children}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: FONTS.sans,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
