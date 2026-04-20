import { View, Text, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";

export default function Home() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>WMS</Text>
      <Link href="/scan" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>Scan</Text>
        </Pressable>
      </Link>
      <Link href="/receive" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>Receive</Text>
        </Pressable>
      </Link>
      <Link href="/pick" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>Pick</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 16, justifyContent: "center", backgroundColor: "#0f172a" },
  title: { color: "white", fontSize: 32, fontWeight: "700", marginBottom: 32 },
  btn: { backgroundColor: "#2563eb", padding: 20, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontSize: 18, fontWeight: "600" },
});
