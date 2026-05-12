import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Frame } from "../../../src/components/Frame";
import { Btn } from "../../../src/components/Btn";
import { Pill } from "../../../src/components/Pill";
import { Cubby } from "../../../src/components/Cubby";
import { theme as t, FONTS } from "../../../src/lib/theme";

/**
 * Putaway suggest screen — same hero pattern as Pick (64px mono
 * location code on a marigold card), but with alternatives below and
 * a confidence chip. Bottom action is "SCAN LOCATION" + ghost
 * "OVERRIDE LOCATION".
 *
 * Mock data; later phase wires putaway.suggest({ palletId }) +
 * putaway.commit({ palletId, locationCode }).
 */

interface Suggestion {
  loc: string;
  confidence: number;
  reason: string;
}

const PRIMARY: Suggestion = {
  loc: "A3-04-C",
  confidence: 94,
  reason: "Same lot already there · empty bay",
};

const ALTS: Suggestion[] = [
  { loc: "A3-02-B", confidence: 81, reason: "Same product zone · 2 free slots" },
  { loc: "C1-04-A", confidence: 68, reason: "Bulk zone · plenty of space" },
];

export default function PutawayScreen() {
  const { lpn } = useLocalSearchParams<{ lpn: string }>();

  return (
    <Frame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={28} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topRef}>{lpn ?? "P-—"}</Text>
            <Text style={styles.topMeta}>312 kg · 3 SKUs</Text>
          </View>
          <Pill tone="lilac" size="sm">
            PUTAWAY
          </Pill>
        </View>

        {/* Primary suggestion */}
        <View style={styles.goto}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>DROP AT</Text>
            <Text style={styles.loc}>{PRIMARY.loc}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 }}>
              <View style={styles.confChip}>
                <Text style={styles.confText}>BEST {PRIMARY.confidence}</Text>
              </View>
            </View>
            <Text style={styles.reason}>{PRIMARY.reason}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </View>

        {/* Alternatives */}
        <Text style={styles.altLabel}>Alternatives</Text>
        <View style={{ gap: 8 }}>
          {ALTS.map((a) => (
            <Pressable
              key={a.loc}
              style={({ pressed }) => [
                styles.altRow,
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.altLoc}>{a.loc}</Text>
              <Text style={styles.altConf}>{a.confidence}</Text>
              <Text style={styles.altReason}>{a.reason}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.previewText}>
          FLOOR MODE PREVIEW · mock suggestions · later phase wires
          putaway.suggest + putaway.commit
        </Text>
      </ScrollView>

      <View style={styles.bottomCta}>
        <Btn variant="light" size="lg" full>
          SCAN LOCATION
        </Btn>
        <View style={{ height: 8 }} />
        <Btn variant="ghost" size="md" full>
          OVERRIDE LOCATION
        </Btn>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  topRef: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: 0.5,
  },
  topMeta: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.muted,
    marginTop: 2,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  goto: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.primary,
    borderRadius: 22,
    padding: 22,
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 8,
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(31,19,8,.65)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  loc: {
    fontFamily: FONTS.mono,
    fontSize: 56,
    fontWeight: "800",
    color: t.primaryText,
    letterSpacing: 1.5,
    lineHeight: 60,
  },
  confChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,.18)",
  },
  confText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: "800",
    color: t.primaryText,
    letterSpacing: 0.8,
  },
  reason: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: "rgba(31,19,8,.75)",
    marginTop: 8,
    fontWeight: "600",
  },
  arrow: {
    fontSize: 48,
    color: t.primaryText,
    fontWeight: "800",
    marginLeft: 8,
  },
  altLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 10,
  },
  altRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  altLoc: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: 0.5,
    width: 110,
  },
  altConf: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    fontWeight: "800",
    color: t.primary,
    width: 36,
  },
  altReason: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: t.body,
  },
  bottomCta: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
  },
  previewText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.mutedSoft,
    letterSpacing: 0.4,
    marginTop: 22,
    textAlign: "center",
  },
});
