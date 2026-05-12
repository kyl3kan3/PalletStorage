"use client";

import { Modal } from "./modal";
import { Btn, Tag } from "./kit";
import { Ic } from "./icons";
import { theme, FONTS } from "~/lib/theme";
import { trpc } from "~/lib/trpc";

type StorageBasis = "peak" | "average" | "pallet_days";

export type BillPreviewInput = {
  customerId: string;
  customerName: string;
  from: Date;
  to: Date;
  storageBasis: StorageBasis;
  overrides?: {
    storageRateCentsPerPalletMonth?: number;
    receiveRateCentsPerPallet?: number;
    shipRateCentsPerPallet?: number;
  };
  extraLines?: Array<{ description: string; amountCents: number }>;
  memo?: string;
  dueInDays?: number;
};

/**
 * Inline preview of the bill a customer will receive. Pulls the same
 * structured charges that the PDF and QuickBooks export use, so the
 * numbers on screen match the numbers on the artifact byte-for-byte.
 *
 * The modal doesn't itself fire the download or QB push — it surfaces
 * two action buttons that call back into the parent's existing flow,
 * so the "Bill" / "Push QB" code paths stay in one place.
 */
export function BillPreviewModal({
  open,
  onClose,
  input,
  onDownload,
  onPushQb,
  downloadDisabled,
  downloadPending,
  pushQbDisabled,
  pushQbPending,
  pushQbLabel,
}: {
  open: boolean;
  onClose: () => void;
  input: BillPreviewInput | null;
  onDownload: () => void;
  onPushQb: () => void;
  downloadDisabled?: boolean;
  downloadPending?: boolean;
  pushQbDisabled?: boolean;
  pushQbPending?: boolean;
  pushQbLabel?: string;
}) {
  const t = theme;

  const preview = trpc.report.previewCustomerBill.useQuery(
    input
      ? {
          customerId: input.customerId,
          from: input.from,
          to: input.to,
          storageBasis: input.storageBasis,
          overrides: input.overrides,
          extraLines: input.extraLines,
          memo: input.memo,
          dueInDays: input.dueInDays,
        }
      : (undefined as never),
    { enabled: open && !!input },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={input ? `Bill preview — ${input.customerName}` : "Bill preview"}
      subtitle={
        input
          ? `${input.from.toLocaleDateString()} – ${input.to.toLocaleDateString()}`
          : undefined
      }
      maxWidth={760}
    >
      {preview.isLoading && (
        <div style={{ padding: "24px 0", color: t.muted, fontSize: 13 }}>
          Calculating…
        </div>
      )}
      {preview.error && (
        <div
          style={{
            background: t.coralSoft,
            color: t.coral,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          {preview.error.message}
        </div>
      )}
      {preview.data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* From / To addresses, period, due date. Same blocks the PDF
              shows up top so the preview reads like the final artifact. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <AddressBlock
              label="From"
              name={
                preview.data.organization?.legalName ??
                preview.data.organization?.name ??
                "—"
              }
              line1={preview.data.organization?.addressLine1 ?? null}
              line2={preview.data.organization?.addressLine2 ?? null}
              city={preview.data.organization?.city ?? null}
              region={preview.data.organization?.region ?? null}
              postal={preview.data.organization?.postalCode ?? null}
              country={preview.data.organization?.country ?? null}
            />
            <AddressBlock
              label="Bill to"
              name={preview.data.customer?.name ?? "—"}
              line1={preview.data.customer?.billingLine1 ?? null}
              line2={preview.data.customer?.billingLine2 ?? null}
              city={preview.data.customer?.billingCity ?? null}
              region={preview.data.customer?.billingRegion ?? null}
              postal={preview.data.customer?.billingPostalCode ?? null}
              country={preview.data.customer?.billingCountry ?? null}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              fontSize: 12.5,
              color: t.muted,
            }}
          >
            <span>
              <strong style={{ color: t.ink }}>Period:</strong>{" "}
              <span style={{ fontFamily: FONTS.mono }}>
                {preview.data.period}
              </span>
            </span>
            <span>
              <strong style={{ color: t.ink }}>Storage basis:</strong>{" "}
              {preview.data.storageBasisLabel}
            </span>
            {preview.data.dueDate && (
              <span>
                <strong style={{ color: t.ink }}>Due:</strong>{" "}
                {preview.data.dueDate.toLocaleDateString()}
              </span>
            )}
          </div>

          {!preview.data.hasRates && (
            <div>
              <Tag t={t} tone="coral">
                Rates not set — preview uses any overrides you supplied
              </Tag>
            </div>
          )}

          {/* Line items table */}
          <div
            style={{
              border: `1.5px solid ${t.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 80px 130px 110px",
                gap: 10,
                padding: "10px 14px",
                background: t.surfaceAlt,
                fontSize: 10.5,
                color: t.muted,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontWeight: 600,
              }}
            >
              <div>Item</div>
              <div style={{ textAlign: "right" }}>Qty</div>
              <div style={{ textAlign: "right" }}>Rate</div>
              <div style={{ textAlign: "right" }}>Amount</div>
            </div>
            {preview.data.lines.length === 0 &&
              preview.data.extraLines.length === 0 && (
                <div
                  style={{
                    padding: "16px 14px",
                    fontSize: 13,
                    color: t.muted,
                  }}
                >
                  No charges for this period. Set rates or add a custom line
                  to bill the customer.
                </div>
              )}
            {preview.data.lines.map((l, i) => (
              <div
                key={`r-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.8fr 80px 130px 110px",
                  gap: 10,
                  padding: "10px 14px",
                  borderTop: `1.5px dashed ${t.border}`,
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <span style={{ color: t.body }}>{l.description}</span>
                <span
                  style={{
                    textAlign: "right",
                    fontFamily: FONTS.mono,
                    color: t.ink,
                  }}
                >
                  {l.qty}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    fontFamily: FONTS.mono,
                    color: t.muted,
                  }}
                >
                  {fmtCents(l.rateCents)} {l.unit}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    fontFamily: FONTS.mono,
                    color: t.ink,
                    fontWeight: 600,
                  }}
                >
                  {fmtCents(l.amountCents)}
                </span>
              </div>
            ))}
            {preview.data.extraLines.map((e, i) => (
              <div
                key={`e-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.8fr 80px 130px 110px",
                  gap: 10,
                  padding: "10px 14px",
                  borderTop: `1.5px dashed ${t.border}`,
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <span style={{ color: t.body }}>{e.description}</span>
                <span
                  style={{
                    textAlign: "right",
                    fontFamily: FONTS.mono,
                    color: t.muted,
                  }}
                >
                  —
                </span>
                <span
                  style={{
                    textAlign: "right",
                    fontFamily: FONTS.mono,
                    color: t.muted,
                  }}
                >
                  —
                </span>
                <span
                  style={{
                    textAlign: "right",
                    fontFamily: FONTS.mono,
                    fontWeight: 600,
                    color: e.amountCents < 0 ? t.coral : t.ink,
                  }}
                >
                  {fmtCents(e.amountCents)}
                </span>
              </div>
            ))}
            {/* Totals row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 80px 130px 110px",
                gap: 10,
                padding: "12px 14px",
                borderTop: `1.5px solid ${t.border}`,
                background: t.surfaceAlt,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <span style={{ color: t.muted }}>Total</span>
              <span />
              <span />
              <span
                style={{
                  textAlign: "right",
                  fontFamily: FONTS.mono,
                  color: t.ink,
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {fmtCents(preview.data.grandTotalCents)}
              </span>
            </div>
          </div>

          {preview.data.memo && (
            <div
              style={{
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 12,
                padding: "10px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  color: t.muted,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Memo
              </div>
              <div style={{ fontSize: 13, color: t.body, whiteSpace: "pre-wrap" }}>
                {preview.data.memo}
              </div>
            </div>
          )}

          {/* Activity snapshot — small grey numbers so the user can
              double-check the period saw the activity they expected. */}
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontSize: 12,
              color: t.muted,
              fontFamily: FONTS.mono,
            }}
          >
            <span>opening {preview.data.counts.opening}</span>
            <span>current {preview.data.counts.current}</span>
            <span>peak {preview.data.counts.peak}</span>
            <span>avg {preview.data.counts.average.toFixed(2)}</span>
            <span>in {preview.data.counts.receives}</span>
            <span>out {preview.data.counts.ships}</span>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 18,
          paddingTop: 14,
          borderTop: `1.5px solid ${t.border}`,
        }}
      >
        <Btn t={t} type="button" variant="ghost" size="md" onClick={onClose}>
          Close
        </Btn>
        <Btn
          t={t}
          type="button"
          variant="secondary"
          size="md"
          icon={Ic.Download}
          disabled={downloadDisabled || downloadPending}
          onClick={onDownload}
        >
          {downloadPending ? "Generating…" : "Download PDF"}
        </Btn>
        <Btn
          t={t}
          type="button"
          variant="primary"
          size="md"
          icon={Ic.Dollar}
          disabled={pushQbDisabled || pushQbPending}
          onClick={onPushQb}
        >
          {pushQbPending ? "Pushing…" : pushQbLabel ?? "Push to QuickBooks"}
        </Btn>
      </div>
    </Modal>
  );
}

function AddressBlock({
  label,
  name,
  line1,
  line2,
  city,
  region,
  postal,
  country,
}: {
  label: string;
  name: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postal: string | null;
  country: string | null;
}) {
  const t = theme;
  const cityRegion = [city, region].filter(Boolean).join(", ");
  return (
    <div
      style={{
        background: t.surfaceAlt,
        border: `1.5px solid ${t.border}`,
        borderRadius: 12,
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
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
          fontSize: 14,
          color: t.ink,
          fontWeight: 600,
          marginTop: 2,
        }}
      >
        {name}
      </div>
      <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
        {line1 && <div>{line1}</div>}
        {line2 && <div>{line2}</div>}
        {(cityRegion || postal) && (
          <div>
            {cityRegion}
            {postal ? ` ${postal}` : ""}
          </div>
        )}
        {country && <div>{country}</div>}
      </div>
    </div>
  );
}

function fmtCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, "0")}`;
}
