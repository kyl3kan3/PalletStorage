import { TRPCError } from "@trpc/server";

type InboundStatus = "draft" | "open" | "receiving" | "closed" | "cancelled";
type OutboundStatus = "draft" | "open" | "picking" | "packed" | "shipped" | "cancelled";

const INBOUND_TRANSITIONS: Record<InboundStatus, readonly InboundStatus[]> = {
  draft: ["open", "cancelled"],
  open: ["receiving", "closed", "cancelled"],
  receiving: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

const OUTBOUND_TRANSITIONS: Record<OutboundStatus, readonly OutboundStatus[]> = {
  draft: ["open", "cancelled"],
  open: ["picking", "cancelled"],
  picking: ["packed", "cancelled"],
  packed: ["shipped"],
  shipped: [],
  cancelled: [],
};

export function assertInboundTransition(from: InboundStatus, to: InboundStatus): void {
  if (!INBOUND_TRANSITIONS[from].includes(to)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Inbound status cannot move from '${from}' to '${to}'`,
    });
  }
}

export function assertOutboundTransition(from: OutboundStatus, to: OutboundStatus): void {
  if (!OUTBOUND_TRANSITIONS[from].includes(to)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Outbound status cannot move from '${from}' to '${to}'`,
    });
  }
}

export { INBOUND_TRANSITIONS, OUTBOUND_TRANSITIONS };
export type { InboundStatus, OutboundStatus };
