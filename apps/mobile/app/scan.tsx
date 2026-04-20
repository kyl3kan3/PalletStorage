import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { trpc } from "../src/lib/trpc";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState<string | null>(null);
  const router = useRouter();
  const resolve = trpc.scan.resolve.useQuery({ code: code ?? "" }, { enabled: !!code });

  useEffect(() => {
    if (!resolve.data) return;
    if (resolve.data.kind === "pallet") router.push(`/pallet/${resolve.data.code}` as never);
    if (resolve.data.kind === "location") router.push(`/location/${resolve.data.code}` as never);
  }, [resolve.data, router]);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission needed to scan.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["code128", "qr", "ean13", "code39"] }}
        onBarcodeScanned={code ? undefined : (r) => setCode(r.data)}
      />
      {code && (
        <View style={styles.footer}>
          <Text style={styles.text}>Scanned: {code}</Text>
          <Pressable style={styles.btn} onPress={() => setCode(null)}>
            <Text style={styles.btnText}>Scan again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, backgroundColor: "#0f172a" },
  footer: { padding: 20, backgroundColor: "#0f172a", gap: 12 },
  text: { color: "white", fontSize: 16 },
  btn: { backgroundColor: "#2563eb", padding: 16, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "600" },
});
