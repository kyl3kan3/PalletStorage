import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  onScan: (code: string) => void;
  prompt: string;
}

export function Scanner({ onScan, prompt }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{prompt}</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant camera permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["code128", "qr", "ean13", "code39"] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : (r) => {
                setScanned(true);
                onScan(r.data);
                setTimeout(() => setScanned(false), 1500);
              }
        }
      />
      <View style={styles.footer}>
        <Text style={styles.text}>{prompt}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, backgroundColor: "#0f172a" },
  footer: { padding: 16, backgroundColor: "#0f172a" },
  text: { color: "white", fontSize: 16, textAlign: "center" },
  btn: { backgroundColor: "#2563eb", padding: 14, borderRadius: 10 },
  btnText: { color: "white", fontWeight: "600" },
});
