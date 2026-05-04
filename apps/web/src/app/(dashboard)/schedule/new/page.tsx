"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";

/**
 * Schedule a truck. Two main shapes — inbound delivery or outbound
 * pickup. The form picks one, then captures the basics: when, who's
 * driving, and (optionally) which existing order this truck is for.
 *
 * Pre-linking to an order is handy because checking the truck in on
 * the schedule page automatically assigns the door to that order's
 * receiving / shipping location.
 */
export default function NewAppointmentPage() {
  const t = theme;
  const router = useRouter();

  const warehouses = trpc.warehouse.list.useQuery();
  const suppliers = trpc.supplier.list.useQuery();
  const customers = trpc.customer.list.useQuery();
  const inboundList = trpc.inbound.list.useQuery({});
  const outboundList = trpc.outbound.list.useQuery({});

  const [type, setType] = useState<"inbound" | "outbound">("inbound");
  const [warehouseId, setWarehouseId] = useState("");
  // ISO local datetime. Default to "this hour, today".
  const defaultDateTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [carrier, setCarrier] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [reference, setReference] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [linkedOrderId, setLinkedOrderId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!warehouseId && warehouses.data && warehouses.data.length === 1) {
      setWarehouseId(warehouses.data[0]!.id);
    }
  }, [warehouses.data, warehouseId]);

  const schedule = trpc.appointment.schedule.useMutation({
    onSuccess: () => router.push("/schedule" as Route),
  });

  function submit() {
    schedule.mutate({
      warehouseId,
      type,
      scheduledAt: new Date(scheduledAt),
      carrier: carrier.trim() || undefined,
      driverName: driverName.trim() || undefined,
      driverPhone: driverPhone.trim() || undefined,
      reference: reference.trim() || undefined,
      supplierId: type === "inbound" && supplierId ? supplierId : undefined,
      customerId: type === "outbound" && customerId ? customerId : undefined,
      inboundOrderId:
        type === "inbound" && linkedOrderId ? linkedOrderId : undefined,
      outboundOrderId:
        type === "outbound" && linkedOrderId ? linkedOrderId : undefined,
      notes: notes.trim() || undefined,
    });
  }

  const orderOptions =
    type === "inbound" ? inboundList.data ?? [] : outboundList.data ?? [];

  return (
    <div>
      <BackLink href={"/schedule" as Route} label="Back to schedule" />
      <PageTitle
        eyebrow="Dock board"
        title="Schedule a truck"
        subtitle="A truck called and you need to put them on the calendar. Pick the basics; you can edit later."
      />

      <Card t={t}>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {(["inbound", "outbound"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setType(opt);
                setLinkedOrderId("");
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                background: type === opt ? t.primary : t.surfaceAlt,
                color: type === opt ? t.primaryText : t.body,
                border: `1.5px solid ${type === opt ? t.primaryDeep : t.border}`,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONTS.sans,
              }}
            >
              {opt === "inbound" ? "Inbound delivery" : "Outbound pickup"}
            </button>
          ))}
        </div>

        <div
          data-collapse-grid
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <Field label="Warehouse" required>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              style={selectStyle(t)}
            >
              <option value="">— select —</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scheduled at" required>
            <TextField
              t={t}
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </Field>
          <Field label="Carrier">
            <TextField
              t={t}
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="ABC Logistics"
            />
          </Field>
          <Field label="Reference (PO / BOL #)">
            <TextField
              t={t}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PO-12345"
            />
          </Field>
          <Field label="Driver name">
            <TextField
              t={t}
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
            />
          </Field>
          <Field label="Driver phone">
            <TextField
              t={t}
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              placeholder="555-555-1212"
            />
          </Field>
          {type === "inbound" ? (
            <Field label="Supplier (sender)">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                style={selectStyle(t)}
              >
                <option value="">—</option>
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Customer (3PL client)">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                style={selectStyle(t)}
              >
                <option value="">—</option>
                {customers.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={type === "inbound" ? "Link to inbound order" : "Link to outbound order"}>
            <select
              value={linkedOrderId}
              onChange={(e) => setLinkedOrderId(e.target.value)}
              style={selectStyle(t)}
            >
              <option value="">— optional —</option>
              {orderOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.reference}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 12 }}>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything the dock crew should know"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 12,
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                fontSize: 13,
                color: t.ink,
                fontFamily: FONTS.sans,
                resize: "vertical",
              }}
            />
          </Field>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <Btn
            t={t}
            type="button"
            variant="accent"
            size="md"
            icon={Ic.Check}
            disabled={!warehouseId || !scheduledAt || schedule.isPending}
            onClick={submit}
          >
            {schedule.isPending ? "Scheduling…" : "Schedule"}
          </Btn>
          {schedule.error && (
            <span style={{ fontSize: 12, color: t.coral }}>
              {schedule.error.message}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: 600,
        }}
      >
        {label}
        {required && <span style={{ color: theme.coral }}> *</span>}
      </span>
      {children}
    </label>
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
