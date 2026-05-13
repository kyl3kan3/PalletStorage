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
 * Putaway suggest screen.
 *
 * Wires:
 *   - pallet.byLpn → pallet header + contents (lpn, weight, items)
 *   - pallet.putawayQueue → suggested rack for this LPN (server picks
 *     the first available rack in the same warehouse; smarter directed
 *     putaway is a later layer)
 *
 * Primary card shows the suggested rack. SCAN LOCATION calls
 * pallet.move with reason='putaway'.
 */

export default function PutawayScreen() {
  const { lpn } = useLocalSearchParams<{ lpn: string }>();

  const pallet = trpc.pallet.byLpn.useQuery(
    { lpn: lpn ?? "" },
    { enabled: !!lpn, refetchInterval: 30_000 },
  );
  const queue = trpc.pallet.putawayQueue.useQuery({}, { refetchInterval: 30_000 });

  const queueRow = useMemo(
    () => (queue.data ?? []).find((q) => q.lpn === lpn),
    [queue.data, lpn],
  );

  if (pallet.isLoading) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Skeleton lines={4} rowHeight={80} />
        </ScrollView>
      </Frame>
    );
  }

  if (!pallet.data) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState
            title="Pallet not found"
            hint={`No pallet matched ${lpn ?? "this LPN"}.`}
          />
        </ScrollView>
      </Frame>
    );
  }

  const { pallet: p, items } = pallet.data;
  const skuCount = items.length;
  const totalUnits = items.reduce((n, i) => n + i.qty, 0);

  return (
    <Frame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={28} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topRef}>{p.lpn}</Text>
            <Text style={styles.topMeta}>
              {p.weightKg ? `${p.weightKg} kg · ` : ""}
              {skuCount} SKU{skuCount === 1 ? "" : "s"} · {totalUnits} units
            </Text>
          </View>
          <Pill tone="lilac" size="sm">
            PUTAWAY
          </Pill>
        </View>

        {/* Primary suggestion */}
        <View style={styles.goto}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>DROP AT</Text>
            <Text style={styles.loc}>{queueRow?.suggestedRack?.code ?? "?"}</Text>
            {queueRow?.suggestedRack && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 10,
                  gap: 8,
                }}
              >
                <View style={styles.confChip}>
                  <Text style={styles.confText}>FIRST OPEN RACK</Text>
                </View>
              </View>
            )}
            <Text style={styles.reason}>
              {queueRow?.suggestedRack
                ? `Currently at ${queueRow.locationCode ?? "dock"}.`
                : "No rack available in this warehouse. Override manually."}
            </Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </View>

        <Text style={styles.altLabel}>Pallet contents</Text>
        <View style={{ gap: 8 }}>
          {items.length === 0 ? (
            <Text style={styles.emptyContents}>Empty pallet — no items recorded.</Text>
          ) : (
            items.map((it) => (
              <View key={it.id} style={styles.altRow}>
                <Text style={styles.altLoc}>{it.qty}</Text>
                <Text style={styles.altReason}>
                  {it.qtyUnit} · {it.lot ?? "no lot"}
                </Text>
              </View>
            ))
          )}
        </View>
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
    width: 60,
  },
  altReason: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: t.body,
  },
  emptyContents: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: t.mutedSoft,
    paddingHorizontal: 4,
  },
  bottomCta: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
  },
});
