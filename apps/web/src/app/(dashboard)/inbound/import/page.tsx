"use client";

import { useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";

/**
 * Single-shot AI import for an inbound order. Accepts:
 *  - photo / scanned page (.png / .jpg) -> sent as vision input
 *  - PDF -> client-side text extraction via pdfjs (one fallback to image
 *    if a single rendered page is uploaded as image)
 *  - Excel / CSV -> client-side text extraction via SheetJS
 *
 * gpt-4o-mini returns a draft inbound order: reference, supplier,
 * customer (3PL client), expected-at date, and per-line product +
 * qty + unit. The user reviews + tweaks, picks a warehouse, and
 * confirm creates the order at status='open' so the existing
 * receive flow takes over.
 */

type Line = {
  productName: string;
  sku?: string;
  qty: number;
  qtyUnit: "each" | "case" | "pallet";
  skip?: boolean;
};

export default function InboundImportPage() {
  const t = theme;
  const router = useRouter();
  const warehouses = trpc.warehouse.list.useQuery();
  const [warehouseId, setWarehouseId] = useState<string>("");

  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);

  const [reference, setReference] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [expectedTime, setExpectedTime] = useState("");
  const [lines, setLines] = useState<Line[] | null>(null);

  useMemo(() => {
    if (!warehouseId && warehouses.data && warehouses.data.length === 1) {
      setWarehouseId(warehouses.data[0]!.id);
    }
  }, [warehouses.data, warehouseId]);

  const parse = trpc.inbound.parseFromDocument.useMutation({
    onSuccess: (data) => {
      if (data.reference) setReference(data.reference);
      if (data.supplierName) setSupplierName(data.supplierName);
      if (data.customerName) setCustomerName(data.customerName);
      if (data.expectedAt) setExpectedAt(data.expectedAt);
      if (data.expectedTime) setExpectedTime(data.expectedTime);
      setLines(data.lines.map((l) => ({ ...l })));
    },
  });
  const create = trpc.inbound.createFromAiImport.useMutation({
    onSuccess: (res) => {
      router.push(`/inbound/${res.id}` as Route);
    },
  });

  async function handleFile(file: File) {
    setFileErr(null);
    setFileBusy(true);
    setImageDataUrl(null);
    setImagePreview(null);
    setText("");
    try {
      const lower = file.name.toLowerCase();
      const mime = (file.type || "").toLowerCase();
      // MIME wins because some uploads have odd / missing extensions
      // (e.g. iOS HEIC, clipboard paste, downloads with stripped names).
      const isImage =
        mime.startsWith("image/") ||
        /\.(png|jpe?g|webp|heic|heif|gif|bmp)$/i.test(lower);
      const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
      const isExcel =
        mime.includes("spreadsheet") ||
        mime === "application/vnd.ms-excel" ||
        lower.endsWith(".xlsx") ||
        lower.endsWith(".xls");
      const isCsv =
        mime === "text/csv" || lower.endsWith(".csv") || lower.endsWith(".txt");
      if (isImage) {
        // Always canvas-roundtrip to JPEG. The server's zod schema only
        // accepts data:image/(png|jpeg);base64, and phone photos can
        // exceed Vercel's 4.5MB body limit otherwise.
        const finalUrl = await fileToJpegDataUrl(file);
        setImageDataUrl(finalUrl);
        setImagePreview(finalUrl);
      } else if (isExcel) {
        const xlsx = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = xlsx.read(buf, { type: "array" });
        const parts: string[] = [];
        for (const sheetName of wb.SheetNames) {
          parts.push(`--- ${sheetName} ---`);
          parts.push(xlsx.utils.sheet_to_csv(wb.Sheets[sheetName]!));
        }
        setText(parts.join("\n"));
      } else if (isPdf) {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        const parts: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const tc = await page.getTextContent();
          const lineText = tc.items.map((it) => ("str" in it ? it.str : "")).join(" ");
          parts.push(lineText);
        }
        const joined = parts.join("\n").trim();
        if (joined.length > 30) {
          setText(joined);
        } else {
          // Image-only PDF: render first page to canvas + send as vision.
          const page = await doc.getPage(1);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D unavailable");
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          const data = canvas.toDataURL("image/jpeg", 0.85);
          setImageDataUrl(data);
          setImagePreview(data);
        }
      } else if (isCsv) {
        setText(await file.text());
      } else {
        throw new Error(
          `Unsupported file type${
            mime ? ` (${mime})` : ""
          }. Use .xlsx, .csv, .pdf, or an image (.png / .jpg / .heic).`,
        );
      }
    } catch (e) {
      setFileErr(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setFileBusy(false);
    }
  }

  const activeLines = (lines ?? []).filter((l) => !l.skip);

  return (
    <div>
      <BackLink href="/inbound" label="Back to inbound" />
      <PageTitle
        eyebrow="One-shot import"
        title="Import an inbound order"
        subtitle="Drop in a packing slip, BOL, supplier invoice, or photo of one. The AI extracts the reference, sender, and line items — you review then create."
      />

      <Card t={t}>
        <SectionLabel>1. Upload the document</SectionLabel>
        <p style={{ fontSize: 12.5, color: t.muted, margin: "0 0 10px" }}>
          Image / Excel / CSV / PDF. Photos go through vision (gpt-4o-mini);
          spreadsheets and text PDFs are extracted in your browser first.
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
              accept=".xlsx,.xls,.csv,.txt,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              disabled={fileBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
          {(text || imageDataUrl) && (
            <Btn
              t={t}
              type="button"
              variant="accent"
              size="md"
              icon={Ic.Spark}
              disabled={parse.isPending}
              onClick={() =>
                parse.mutate({
                  text: text.trim() ? text : undefined,
                  imageDataUrl: imageDataUrl ?? undefined,
                })
              }
            >
              {parse.isPending ? "Parsing…" : "Parse with AI"}
            </Btn>
          )}
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
        {imagePreview && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              border: `1.5px solid ${t.border}`,
              borderRadius: 12,
              background: t.surfaceAlt,
              display: "inline-block",
              maxWidth: "100%",
            }}
          >
            <img
              src={imagePreview}
              alt="Uploaded document preview"
              style={{ maxWidth: 360, maxHeight: 240, display: "block" }}
            />
          </div>
        )}
        {text && !imagePreview && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 12,
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              fontFamily: FONTS.mono,
              fontSize: 11.5,
              color: t.ink,
              resize: "vertical",
              marginTop: 8,
            }}
          />
        )}
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

      {lines !== null && (
        <Card t={t} style={{ marginTop: 16 }}>
          <SectionLabel>2. Review the parsed order</SectionLabel>
          <div
            data-collapse-grid
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <Field label="Reference / PO #" required>
              <TextField
                t={t}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. PO-12345"
              />
            </Field>
            <Field label="Expected on">
              <div style={{ display: "flex", gap: 6 }}>
                <TextField
                  t={t}
                  type="date"
                  value={expectedAt}
                  onChange={(e) => setExpectedAt(e.target.value)}
                  style={{ flex: 1 }}
                />
                <TextField
                  t={t}
                  type="time"
                  value={expectedTime}
                  onChange={(e) => setExpectedTime(e.target.value)}
                  style={{ width: 110 }}
                />
              </div>
            </Field>
            <Field
              label="Supplier (sender)"
              hint={
                supplierName
                  ? parse.data?.existingSupplier
                    ? {
                        tone: "mint",
                        text: `Matched to existing "${parse.data.existingSupplier.name}"`,
                      }
                    : { tone: "neutral", text: `Will create new supplier "${supplierName}"` }
                  : undefined
              }
            >
              <TextField
                t={t}
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field
              label="Customer (3PL client)"
              hint={
                customerName
                  ? parse.data?.existingCustomer
                    ? {
                        tone: "mint",
                        text: `Matched to existing "${parse.data.existingCustomer.name}"`,
                      }
                    : { tone: "neutral", text: `Will create new customer "${customerName}"` }
                  : undefined
              }
            >
              <TextField
                t={t}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Warehouse" required>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 12,
                  background: t.surfaceAlt,
                  border: `1.5px solid ${t.border}`,
                  fontSize: 13.5,
                  color: t.ink,
                  fontFamily: FONTS.sans,
                  cursor: "pointer",
                }}
              >
                <option value="">— select —</option>
                {warehouses.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Line items
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 110px 70px 90px 60px",
              gap: 8,
              padding: "8px 10px",
              fontSize: 10.5,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
              borderBottom: `1.5px solid ${t.border}`,
            }}
          >
            <div>Product</div>
            <div>SKU</div>
            <div>Qty</div>
            <div>Unit</div>
            <div>Skip</div>
          </div>
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 110px 70px 90px 60px",
                gap: 8,
                padding: "6px 10px",
                borderBottom: `1px dashed ${t.border}`,
                alignItems: "center",
                opacity: l.skip ? 0.4 : 1,
              }}
            >
              <input
                value={l.productName}
                onChange={(e) =>
                  setLines((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, productName: e.target.value } : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <input
                value={l.sku ?? ""}
                onChange={(e) =>
                  setLines((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, sku: e.target.value || undefined } : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) =>
                  setLines((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, qty: Number(e.target.value) } : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              />
              <select
                value={l.qtyUnit}
                onChange={(e) =>
                  setLines((prev) =>
                    prev!.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            qtyUnit: e.target.value as Line["qtyUnit"],
                          }
                        : x,
                    ),
                  )
                }
                style={inlineInputStyle(t)}
              >
                <option value="each">items</option>
                <option value="case">cases</option>
                <option value="pallet">pallets</option>
              </select>
              <input
                type="checkbox"
                checked={!!l.skip}
                onChange={(e) =>
                  setLines((prev) =>
                    prev!.map((x, j) =>
                      j === i ? { ...x, skip: e.target.checked } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          {lines.length === 0 && (
            <div style={{ padding: 14, color: t.muted, fontSize: 13 }}>
              No lines extracted. Add manually or re-upload a clearer document.
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
                !reference.trim() ||
                !warehouseId ||
                activeLines.length === 0 ||
                create.isPending
              }
              onClick={() =>
                create.mutate({
                  warehouseId,
                  reference: reference.trim(),
                  supplierName: supplierName.trim() || undefined,
                  customerName: customerName.trim() || undefined,
                  expectedAt: expectedAt
                    ? expectedTime
                      ? `${expectedAt}T${expectedTime}:00`
                      : expectedAt
                    : undefined,
                  lines: activeLines.map((l) => ({
                    productName: l.productName.trim(),
                    sku: l.sku?.trim() || undefined,
                    qty: l.qty,
                    qtyUnit: l.qtyUnit,
                  })),
                })
              }
            >
              {create.isPending
                ? "Creating…"
                : `Create inbound (${activeLines.length} line${activeLines.length === 1 ? "" : "s"})`}
            </Btn>
            {create.error && (
              <span style={{ fontSize: 12, color: t.coral }}>
                {create.error.message}
              </span>
            )}
          </div>
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

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: { tone: "mint" | "neutral"; text: string };
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
        <span style={{ marginTop: 2 }}>
          <Tag t={theme} tone={hint.tone}>
            {hint.text}
          </Tag>
        </span>
      )}
    </label>
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

async function fileToJpegDataUrl(file: File): Promise<string> {
  // Object URL lets the browser sniff format from bytes (works even when
  // file.type is empty or wrong, e.g. iOS HEIC, clipboard paste).
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1800;
        const scale = Math.min(
          1,
          maxDim / Math.max(img.naturalWidth, img.naturalHeight),
        );
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas 2D unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () =>
        reject(
          new Error(
            "Couldn't decode that image. Try saving it as PNG or JPEG first.",
          ),
        );
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
