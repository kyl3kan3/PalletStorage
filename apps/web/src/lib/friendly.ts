import type { TagTone } from "~/components/kit";

/**
 * Plain-language mappings for statuses and terms. Kept centralized so
 * a future rebrand or localization pass only touches this file.
 */

type InboundStatus = "draft" | "open" | "receiving" | "closed" | "cancelled";
type OutboundStatus =
  | "draft"
  | "open"
  | "picking"
  | "packed"
  | "shipped"
  | "cancelled";
type CountStatus =
  | "draft"
  | "open"
  | "counting"
  | "reviewing"
  | "closed"
  | "cancelled";

export function friendlyInboundStatus(status: string): string {
  switch (status as InboundStatus) {
    case "draft":
      return "Not started";
    case "open":
      return "Ready to receive";
    case "receiving":
      return "Receiving now";
    case "closed":
      return "Received & closed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function friendlyOutboundStatus(status: string): string {
  switch (status as OutboundStatus) {
    case "draft":
      return "Not started";
    case "open":
      return "Ready to pick";
    case "picking":
      return "Being picked";
    case "packed":
      return "Ready to ship";
    case "shipped":
      return "Shipped";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function friendlyCountStatus(status: string): string {
  switch (status as CountStatus) {
    case "draft":
      return "Draft";
    case "open":
      return "Ready to count";
    case "counting":
      return "Counting in progress";
    case "reviewing":
      return "Awaiting approval";
    case "closed":
      return "Done";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export interface NextStep {
  label: string;
  blurb: string;
  tone: TagTone;
}

/**
 * "What's the one thing to do next on this order?" — drives the big
 * primary action at the top of an inbound detail page. Returning
 * `null` means the order has no next-step action (terminal status).
 */
export function nextInboundStep(status: string, hasShortLine: boolean): NextStep | null {
  switch (status as InboundStatus) {
    case "draft":
    case "open":
      return {
        label: "Start receiving",
        blurb:
          "Put a pallet on the dock and scan the order code on the mobile app. Lines update as product is checked in.",
        tone: "sky",
      };
    case "receiving":
      return {
        label: hasShortLine ? "Close (short-receive)" : "Close order",
        blurb: hasShortLine
          ? "Some lines have less than expected. Closing will ask for a reason so the shortfall is recorded."
          : "Received everything you wanted. Close the order to mark it done and make it exportable to QuickBooks.",
        tone: "primary",
      };
    case "closed":
    case "cancelled":
      return null;
    default:
      return null;
  }
}

export function nextOutboundStep(
  status: string,
  allLinesPicked: boolean,
): NextStep | null {
  switch (status as OutboundStatus) {
    case "draft":
    case "open":
      return {
        label: "Generate picks",
        blurb:
          "Choose which pallets go out for this order. We pick by earliest-expiry so older stock rotates first.",
        tone: "sky",
      };
    case "picking":
      return allLinesPicked
        ? {
            label: "Mark packed",
            blurb:
              "Everything is picked. Mark packed once the pallets are staged and ready for the carrier.",
            tone: "primary",
          }
        : {
            label: "Finish picking",
            blurb:
              "Generated picks need confirming. Scroll to the Picks section below, pick a staging location for each, and click Done.",
            tone: "neutral",
          };
    case "packed":
      return {
        label: "Confirm ship",
        blurb:
          "Enter the carrier and tracking number. We'll create the Bill of Lading automatically.",
        tone: "primary",
      };
    case "shipped":
    case "cancelled":
      return null;
    default:
      return null;
  }
}

export function nextCycleCountStep(status: string): NextStep | null {
  switch (status as CountStatus) {
    case "open":
    case "counting":
      return {
        label: "Submit counts",
        blurb:
          "Fill in the counted quantity for each item and submit. A manager will review any variances.",
        tone: "sky",
      };
    case "reviewing":
      return {
        label: "Approve & post variances",
        blurb:
          "Manager sign-off. Approving will adjust the on-hand quantity and log a cycle_count movement per variance.",
        tone: "primary",
      };
    default:
      return null;
  }
}

/**
 * Friendlier relative-time formatter: "5 minutes ago", "2 hours ago",
 * "Yesterday", "3 days ago", then falls back to toLocaleDateString.
 */
export function friendlyDate(when: Date | null | undefined): string {
  if (!when) return "—";
  const d = Date.now() - when.getTime();
  const mins = Math.round(d / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
