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
 * Receive screen. Param [ref] is the inbound order UUID.
 *
 * Wires:
 *   - inbound.byId → order header + lines (productId, qtyExpected,
 *     qtyReceived)
 *   - product.search → bulk SKU/name lookup
 *
 * Progress card splits mint-matched vs coral-short. Sticky marigold
 * "SCAN LINE N" button at the bottom points at the first not-yet-
 * fully-received line.
 */

export default function ReceiveScreen() {
  const { ref: id } = useLocalSearchParams<{ ref: string }>();

  const detail = trpc.inbound.byId.useQuery(
    { id: id ?? "" },
    { enabled: !!id, refetchInterval: 30_000 },
  );
  const products = trpc.product.search.useQuery({ q: "", limit: 500 });

  const productMap = useMemo(() => {
    const m = new Map<string, { sku: string | null; name: string }>();
    for (const p of products.data ?? []) m.set(p.id, { sku: p.sku, name: p.name });
    return m;
  }, [products.data]);

  if (detail.isLoading) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Skeleton lines={6} rowHeight={64} />
        </ScrollView>
      </Frame>
    );
  }

  if (!detail.data) {
    return (
      <Frame>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState title="Order not found" />
        </ScrollView>
      </Frame>
    );
  }

  const { order, lines } = detail.data;
  const matchedLines = lines.filter(
    (l) => l.qtyReceived === l.qtyExpected && l.qtyReceived > 0,
  ).length;
  const shortLines = lines.filter(
    (l) => l.qtyReceived > 0 && l.qtyReceived < l.qtyExpected,
  ).length;
  const total = lines.length;
  const variance = lines.reduce((n, l) => n + (l.qtyReceived - l.qtyExpected), 0);
  const matchedPct = total > 0 ? matchedLines / total : 0;
  const shortPct = total > 0 ? shortLines / total : 0;
  const nextLineIdx = lines.findIndex((l) => l.qtyReceived < l.qtyExpected);

  return (
    <Frame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={28} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topRef}>{order.reference}</Text>
            <Text style={styles.topSupplier}>{order.supplier ?? "supplier —"}</Text>
          </View>
          {variance < 0 && (
            <Pill tone="coral" size="sm">{`${Math.abs(variance)} SHORT`}</Pill>
          )}
        </View>

        {/* Progress card */}
        <View style={styles.progress}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressBig}>
              {matchedLines + shortLines} / {total}
              <Text style={styles.progressBigUnit}> LINES</Text>
            </Text>
            <Text style={[styles.progressVar, variance < 0 && { color: t.coral }]}>
              VAR {variance > 0 ? "+" : ""}
              {variance} EA
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={{ flex: matchedPct, backgroundColor: t.mint }} />
            <View style={{ flex: shortPct, backgroundColor: t.coral }} />
            <View style={{ flex: Math.max(0, 1 - matchedPct - shortPct) }} />
          </View>
        </View>

        {/* Lines */}
        {lines.length === 0 ? (
          <View style={{ marginTop: 16 }}>
            <EmptyState
              title="No lines on this order"
              hint="Add lines from the manager screen."
            />
          </View>
        ) : (
          <View style={{ marginTop: 16, gap: 8 }}>
            {lines.map((l, i) => {
              const product = productMap.get(l.productId);
              const matched = l.qtyReceived === l.qtyExpected && l.qtyReceived > 0;
              const short = l.qtyReceived > 0 && l.qtyReceived < l.qtyExpected;
              const active = i === nextLineIdx;
              const status: "matched" | "short" | "active" | "todo" = matched
                ? "matched"
                : short
                  ? "short"
                  : active
                    ? "active"
                    : "todo";
              return (
                <LineRow
                  key={l.id}
                  n={i + 1}
                  sku={product?.sku ?? "—"}
                  name={product?.name ?? `Product ${l.productId.slice(0, 8)}`}
                  expected={l.qtyExpected}
                  received={l.qtyReceived}
                  status={status}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom CTA */}
      {nextLineIdx >= 0 && (
        <View style={styles.bottomCta}>
          <Btn variant="primary" size="lg" full>
            SCAN LINE {nextLineIdx + 1}
          </Btn>
        </View>
      )}
    </Frame>
  );
}

type LineStatus = "todo" | "matched" | "short" | "active";

function LineRow({
  n,
  sku,
  name,
  expected,
  received,
  status,
}: {
  n: number;
  sku: string;
  name: string;
  expected: number;
  received: number;
  status: LineStatus;
}) {
  const badge = lineBadge(status, n);
  const isShort = status === "short";
  const isActive = status === "active";
  return (
    <View
      style={[
        styles.line,
        isActive && { borderColor: t.primary, backgroundColor: t.primarySoft },
        isShort && { backgroundColor: "rgba(255,107,91,.08)" },
      ]}
    >
      <View style={[styles.lineBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.lineBadgeText, { color: badge.fg }]}>{badge.text}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineSku}>{sku}</Text>
        <Text style={styles.lineName}>{name}</Text>
      </View>
      <Text
        style={[
          styles.lineQty,
          isShort && { color: t.coral },
          status === "matched" && { color: t.mint },
        ]}
      >
        {received} / {expected}
      </Text>
    </View>
  );
}

function lineBadge(s: LineStatus, n: number) {
  if (s === "matched") return { bg: t.mintSoft, fg: t.mint, text: "✓" };
  if (s === "short") return { bg: t.coralSoft, fg: t.coral, text: "✗" };
  if (s === "active") return { bg: t.primary, fg: t.primaryText, text: String(n) };
  return { bg: t.surfaceAlt, fg: t.muted, text: String(n) };
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
  topSupplier: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: t.body,
    marginTop: 2,
    fontWeight: "600",
  },
  progress: {
    backgroundColor: t.bgAlt,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: t.border,
  },
  progressLabels: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  progressBig: {
    fontFamily: FONTS.mono,
    fontSize: 28,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -1,
  },
  progressBigUnit: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: "700",
    color: t.muted,
    letterSpacing: 0.5,
  },
  progressVar: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 0.4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: t.surfaceAlt,
    overflow: "hidden",
    flexDirection: "row",
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    gap: 12,
  },
  lineBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  lineBadgeText: {
    fontFamily: FONTS.mono,
    fontWeight: "800",
    fontSize: 16,
  },
  lineSku: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    color: t.muted,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  lineName: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: t.ink,
    fontWeight: "600",
    marginTop: 2,
  },
  lineQty: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -0.3,
  },
  bottomCta: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
  },
});
