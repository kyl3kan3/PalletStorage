import { View, Text, StyleSheet } from "react-native";
import { Cubby } from "./Cubby";
import { theme as t, FONTS } from "../lib/theme";

/**
 * Mobile empty-state block. Cubby asleep + friendly mono headline +
 * optional hint copy + optional CTA (a Btn the parent passes in).
 * Use inside a Card or Frame body when a list has no rows.
 *
 *   <EmptyState title="Queue clear." hint="Tap Scan to start a task." />
 */
export function EmptyState({
  title = "Nothing here yet. Quiet shift.",
  hint,
  cta,
}: {
  title?: string;
  hint?: string;
  cta?: React.ReactNode;
}) {
  return (
    <View style={styles.root}>
      <Cubby size={64} />
      <Text style={styles.title}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {cta && <View style={{ marginTop: 8 }}>{cta}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 14,
    padding: 32,
  },
  title: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  hint: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: t.mutedSoft,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
});
