import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { Frame } from "../../src/components/Frame";
import { Pill } from "../../src/components/Pill";
import { Card } from "../../src/components/Card";
import { theme as t, FONTS } from "../../src/lib/theme";

/**
 * Tasks tab — same data as Today but with explicit filter chips so
 * the operator can drill into one task type. Tapping a row routes to
 * the matching action screen (Pick / Receive / Putaway).
 *
 * Mock data; later phase wires task.listForUser({ warehouseId }).
 */

type TaskType = "PICK" | "RECV" | "PUT" | "COUNT";

interface Task {
  id: string;
  type: TaskType;
  ref: string;
  detail: string;
  shipBy: string;
  urgent: boolean;
  href: string;
}

const TASKS: Task[] = [
  { id: "1", type: "PICK", ref: "SO-24881", detail: "Northgate Foods · 22 lines · 13 picked", shipBy: "17:00", urgent: true, href: "/tasks/pick/SO-24881" },
  { id: "2", type: "PICK", ref: "SO-24886", detail: "Cascade Foods · 18 lines · 4 picked", shipBy: "17:30", urgent: true, href: "/tasks/pick/SO-24886" },
  { id: "3", type: "RECV", ref: "PO-58812", detail: "ACME Corp · 6 lines · D-01", shipBy: "—", urgent: false, href: "/tasks/receive/PO-58812" },
  { id: "4", type: "RECV", ref: "PO-58901", detail: "Pacific Supply · 5 lines · D-02", shipBy: "—", urgent: false, href: "/tasks/receive/PO-58901" },
  { id: "5", type: "PUT", ref: "P-9QK4X72L", detail: "From D-01 · 312 kg · suggested A2-04-B", shipBy: "—", urgent: false, href: "/tasks/putaway/P-9QK4X72L" },
  { id: "6", type: "COUNT", ref: "CC-205", detail: "A3 zone · 86 items", shipBy: "today", urgent: false, href: "/(tabs)/tasks" },
];

const STRIPE: Record<TaskType, string> = {
  PICK: t.primary,
  RECV: t.sky,
  COUNT: t.mint,
  PUT: t.lilac,
};

export default function TasksScreen() {
  return (
    <Frame>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={styles.eyebrow}>Today · {TASKS.length}</Text>
        <Text style={styles.title}>Tasks</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 14, gap: 10 }}
      >
        {TASKS.map((tk, i) => (
          <Link key={tk.id} href={tk.href as any} asChild>
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
        ))}

        <Card style={{ marginTop: 14 }} padding={14}>
          <Text style={styles.previewText}>
            FLOOR MODE PREVIEW · mock tasks · later phase wires task.listForUser
          </Text>
        </Card>
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
  previewText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: t.mutedSoft,
    letterSpacing: 0.4,
  },
});
