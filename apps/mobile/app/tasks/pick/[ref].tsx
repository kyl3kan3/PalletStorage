import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Frame } from "../../../src/components/Frame";
import { Btn } from "../../../src/components/Btn";
import { Pill } from "../../../src/components/Pill";
import { Cubby } from "../../../src/components/Cubby";
import { theme as t, FONTS, TYPE } from "../../../src/lib/theme";

/**
 * Pick run screen — one line at a time. Massive marigold "GO TO" card
 * with the location code in 64px mono, item card below, then the
 * SCAN TO CONFIRM strip. Per the handoff this is the floor staff's
 * primary loop — read location, walk, scan to confirm, repeat.
 *
 * Mock data; later phase wires pick.next({ orderId }) +
 * pick.confirm({ orderId, lineId, qty, lot, locationCode }).
 */

export default function PickScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();

  // Mock line data — line 13 of 22 in the current order.
  const line = {
    n: 13,
    total: 22,
    sku: "SKU-00211",
    name: "Whole Tomatoes #10",
    velocity: "B",
    take: 12,
    unit: "ea",
    location: "A2-02-B",
    steps: 32,
    walkSec: 18,
    lot: "LOT-2026-Q1",
    expiry: "Apr 18",
  };

  return (
    <Frame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={28} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topRef}>
              {ref ?? "SO-—"} · LINE {line.n}/{line.total}
            </Text>
            <Text style={styles.topCustomer}>Northgate Foods</Text>
          </View>
          <Pill tone="coral" size="sm">
            1H 12M
          </Pill>
        </View>

        {/* Hero GO TO card */}
        <View style={styles.goto}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gotoKicker}>GO TO</Text>
            <Text style={styles.gotoLoc}>{line.location}</Text>
            <Text style={styles.gotoWalk}>
              📍 {line.steps} steps · ~{line.walkSec}s
            </Text>
          </View>
          <Text style={styles.gotoArrow}>→</Text>
        </View>

        {/* Item card */}
        <View style={styles.item}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemSku}>{line.sku}</Text>
            <Pill tone="primary" size="sm">
              {line.velocity}
            </Pill>
          </View>
          <Text style={styles.itemName}>{line.name}</Text>

          <View style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemMetaLabel}>TAKE</Text>
              <Text style={styles.qty}>
                {line.take} <Text style={styles.qtyUnit}>{line.unit}</Text>
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemMetaLabel}>LOT</Text>
              <Text style={styles.lot}>{line.lot}</Text>
              <Text style={styles.itemMetaLabel}>EXPIRY</Text>
              <Text style={styles.lot}>{line.expiry}</Text>
            </View>
          </View>
        </View>

        {/* Confirm strip */}
        <View style={{ marginTop: 18 }}>
          <Btn variant="light" size="lg" full>
            SCAN TO CONFIRM
          </Btn>
          <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
            <Btn variant="ghost" size="md" style={{ flex: 1 }}>
              SKIP
            </Btn>
            <Btn variant="ghost" size="md" style={{ flex: 1 }}>
              SHORT
            </Btn>
            <Btn variant="ghost" size="md" style={{ flex: 1 }}>
              SUB
            </Btn>
          </View>
        </View>

        <Text style={styles.previewText}>
          FLOOR MODE PREVIEW · mock data · later phase wires pick.next +
          pick.confirm
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
    color: t.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  topCustomer: {
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
  gotoWalk: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: "rgba(31,19,8,.7)",
    marginTop: 8,
    fontWeight: "700",
    letterSpacing: 0.3,
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
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemSku: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: 0.3,
  },
  itemName: {
    fontFamily: FONTS.sans,
    fontSize: 17,
    fontWeight: "700",
    color: t.ink,
    marginTop: 6,
    letterSpacing: -0.2,
  },
  itemRow: {
    flexDirection: "row",
    marginTop: 18,
    gap: 16,
  },
  itemMetaLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 10,
  },
  qty: {
    fontFamily: FONTS.mono,
    fontSize: 56,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -1,
    lineHeight: 60,
    marginTop: 4,
  },
  qtyUnit: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: t.muted,
    fontWeight: "700",
  },
  lot: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: t.body,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.2,
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
