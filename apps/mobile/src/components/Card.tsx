import {
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme as t } from "../lib/theme";

/**
 * Floor-mode card. Subtle white-over-black surface with thin border.
 * `accent` adds a 2px marigold top border (used for hot/urgent cards).
 * `padding` defaults to 18 (matches the web FCard).
 */
export function Card({
  children,
  padding = 18,
  accent,
  style,
}: {
  children: React.ReactNode;
  padding?: number;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.base,
        {
          padding,
          ...(accent ? { borderTopColor: t.primary, borderTopWidth: 2 } : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 2,
  },
});
