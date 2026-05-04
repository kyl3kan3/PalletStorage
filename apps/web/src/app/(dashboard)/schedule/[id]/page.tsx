"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";
import { useIsManager } from "~/lib/useRole";

/**
 * Detail view for a single dock appointment. Manager-gated actions:
 * check the truck in (mark at-dock + assign door), reassign the door,
 * complete, or cancel. Door assignment propagates to the linked
 * inbound / outbound order so the receive / ship flow knows which
 * door to use.
 */
export default function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = theme;
  const { id } = use(params);
  const isManager = useIsManager();
  const utils = trpc.useUtils();

  const q = trpc.appointment.byId.useQuery({ id });
  const a = q.data;

  const docks = trpc.location.listByWarehouse.useQuery(
    { warehouseId: a?.warehouseId ?? "" },
    { enabled: !!a?.warehouseId },
  );
  const dockOptions = (docks.data ?? []).filter((l) => l.type === "dock");

  const [doorChoice, setDoorChoice] = useState<string>("");

  const checkIn = trpc.appointment.checkIn.useMutation({
    onSuccess: () => utils.appointment.byId.invalidate({ id }),
  });
  const assignDoor = trpc.appointment.assignDoor.useMutation({
    onSuccess: () => utils.appointment.byId.invalidate({ id }),
  });
  const complete = trpc.appointment.complete.useMutation({
    onSuccess: () => utils.appointment.byId.invalidate({ id }),
  });
  const cancel = trpc.appointment.cancel.useMutation({
    onSuccess: () => utils.appointment.byId.invalidate({ id }),
  });

  if (!a) {
    return <div style={{ color: t.muted }}>Loading…</div>;
  }

  const time = new Date(a.scheduledAt).toLocaleString();

  return (
    <div>
      <BackLink href={"/schedule" as Route} label="Back to schedule" />
      <PageTitle
        eyebrow={a.type === "inbound" ? "Inbound delivery" : "Outbound pickup"}
        title={a.reference ?? a.carrier ?? "Truck"}
        subtitle={time}
        right={
          <StatusTag t={t} status={a.status} />
        }
      />

      <div
        data-collapse-grid
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <Card t={t}>
          <SectionLabel>Truck</SectionLabel>
          <Field label="Carrier" value={a.carrier ?? "—"} />
          <Field label="Driver" value={a.driverName ?? "—"} />
          <Field label="Phone" value={a.driverPhone ?? "—"} mono />
          <Field label="Reference" value={a.reference ?? "—"} mono />
        </Card>

        <Card t={t}>
          <SectionLabel>Door assignment</SectionLabel>
          {a.dockLocationId ? (
            <div style={{ marginBottom: 10 }}>
              <Tag t={t} tone="primary">
                Assigned
              </Tag>
              <span style={{ marginLeft: 8, fontFamily: FONTS.mono, color: t.body }}>
                {dockOptions.find((d) => d.id === a.dockLocationId)?.code ??
                  a.dockLocationId.slice(0, 8)}
              </span>
            </div>
          ) : (
            <div style={{ marginBottom: 10, fontSize: 12, color: t.muted }}>
              No door assigned yet.
            </div>
          )}
          {isManager && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={doorChoice}
                onChange={(e) => setDoorChoice(e.target.value)}
                style={selectStyle(t)}
              >
                <option value="">— pick a door —</option>
                {dockOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
                  </option>
                ))}
              </select>
              <Btn
                t={t}
                type="button"
                variant="primary"
                size="sm"
                icon={Ic.Check}
                disabled={!doorChoice || assignDoor.isPending}
                onClick={() =>
                  assignDoor.mutate({ id, dockLocationId: doorChoice })
                }
              >
                {assignDoor.isPending ? "Assigning…" : a.dockLocationId ? "Reassign" : "Assign"}
              </Btn>
            </div>
          )}
          {dockOptions.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: t.muted }}>
              No dock-type locations configured for this warehouse. Add some at /catalog/locations.
            </div>
          )}
        </Card>

        <Card t={t}>
          <SectionLabel>Linked order</SectionLabel>
          {a.inboundOrderId ? (
            <Link
              href={`/inbound/${a.inboundOrderId}` as Route}
              style={{ color: t.primaryDeep, fontWeight: 600 }}
            >
              Open inbound order →
            </Link>
          ) : a.outboundOrderId ? (
            <Link
              href={`/outbound/${a.outboundOrderId}` as Route}
              style={{ color: t.primaryDeep, fontWeight: 600 }}
            >
              Open outbound order →
            </Link>
          ) : (
            <div style={{ fontSize: 12.5, color: t.muted }}>
              No order linked. Edit this appointment to attach one — or just
              create a new {a.type === "inbound" ? "inbound" : "outbound"} order
              when the paperwork comes in.
            </div>
          )}
        </Card>

        <Card t={t}>
          <SectionLabel>Notes</SectionLabel>
          <div style={{ fontSize: 13, color: t.body, whiteSpace: "pre-wrap" }}>
            {a.notes ?? "—"}
          </div>
        </Card>
      </div>

      {isManager && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {a.status === "scheduled" && (
            <Btn
              t={t}
              type="button"
              variant="primary"
              size="md"
              icon={Ic.Check}
              disabled={checkIn.isPending}
              onClick={() => checkIn.mutate({ id })}
            >
              Check in
            </Btn>
          )}
          {(a.status === "at_dock" || a.status === "in_progress") && (
            <Btn
              t={t}
              type="button"
              variant="primary"
              size="md"
              icon={Ic.Check}
              disabled={complete.isPending}
              onClick={() => complete.mutate({ id })}
            >
              Mark complete
            </Btn>
          )}
          {a.status !== "completed" && a.status !== "cancelled" && (
            <Btn
              t={t}
              type="button"
              variant="secondary"
              size="md"
              icon={Ic.X}
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ id })}
            >
              Cancel appointment
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = theme;
  return (
    <div
      style={{
        fontSize: 11,
        color: t.muted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        fontWeight: 600,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const t = theme;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: t.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: t.ink,
          marginTop: 2,
          fontFamily: mono ? FONTS.mono : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusTag({
  t,
  status,
}: {
  t: typeof theme;
  status: string;
}) {
  const tone =
    status === "scheduled"
      ? "neutral"
      : status === "at_dock"
        ? "primary"
        : status === "in_progress"
          ? "primary"
          : status === "completed"
            ? "mint"
            : "coral";
  const label =
    status === "at_dock"
      ? "at dock"
      : status === "in_progress"
        ? "in progress"
        : status;
  return (
    <Tag t={t} tone={tone as "neutral" | "primary" | "mint" | "coral"}>
      {label}
    </Tag>
  );
}

function selectStyle(t: typeof theme): React.CSSProperties {
  return {
    padding: "9px 12px",
    borderRadius: 12,
    background: t.surfaceAlt,
    border: `1.5px solid ${t.border}`,
    fontSize: 13,
    color: t.ink,
    fontFamily: FONTS.sans,
    cursor: "pointer",
  };
}
