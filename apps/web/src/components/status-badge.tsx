"use client";

// StatusBadge: thin wrapper over the `Tag` kit primitive that adds a
// hover-tooltip explanation per status. New 3PL users routinely misread
// "closed" as "fully put away" and "shipped" as "billed" — the tooltip
// is the cheapest fix.
//
// All status enums and their copy live here so the kit-level Tag stays
// generic and we have ONE place to keep terminology in sync with the
// schema (`packages/db/src/schema.ts`).

import type { ReactNode } from "react";
import { Tag, type TagTone } from "./kit";
import type { Theme } from "~/lib/theme";

type InboundStatus = "draft" | "open" | "receiving" | "closed" | "cancelled";
type OutboundStatus =
  | "draft"
  | "open"
  | "picking"
  | "packed"
  | "shipped"
  | "cancelled";
type PalletStatus =
  | "in_transit"
  | "received"
  | "stored"
  | "picked"
  | "shipped"
  | "damaged";
type AppointmentStatus =
  | "scheduled"
  | "at_dock"
  | "in_progress"
  | "completed"
  | "cancelled";

const INBOUND: Record<InboundStatus, { label: string; tone: TagTone; tip: string }> = {
  draft: { label: "Draft", tone: "neutral", tip: "Saved but not yet expected at the dock." },
  open: { label: "Open", tone: "sky", tip: "Expected — waiting on the truck to arrive." },
  receiving: { label: "Receiving", tone: "primary", tip: "Receiving in progress." },
  closed: {
    label: "Closed",
    tone: "mint",
    tip: "Receipt complete (or short-closed). Pallets may still be on the dock — see Awaiting putaway.",
  },
  cancelled: { label: "Cancelled", tone: "coral", tip: "Cancelled before any receive." },
};

const OUTBOUND: Record<OutboundStatus, { label: string; tone: TagTone; tip: string }> = {
  draft: { label: "Draft", tone: "neutral", tip: "Saved but not yet ready to pick." },
  open: { label: "Open", tone: "sky", tip: "Ready — generate picks to assign stock." },
  picking: { label: "Picking", tone: "primary", tip: "Picks generated. Operators are pulling stock." },
  packed: {
    label: "Packed",
    tone: "primary",
    tip: "All picks complete. Staged for the outbound truck — not shipped yet.",
  },
  shipped: { label: "Shipped", tone: "mint", tip: "Truck left with the BOL. Eligible for invoice." },
  cancelled: { label: "Cancelled", tone: "coral", tip: "Cancelled before shipment." },
};

const PALLET: Record<PalletStatus, { label: string; tone: TagTone; tip: string }> = {
  in_transit: { label: "In transit", tone: "neutral", tip: "Expected but not yet received." },
  received: {
    label: "Received",
    tone: "sky",
    tip: "On the dock — needs putaway to a rack location before it's pickable.",
  },
  stored: { label: "Stored", tone: "mint", tip: "In a rack location — pickable for outbound." },
  picked: {
    label: "Picked",
    tone: "primary",
    tip: "On the staging floor — picked but not shipped yet.",
  },
  shipped: { label: "Shipped", tone: "neutral", tip: "Left the warehouse." },
  damaged: { label: "Damaged", tone: "coral", tip: "Flagged as unsellable. Excluded from picks." },
};

const APPOINTMENT: Record<AppointmentStatus, { label: string; tone: TagTone; tip: string }> = {
  scheduled: { label: "Scheduled", tone: "sky", tip: "Truck appointment booked." },
  at_dock: { label: "At dock", tone: "primary", tip: "Truck has arrived and is at a door." },
  in_progress: { label: "In progress", tone: "primary", tip: "Loading or unloading is happening now." },
  completed: { label: "Completed", tone: "mint", tip: "Appointment finished." },
  cancelled: { label: "Cancelled", tone: "coral", tip: "Appointment cancelled." },
};

interface BaseProps {
  t?: Theme;
  /** Override the default label from the status map (rare). */
  labelOverride?: ReactNode;
}

export function InboundStatusBadge({
  status,
  t,
  labelOverride,
}: BaseProps & { status: InboundStatus | string }) {
  const m = INBOUND[status as InboundStatus] ?? {
    label: status,
    tone: "neutral" as TagTone,
    tip: "",
  };
  return (
    <Tag t={t} tone={m.tone} style={{ cursor: "help" }}>
      <span title={m.tip}>{labelOverride ?? m.label}</span>
    </Tag>
  );
}

export function OutboundStatusBadge({
  status,
  t,
  labelOverride,
}: BaseProps & { status: OutboundStatus | string }) {
  const m = OUTBOUND[status as OutboundStatus] ?? {
    label: status,
    tone: "neutral" as TagTone,
    tip: "",
  };
  return (
    <Tag t={t} tone={m.tone} style={{ cursor: "help" }}>
      <span title={m.tip}>{labelOverride ?? m.label}</span>
    </Tag>
  );
}

export function PalletStatusBadge({
  status,
  t,
  labelOverride,
}: BaseProps & { status: PalletStatus | string }) {
  const m = PALLET[status as PalletStatus] ?? {
    label: status,
    tone: "neutral" as TagTone,
    tip: "",
  };
  return (
    <Tag t={t} tone={m.tone} style={{ cursor: "help" }}>
      <span title={m.tip}>{labelOverride ?? m.label}</span>
    </Tag>
  );
}

export function AppointmentStatusBadge({
  status,
  t,
  labelOverride,
}: BaseProps & { status: AppointmentStatus | string }) {
  const m = APPOINTMENT[status as AppointmentStatus] ?? {
    label: status,
    tone: "neutral" as TagTone,
    tip: "",
  };
  return (
    <Tag t={t} tone={m.tone} style={{ cursor: "help" }}>
      <span title={m.tip}>{labelOverride ?? m.label}</span>
    </Tag>
  );
}
