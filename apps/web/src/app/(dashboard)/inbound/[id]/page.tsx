"use client";

import { use, useMemo, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { inboundStatusTone } from "~/lib/statusTone";
import { friendlyInboundStatus, nextInboundStep } from "~/lib/friendly";
import { NextStepCard } from "~/components/next-step-card";
import { useIsManager } from "~/lib/useRole";
import { toEaches, qtyUnitLabel } from "@wms/core";

export default function InboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = theme;
  const { id } = use(params);
  const utils = trpc.useUtils();
  const detail = trpc.inbound.byId.useQuery({ id });
  const invalidate = () => utils.inbound.byId.invalidate({ id });

  const closeOrder = trpc.inbound.close.useMutation({ onSuccess: invalidate });
  const cancelOrder = trpc.inbound.cancel.useMutation({ onSuccess: invalidate });
  const updateHeader = trpc.inbound.updateHeader.useMutation({ onSuccess: invalidate });
  const updateLine = trpc.inbound.updateLine.useMutation({ onSuccess: invalidate });
  const addLine = trpc.inbound.addLine.useMutation({ onSuccess: invalidate });
  const removeLine = trpc.inbound.removeLine.useMutation({ onSuccess: invalidate });

  const exportInbound = trpc.quickbooks.exportInbound.useMutation();
  const qbStatus = trpc.quickbooks.status.useQuery();

  // Reference data for edit-mode dropdowns.
  const order = detail.data?.order;
  const lines = detail.data?.lines ?? [];
  const suppliers = trpc.supplier.search.useQuery({ q: "", limit: 100 });
  const customers = trpc.customer.search.useQuery({ q: "", limit: 100 });
  const products = trpc.product.search.useQuery({ q: "", limit: 200 });
  const locations = trpc.location.listByWarehouse.useQuery(
    { warehouseId: order?.warehouseId ?? "" },
    { enabled: !!order?.warehouseId },
  );
  const receivingCandidates = useMemo(
    () => (locations.data ?? []).filter((l) => l.type === "dock" || l.type === "staging"),
    [locations.data],
  );

  const [closeReason, setCloseReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [editing, setEditing] = useState(false);

  // Edit state — initialised from the current order when editing begins.
  const [draft, setDraft] = useState({
    reference: "",
    supplier: "",
    supplierId: "",
    customerId: "",
    receivingLocationId: "",
    expectedAt: "",
  });
  function beginEdit() {
    if (!order) return;
    setDraft({
      reference: order.reference,
      supplier: order.supplier ?? "",
      supplierId: order.supplierId ?? "",
      customerId: order.customerId ?? "",
      receivingLocationId: order.receivingLocationId ?? "",
      expectedAt: order.expectedAt ? order.expectedAt.toISOString().slice(0, 10) : "",
    });
    setEditing(true);
  }
  function saveHeader() {
    if (!order) return;
    updateHeader.mutate(
      {
        id,
        reference: draft.reference !== order.reference ? draft.reference : undefined,
        supplier: draft.supplier !== (order.supplier ?? "") ? (draft.supplier || null) : undefined,
        supplierId:
          draft.supplierId !== (order.supplierId ?? "")
            ? (draft.supplierId || null)
            : undefined,
        customerId:
          draft.customerId !== (order.customerId ?? "")
            ? (draft.customerId || null)
            : undefined,
        receivingLocationId:
          draft.receivingLocationId !== (order.receivingLocationId ?? "")
            ? (draft.receivingLocationId || null)
            : undefined,
        expectedAt:
          draft.expectedAt !==
          (order.expectedAt ? order.expectedAt.toISOString().slice(0, 10) : "")
            ? (draft.expectedAt ? new Date(draft.expectedAt) : null)
            : undefined,
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  // "Add line" picker inside edit mode.
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);

  const hasShort = lines.some(
    (l) =>
      l.qtyReceived <
      toEaches(l.qtyExpected, l.qtyUnit, {
        unitsPerCase: l.unitsPerCase,
        casesPerPallet: l.casesPerPallet,
      }),
  );
  const status = order?.status ?? "…";
  const isTerminal = status === "closed" || status === "cancelled";
  const isManager = useIsManager();
  // Operators can see everything but can't edit header / cancel / add
  // or remove lines. Manager+ gets the full toolbox.
  const canEdit = !isTerminal && isManager;

  const productName = (productId: string) => {
    const p = products.data?.find((x) => x.id === productId);
    return p ? (p.sku ? `${p.sku} — ${p.name}` : p.name) : productId.slice(0, 8);
  };

  return (
    <div>
      <PageTitle
        eyebrow={order?.reference ? `Ref ${order.reference}` : "Inbound"}
        title={`Inbound ${id.slice(0, 8)}`}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Tag t={t} tone={inboundStatusTone(status)}>
              {friendlyInboundStatus(status)}
            </Tag>
            {canEdit && !editing && (
              <Btn t={t} variant="secondary" size="sm" icon={Ic.Settings} onClick={beginEdit}>
                Edit
              </Btn>
            )}
            {editing && (
              <>
                <Btn
                  t={t}
                  variant="secondary"
                  size="sm"
                  icon={Ic.X}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Btn>
                <Btn
                  t={t}
                  variant="primary"
                  size="sm"
                  icon={Ic.Check}
                  disabled={updateHeader.isPending}
                  onClick={saveHeader}
                >
                  {updateHeader.isPending ? "Saving…" : "Save"}
                </Btn>
              </>
            )}
          </div>
        }
      />

      {/* Next-step card — only when not editing and when there's actually
          something to do. Gives someone with basic warehouse training a
          clear action label instead of staring at five buttons. */}
      {!editing && order && (() => {
        const step = nextInboundStep(status, hasShort);
        if (!step) return null;
        return (
          <div style={{ marginBottom: 16 }}>
            <NextStepCard step={step}>
              {(status === "receiving" || status === "open") && (
                <>
                  <Btn
                    t={t}
                    variant="accent"
                    size="md"
                    icon={Ic.Check}
                    disabled={closeOrder.isPending || (hasShort && !closeReason.trim())}
                    onClick={() =>
                      closeOrder.mutate({ id, closeReason: closeReason.trim() || undefined })
                    }
                  >
                    {closeOrder.isPending ? "Closing…" : step.label}
                  </Btn>
                  {hasShort && (
                    <TextField
                      t={t}
                      placeholder="Short-close reason (required)"
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      style={{ minWidth: 260, flex: 1 }}
                    />
                  )}
                  {closeOrder.error && (
                    <span style={{ fontSize: 12, color: t.coral }}>
                      {closeOrder.error.message}
                    </span>
                  )}
                </>
              )}
            </NextStepCard>
          </div>
        );
      })()}

      {/* Header card */}
      <Card t={t}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <EditField label="Order number">
                <TextField
                  t={t}
                  value={draft.reference}
                  onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                />
              </EditField>
              <EditField label="Expected on">
                <TextField
                  t={t}
                  type="date"
                  value={draft.expectedAt}
                  onChange={(e) => setDraft({ ...draft, expectedAt: e.target.value })}
                />
              </EditField>
              <EditField label="Receiving location">
                <Select
                  value={draft.receivingLocationId}
                  onChange={(e) => setDraft({ ...draft, receivingLocationId: e.target.value })}
                >
                  <option value="">— none —</option>
                  {receivingCandidates.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} ({l.type})
                    </option>
                  ))}
                </Select>
              </EditField>
            </div>
            <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <EditField label="Supplier">
                <Select
                  value={draft.supplierId}
                  onChange={(e) => setDraft({ ...draft, supplierId: e.target.value })}
                >
                  <option value="">— none —</option>
                  {suppliers.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </EditField>
              <EditField label="Customer (3PL client)">
                <Select
                  value={draft.customerId}
                  onChange={(e) => setDraft({ ...draft, customerId: e.target.value })}
                >
                  <option value="">— none —</option>
                  {customers.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </EditField>
            </div>
            <EditField label="Supplier (free text)">
              <TextField
                t={t}
                value={draft.supplier}
                onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                placeholder="Only used if no supplier is linked above"
              />
            </EditField>
            {updateHeader.error && (
              <div style={{ fontSize: 12, color: t.coral }}>{updateHeader.error.message}</div>
            )}
          </div>
        ) : (
          <HeaderReadout t={t} order={order} receivingCandidates={receivingCandidates} />
        )}
      </Card>

      {/* Lines table */}
      <div style={{ marginTop: 16 }}>
        <Card t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: editing
                ? "60px 1.4fr 100px 120px 140px 32px"
                : "60px 1.4fr 100px 120px 140px",
              gap: 16,
              padding: "14px 20px",
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            <div>Line</div>
            <div>Product</div>
            <div>Expected</div>
            <div>Received</div>
            <div>Variance</div>
            {editing && <div />}
          </div>

          {lines.map((l, i) => {
            const expectedEaches = toEaches(l.qtyExpected, l.qtyUnit, {
              unitsPerCase: l.unitsPerCase,
              casesPerPallet: l.casesPerPallet,
            });
            const v = l.qtyReceived - expectedEaches;
            return (
              <div
                key={l.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: editing
                    ? "60px 1.4fr 100px 120px 140px 32px"
                    : "60px 1.4fr 100px 120px 140px",
                  gap: 16,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: `1.5px dashed ${t.border}`,
                }}
              >
                <span style={{ color: t.muted, fontFamily: FONTS.mono, fontSize: 12 }}>
                  #{i + 1}
                </span>
                <span style={{ fontSize: 13, color: t.body }}>{productName(l.productId)}</span>
                <span>
                  {editing ? (
                    <InlineQtyEditor
                      initial={l.qtyExpected}
                      onCommit={(next) =>
                        updateLine.mutate({ lineId: l.id, qtyExpected: next })
                      }
                    />
                  ) : (
                    <span style={{ display: "inline-flex", flexDirection: "column" }}>
                      <span
                        style={{
                          fontFamily: FONTS.mono,
                          color: t.ink,
                          fontWeight: 600,
                        }}
                      >
                        {l.qtyExpected} {qtyUnitLabel(l.qtyUnit, l.qtyExpected !== 1)}
                      </span>
                      {l.qtyUnit !== "each" && (
                        <span style={{ fontSize: 11, color: t.muted }}>
                          = {expectedEaches} items
                        </span>
                      )}
                    </span>
                  )}
                </span>
                <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                  {l.qtyReceived}
                </span>
                <span>
                  {v === 0 ? (
                    <Tag t={t} tone="mint">
                      on target
                    </Tag>
                  ) : v < 0 ? (
                    <Tag t={t} tone="coral">
                      short {v}
                    </Tag>
                  ) : (
                    <Tag t={t} tone="sky">
                      over +{v}
                    </Tag>
                  )}
                </span>
                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      if (l.qtyReceived > 0) {
                        alert("Line has received qty; can't remove without returning stock first.");
                        return;
                      }
                      if (confirm("Remove this line?")) removeLine.mutate({ lineId: l.id });
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1.5px solid ${t.border}`,
                      background: "transparent",
                      color: t.muted,
                      cursor: "pointer",
                    }}
                    aria-label="Remove line"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {editing && canEdit && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 140px",
                gap: 12,
                padding: "14px 20px",
                borderTop: `1.5px dashed ${t.border}`,
                background: t.surfaceAlt,
                alignItems: "center",
              }}
            >
              <Select
                value={addProductId}
                onChange={(e) => setAddProductId(e.target.value)}
              >
                <option value="">Add a product…</option>
                {products.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku ? `${p.sku} — ${p.name}` : p.name}
                  </option>
                ))}
              </Select>
              <TextField
                t={t}
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(Number(e.target.value))}
                style={{ width: 100 }}
              />
              <Btn
                t={t}
                variant="primary"
                size="sm"
                icon={Ic.Plus}
                disabled={!addProductId || addQty < 1 || addLine.isPending}
                onClick={() =>
                  addLine.mutate(
                    {
                      inboundOrderId: id,
                      productId: addProductId,
                      qtyExpected: addQty,
                    },
                    {
                      onSuccess: () => {
                        setAddProductId("");
                        setAddQty(1);
                      },
                    },
                  )
                }
              >
                {addLine.isPending ? "Adding…" : "Add line"}
              </Btn>
            </div>
          )}

          {lines.length === 0 && !editing && (
            <div
              style={{
                padding: "24px 20px",
                borderTop: `1.5px dashed ${t.border}`,
                color: t.muted,
                fontSize: 13,
              }}
            >
              No lines on this order.
            </div>
          )}
        </Card>
      </div>

      {!isTerminal && !editing && isManager && (
        <div data-collapse-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <Card t={t}>
            <div style={{ fontWeight: 600, color: t.ink, marginBottom: 8 }}>Close order</div>
            {hasShort && (
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  color: t.coral,
                  background: t.coralSoft,
                  padding: "6px 10px",
                  borderRadius: 8,
                }}
              >
                Under-received — a reason is required to short-close.
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <TextField
                t={t}
                placeholder={hasShort ? "Short-close reason (required)" : "Reason (optional)"}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                style={{ flex: 1 }}
              />
              <Btn
                t={t}
                variant="primary"
                size="md"
                icon={Ic.Check}
                disabled={closeOrder.isPending || (hasShort && !closeReason.trim())}
                onClick={() =>
                  closeOrder.mutate({ id, closeReason: closeReason.trim() || undefined })
                }
              >
                {closeOrder.isPending ? "Closing…" : "Close"}
              </Btn>
            </div>
            {closeOrder.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
                {closeOrder.error.message}
              </div>
            )}
          </Card>

          <Card t={t}>
            <div style={{ fontWeight: 600, color: t.ink, marginBottom: 8 }}>Cancel order</div>
            <div style={{ display: "flex", gap: 8 }}>
              <TextField
                t={t}
                placeholder="Cancel reason (required)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ flex: 1 }}
              />
              <Btn
                t={t}
                variant="danger"
                size="md"
                icon={Ic.X}
                disabled={cancelOrder.isPending || !cancelReason.trim()}
                onClick={() => cancelOrder.mutate({ id, reason: cancelReason.trim() })}
              >
                {cancelOrder.isPending ? "Cancelling…" : "Cancel"}
              </Btn>
            </div>
            {cancelOrder.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
                {cancelOrder.error.message}
              </div>
            )}
          </Card>
        </div>
      )}

      {isTerminal && order?.closeReason && (
        <div style={{ marginTop: 16 }}>
          <Card t={t} tint="coral">
            <div
              style={{
                fontSize: 11,
                color: t.muted,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontWeight: 600,
              }}
            >
              Reason
            </div>
            <div style={{ color: t.ink, marginTop: 4 }}>{order.closeReason}</div>
          </Card>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <a
              href={`/api/inbound-orders/${id}/receipt.pdf`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
            >
              <Btn t={t} variant="secondary" size="md" icon={Ic.Download}>
                Receipt (for driver)
              </Btn>
            </a>
            <a
              href={`/api/inbound-orders/${id}/report.pdf`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
            >
              <Btn t={t} variant="secondary" size="md" icon={Ic.Download}>
                Order report (for records)
              </Btn>
            </a>
            <Btn
              t={t}
              variant="secondary"
              size="md"
              icon={Ic.Download}
              disabled={!qbStatus.data?.connected || exportInbound.isPending || status !== "closed"}
              onClick={() => exportInbound.mutate({ inboundOrderId: id })}
            >
              {exportInbound.isPending ? "Exporting…" : "Export to QuickBooks"}
            </Btn>
            {exportInbound.data && (
              <Tag t={t} tone="mint">
                Exported as Bill {exportInbound.data.qboId}
              </Tag>
            )}
            {exportInbound.error && (
              <span style={{ fontSize: 12, color: t.coral }}>{exportInbound.error.message}</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HeaderReadout({
  t,
  order,
  receivingCandidates,
}: {
  t: typeof theme;
  order:
    | {
        reference: string;
        supplier: string | null;
        supplierId: string | null;
        customerId: string | null;
        receivingLocationId: string | null;
        expectedAt: Date | null;
      }
    | undefined;
  receivingCandidates: Array<{ id: string; code: string; type: string }>;
}) {
  if (!order) return <div style={{ color: t.muted }}>Loading…</div>;
  const locLabel = order.receivingLocationId
    ? receivingCandidates.find((l) => l.id === order.receivingLocationId)?.code ?? "—"
    : "—";
  return (
    <div
      data-collapse-grid
      style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}
    >
      <Stat label="Reference">
        <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>
          {order.reference}
        </span>
      </Stat>
      <Stat label="Expected">
        <span style={{ fontFamily: FONTS.mono, color: t.ink }}>
          {order.expectedAt?.toLocaleDateString() ?? "—"}
        </span>
      </Stat>
      <Stat label="Receiving location">
        <span style={{ fontFamily: FONTS.mono, color: t.ink }}>{locLabel}</span>
      </Stat>
      <Stat label="Supplier">
        <span style={{ color: t.ink }}>{order.supplier ?? "—"}</span>
      </Stat>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          color: theme.muted,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  style,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      style={{
        padding: "9px 14px",
        borderRadius: 12,
        background: theme.surfaceAlt,
        border: `1.5px solid ${theme.border}`,
        outline: "none",
        fontFamily: FONTS.sans,
        fontSize: 13.5,
        color: theme.ink,
        cursor: "pointer",
        ...(style || {}),
      }}
    />
  );
}

/**
 * Inline editor for a line's qtyExpected. Type a number, press Enter
 * (or blur) to commit via the tRPC mutation. Escape reverts.
 */
function InlineQtyEditor({
  initial,
  onCommit,
}: {
  initial: number;
  onCommit: (next: number) => void;
}) {
  const [v, setV] = useState(String(initial));
  return (
    <input
      type="number"
      min={1}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(String(initial));
      }}
      onBlur={() => {
        const n = Number.parseInt(v, 10);
        if (Number.isFinite(n) && n > 0 && n !== initial) onCommit(n);
        else setV(String(initial));
      }}
      style={{
        width: 80,
        padding: "6px 8px",
        borderRadius: 8,
        border: `1.5px solid ${theme.border}`,
        background: theme.surface,
        fontFamily: FONTS.mono,
        fontSize: 13,
        color: theme.ink,
      }}
    />
  );
}
