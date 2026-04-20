import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { Scanner } from "../src/components/Scanner";
import { trpc } from "../src/lib/trpc";
import { openQueue, type OfflineQueue } from "../src/lib/offlineQueue";

type Step = "pickOrder" | "scanPallet" | "scanLocation" | "done";

export default function ReceiveScreen() {
  const orders = trpc.inbound.list.useQuery({});
  const resolve = trpc.scan.resolveOnce.useMutation();
  const movePallet = trpc.pallet.move.useMutation();

  const [step, setStep] = useState<Step>("pickOrder");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [palletId, setPalletId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [queue, setQueue] = useState<OfflineQueue | null>(null);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    openQueue().then(async (q) => {
      setQueue(q);
      setQueueSize(await q.size());
    });
  }, []);

  function push(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 20));
  }

  async function drainQueue() {
    if (!queue) return;
    const { applied, failed } = await queue.drain(async (a) => {
      if (a.op === "pallet.move") await movePallet.mutateAsync(a.input as Parameters<typeof movePallet.mutateAsync>[0]);
    });
    if (applied > 0) push(`Synced ${applied} queued action(s)`);
    if (failed > 0) push("Still offline, will retry");
    setQueueSize(await queue.size());
  }

  async function onScan(raw: string) {
    const res = await resolve.mutateAsync({ code: raw });
    if (step === "scanPallet") {
      if (res.kind !== "pallet" || !res.pallet) return push(`Not a pallet: ${raw}`);
      setPalletId(res.pallet.id);
      push(`Pallet ${res.pallet.lpn} selected`);
      setStep("scanLocation");
    } else if (step === "scanLocation") {
      if (res.kind !== "location" || !res.location) return push(`Not a location: ${raw}`);
      if (!palletId) return;
      const input = { palletId, toLocationId: res.location.id, reason: "putaway" as const };
      try {
        await movePallet.mutateAsync(input);
        push(`Put away at ${res.location.path}`);
      } catch {
        // Network hiccup — queue and let the operator keep moving.
        await queue?.enqueue("pallet.move", input);
        setQueueSize((s) => s + 1);
        push(`Offline — queued putaway to ${res.location.path}`);
      }
      setPalletId(null);
      setStep("scanPallet");
    }
  }

  if (step === "pickOrder") {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Pick an inbound order</Text>
        <FlatList
          data={orders.data ?? []}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => {
                setOrderId(item.id);
                setStep("scanPallet");
              }}
            >
              <Text style={styles.cardTitle}>{item.reference}</Text>
              <Text style={styles.muted}>
                {item.supplier ?? "—"} · {item.status}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No open inbound orders</Text>}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Scanner
        prompt={step === "scanPallet" ? "Scan a pallet LPN" : "Scan the putaway location"}
        onScan={onScan}
      />
      <View style={styles.logBox}>
        <View style={styles.queueRow}>
          <Text style={styles.muted}>Order: {orderId?.slice(0, 8)}</Text>
          {queueSize > 0 && (
            <Pressable onPress={drainQueue}>
              <Text style={styles.queueChip}>{queueSize} queued · tap to sync</Text>
            </Pressable>
          )}
        </View>
        {log.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {l}
          </Text>
        ))}
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
  logBox: { padding: 12, backgroundColor: "#0f172a", maxHeight: 180 },
  logLine: { color: "#cbd5e1", fontSize: 13 },
  queueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  queueChip: {
    color: "#0f172a",
    backgroundColor: "#fbbf24",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
});
