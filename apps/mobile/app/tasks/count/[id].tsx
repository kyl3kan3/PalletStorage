import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Frame } from "../../../src/components/Frame";
import { Btn } from "../../../src/components/Btn";
import { Pill } from "../../../src/components/Pill";
import { Cubby } from "../../../src/components/Cubby";
import { theme as t, FONTS } from "../../../src/lib/theme";

/**
 * Cycle count detail — line-by-line, one item at a time. Mirrors the
 * Pick screen pattern per the handoff README's "Open questions / known
 * gaps" note: "Mobile Cycle Count detail — designed at the queue
 * level only. Recommend recycling the Pick screen pattern."
 *
 * Header: count id + zone + variance pill. Hero card with the expected
 * qty and a big number input for the operator's count. Save button
 * commits the entry and the next line autoadvances.
 *
 * Mock data; later phase wires cycleCount.line({ countId }) +
 * cycleCount.recordCount({ countId, lineId, observedQty }).
 */

interface Line {
  n: number;
  total: number;
  sku: string;
  name: string;
  location: string;
  expected: number;
  unit: string;
}

const LINE: Line = {
  n: 14,
  total: 86,
  sku: "SKU-00211",
  name: "Whole Tomatoes #10",
  location: "A3-04-B",
  expected: 24,
  unit: "cs",
};

export default function CountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [observed, setObserved] = useState("");

  const obsNum = observed.trim() === "" ? null : Number.parseInt(observed, 10);
  const variance = obsNum == null ? null : obsNum - LINE.expected;
  const matched = variance === 0;
  const tone: "mint" | "coral" | "primary" | "neutral" =
    variance == null
      ? "neutral"
      : matched
        ? "mint"
        : variance < 0
          ? "coral"
          : "primary";

  return (
    <Frame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={28} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topRef}>
              {id ?? "CC-—"} · LINE {LINE.n}/{LINE.total}
            </Text>
            <Text style={styles.topZone}>A3 zone · dry</Text>
          </View>
          <Pill tone="lilac" size="sm">
            COUNT
          </Pill>
        </View>

        {/* Location hero (matches Pick's GO TO card) */}
        <View style={styles.goto}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gotoKicker}>BIN</Text>
            <Text style={styles.gotoLoc}>{LINE.location}</Text>
          </View>
          <Text style={styles.gotoArrow}>→</Text>
        </View>

        {/* Item card */}
        <View style={styles.item}>
          <Text style={styles.itemSku}>{LINE.sku}</Text>
          <Text style={styles.itemName}>{LINE.name}</Text>

          <View style={styles.expectedRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>EXPECTED</Text>
              <Text style={styles.metaQty}>
                {LINE.expected} <Text style={styles.metaUnit}>{LINE.unit}</Text>
              </Text>
            </View>
            {variance != null && (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.metaLabel}>VARIANCE</Text>
                <Text
                  style={[
                    styles.varianceQty,
                    {
                      color:
                        matched
                          ? t.mint
                          : variance < 0
                            ? t.coral
                            : t.primary,
                    },
                  ]}
                >
                  {variance > 0 ? "+" : ""}
                  {variance}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Observed input */}
        <View style={styles.observedCard}>
          <Text style={styles.observedLabel}>You count</Text>
          <TextInput
            value={observed}
            onChangeText={setObserved}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={t.mutedSoft}
            style={styles.observedInput}
            autoFocus
          />
          <Text style={styles.observedUnit}>{LINE.unit}</Text>
        </View>

        {/* Submit strip */}
        <View style={{ marginTop: 18 }}>
          <Btn
            variant={tone === "neutral" ? "ghost" : "light"}
            size="lg"
            full
            disabled={obsNum == null || obsNum < 0}
            onPress={() => setObserved("")}
          >
            {matched ? "MATCH · SAVE & NEXT" : "SAVE COUNT · NEXT"}
          </Btn>
          <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
            <Btn variant="ghost" size="md" style={{ flex: 1 }}>
              SKIP
            </Btn>
            <Btn variant="ghost" size="md" style={{ flex: 1 }}>
              FLAG
            </Btn>
          </View>
        </View>

        <Text style={styles.previewText}>
          FLOOR MODE PREVIEW · mock line · later phase wires
          cycleCount.line + cycleCount.recordCount
        </Text>
      </ScrollView>
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
    fontSize: 11,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  topZone: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: t.body,
    marginTop: 2,
    fontWeight: "600",
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
  gotoKicker: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(31,19,8,.65)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  gotoLoc: {
    fontFamily: FONTS.mono,
    fontSize: 56,
    fontWeight: "800",
    color: t.primaryText,
    letterSpacing: 1.5,
    lineHeight: 60,
  },
  gotoArrow: {
    fontSize: 56,
    color: t.primaryText,
    fontWeight: "800",
    marginLeft: 8,
  },
  item: {
    marginTop: 14,
    backgroundColor: t.bgAlt,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: t.border,
  },
  itemSku: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 0.3,
  },
  itemName: {
    fontFamily: FONTS.sans,
    fontSize: 17,
    fontWeight: "700",
    color: t.ink,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  expectedRow: {
    flexDirection: "row",
    marginTop: 18,
    alignItems: "flex-start",
    gap: 14,
  },
  metaLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metaQty: {
    fontFamily: FONTS.mono,
    fontSize: 40,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -1,
    marginTop: 4,
  },
  metaUnit: {
    fontSize: 16,
    color: t.muted,
    fontWeight: "700",
  },
  varianceQty: {
    fontFamily: FONTS.mono,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 4,
  },
  observedCard: {
    marginTop: 14,
    backgroundColor: t.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: t.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "baseline",
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 4,
  },
  observedLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    width: 100,
  },
  observedInput: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 48,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -1,
    textAlign: "right",
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  observedUnit: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    fontWeight: "700",
    color: t.muted,
    marginLeft: 8,
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
