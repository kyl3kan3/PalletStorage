import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { trpc } from "../../src/lib/trpc";

export default function LocationDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const res = trpc.scan.resolve.useQuery({ code: code! }, { enabled: !!code });

  if (!res.data) return <View style={s.root}><Text style={s.muted}>{res.isLoading ? "Loading..." : "Not found"}</Text></View>;
  if (res.data.kind !== "location" || !res.data.location) {
    return <View style={s.root}><Text style={s.muted}>Not a location</Text></View>;
  }
  const loc = res.data.location;
  return (
    <View style={s.root}>
      <Text style={s.title}>{loc.path}</Text>
      <Text style={s.text}>Type: {loc.type}</Text>
      <Text style={s.text}>Max weight: {loc.maxWeightKg ?? "—"} kg</Text>
      <Text style={s.text}>Velocity class: {loc.velocityClass ?? "—"}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: "#0f172a" },
  title: { color: "white", fontSize: 20, fontWeight: "700", marginBottom: 12 },
  text: { color: "white", fontSize: 14 },
  muted: { color: "#94a3b8" },
});
