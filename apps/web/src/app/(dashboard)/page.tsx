import { redirect } from "next/navigation";

/**
 * Root "/" is now the Floor-mode home.
 *
 * The legacy "Today" board (sidebar Shell + Inbound/Outbound lane
 * dashboard) was the home for the original (dashboard) layout. The
 * Floor-mode redesign at /floor is the canonical landing now —
 * everything that used to live here is reachable from the FShell
 * sidebar with parity, plus the Cmd+K palette covers prefix routing
 * the lane board couldn't.
 *
 * Per-section pages (/inbound, /outbound, /customers, /reports, etc.)
 * still render inside the legacy Shell while their floor-mode
 * equivalents are filled in — that's why we redirect here rather than
 * deleting (dashboard) outright.
 */
export default function HomeRedirect() {
  redirect("/floor");
}
