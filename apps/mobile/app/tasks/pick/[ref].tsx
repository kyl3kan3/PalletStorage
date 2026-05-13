import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Frame } from "../../../src/components/Frame";
import { Btn } from "../../../src/components/Btn";
import { Pill } from "../../../src/components/Pill";
import { Cubby } from "../../../src/components/Cubby";
import { Skeleton } from "../../../src/components/Skeleton";
import { EmptyState } from "../../../src/components/EmptyState";
import { theme as t, FONTS } from "../../../src/lib/theme";
import { trpc } from "../../../src/lib/trpc";

/**
 * Pick run screen — one line at a time. Param [ref] is the outbound
 * order UUID (passed from the Today/Tasks queue).
 *
 * Wires:
 *   - outbound.byId → order header (reference, customer, shipBy)
 *   - outbound.picksForOrder → pick rows w/ location, qty, pallet
 *   - product.search → bulk SKU/name map for line.productId
 *
 * Renders the first incomplete pick as the GO-TO card. SCAN TO CONFIRM
 * calls outbound.completePick.
 */

export default function PickScreen() {
  const { ref: id } = useLocalSearchParams<{ ref: string }>();

  const order = trpc.outbound.byId.useQuery(
    { id: id ?? "" },
    { enabled: !!id, refetchInterval: 30_000 },
  );
  const picks = trpc.outbound.picksForOrder.useQuery(
    { outboundOrderId: id ?? "" },
    { enabled: !!id, refetchInterval: 30_000 },
  );
  const products = trpc.product.search.useQuery({ q: "", limit: 500 });

  const productMap = useMemo(() => {
    const m = new Map<string, { sku: string | null; name: string }>();
    for (const p of products.data ?? []) m.set(p.id, { sku: p.sku, name: p.name });
    return m;
  }, [products.data]);

  const allPicks = picks.data ?? [];
  const completedPicks = allPicks.filter((p) => p.completedAt != null);
  const nextPick = allPicks.find((p) => p.completedAt == null);

  if (order.isLoading || picks.isLoading) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Skeleton lines={5} rowHeight={80} />
        </ScrollView>
      </Frame>
    );
  }

  if (!order.data) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState title="Order not found" />
        </ScrollView>
      </Frame>
    );
  }

  const { order: ord } = order.data;
  const product = nextPick ? productMap.get(nextPick.productId) : null;
  const shipMinsLeft = ord.shipBy
    ? Math.round((new Date(ord.shipBy).getTime() - Date.now()) / 60_000)
    : null;

  return (
    <Frame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={28} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topRef}>
              {ord.reference} · LINE {completedPicks.length + 1}/{allPicks.length || "—"}
            </Text>
            <Text style={styles.topCustomer}>{ord.customer ?? "—"}</Text>
          </View>
          {shipMinsLeft != null && shipMinsLeft >= 0 && (
            <Pill tone={shipMinsLeft < 240 ? "coral" : "neutral"} size="sm">
              {formatMinsLeft(shipMinsLeft)}
            </Pill>
          )}
        </View>

        {!nextPick ? (
          <EmptyState
            title={allPicks.length === 0 ? "No picks generated yet" : "All picks complete"}
            hint={
              allPicks.length === 0
                ? "Go back to the manager screen and generate picks for this order."
                : `${completedPicks.length} picks complete. Ready to pack.`
            }
          />
        ) : (
          <>
            {/* Hero GO TO card */}
            <View style={styles.goto}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gotoKicker}>GO TO</Text>
                <Text style={styles.gotoLoc}>{nextPick.fromLocationCode ?? "?"}</Text>
                <Text style={styles.gotoWalk}>
                  📍 LPN {nextPick.palletLpn ?? "—"}
                </Text>
              </View>
              <Text style={styles.gotoArrow}>→</Text>
            </View>

            {/* Item card */}
            <View style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemSku}>{product?.sku ?? "—"}</Text>
              </View>
              <Text style={styles.itemName}>
                {product?.name ?? `Product ${nextPick.productId.slice(0, 8)}`}
              </Text>

              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemMetaLabel}>TAKE</Text>
                  <Text style={styles.qty}>
                    {nextPick.qty} <Text style={styles.qtyUnit}>ea</Text>
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemMetaLabel}>SEQUENCE</Text>
                  <Text style={styles.lot}>{nextPick.sequence}</Text>
                  <Text style={styles.itemMetaLabel}>REMAINING</Text>
                  <Text style={styles.lot}>{allPicks.length - completedPicks.length}</Text>
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
          </>
        )}
      </ScrollView>
    </Frame>
  );
}

function formatMinsLeft(mins: number): string {
  if (mins < 60) return `${mins}M`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}H ${m.toString().padStart(2, "0")}M`;
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
});
