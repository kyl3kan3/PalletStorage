"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { useIsManager } from "~/lib/useRole";
import {
  BillPreviewModal,
  type BillPreviewInput,
} from "~/components/bill-preview-modal";

type StorageBasis = "peak" | "average" | "pallet_days";

type RowOverrides = {
  storageBasis: StorageBasis;
  storageRateDollars: string; // user-entered, blank => use saved
  receiveRateDollars: string;
  shipRateDollars: string;
  extraLines: Array<{ description: string; amountDollars: string }>;
  memo: string;
  dueInDays: string;
};

const PRESETS: Array<{
  key: string;
  label: string;
  range: () => { from: Date; to: Date; isLive: boolean };
}> = [
  {
    key: "mtd",
    label: "This month",
    range: () => {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from, to: now, isLive: true };
    },
  },
  {
    key: "last-month",
    label: "Last month",
    range: () => {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      return { from, to, isLive: false };
    },
  },
  {
    key: "qtd",
    label: "This quarter",
    range: () => {
      const now = new Date();
      const q = Math.floor(now.getUTCMonth() / 3);
      const from = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
      return { from, to: now, isLive: true };
    },
  },
  {
    key: "ytd",
    label: "Year to date",
    range: () => {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return { from, to: now, isLive: true };
    },
  },
  {
    key: "last-7",
    label: "Last 7 days",
    range: () => {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 86_400_000);
      return { from, to: now, isLive: true };
    },
  },
];

