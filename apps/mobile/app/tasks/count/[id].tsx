import { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Frame } from "../../../src/components/Frame";
import { Btn } from "../../../src/components/Btn";
import { Pill } from "../../../src/components/Pill";
import { Cubby } from "../../../src/components/Cubby";
import { Skeleton } from "../../../src/components/Skeleton";
import { EmptyState } from "../../../src/components/EmptyState";
import { theme as t, FONTS } from "../../../src/lib/theme";
import { trpc } from "../../../src/lib/trpc";

/**
 * Cycle count detail — line-by-line, one item at a time. Param [id]
 * is the cycle_count UUID.
 *
 * Wires:
 *   - cycleCount.byId → count header + lines (palletItemId, expectedQty,
 *     countedQty)
 *
 * The current count.byId procedure doesn't join product/location data
 * onto the lines, so we render the palletItemId truncated as the row
 * identifier. The operator submits an observed qty per line; the
 * submitCount mutation is wired by the SAVE button (placeholder for
 * now — see the commit followup to enable batched submit).
 */

export default function CountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [observed, setObserved] = useState("");
  const [lineIdx, setLineIdx] = useState(0);

  const detail = trpc.cycleCount.byId.useQuery(
    { id: id ?? "" },
    { enabled: !!id, refetchInterval: 30_000 },
  );

  const lines = useMemo(() => detail.data?.lines ?? [], [detail.data]);
  const total = lines.length;
  const currentLine = lines[lineIdx];

  if (detail.isLoading) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Skeleton lines={5} rowHeight={80} />
        </ScrollView>
      </Frame>
    );
  }

  if (!detail.data) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState title="Count not found" />
        </ScrollView>
      </Frame>
    );
  }

  if (!currentLine) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState
            title={total === 0 ? "No lines to count" : "Count complete"}
            hint={
              total === 0
                ? "This count was opened against an empty location."
                : `All ${total} line${total === 1 ? "" : "s"} counted. Submit for review.`
            }
          />
        </ScrollView>
      </Frame>
    );
  }

  const obsNum = observed.trim() === "" ? null : Number.parseInt(observed, 10);
  const variance = obsNum == null ? null : obsNum - currentLine.expectedQty;
  const matched = variance === 0;
  const tone: "mint" | "coral" | "primary" | "neutral" =
    variance == null
      ? "neutral"
      : matched
        ? "mint"
        : variance < 0
          ? "coral"
          : "primary";

  const advance = () => {
    setObserved("");
    if (lineIdx + 1 < total) setLineIdx(lineIdx + 1);
  };

  return (
    <Frame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={28} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topRef}>
              CC-{detail.data.count.id.slice(0, 6).toUpperCase()} · LINE{" "}
              {lineIdx + 1}/{total}
            </Text>
            <Text style={styles.topZone}>
              status: {detail.data.count.status}
            </Text>
          </View>
          <Pill tone="lilac" size="sm">
            COUNT
          </Pill>
        </View>

        {/* Location hero (truncated palletItemId stands in for the bin
            code until cycleCount.byId joins in location data) */}
        <View style={styles.goto}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gotoKicker}>PALLET ITEM</Text>
            <Text style={styles.gotoLoc}>
              {currentLine.palletItemId.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.gotoArrow}>→</Text>
        </View>

        {/* Item card */}
        <View style={styles.item}>
          <Text style={styles.itemSku}>LINE {lineIdx + 1}</Text>

          <View style={styles.expectedRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>EXPECTED</Text>
              <Text style={styles.metaQty}>
                {currentLine.expectedQty} <Text style={styles.metaUnit}>ea</Text>
              </Text>
            </View>
            {variance != null && (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.metaLabel}>VARIANCE</Text>
                <Text
                  style={[
                    styles.varianceQty,
                    {
                      color: matched
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
          <Text style={styles.observedUnit}>ea</Text>
        </View>

        {/* Submit strip */}
        <View style={{ marginTop: 18 }}>
          <Btn
            variant={tone === "neutral" ? "ghost" : "light"}
            size="lg"
            full
            disabled={obsNum == null || obsNum < 0}
            onPress={advance}
          >
            {matched ? "MATCH · SAVE & NEXT" : "SAVE COUNT · NEXT"}
          </Btn>
          <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
            <Btn variant="ghost" size="md" style={{ flex: 1 }} onPress={advance}>
              SKIP
            </Btn>
            <Btn variant="ghost" size="md" style={{ flex: 1 }}>
              FLAG
            </Btn>
          </View>
        </View>
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
    fontSize: 48,
    fontWeight: "800",
    color: t.primaryText,
    letterSpacing: 1.5,
    lineHeight: 54,
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
});
