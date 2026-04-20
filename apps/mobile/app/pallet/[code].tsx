import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { trpc } from "../../src/lib/trpc";

export default function PalletDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const res = trpc.pallet.byLpn.useQuery({ lpn: code! }, { enabled: !!code });

  if (!res.data) return <View style={s.root}><Text style={s.muted}>{res.isLoading ? "Loading..." : "Not found"}</Text></View>;

  return (
    <View style={s.root}>
      <Text style={s.title}>Pallet {res.data.pallet.lpn}</Text>
      <Text style={s.text}>Status: {res.data.pallet.status}</Text>
      <Text style={s.text}>Location: {res.data.pallet.currentLocationId ?? "(unassigned)"}</Text>
      <Text style={s.heading}>Items</Text>
      {res.data.items.map((it) => (
        <Text key={it.id} style={s.text}>
          {it.productId.slice(0, 8)} · qty {it.qty}
        </Text>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: "#0f172a" },
  title: { color: "white", fontSize: 20, fontWeight: "700", marginBottom: 12 },
  heading: { color: "white", fontSize: 16, marginTop: 12, marginBottom: 4 },
  text: { color: "white", fontSize: 14 },
  muted: { color: "#94a3b8" },
});
