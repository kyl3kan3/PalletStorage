import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { theme as t, FONTS } from "../../src/lib/theme";

/**
 * Floor-mode tab bar. Four destinations per the handoff README:
 *
 *   Today · Scan · Tasks · More
 *
 * Active tab renders as a solid marigold pill; inactive tabs are
 * muted on the dark `#0F0C0A` bar. We're skipping vector icons to
 * avoid pulling in @expo/vector-icons just for chrome — the labels
 * are big enough to read on their own (matches the handoff's
 * label-first feel).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.bgAlt,
          borderTopColor: t.border,
          borderTopWidth: 1,
          height: 78,
          paddingTop: 10,
          paddingBottom: 14,
        },
        tabBarLabelStyle: { display: "none" },
        tabBarItemStyle: { paddingHorizontal: 6 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ focused }) => <TabPill label="Today" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ focused }) => <TabPill label="Scan" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ focused }) => <TabPill label="Tasks" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabPill label="More" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

/**
 * Tab indicator pill — solid marigold when focused, transparent +
 * muted text otherwise. Renders inside Expo Router's tabBarIcon slot
 * so we own the entire affordance without fighting Tabs.Screen.
 */
function TabPill({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: focused ? t.primary : "transparent",
        minWidth: 72,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: focused ? t.primaryText : t.muted,
          fontFamily: FONTS.sans,
          fontWeight: focused ? "800" : "600",
          fontSize: 13,
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
