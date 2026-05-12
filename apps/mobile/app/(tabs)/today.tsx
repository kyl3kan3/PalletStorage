import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { Frame } from "../../src/components/Frame";
import { Card } from "../../src/components/Card";
import { Pill } from "../../src/components/Pill";
import { Cubby } from "../../src/components/Cubby";
import { theme as t, FONTS, TYPE } from "../../src/lib/theme";

/**
 * Today queue — floor staff's home. Top bar with Cubby + shift status,
 * a giant "Open scanner" CTA, then the work queue. Items are sorted
 * by urgency: active item gets a marigold-soft background, others
 * just show their type color stripe.
 *
 * Mock data; later phase wires task.listForUser({ warehouseId }).
 */

type TaskType = "PICK" | "RECV" | "COUNT" | "PUT";

interface QueueItem {
  id: string;
  type: TaskType;
  ref: string;
  detail: string;
  shipBy: string;
  urgent: boolean;
  href: string;
}

const QUEUE: QueueItem[] = [
  {
    id: "1",
    type: "PICK",
    ref: "SO-24881",
    detail: "Northgate Foods · 22 lines",
    shipBy: "17:00",
    urgent: true,
    href: "/tasks/pick/SO-24881",
  },
  {
    id: "2",
    type: "RECV",
    ref: "PO-58812",
    detail: "ACME Corp · D-01",
    shipBy: "—",
    urgent: false,
    href: "/tasks/receive/PO-58812",
  },
  {
    id: "3",
    type: "PUT",
    ref: "P-9QK4X72L",
    detail: "From D-01 · 312 kg",
    shipBy: "—",
    urgent: false,
    href: "/tasks/putaway/P-9QK4X72L",
  },
  {
    id: "4",
    type: "COUNT",
    ref: "CC-205",
    detail: "A3 zone · 86 items",
    shipBy: "today",
    urgent: false,
    href: "/tasks",
  },
  {
    id: "5",
    type: "PICK",
    ref: "SO-24886",
    detail: "Cascade Foods · 18 lines",
    shipBy: "17:30",
    urgent: true,
    href: "/tasks/pick/SO-24886",
  },
];

const STRIPE: Record<TaskType, string> = {
  PICK: t.primary,
  RECV: t.sky,
  COUNT: t.mint,
  PUT: t.lilac,
};

export default function TodayScreen() {
  return (
    <Frame>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={32} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.eyebrow}>WH-01 · MAYA</Text>
            <Text style={styles.subtitle}>Morning shift · 5 left</Text>
          </View>
          <Pill tone="mint" size="sm">
            ● LIVE
          </Pill>
        </View>

        {/* Hero scanner CTA */}
        <Link href="/(tabs)/scan" asChild>
          <Pressable
            style={({ pressed }) => [
              styles.hero,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.scanIcon}>
                <Text style={styles.scanGlyph}>⌐</Text>
              </View>
              <Text style={styles.heroLabel}>Open scanner</Text>
              <Text style={styles.heroSub}>or hardware trigger</Text>
            </View>
            <View style={styles.trgBadge}>
              <Text style={styles.trgBadgeText}>TRG</Text>
            </View>
          </Pressable>
        </Link>

        {/* Queue */}
        <Text style={styles.sectionLabel}>Queue · {QUEUE.length}</Text>
        <View style={{ gap: 10 }}>
          {QUEUE.map((q, i) => (
            <Link key={q.id} href={q.href as any} asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.queueRow,
                  i === 0 && styles.queueRowActive,
                  pressed && { transform: [{ scale: 0.99 }] },
                ]}
              >
                <View style={[styles.stripe, { backgroundColor: STRIPE[q.type] }]} />
                <View style={{ flex: 1, paddingVertical: 14, paddingRight: 14 }}>
                  <View style={styles.queueHeader}>
                    <Text style={[styles.typeLabel, { color: STRIPE[q.type] }]}>
                      {q.type}
                    </Text>
                    <Text style={styles.queueRef}>{q.ref}</Text>
                    <View style={{ flex: 1 }} />
                    {q.urgent && (
                      <Pill tone="coral" size="sm">
                        {q.shipBy}
                      </Pill>
                    )}
                  </View>
                  <Text style={styles.queueDetail}>{q.detail}</Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>

        <Card style={{ marginTop: 24, borderStyle: "dashed" }} padding={14}>
          <Text style={styles.previewText}>
            FLOOR MODE PREVIEW · mock queue · later phase wires task.listForUser
          </Text>
        </Card>
      </ScrollView>
    </Frame>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 6,
  },
  eyebrow: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "700",
    color: t.muted,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: t.body,
    marginTop: 2,
    fontWeight: "600",
  },
  hero: {
    marginTop: 8,
    marginBottom: 22,
    padding: 22,
    borderRadius: 22,
    backgroundColor: t.primary,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 8,
  },
  scanIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  scanGlyph: {
    fontSize: 28,
    color: t.primaryText,
    fontWeight: "800",
  },
  heroLabel: {
    fontFamily: FONTS.sans,
    fontSize: 22,
    fontWeight: "800",
    color: t.primaryText,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: "rgba(31,19,8,.65)",
    marginTop: 4,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  trgBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,.18)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,.18)",
  },
  trgBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: "800",
    color: t.primaryText,
    letterSpacing: 1,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  queueRow: {
    flexDirection: "row",
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
    overflow: "hidden",
  },
  queueRowActive: {
    backgroundColor: t.primarySoft,
    borderColor: "rgba(255,178,62,.3)",
  },
  stripe: {
    width: 4,
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  typeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  queueRef: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: 0.3,
  },
  queueDetail: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    color: t.body,
    marginTop: 4,
    paddingLeft: 14,
  },
  previewText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.mutedSoft,
    letterSpacing: 0.4,
  },
});
