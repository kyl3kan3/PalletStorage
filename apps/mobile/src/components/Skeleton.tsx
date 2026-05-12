import { Animated, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useEffect, useRef } from "react";
import { theme as t } from "../lib/theme";

/**
 * Mobile skeleton row. Renders `lines` filled rectangles (default 3)
 * with a slow opacity pulse so the operator sees "loading, not
 * broken" while a query fetches. No external animation lib — uses
 * Animated.loop on opacity.
 *
 * Pair with TanStack Query's `isLoading` boolean:
 *   {data ? <List rows={data} /> : <Skeleton />}
 */
export function Skeleton({
  lines = 3,
  rowHeight = 64,
  gap = 10,
  style,
}: {
  lines?: number;
  rowHeight?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.row,
            { height: rowHeight, opacity },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    backgroundColor: t.surfaceAlt,
    borderWidth: 1,
    borderColor: t.border,
  },
});
