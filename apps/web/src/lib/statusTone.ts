import type { TagTone } from "~/components/kit";

export function inboundStatusTone(status: string): TagTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "open":
      return "sky";
    case "receiving":
      return "primary";
    case "closed":
      return "mint";
    case "cancelled":
      return "coral";
    default:
      return "neutral";
  }
}

export function outboundStatusTone(status: string): TagTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "open":
      return "sky";
    case "picking":
      return "primary";
    case "packed":
      return "primary";
    case "shipped":
      return "mint";
    case "cancelled":
      return "coral";
    default:
      return "neutral";
  }
}

export function movementReasonTone(reason: string): TagTone {
  switch (reason) {
    case "receive":
      return "sky";
    case "putaway":
      return "mint";
    case "move":
      return "neutral";
    case "pick":
      return "primary";
    case "ship":
      return "mint";
    case "adjust":
      return "coral";
    case "cycle_count":
      return "sky";
    default:
      return "neutral";
  }
}

export function cycleCountStatusTone(status: string): TagTone {
  switch (status) {
    case "open":
      return "sky";
    case "counting":
      return "primary";
    case "reviewing":
      return "primary";
    case "closed":
      return "mint";
    case "cancelled":
      return "coral";
    default:
      return "neutral";
  }
}

// Dock-to-stock formatter used on reports page and potentially elsewhere.
export function formatDuration(seconds: number | undefined | null): string {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
