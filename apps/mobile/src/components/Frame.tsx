import {
  View,
  StyleSheet,
  StatusBar,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme as t } from "../lib/theme";

/**
 * Floor-mode page frame. Black canvas, safe-area-aware, light status
 * bar content so OS clock/battery read against the dark background.
 *
 *   <Frame>
 *     <TopBar … />
 *     <ScrollView …>{contents}</ScrollView>
 *     <TabBar … />  ← bottom tab bar lives outside Frame
 *   </Frame>
 */
export function Frame({
  children,
  padded = false,
  style,
}: {
  children: React.ReactNode;
  /** Inset content by 16px on the sides. Most screens want this. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={t.bg} />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View
          style={[
            { flex: 1, paddingHorizontal: padded ? 16 : 0 },
            style,
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  safe: { flex: 1, backgroundColor: t.bg },
});
