import { useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { Scanner } from "../src/components/Scanner";
import { trpc } from "../src/lib/trpc";

export default function PickScreen() {
  const picks = trpc.outbound.myPicks.useQuery();
  const resolve = trpc.scan.resolveOnce.useMutation();
  const complete = trpc.outbound.completePick.useMutation({
    onSuccess: () => picks.refetch(),
  });

  const [activePickId, setActivePickId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function push(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 20));
  }

  async function onScan(raw: string) {
    if (!activePickId) return;
    const res = await resolve.mutateAsync({ code: raw });
    if (res.kind !== "location" || !res.location) return push(`Not a location: ${raw}`);
    await complete.mutateAsync({ pickId: activePickId, stagingLocationId: res.location.id });
    push(`Completed pick → ${res.location.path}`);
    setActivePickId(null);
  }

  if (!activePickId) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>My picks</Text>
        <FlatList
          data={picks.data ?? []}
          keyExtractor={(row) => row.pick.id}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setActivePickId(item.pick.id)}>
              <Text style={styles.cardTitle}>{item.order.reference}</Text>
              <Text style={styles.muted}>
                From {item.location?.path ?? "?"} · qty {item.pick.qty}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No assigned picks</Text>}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Scanner prompt="Scan the staging location for this pick" onScan={onScan} />
      <View style={styles.logBox}>
        {log.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {l}
          </Text>
        ))}
        <Pressable style={styles.cancel} onPress={() => setActivePickId(null)}>
          <Text style={styles.muted}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: "#0f172a" },
  title: { color: "white", fontSize: 20, marginBottom: 12 },
  card: { padding: 16, backgroundColor: "#1e293b", borderRadius: 10, marginBottom: 8 },
  cardTitle: { color: "white", fontSize: 16, fontWeight: "600" },
  muted: { color: "#94a3b8", fontSize: 13 },
  logBox: { padding: 12, backgroundColor: "#0f172a", maxHeight: 200 },
  logLine: { color: "#cbd5e1", fontSize: 13 },
  cancel: { padding: 8 },
});
