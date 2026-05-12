import { ScrollView, View, Text, StyleSheet } from "react-native";
import { Frame } from "../../src/components/Frame";
import { Card } from "../../src/components/Card";
import { Pill } from "../../src/components/Pill";
import { Btn } from "../../src/components/Btn";
import { Cubby } from "../../src/components/Cubby";
import { theme as t, FONTS } from "../../src/lib/theme";

/**
 * More tab — settings hub. Warehouse switcher, sync queue, app info,
 * sign out. Placeholder rows for now; later phase wires:
 *   - warehouse.list + active warehouse selection
 *   - offline queue inspector (TanStack Query persister)
 *   - Clerk sign-out via useAuth().signOut()
 */
export default function MoreScreen() {
  return (
    <Frame>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 18 }}>
        <View style={styles.header}>
          <Cubby size={48} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.eyebrow}>Signed in</Text>
            <Text style={styles.name}>Maya Rivera</Text>
            <Text style={styles.role}>WH-01 · TACOMA · operator</Text>
          </View>
        </View>

        {/* Sync status */}
        <Card style={{ marginTop: 18 }} padding={18}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pill tone="mint" size="sm">
              ● ONLINE
            </Pill>
            <Text style={styles.syncCount}>0 queued</Text>
          </View>
          <Text style={styles.syncDetail}>
            All confirms and adjustments are sync'd. Mutations queue when the
            handset is offline and flush on reconnect.
          </Text>
        </Card>

        {/* Settings rows */}
        <View style={{ marginTop: 18, gap: 8 }}>
          <Row label="Warehouse" value="WH-01 · TACOMA" />
          <Row label="Hardware trigger" value="Bluetooth scanner · paired" />
          <Row label="App version" value="0.1.0" />
        </View>

        <View style={{ marginTop: 24 }}>
          <Btn variant="ghost" size="md" full>
            Sign out
          </Btn>
        </View>

        <Card style={{ marginTop: 18 }} padding={14}>
          <Text style={styles.previewText}>
            FLOOR MODE PREVIEW · settings stubbed · later phase wires Clerk
            sign-out + offline queue inspector
          </Text>
        </Card>
      </ScrollView>
    </Frame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  eyebrow: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "800",
    color: t.primary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  name: {
    fontFamily: FONTS.sans,
    fontSize: 22,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -0.6,
    marginTop: 4,
  },
  role: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.muted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 4,
  },
  syncCount: {
    marginLeft: 10,
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.muted,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  syncDetail: {
    marginTop: 10,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: t.body,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  rowLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.muted,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    width: 130,
  },
  rowValue: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: t.ink,
    fontWeight: "600",
    textAlign: "right",
  },
  previewText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.mutedSoft,
    letterSpacing: 0.4,
  },
});
