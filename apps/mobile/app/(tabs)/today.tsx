import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useMemo } from "react";
import { Frame } from "../../src/components/Frame";
import { Pill } from "../../src/components/Pill";
import { Cubby } from "../../src/components/Cubby";
import { Skeleton } from "../../src/components/Skeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { theme as t, FONTS } from "../../src/lib/theme";
import { trpc } from "../../src/lib/trpc";

/**
 * Today queue — floor staff's home. Aggregates the operator's work
 * across three tRPC procedures:
 *
 *   - task.listMine → picks assigned (or unassigned) + cycle counts
 *   - pallet.putawayQueue → pallets on the dock needing a rack
 *   - inbound.list → orders currently in receiving
 *
 * Sorted urgent-first: picks with a shipBy in the next 4h glow coral.
 */

type TaskType = "PICK" | "RECV" | "COUNT" | "PUT";

interface QueueItem {
  key: string;
  type: TaskType;
  ref: string;
  detail: string;
  shipBy: string;
  urgent: boolean;
  href: string;
}

const STRIPE: Record<TaskType, string> = {
  PICK: t.primary,
  RECV: t.sky,
  COUNT: t.mint,
  PUT: t.lilac,
};

export default function TodayScreen() {
  const tasks = trpc.task.listMine.useQuery(undefined, { refetchInterval: 30_000 });
  const putaway = trpc.pallet.putawayQueue.useQuery({}, { refetchInterval: 30_000 });
  const inbounds = trpc.inbound.list.useQuery({}, { refetchInterval: 30_000 });

  const queue: QueueItem[] = useMemo(() => {
    const picks = (tasks.data?.picks ?? []).map((p) => ({
      key: `pick-${p.id}`,
      type: "PICK" as const,
      ref: p.orderReference,
      detail: `${p.orderCustomer ?? "—"} · ${p.locationPath ?? "—"} · ${p.qty} ea`,
      shipBy: "—",
      urgent: false,
      href: `/tasks/pick/${p.orderId}`,
    }));
    const counts = (tasks.data?.counts ?? []).map((c) => ({
      key: `count-${c.id}`,
      type: "COUNT" as const,
      ref: `CC-${c.id.slice(0, 6).toUpperCase()}`,
      detail: c.locationPath ?? "zone count",
      shipBy: c.dueAt ? new Date(c.dueAt).toLocaleDateString() : "—",
      urgent: c.dueAt ? new Date(c.dueAt) < new Date() : false,
      href: `/tasks/count/${c.id}`,
    }));
    const puts = (putaway.data ?? []).map((p) => ({
      key: `put-${p.palletId}`,
      type: "PUT" as const,
      ref: p.lpn,
      detail: `${p.customerName ?? "—"} · from ${p.locationCode ?? "dock"} → ${p.suggestedRack?.code ?? "?"}`,
      shipBy: "—",
      urgent: false,
      href: `/tasks/putaway/${p.lpn}`,
    }));
    const recvs = (inbounds.data ?? [])
      .filter((o) => o.status === "receiving")
      .map((o) => ({
        key: `recv-${o.id}`,
        type: "RECV" as const,
        ref: o.reference,
        detail: o.supplier ?? "supplier —",
        shipBy: o.expectedAt
          ? new Date(o.expectedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        urgent: false,
        href: `/tasks/receive/${o.id}`,
      }));
    // Urgent first, then picks, then everything else.
    return [...picks, ...recvs, ...puts, ...counts].sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return 0;
    });
  }, [tasks.data, putaway.data, inbounds.data]);

  const loading = tasks.isLoading || putaway.isLoading || inbounds.isLoading;

  return (
    <Frame>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Cubby size={32} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.eyebrow}>SHIFT QUEUE</Text>
            <Text style={styles.subtitle}>
              {loading ? "Loading…" : `${queue.length} task${queue.length === 1 ? "" : "s"} left`}
            </Text>
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
        <Text style={styles.sectionLabel}>Queue · {queue.length}</Text>
        {loading ? (
          <Skeleton lines={4} rowHeight={64} />
        ) : queue.length === 0 ? (
          <EmptyState
            title="Nothing on the queue"
            hint="Picks, receives, putaway and counts will land here as they're created."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {queue.map((q, i) => (
              <Link key={q.key} href={q.href as any} asChild>
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
        )}
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
    paddingLeft: 14,
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
});
