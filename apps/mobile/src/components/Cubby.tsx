import { View, StyleSheet } from "react-native";
import { theme as t } from "../lib/theme";

/**
 * Stacked-pallet mascot — non-SVG mobile approximation.
 *
 * The web version uses inline SVG (apps/web/src/lib/theme.tsx::Cubby).
 * The mobile app doesn't have react-native-svg yet, so this is a
 * three-rectangle stack tinted with the marigold brand. Faceless
 * because eyes/mouth require strokes that need SVG. When
 * react-native-svg is added, swap this for a faithful port.
 *
 * Sizes used across the app match the web spec:
 *   - 28 → top bar / status header
 *   - 36–48 → callout cards (variance, ETA)
 *   - 52–60 → site cards / hero
 */
export function Cubby({ size = 56 }: { size?: number; mood?: never }) {
  // mood prop is accepted for API parity with the web Cubby but ignored
  // in this stub — without SVG strokes we can't draw eyes / mouth.
  const w = size;
  const h = size;
  const unit = w / 64; // SVG viewBox was 0 0 64 64
  return (
    <View style={[styles.root, { width: w, height: h }]}>
      {/* shadow */}
      <View
        style={{
          position: "absolute",
          left: 12 * unit,
          width: 40 * unit,
          bottom: 0,
          height: 4 * unit,
          borderRadius: 2 * unit,
          backgroundColor: "rgba(0,0,0,.25)",
        }}
      />
      {/* bottom crate */}
      <View
        style={{
          position: "absolute",
          left: 6 * unit,
          top: 40 * unit,
          width: 52 * unit,
          height: 16 * unit,
          borderRadius: 5 * unit,
          backgroundColor: t.primaryDeep,
        }}
      />
      {/* middle crate */}
      <View
        style={{
          position: "absolute",
          left: 10 * unit,
          top: 24 * unit,
          width: 44 * unit,
          height: 16 * unit,
          borderRadius: 5 * unit,
          backgroundColor: t.primary,
        }}
      />
      {/* top crate (face) */}
      <View
        style={{
          position: "absolute",
          left: 14 * unit,
          top: 8 * unit,
          width: 36 * unit,
          height: 18 * unit,
          borderRadius: 5 * unit,
          backgroundColor: t.ink,
        }}
      />
      {/* eyes */}
      <View
        style={{
          position: "absolute",
          left: 22 * unit,
          top: 15 * unit,
          width: 4 * unit,
          height: 4 * unit,
          borderRadius: 2 * unit,
          backgroundColor: t.primary,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 38 * unit,
          top: 15 * unit,
          width: 4 * unit,
          height: 4 * unit,
          borderRadius: 2 * unit,
          backgroundColor: t.primary,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative" },
});
