import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { Frame } from "../../src/components/Frame";
import { Btn } from "../../src/components/Btn";
import { Pill } from "../../src/components/Pill";
import { theme as t, FONTS } from "../../src/lib/theme";

/**
 * Floor-mode scan screen — full-bleed dark canvas with viewfinder and
 * animated scan line. Mode switcher (LPN / SKU / LOC / LOT) lives at
 * the top; bottom HUD shows last scan + actions.
 *
 * **Camera and hardware trigger are stubbed** in this preview. Wiring:
 *   - `expo-camera` is already in package.json; later phase replaces
 *     the placeholder viewport with <CameraView barcodeScannerSettings={…}>.
 *   - Hardware trigger: most warehouse iPhones expose it as a keyboard
 *     event or vendor SDK callback — wire one global handler that
 *     fires haptic + auto-routes by prefix.
 *   - Manual entry: tap the LPN label area to open a numeric/alpha
 *     keypad (also TODO).
 *
 * The prefix router below already mirrors what a real scan callback
 * would do (P- → pallet, SO- → outbound, etc.) so plugging in camera
 * decode is just `onBarcodeScanned={(e) => route(e.data)}`.
 */

type ScanMode = "LPN" | "SKU" | "LOC" | "LOT";

const MODES: ScanMode[] = ["LPN", "SKU", "LOC", "LOT"];

export default function ScanScreen() {
  const [mode, setMode] = useState<ScanMode>("LPN");
  const router = useRouter();
  const scanY = useRef(new Animated.Value(0)).current;

  // 1.5s linear top↔bottom loop for the scan line.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: 0,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanY]);

  function route(code: string) {
    const upper = code.toUpperCase();
    if (upper.startsWith("P-")) router.push(`/pallet/${upper}` as any);
    else if (upper.startsWith("L-")) router.push(`/location/${upper}` as any);
    else if (upper.startsWith("SO-")) router.push("/(tabs)/tasks" as any);
    else if (upper.startsWith("PO-")) router.push("/(tabs)/tasks" as any);
    // SKU- / LOC fall back to the tasks tab for now
    else router.push("/(tabs)/tasks" as any);
  }

  // Mock "last scan" payload that the bottom HUD shows. In the real
  // build this comes from the camera decode callback or hardware
  // trigger handler.
  const lastScan = {
    lpn: "P-9QK4X72L",
    location: "A2-02-B",
    weight: "312 kg",
    skus: 3,
  };

  return (
    <Frame>
      {/* Marigold radial haze at the top-left, faked with a positioned circle */}
      <View pointerEvents="none" style={styles.haze} />

      {/* Mode switcher */}
      <View style={styles.modeBar}>
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[
                styles.modeBtn,
                { backgroundColor: active ? t.primary : "rgba(255,255,255,.08)" },
              ]}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  { color: active ? t.primaryText : t.muted },
                ]}
              >
                {m}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Viewfinder */}
      <View style={styles.viewfinder}>
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
        <Animated.View
          style={[
            styles.scanLine,
            {
              transform: [
                {
                  translateY: scanY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 240],
                  }),
                },
              ],
            },
          ]}
        />
        <Text style={styles.viewfinderHint}>
          {mode === "LPN"
            ? "Aim at the pallet label"
            : mode === "LOC"
              ? "Aim at the bay/rack label"
              : mode === "SKU"
                ? "Aim at the product barcode"
                : "Aim at the lot label"}
        </Text>
      </View>

      {/* Bottom HUD */}
      <View style={styles.hud}>
        <View style={styles.hudHeader}>
          <Pill tone="primary" size="sm">
            LAST SCAN
          </Pill>
          <View style={{ flex: 1 }} />
          <Text style={styles.hudTime}>00:08 ago</Text>
        </View>
        <Text style={styles.hudLpn}>{lastScan.lpn}</Text>
        <View style={styles.hudMetaRow}>
          <HudMeta label="Loc" value={lastScan.location} />
          <HudMeta label="Weight" value={lastScan.weight} />
          <HudMeta label="SKUs" value={String(lastScan.skus)} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <Btn
            variant="primary"
            size="md"
            style={{ flex: 1 }}
            onPress={() => route(lastScan.lpn)}
          >
            OPEN
          </Btn>
          <Btn variant="ghost" size="md" style={{ flex: 1 }} onPress={() => {}}>
            MOVE
          </Btn>
          <Btn variant="ghost" size="md" style={{ flex: 1 }} onPress={() => {}}>
            LABEL
          </Btn>
        </View>
      </View>
    </Frame>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const size = 26;
  const thickness = 3;
  const isTop = pos === "tl" || pos === "tr";
  const isLeft = pos === "tl" || pos === "bl";
  return (
    <View
      style={{
        position: "absolute",
        width: size,
        height: size,
        ...(isTop ? { top: -2 } : { bottom: -2 }),
        ...(isLeft ? { left: -2 } : { right: -2 }),
        borderColor: t.primary,
        borderTopWidth: isTop ? thickness : 0,
        borderBottomWidth: isTop ? 0 : thickness,
        borderLeftWidth: isLeft ? thickness : 0,
        borderRightWidth: isLeft ? 0 : thickness,
        shadowColor: t.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
      }}
    />
  );
}

function HudMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.hudMetaLabel}>{label}</Text>
      <Text style={styles.hudMetaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  haze: {
    position: "absolute",
    top: -120,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: t.primary,
    opacity: 0.15,
  },
  modeBar: {
    flexDirection: "row",
    alignSelf: "center",
    marginTop: 14,
    padding: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,.45)",
    borderWidth: 1,
    borderColor: t.border,
    gap: 4,
  },
  modeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
  },
  modeBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  viewfinder: {
    flex: 1,
    marginHorizontal: 36,
    marginVertical: 32,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,.25)",
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 18,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: t.primary,
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    top: 12,
  },
  viewfinderHint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: "700",
    textAlign: "center",
  },
  hud: {
    margin: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,.55)",
    borderWidth: 1,
    borderColor: t.border,
  },
  hudHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  hudTime: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.mutedSoft,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  hudLpn: {
    fontFamily: FONTS.mono,
    fontSize: 26,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: 2,
  },
  hudMetaRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 14,
  },
  hudMetaLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    color: t.mutedSoft,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  hudMetaValue: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: "800",
    color: t.ink,
    marginTop: 3,
    letterSpacing: 0.3,
  },
});