export default function BillingReportPage() {
  const t = theme;
  const isManager = useIsManager();
  const [presetKey, setPresetKey] = useState<string>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [globalBasis, setGlobalBasis] = useState<StorageBasis>("peak");

  const { from, to, isLive } = useMemo(() => {
    if (presetKey === "custom" && customFrom && customTo) {
      const f = new Date(`${customFrom}T00:00:00Z`);
      const tt = new Date(`${customTo}T23:59:59.999Z`);
      return { from: f, to: tt, isLive: false };
    }
    const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0]!;
    return preset.range();
  }, [presetKey, customFrom, customTo]);

  const billing = trpc.report.customerBilling.useQuery({
    from,
    to,
    storageBasis: globalBasis,
  });
  const utils = trpc.useUtils();
  const exportToQb = trpc.report.exportCustomerBillToQuickbooks.useMutation({
    onSuccess: () => utils.report.customerBilling.invalidate(),
  });
  const [exportedFor, setExportedFor] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RowOverrides>>({});
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null);
  const [downloadErr, setDownloadErr] = useState<string | null>(null);
  // Currently-previewing row. Holds enough to render the bill modal +
  // re-route Download/Push actions back through the existing flow.
  const [previewing, setPreviewing] = useState<{
    customerId: string;
    customerName: string;
  } | null>(null);

  function basisDisplay(row: { peakCount: number; averageCount: number; palletDays: number }, basis: StorageBasis) {
    if (basis === "peak") return `${row.peakCount}`;
    if (basis === "average") return row.averageCount.toFixed(2);
    return row.palletDays.toFixed(2);
  }

  function getRowOverrides(customerId: string): RowOverrides {
    return (
      overrides[customerId] ?? {
        storageBasis: globalBasis,
        storageRateDollars: "",
        receiveRateDollars: "",
        shipRateDollars: "",
        extraLines: [],
        memo: "",
        dueInDays: "",
      }
    );
  }

  function patchRowOverrides(customerId: string, patch: Partial<RowOverrides>) {
    setOverrides((prev) => ({
      ...prev,
      [customerId]: { ...getRowOverrides(customerId), ...patch },
    }));
  }

  function buildBillPayload(customerId: string) {
    const o = getRowOverrides(customerId);
    const dollarsToCents = (s: string): number | undefined => {
      const trimmed = s.trim();
      if (!trimmed) return undefined;
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return Math.round(n * 100);
    };
    const overridesPayload = {
      storageRateCentsPerPalletMonth: dollarsToCents(o.storageRateDollars),
      receiveRateCentsPerPallet: dollarsToCents(o.receiveRateDollars),
      shipRateCentsPerPallet: dollarsToCents(o.shipRateDollars),
    };
    const anyOverride = Object.values(overridesPayload).some(
      (v) => v !== undefined,
    );
    const extraLines = o.extraLines
      .map((l) => {
        const desc = l.description.trim();
        const trimmedAmt = l.amountDollars.trim();
        if (!desc || !trimmedAmt) return null;
        const n = Number(trimmedAmt);
        if (!Number.isFinite(n)) return null;
        return { description: desc, amountCents: Math.round(n * 100) };
      })
      .filter(
        (l): l is { description: string; amountCents: number } =>
          l !== null && l.amountCents !== 0,
      );
    const memo = o.memo.trim() || undefined;
    const dueRaw = o.dueInDays.trim();
    const dueInDays = dueRaw && Number.isFinite(Number(dueRaw))
      ? Math.max(0, Math.round(Number(dueRaw)))
      : undefined;
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      storageBasis: o.storageBasis,
      overrides: anyOverride ? overridesPayload : undefined,
      extraLines: extraLines.length > 0 ? extraLines : undefined,
      memo,
      dueInDays,
    };
  }

  async function downloadBill(customerId: string, customerName: string) {
    setDownloadingFor(customerId);
    setDownloadErr(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBillPayload(customerId)),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const period = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
      const safe = customerName.replace(/[^a-z0-9]/gi, "_");
      link.download = `bill-${safe}-${period}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadErr(e instanceof Error ? e.message : "Couldn't generate the bill.");
    } finally {
      setDownloadingFor(null);
    }
  }

  function pushToQb(customerId: string) {
    const payload = buildBillPayload(customerId);
    exportToQb.mutate(
      {
        customerId,
        from,
        to,
        storageBasis: payload.storageBasis,
        overrides: payload.overrides,
        extraLines: payload.extraLines,
        memo: payload.memo,
        dueInDays: payload.dueInDays,
      },
      {
        onSuccess: (res) =>
          setExportedFor((prev) => ({ ...prev, [customerId]: res.qboId })),
      },
    );
  }

  const totalRevenueCents = (billing.data?.rows ?? []).reduce(
    (n, r) => n + r.totalChargeCents,
    0,
  );

  return (
    <div>
      <PageTitle
        eyebrow="Customer statements"
        title="Customer billing"
        subtitle="Pick a date range and storage basis, customize per-bill rates and add ad-hoc charges, then download or push to QuickBooks."
      />

      <Card t={t}>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPresetKey(p.key)}
              style={chipStyle(t, presetKey === p.key)}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPresetKey("custom")}
            style={chipStyle(t, presetKey === "custom")}
          >
            Custom…
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          {presetKey === "custom" && (
            <>
              <FieldLabel label="From">
                <TextField
                  t={t}
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="To">
                <TextField
                  t={t}
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </FieldLabel>
            </>
          )}
          <FieldLabel label="Storage basis">
            <select
              value={globalBasis}
              onChange={(e) => setGlobalBasis(e.target.value as StorageBasis)}
              style={selectStyle(t)}
            >
              <option value="peak">Peak (max in period)</option>
              <option value="average">Average (time-weighted)</option>
              <option value="pallet_days">Pallet-days</option>
            </select>
          </FieldLabel>
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 13,
              color: t.muted,
              textAlign: "right",
            }}
          >
            <div>
              {from.toLocaleDateString()} – {to.toLocaleDateString()}
              {isLive && (
                <span style={{ marginLeft: 6, color: t.primaryDeep }}>
                  (live)
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 18,
                fontWeight: 700,
                color: t.ink,
                marginTop: 2,
              }}
            >
              {fmtCents(totalRevenueCents)} total
            </div>
          </div>
        </div>
      </Card>

      {downloadErr && (
        <div
          style={{
            marginTop: 12,
            background: t.coralSoft,
            color: t.coral,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          {downloadErr}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Card t={t} padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.6fr 70px 70px 80px 70px 70px 110px 90px 90px 110px 240px",
              gap: 10,
              padding: "12px 16px",
              fontSize: 10.5,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            <div>Customer</div>
            <div>Open</div>
            <div>Curr.</div>
            <div>{globalBasis === "peak" ? "Peak" : globalBasis === "average" ? "Avg" : "Plt-days"}</div>
            <div>In</div>
            <div>Out</div>
            <div>Storage&nbsp;$</div>
            <div>In&nbsp;$</div>
            <div>Out&nbsp;$</div>
            <div>Total&nbsp;$</div>
            <div>Actions</div>
          </div>
          {(billing.data?.rows ?? []).map((r) => {
            const exportedQboId = exportedFor[r.customerId];
            const isExpanded = expanded === r.customerId;
            const o = getRowOverrides(r.customerId);
            return (
              <div key={r.customerId}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1.6fr 70px 70px 80px 70px 70px 110px 90px 90px 110px 240px",
                    gap: 10,
                    padding: "12px 16px",
                    borderTop: `1.5px dashed ${t.border}`,
                    alignItems: "center",
                    background: isExpanded ? t.surfaceAlt : undefined,
                  }}
                >
                  <div>
                    <Link
                      href={`/customers/${r.customerId}` as Route}
                      style={{
                        color: t.ink,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {r.customerName}
                    </Link>
                    {!r.hasRates && (
                      <div style={{ marginTop: 2 }}>
                        <Tag t={t} tone="coral">
                          rates not set
                        </Tag>
                      </div>
                    )}
                  </div>
                  <Mono v={r.openingCount} t={t} />
                  <Mono v={r.currentCount} t={t} />
                  <MonoRaw t={t} highlight>
                    {basisDisplay(r, globalBasis)}
                  </MonoRaw>
                  <Mono v={r.receives} t={t} />
                  <Mono v={r.ships} t={t} />
                  <MonoCents v={r.storageChargeCents} t={t} />
                  <MonoCents v={r.receiveChargeCents} t={t} />
                  <MonoCents v={r.shipChargeCents} t={t} />
                  <MonoCents v={r.totalChargeCents} t={t} highlight />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Btn
                      t={t}
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={isExpanded ? Ic.X : Ic.Settings}
                      onClick={() =>
                        setExpanded(isExpanded ? null : r.customerId)
                      }
                    >
                      {isExpanded ? "Close" : "Customize"}
                    </Btn>
                    <Btn
                      t={t}
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={Ic.Eye}
                      onClick={() =>
                        setPreviewing({
                          customerId: r.customerId,
                          customerName: r.customerName,
                        })
                      }
                    >
                      Preview
                    </Btn>
                    <Btn
                      t={t}
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Ic.Download}
                      disabled={downloadingFor === r.customerId}
                      onClick={() => downloadBill(r.customerId, r.customerName)}
                    >
                      {downloadingFor === r.customerId ? "…" : "Bill"}
                    </Btn>
                    <Btn
                      t={t}
                      type="button"
                      variant={exportedQboId ? "secondary" : "primary"}
                      size="sm"
                      icon={Ic.Dollar}
                      title={
                        !r.hasRates && !o.storageRateDollars
                          ? "Set rates on /customers/[id] or supply overrides"
                          : !isManager
                            ? "Manager-only action"
                            : ""
                      }
                      disabled={!isManager || exportToQb.isPending}
                      onClick={() => pushToQb(r.customerId)}
                    >
                      {exportedQboId ? `Inv ${exportedQboId}` : "Push QB"}
                    </Btn>
                  </div>
                </div>
                {isExpanded && (
                  <CustomizePanel
                    t={t}
                    row={r}
                    overrides={o}
                    onChange={(patch) =>
                      patchRowOverrides(r.customerId, patch)
                    }
                  />
                )}
              </div>
            );
          })}
          {billing.data && billing.data.rows.length === 0 && (
            <div
              style={{
                padding: "20px 16px",
                fontSize: 13,
                color: t.muted,
                borderTop: `1.5px dashed ${t.border}`,
              }}
            >
              No customers in this org yet — add one at{" "}
              <Link
                href={"/customers/new" as Route}
                style={{ color: t.primaryDeep, fontWeight: 600 }}
              >
                /customers/new
              </Link>
              .
            </div>
          )}
        </Card>
        {exportToQb.error && (
          <div
            style={{
              marginTop: 10,
              background: t.coralSoft,
              color: t.coral,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {exportToQb.error.message}
          </div>
        )}
      </div>

      {(() => {
        if (!previewing) return null;
        const o = getRowOverrides(previewing.customerId);
        const payload = buildBillPayload(previewing.customerId);
        const previewInput: BillPreviewInput = {
          customerId: previewing.customerId,
          customerName: previewing.customerName,
          from,
          to,
          storageBasis: o.storageBasis,
          overrides: payload.overrides,
          extraLines: payload.extraLines,
          memo: payload.memo,
          dueInDays: payload.dueInDays,
        };
        const row = (billing.data?.rows ?? []).find(
          (r) => r.customerId === previewing.customerId,
        );
        const cantQb =
          !isManager ||
          (!row?.hasRates && !o.storageRateDollars);
        const exportedQboId = exportedFor[previewing.customerId];
        return (
          <BillPreviewModal
            open
            onClose={() => setPreviewing(null)}
            input={previewInput}
            onDownload={() =>
              downloadBill(previewing.customerId, previewing.customerName)
            }
            onPushQb={() => pushToQb(previewing.customerId)}
            downloadDisabled={downloadingFor === previewing.customerId}
            downloadPending={downloadingFor === previewing.customerId}
            pushQbDisabled={cantQb || exportToQb.isPending}
            pushQbPending={exportToQb.isPending}
            pushQbLabel={
              exportedQboId ? `Pushed (Inv ${exportedQboId})` : undefined
            }
          />
        );
      })()}
    </div>
  );
}

function CustomizePanel({
  t,
  row,
  overrides,
  onChange,
}: {
  t: typeof theme;
  row: {
    customerId: string;
    peakCount: number;
    averageCount: number;
    palletDays: number;
    receives: number;
    ships: number;
    storageRateCentsPerPalletMonth: number | null;
    receiveRateCentsPerPallet: number | null;
    shipRateCentsPerPallet: number | null;
  };
  overrides: RowOverrides;
  onChange: (patch: Partial<RowOverrides>) => void;
}) {
  const placeholder = (cents: number | null): string =>
    cents == null ? "0.00" : (cents / 100).toFixed(2);

  function setExtra(i: number, patch: Partial<{ description: string; amountDollars: string }>) {
    onChange({
      extraLines: overrides.extraLines.map((l, j) =>
        j === i ? { ...l, ...patch } : l,
      ),
    });
  }
  function addExtra() {
    onChange({
      extraLines: [
        ...overrides.extraLines,
        { description: "", amountDollars: "" },
      ],
    });
  }
  function removeExtra(i: number) {
    onChange({
      extraLines: overrides.extraLines.filter((_, j) => j !== i),
    });
  }

  return (
    <div
      style={{
        padding: "14px 18px 18px",
        borderTop: `1px dashed ${t.border}`,
        background: t.surfaceAlt,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      <div>
        <SectionLabel>Storage basis (this bill only)</SectionLabel>
        <select
          value={overrides.storageBasis}
          onChange={(e) =>
            onChange({ storageBasis: e.target.value as StorageBasis })
          }
          style={selectStyle(t)}
        >
          <option value="peak">Peak — {row.peakCount} pallets</option>
          <option value="average">Average — {row.averageCount.toFixed(2)} pallets</option>
          <option value="pallet_days">Pallet-days — {row.palletDays.toFixed(2)} (rate ÷ 30)</option>
        </select>

        <SectionLabel style={{ marginTop: 12 }}>Rate overrides ($)</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <RateInput
            t={t}
            label="Storage / pallet / month"
            placeholder={placeholder(row.storageRateCentsPerPalletMonth)}
            value={overrides.storageRateDollars}
            onChange={(v) => onChange({ storageRateDollars: v })}
          />
          <RateInput
            t={t}
            label="Inbound / pallet"
            placeholder={placeholder(row.receiveRateCentsPerPallet)}
            value={overrides.receiveRateDollars}
            onChange={(v) => onChange({ receiveRateDollars: v })}
          />
          <RateInput
            t={t}
            label="Outbound / pallet"
            placeholder={placeholder(row.shipRateCentsPerPallet)}
            value={overrides.shipRateDollars}
            onChange={(v) => onChange({ shipRateDollars: v })}
          />
          <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
            Blank = use the customer&apos;s saved rate. Overrides apply to
            this bill only.
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Extra lines (one-off fees, discounts as negatives)</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {overrides.extraLines.map((line, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 28px",
                gap: 6,
                alignItems: "center",
              }}
            >
              <input
                value={line.description}
                onChange={(e) => setExtra(i, { description: e.target.value })}
                placeholder="Rework fee"
                style={inlineInput(t)}
              />
              <input
                value={line.amountDollars}
                onChange={(e) => setExtra(i, { amountDollars: e.target.value })}
                placeholder="50.00"
                inputMode="decimal"
                style={inlineInput(t)}
              />
              <button
                type="button"
                aria-label="Remove line"
                onClick={() => removeExtra(i)}
                style={removeBtn(t)}
              >
                <Ic.X size={12} />
              </button>
            </div>
          ))}
          <Btn
            t={t}
            type="button"
            variant="secondary"
            size="sm"
            icon={Ic.Plus}
            onClick={addExtra}
          >
            Add line
          </Btn>
        </div>

        <SectionLabel style={{ marginTop: 12 }}>Memo & terms</SectionLabel>
        <textarea
          value={overrides.memo}
          onChange={(e) => onChange({ memo: e.target.value })}
          rows={2}
          placeholder="Thanks for your business — wire instructions on file."
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            fontSize: 12.5,
            color: t.ink,
            fontFamily: FONTS.sans,
            resize: "vertical",
            marginBottom: 6,
          }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: t.muted,
          }}
        >
          Due in
          <input
            value={overrides.dueInDays}
            onChange={(e) => onChange({ dueInDays: e.target.value })}
            placeholder="30"
            inputMode="numeric"
            style={{ ...inlineInput(t), width: 60 }}
          />
          days (Net N — leave blank to omit)
        </label>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const t = theme;
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 11,
        color: t.muted,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        fontWeight: 600,
      }}
    >
      {label}
      {children}
    </label>
  );
}

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const t = theme;
  return (
    <div
      style={{
        fontSize: 10.5,
        color: t.muted,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        fontWeight: 600,
        marginBottom: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function RateInput({
  t,
  label,
  placeholder,
  value,
  onChange,
}: {
  t: typeof theme;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        color: t.body,
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontFamily: FONTS.mono, color: t.muted }}>$</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        style={{ ...inlineInput(t), width: 90, fontFamily: FONTS.mono }}
      />
    </label>
  );
}

function chipStyle(t: typeof theme, active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    background: active ? t.primary : t.surfaceAlt,
    color: active ? t.primaryText : t.body,
    border: `1.5px solid ${active ? t.primaryDeep : t.border}`,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: FONTS.sans,
  };
}

function selectStyle(t: typeof theme): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    background: t.surfaceAlt,
    border: `1.5px solid ${t.border}`,
    fontSize: 13,
    color: t.ink,
    fontFamily: FONTS.sans,
    cursor: "pointer",
  };
}

function inlineInput(t: typeof theme): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    background: t.surface,
    border: `1.5px solid ${t.border}`,
    fontSize: 12.5,
    color: t.ink,
    fontFamily: FONTS.sans,
    width: "100%",
    minWidth: 0,
  };
}

function removeBtn(t: typeof theme): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: `1.5px solid ${t.border}`,
    background: t.surface,
    color: t.muted,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function Mono({
  v,
  t,
  highlight = false,
}: {
  v: number;
  t: typeof theme;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? t.ink : v > 0 ? t.body : t.muted,
      }}
    >
      {v}
    </div>
  );
}

function MonoRaw({
  children,
  t,
  highlight = false,
}: {
  children: React.ReactNode;
  t: typeof theme;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? t.ink : t.body,
      }}
    >
      {children}
    </div>
  );
}

function MonoCents({
  v,
  t,
  highlight = false,
}: {
  v: number;
  t: typeof theme;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? t.ink : v > 0 ? t.body : t.muted,
      }}
    >
      {fmtCents(v)}
    </div>
  );
}

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
