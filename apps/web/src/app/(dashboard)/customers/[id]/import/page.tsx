"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";

/**
 * AI-assisted backfill for an existing 3PL customer's pallet history.
 * The user pastes a slice of their billing/inventory spreadsheet and
 * gpt-4o-mini extracts each pallet row + (when present) the customer's
 * billing rates. Nothing writes until the user confirms — they can
 * edit, drop, or skip rows on the preview table first.
 *
 * Confirming creates one pallet + pallet_item + receive movement per
 * row, and a ship movement if an out-date was found. Pallets are
 * tagged with the customer so the billing report sees them right away.
 */
type Row = {
  productName: string;
  qty: number;
  inDate: string;
  outDate?: string;
  lot?: string;
  expiry?: string;
  skip?: boolean;
};

type DetectedRates = {
  storageRateCentsPerPalletMonth?: number;
  receiveRateCentsPerPallet?: number;
  shipRateCentsPerPallet?: number;
};

export default function CustomerImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = theme;
  const { id } = use(params);
  const router = useRouter();
  const customer = trpc.customer.byId.useQuery({ id });
  const warehouses = trpc.warehouse.list.useQuery();

  const [text, setText] = useState("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [detectedRates, setDetectedRates] = useState<DetectedRates | undefined>();
  const [applyDetectedRates, setApplyDetectedRates] = useState(true);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);

  /**
   * Read an uploaded .xlsx / .csv / .pdf into a flat text blob and
   * dump it into the textarea. Excel via SheetJS, PDF via pdfjs —
   * both are dynamic-imported so they only ship to clients that
   * actually upload a file. Plain CSV / TXT just decoded as utf-8.
   */
  async function handleFile(file: File) {
    setFileErr(null);
    setFileBusy(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const xlsx = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = xlsx.read(buf, { type: "array" });
        const parts: string[] = [];
        for (const sheetName of wb.SheetNames) {
          parts.push(`--- ${sheetName} ---`);
          parts.push(xlsx.utils.sheet_to_csv(wb.Sheets[sheetName]!));
        }
        setText(parts.join("\n"));
      } else if (lower.endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        const parts: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          const lineText = textContent.items
            .map((it) => ("str" in it ? it.str : ""))
            .join(" ");
          parts.push(lineText);
        }
        setText(parts.join("\n"));
      } else {
        setText(await file.text());
      }
    } catch (e) {
      setFileErr(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setFileBusy(false);
    }
  }

  // Default the warehouse to the only one if there's just a single site.
  useMemo(() => {
    if (!warehouseId && warehouses.data && warehouses.data.length === 1) {
      setWarehouseId(warehouses.data[0]!.id);
    }
  }, [warehouses.data, warehouseId]);

  const parse = trpc.customer.parseInventorySheet.useMutation({
    onSuccess: (data) => {
      setRows(data.rows.map((r) => ({ ...r })));
      setDetectedRates(data.detectedRates);
    },
  });
  const apply = trpc.customer.applyInventoryImport.useMutation({
    onSuccess: () => {
      // Send the user back to the customer detail page so they can see
      // the rates updated and head to /reports/billing.
      router.push((`/customers/${id}` as unknown) as Route);
    },
  });

  const activeRows = (rows ?? []).filter((r) => !r.skip);

  return (
    <div>
      <BackLink href={(`/customers/${id}` as unknown) as Route} label="Back to customer" />
      <PageTitle
        eyebrow={customer.data?.customer?.name ?? "Customer"}
        title="Import inventory from a spreadsheet"
        subtitle="Paste a slice of your billing or inventory sheet — the AI extracts pallet rows and any rates you have written down."
      />

      <Card t={t}>
        <SectionLabel>1. Upload or paste the sheet</SectionLabel>
        <p style={{ fontSize: 12.5, color: t.muted, margin: "0 0 10px" }}>
          Drop in an Excel file (.xlsx), CSV, or PDF — we&apos;ll extract the
          text in your browser and feed it to the AI. You can also paste cells
          directly from Excel or Google Sheets.
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 14px",
              borderRadius: 12,
              background: t.primary,
              color: t.primaryText,
              border: `1.5px solid ${t.primary}`,
              fontSize: 13.5,
              fontWeight: 600,
              fontFamily: FONTS.sans,
              cursor: fileBusy ? "progress" : "pointer",
              opacity: fileBusy ? 0.6 : 1,
            }}
          >
            <Ic.Upload size={16} />
            {fileBusy ? "Reading…" : "Upload file"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={fileBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
          <span style={{ fontSize: 11, color: t.muted }}>
            .xlsx · .csv · .pdf · or paste cells below
          </span>
        </div>
        {fileErr && (
          <div
            style={{
              marginBottom: 10,
              background: t.coralSoft,
              color: t.coral,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {fileErr}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"#1 - Rocky Mountains\tMarch 6, 2026\t\t$22.00\n#2 - Rocky Mountains\tMarch 6, 2026\t\t$22.00\n…"}
          rows={10}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 12,
            background: t.surfaceAlt,
            border: `1.5px solid ${t.border}`,
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: t.ink,
            resize: "vertical",
          }}
        />
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <Btn
            t={t}
            type="button"
            variant="accent"
            size="md"
            icon={Ic.Spark}
            disabled={!text.trim() || parse.isPending}
            onClick={() => parse.mutate({ customerId: id, text })}
          >
            {parse.isPending ? "Parsing…" : "Parse with AI"}
          </Btn>
          <span style={{ fontSize: 11, color: t.muted }}>
            Sends to gpt-4o-mini. ~$0.001 per import. Nothing writes yet.
          </span>
        </div>
        {parse.error && (
          <div
            style={{
              marginTop: 10,
              background: t.coralSoft,
              color: t.coral,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {parse.error.message}
          </div>
        )}
      </Card>

      {rows !== null && (
        <Card t={t} style={{ marginTop: 16 }}>
          <SectionLabel>2. Review parsed rows</SectionLabel>
          {detectedRates && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                background: t.surfaceAlt,
                borderRadius: 10,
                fontSize: 13,
                color: t.body,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Detected billing rates
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 12 }}>
                Storage:{" "}
                {detectedRates.storageRateCentsPerPalletMonth != null
                  ? `$${(detectedRates.storageRateCentsPerPalletMonth / 100).toFixed(2)}/pallet/mo`
                  : "—"}
                {" · "}
                Inbound:{" "}
                {detectedRates.receiveRateCentsPerPallet != null
                  ? `$${(detectedRates.receiveRateCentsPerPallet / 100).toFixed(2)}/pallet`
                  : "—"}
                {" · "}
                Outbound:{" "}
                {detectedRates.shipRateCentsPerPallet != null
                  ? `$${(detectedRates.shipRateCentsPerPallet / 100).toFixed(2)}/pallet`
                  : "—"}
              </div>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 6,
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={applyDetectedRates}
                  onChange={(e) => setApplyDetectedRates(e.target.checked)}
                />
                Apply these rates to the customer on import
              </label>
            </div>
          )}

          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: t.muted }}>Warehouse:</span>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                fontSize: 13,
                color: t.ink,
              }}
            >
              <option value="">— select —</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
            <span style={{ flex: 1 }} />
            <Tag t={t} tone="neutral">
              {activeRows.length} of {rows.length} rows selected
            </Tag>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 70px 110px 110px 110px 110px 70px",
              gap: 8,
              padding: "10px 12px",
              fontSize: 10.5,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
              borderBottom: `1.5px solid ${t.border}`,
            }}
          >
            <div>Product</div>
            <div>Qty</div>
            <div>In date</div>
            <div>Out date</div>
            <div>Lot</div>
            <div>Expiry</div>
            <div>Skip</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 70px 110px 110px 110px 110px 70px",
                gap: 8,
                padding: "8px 12px",
                borderBottom: `1px dashed ${t.border}`,
                alignItems: "center",
                opacity: r.skip ? 0.4 : 1,
              }}
            >
              <input
                value={r.productName}
                onChange={(e) =>
                  setRows((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, productName: e.target.value } : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <input
                type="number"
                min={1}
                value={r.qty}
                onChange={(e) =>
                  setRows((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, qty: Number(e.target.value) } : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <input
                type="date"
                value={r.inDate}
                onChange={(e) =>
                  setRows((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, inDate: e.target.value } : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <input
                type="date"
                value={r.outDate ?? ""}
                onChange={(e) =>
                  setRows((prev) =>
                    prev!.map((x, j) =>
                      j === i
                        ? { ...x, outDate: e.target.value || undefined }
                        : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <input
                value={r.lot ?? ""}
                onChange={(e) =>
                  setRows((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, lot: e.target.value || undefined } : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <input
                type="date"
                value={r.expiry ?? ""}
                onChange={(e) =>
                  setRows((prev) =>
                    prev!.map((x, j) =>
                      j === i
                        ? { ...x, expiry: e.target.value || undefined }
                        : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <input
                type="checkbox"
                checked={!!r.skip}
                onChange={(e) =>
                  setRows((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, skip: e.target.checked } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          {rows.length === 0 && (
            <div style={{ padding: 16, color: t.muted, fontSize: 13 }}>
              No rows extracted. Try pasting a smaller, cleaner slice of the
              sheet.
            </div>
          )}

          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <Btn
              t={t}
              type="button"
              variant="accent"
              size="md"
              icon={Ic.Check}
              disabled={
                !warehouseId ||
                activeRows.length === 0 ||
                apply.isPending
              }
              onClick={() => {
                const validRows = activeRows.map((r) => ({
                  productName: r.productName.trim(),
                  qty: r.qty,
                  inDate: r.inDate,
                  outDate: r.outDate || undefined,
                  lot: r.lot?.trim() || undefined,
                  expiry: r.expiry || undefined,
                }));
                apply.mutate({
                  customerId: id,
                  warehouseId,
                  rows: validRows,
                  applyRates:
                    applyDetectedRates && detectedRates ? detectedRates : undefined,
                });
              }}
            >
              {apply.isPending
                ? "Importing…"
                : `Confirm import (${activeRows.length} pallet${activeRows.length === 1 ? "" : "s"})`}
            </Btn>
            <Link
              href={(`/customers/${id}` as unknown) as Route}
              style={{ fontSize: 13, color: t.muted, textDecoration: "underline" }}
            >
              Cancel
            </Link>
          </div>
          {apply.error && (
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
              {apply.error.message}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: theme.muted,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        fontWeight: 600,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function inlineInputStyle(t: typeof theme): React.CSSProperties {
  return {
    padding: "5px 8px",
    borderRadius: 6,
    background: t.surface,
    border: `1px solid ${t.border}`,
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: t.ink,
    width: "100%",
    minWidth: 0,
  };
}
