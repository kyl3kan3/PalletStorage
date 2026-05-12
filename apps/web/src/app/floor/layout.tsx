import { FShell } from "~/components/floor-shell";

/**
 * /floor — preview tree for the "Floor mode" redesign (Phase 2).
 *
 * Lives parallel to the legacy /(dashboard) routes so we can ship the
 * new chrome and pages incrementally without breaking the existing
 * UI. Once Home / Operations / Inventory are all wired in and signed
 * off, a later phase folds these routes into the canonical paths and
 * retires the dashboard layout.
 *
 * Pages inside /floor set their own page-title block by rendering
 * <FShell title=… eyebrow=… > themselves, so individual pages have
 * control over tabs / actions without having to plumb them through
 * the layout.
 */
export default function FloorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
