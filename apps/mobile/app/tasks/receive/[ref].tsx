import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Frame } from "../../../src/components/Frame";
import { Btn } from "../../../src/components/Btn";
import { Pill } from "../../../src/components/Pill";
import { Cubby } from "../../../src/components/Cubby";
import { theme as t, FONTS } from "../../../src/lib/theme";

/**
 * Receive screen. Header with PO ref + dock + variance pill. Progress
 * card with split mint-matched / coral-short bar. Lines list with
 * status badges (✓ matched, ✗ short, number for todo, marigold for
 * active). Sticky marigold "SCAN LINE N" button at the bottom.
 *
 * Mock data; later phase wires order.inbound + order.inboundLines +
 * receive.line({ poId, lineId, qty, lot }).
 */

type LineStatus = "todo" | "matched" | "short" | "active";

interface Line {
  n: number;
  sku: string;
  name: string;
  expected: number;
  received: number;
  status: LineStatus;
}

const LINES: Line[] = [
  { n: 1, sku: "SKU-00041", name: "Vanilla Extract 8oz", expected: 120, received: 120, status: "matched" },
  { n: 2, sku: "SKU-00102", name: "Cane Sugar 50lb", expected: 40, received: 36, status: "short" },
  { n: 3, sku: "SKU-00038", name: "Coffee Beans 5lb", expected: 30, received: 30, status: "matched" },
  { n: 4, sku: "SKU-00211", name: "Whole Tomatoes #10", expected: 24, received: 0, status: "active" },
  { n: 5, sku: "SKU-00150", name: "Olive Oil 1L", expected: 18, received: 0, status: "todo" },
];

export default function ReceiveScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const matched = LINES.filter((l) => l.status === "matched").length;
  const total = LINES.length;
  const variance = LINES.reduce((n, l) => n + (l.received - l.expected), 0);
  const matchedPct = matched / total;
  const shortPct = LINES.filter((l) => l.status === "short").length / total;
  const nextLine = LINES.find((l) => l.status === "active" || l.status === "todo");

  return (
    <Frame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={28} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topRef}>{ref ?? "PO-—"} · D-01</Text>
            <Text style={styles.topSupplier}>ACME Corp</Text>
          </View>
          {variance < 0 && (
            <Pill tone="coral" size="sm">{`${Math.abs(variance)} SHORT`}</Pill>
          )}
        </View>

        {/* Progress card */}
        <View style={styles.progress}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressBig}>
              {matched + LINES.filter((l) => l.status === "short").length} / {total}
              <Text style={styles.progressBigUnit}> LINES</Text>
            </Text>
            <Text style={styles.progressVar}>
              VAR {variance > 0 ? "+" : ""}
              {variance} EA
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={{
                flex: matchedPct,
                backgroundColor: t.mint,
              }}
            />
            <View
              style={{
                flex: shortPct,
                backgroundColor: t.coral,
              }}
            />
            <View style={{ flex: 1 - matchedPct - shortPct }} />
          </View>
        </View>

        {/* Lines */}
        <View style={{ marginTop: 16, gap: 8 }}>
          {LINES.map((l) => (
            <LineRow key={l.n} l={l} />
          ))}
        </View>

        <Text style={styles.previewText}>
          FLOOR MODE PREVIEW · mock data · later phase wires order.inbound +
          receive.line
        </Text>
      </ScrollView>

      {/* Sticky bottom CTA */}
      {nextLine && (
        <View style={styles.bottomCta}>
          <Btn variant="primary" size="lg" full>
            SCAN LINE {nextLine.n}
          </Btn>
        </View>
      )}
    </Frame>
  );
}

function LineRow({ l }: { l: Line }) {
  const badge = lineBadge(l.status, l.n);
  const isShort = l.status === "short";
  const isActive = l.status === "active";
  return (
    <View
      style={[
        styles.line,
        isActive && { borderColor: t.primary, backgroundColor: t.primarySoft },
        isShort && { backgroundColor: "rgba(255,107,91,.08)" },
      ]}
    >
      <View
        style={[
          styles.lineBadge,
          { backgroundColor: badge.bg },
        ]}
      >
        <Text style={[styles.lineBadgeText, { color: badge.fg }]}>
          {badge.text}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineSku}>{l.sku}</Text>
        <Text style={styles.lineName}>{l.name}</Text>
      </View>
      <Text
        style={[
          styles.lineQty,
          isShort && { color: t.coral },
          l.status === "matched" && { color: t.mint },
        ]}
      >
        {l.received} / {l.expected}
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
    color: t.coral,
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
  previewText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.mutedSoft,
    letterSpacing: 0.4,
    marginTop: 22,
    textAlign: "center",
  },
});
