import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Frame } from "../../src/components/Frame";
import { Pill } from "../../src/components/Pill";
import { Skeleton } from "../../src/components/Skeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { theme as t, FONTS } from "../../src/lib/theme";
import { trpc } from "../../src/lib/trpc";

/**
 * Tasks tab — same source data as Today (task.listMine +
 * pallet.putawayQueue + inbound.list filtered to receiving) but with
 * explicit filter chips so the operator can drill into one task type.
 */

type TaskType = "PICK" | "RECV" | "PUT" | "COUNT";
type Filter = "ALL" | TaskType;

interface Task {
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

const FILTERS: Filter[] = ["ALL", "PICK", "RECV", "PUT", "COUNT"];

export default function TasksScreen() {
  const [filter, setFilter] = useState<Filter>("ALL");

  const tasks = trpc.task.listMine.useQuery(undefined, { refetchInterval: 30_000 });
  const putaway = trpc.pallet.putawayQueue.useQuery({}, { refetchInterval: 30_000 });
  const inbounds = trpc.inbound.list.useQuery({}, { refetchInterval: 30_000 });

  const all: Task[] = useMemo(() => {
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
    return [...picks, ...recvs, ...puts, ...counts];
  }, [tasks.data, putaway.data, inbounds.data]);

  const visible = useMemo(
    () => (filter === "ALL" ? all : all.filter((x) => x.type === filter)),
    [all, filter],
  );

  const loading = tasks.isLoading || putaway.isLoading || inbounds.isLoading;

  return (
    <Frame>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={styles.eyebrow}>Today · {all.length}</Text>
        <Text style={styles.title}>Tasks</Text>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 14, gap: 10 }}
      >
        {loading ? (
          <Skeleton lines={5} rowHeight={64} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={filter === "ALL" ? "Queue clear" : `No ${filter.toLowerCase()} tasks`}
            hint="Tasks will appear here as they're created."
          />
        ) : (
          visible.map((tk, i) => (
            <Link key={tk.key} href={tk.href as any} asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  i === 0 && styles.rowActive,
                  pressed && { transform: [{ scale: 0.99 }] },
                ]}
              >
                <View style={[styles.stripe, { backgroundColor: STRIPE[tk.type] }]} />
                <View style={{ flex: 1, paddingVertical: 14, paddingRight: 14 }}>
                  <View style={styles.header}>
                    <Text style={[styles.typeLabel, { color: STRIPE[tk.type] }]}>
                      {tk.type}
                    </Text>
                    <Text style={styles.ref}>{tk.ref}</Text>
                    <View style={{ flex: 1 }} />
                    {tk.urgent && (
                      <Pill tone="coral" size="sm">
                        {tk.shipBy}
                      </Pill>
                    )}
                  </View>
                  <Text style={styles.detail}>{tk.detail}</Text>
                </View>
              </Pressable>
            </Link>
          ))
        )}
      </ScrollView>
    </Frame>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "800",
    color: t.primary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: FONTS.sans,
    fontSize: 32,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -1.2,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.surfaceAlt,
    borderWidth: 1,
    borderColor: t.border,
  },
  chipActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  chipText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: "800",
    color: t.muted,
    letterSpacing: 0.6,
  },
  chipTextActive: {
    color: t.primaryText,
  },
  row: {
    flexDirection: "row",
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
    overflow: "hidden",
  },
  rowActive: {
    backgroundColor: t.primarySoft,
    borderColor: "rgba(255,178,62,.3)",
  },
  stripe: { width: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14 },
  typeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  ref: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: 0.3,
  },
  detail: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    color: t.body,
    marginTop: 4,
    paddingLeft: 14,
  },
});
