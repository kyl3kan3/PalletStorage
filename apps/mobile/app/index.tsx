import { Redirect } from "expo-router";

/**
 * Mobile root redirects to /today — the floor staff queue is the home
 * screen now (per the handoff README). The legacy /scan, /pick,
 * /receive routes at the root still exist as back-compat while we
 * migrate.
 */
export default function Index() {
  return <Redirect href="/today" />;
}
