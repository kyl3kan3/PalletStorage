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
  const utils = trpc.useUtils();

  const warehouses = trpc.warehouse.list.useQuery();
  const suppliers = trpc.supplier.list.useQuery();
  const customers = trpc.customer.list.useQuery();
  const inboundList = trpc.inbound.list.useQuery({});
  const outboundList = trpc.outbound.list.useQuery({});

  // Inline "+ Add new" state — lets the operator create a supplier or
  // customer without leaving the schedule form. Just the name; the
  // full profile can be filled in later on the entity detail page.
  const [adding, setAdding] = useState<null | "supplier" | "customer">(null);
  const [addName, setAddName] = useState("");

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

  const createSupplier = trpc.supplier.create.useMutation({
    onSuccess: (row) => {
      utils.supplier.list.invalidate();
      if (row) setSupplierId(row.id);
      setAdding(null);
      setAddName("");
    },
  });
  const createCustomer = trpc.customer.create.useMutation({
    onSuccess: (row) => {
      utils.customer.list.invalidate();
      if (row) setCustomerId(row.id);
      setAdding(null);
      setAddName("");
    },
  });
  function saveNew() {
    const name = addName.trim();
    if (!name) return;
    if (adding === "supplier") createSupplier.mutate({ name });
    else if (adding === "customer") createCustomer.mutate({ name });
  }

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
            <Field
              label="Supplier (sender)"
              hint="Who's putting the freight on the truck — the vendor / shipper / 'from' on the BOL. Pick the company whose name is on the paperwork, or add a new one. Optional: leave blank if you don't know yet, fill it in when the truck arrives."
            >
              {adding === "supplier" ? (
                <InlineAdd
                  t={t}
                  placeholder="Supplier name"
                  value={addName}
                  pending={createSupplier.isPending}
                  error={createSupplier.error?.message}
                  onChange={setAddName}
                  onSave={saveNew}
                  onCancel={() => {
                    setAdding(null);
                    setAddName("");
                  }}
                />
              ) : (
                <>
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
                  <button
                    type="button"
                    onClick={() => {
                      setAdding("supplier");
                      setAddName("");
                    }}
                    style={addLinkStyle(t)}
                  >
                    + Add a new supplier
                  </button>
                </>
              )}
            </Field>
          ) : (
            <Field
              label="Customer (3PL client)"
              hint="The 3PL client whose pallets are being picked up. Pick the company or add a new one. Optional now — you can fill it in when the truck arrives."
            >
              {adding === "customer" ? (
                <InlineAdd
                  t={t}
                  placeholder="Customer name"
                  value={addName}
                  pending={createCustomer.isPending}
                  error={createCustomer.error?.message}
                  onChange={setAddName}
                  onSave={saveNew}
                  onCancel={() => {
                    setAdding(null);
                    setAddName("");
                  }}
                />
              ) : (
                <>
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
                  <button
                    type="button"
                    onClick={() => {
                      setAdding("customer");
                      setAddName("");
                    }}
                    style={addLinkStyle(t)}
                  >
                    + Add a new customer
                  </button>
                </>
              )}
            </Field>
          )}
          <Field
            label={type === "inbound" ? "Link to inbound order" : "Link to outbound order"}
            hint={
              type === "inbound"
                ? "Optional. If you've already created the inbound order for this PO/BOL (via /inbound or 'Import from doc'), link it here. When the truck checks in, the door you assign will automatically attach to that order. Leave blank if the truck shows up unannounced — you can create the inbound after the fact."
                : "Optional. If the customer's outbound order already exists in the system, link it. When you check the truck in, the assigned door propagates to that order so the load-out flow knows where to stage."
            }
          >
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
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
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
      {hint && (
        <span style={{ fontSize: 11, color: theme.muted, lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
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

function addLinkStyle(t: typeof theme): React.CSSProperties {
  return {
    alignSelf: "flex-start",
    background: "transparent",
    border: "none",
    padding: "2px 0",
    color: t.primaryDeep,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: FONTS.sans,
  };
}

function InlineAdd({
  t,
  placeholder,
  value,
  pending,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  t: typeof theme;
  placeholder: string;
  value: string;
  pending: boolean;
  error?: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 12,
            background: t.surfaceAlt,
            border: `1.5px solid ${t.border}`,
            fontSize: 13,
            color: t.ink,
            fontFamily: FONTS.sans,
          }}
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!value.trim() || pending}
          style={{
            padding: "9px 14px",
            borderRadius: 12,
            background: t.primary,
            color: t.primaryText,
            border: `1.5px solid ${t.primaryDeep}`,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: FONTS.sans,
            cursor: pending ? "progress" : "pointer",
          }}
        >
          {pending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "9px 14px",
            borderRadius: 12,
            background: "transparent",
            color: t.muted,
            border: `1.5px solid ${t.border}`,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: FONTS.sans,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <span style={{ fontSize: 11.5, color: t.coral }}>{error}</span>
      )}
    </div>
  );
}
