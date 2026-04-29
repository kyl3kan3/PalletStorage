"use client";

import { useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";

/**
 * Standalone customer + inventory importer. The sheet itself names
 * the customer, so the user doesn't pre-select one — the AI extracts
 * everything (customer name + email + address + rates + pallet rows)
 * and the user reviews + confirms. If the detected name already
 * exists in the org, the page offers to merge instead of double-
 * creating.
 *
 * Optional `?customerId=` query param skips the customer-detection
 * step and locks the import to that existing customer (used when
 * the user starts the flow from /customers/<id>/page.tsx).
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

type DetectedCustomer = {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  billingLine1?: string;
  billingLine2?: string;
  billingCity?: string;
  billingRegion?: string;
  billingPostalCode?: string;
  billingCountry?: string;
};

type DetectedRates = {
  storageRateCentsPerPalletMonth?: number;
  receiveRateCentsPerPallet?: number;
  shipRateCentsPerPallet?: number;
};

export default function ImportInventoryPage() {
  const t = theme;
  const router = useRouter();
  const sp = useSearchParams();
  const lockedCustomerId = sp.get("customerId") ?? "";
  const lockedCustomer = trpc.customer.byId.useQuery(
    { id: lockedCustomerId },
    { enabled: !!lockedCustomerId },
  );
  const warehouses = trpc.warehouse.list.useQuery();
  const customers = trpc.customer.list.useQuery();

  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [fileBusy, setFileBusy] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [detectedRates, setDetectedRates] = useState<DetectedRates | undefined>();
  const [applyDetectedRates, setApplyDetectedRates] = useState(true);
  const [customer, setCustomer] = useState<DetectedCustomer | null>(null);
  const [matchExistingId, setMatchExistingId] = useState<string>("");

  useMemo(() => {
    if (!warehouseId && warehouses.data && warehouses.data.length === 1) {
      setWarehouseId(warehouses.data[0]!.id);
    }
  }, [warehouses.data, warehouseId]);

  const parse = trpc.customer.parseInventorySheet.useMutation({
    onSuccess: (data) => {
      setRows(data.rows.map((r) => ({ ...r })));
      setDetectedRates(data.detectedRates);
      if (lockedCustomerId) {
        setCustomer(null); // existing customer path — no detected info shown
      } else {
        setCustomer(data.detectedCustomer ?? null);
        setMatchExistingId(data.existingMatch?.id ?? "");
      }
    },
  });
  const apply = trpc.customer.applyInventoryImport.useMutation({
    onSuccess: (res) => {
      router.push(`/customers/${res.customerId}` as Route);
    },
  });

  async function handleFile(file: File) {
    setFileErr(null);
    setFileBusy(true);
    setText("");
    setImageDataUrl(null);
    setImagePreview(null);
    try {
      const lower = file.name.toLowerCase();
      const mime = (file.type || "").toLowerCase();
      // MIME type wins because some downloads have odd / missing
      // extensions (e.g. iOS share-sheet renames screenshots, or a
      // file came in via clipboard). Fall back to extension only
      // when MIME is empty.
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
        // accepts data:image/(png|jpeg);base64, so PNGs from screenshots
        // are fine, but anything else (webp, heic, gif, or files with an
        // empty / weird MIME from clipboard pastes) would be rejected.
        // The canvas pipeline also caps file size — phone photos are
        // commonly 5-10MB and would blow the Vercel 4.5MB body limit.
        const finalUrl = await fileToJpegDataUrl(file);
        setImageDataUrl(finalUrl);
        setImagePreview(finalUrl);
      } else if (isExcel) {
        const xlsx = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = xlsx.read(buf, { type: "array" });
        const parts: string[] = [];
        for (const name of wb.SheetNames) {
          parts.push(`--- ${name} ---`);
          parts.push(xlsx.utils.sheet_to_csv(wb.Sheets[name]!));
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
          parts.push(
            tc.items.map((it) => ("str" in it ? it.str : "")).join(" "),
          );
        }
        const joined = parts.join("\n").trim();
        if (joined.length > 30) {
          setText(joined);
        } else {
          // Image-only PDF — render first page and route through vision.
          const page = await doc.getPage(1);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D unavailable");
          await page.render({ canvasContext: ctx, viewport: vp, canvas })
            .promise;
          const data = canvas.toDataURL("image/jpeg", 0.9);
          setImageDataUrl(data);
          setImagePreview(data);
        }
      } else if (isCsv) {
        setText(await file.text());
      } else {
        // Unknown type — refuse rather than dumping raw bytes into
        // the textarea (that's how users hit 'string too big' on
        // image uploads with weird extensions).
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

  async function fileToJpegDataUrl(file: File): Promise<string> {
    // Use an object URL rather than readAsDataURL so the browser
    // image decoder sniffs format from the bytes (works even when
    // file.type is empty or wrong, e.g. iOS HEIC, clipboard paste).
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<string>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          // Cap at 1800px on the long edge — keeps the request well
          // under Vercel's 4.5MB body limit while staying readable
          // for OpenAI vision.
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

  const activeRows = (rows ?? []).filter((r) => !r.skip);

  const headerName = lockedCustomerId
    ? lockedCustomer.data?.customer?.name ?? "Customer"
    : "Import customer + inventory";

  return (
    <div>
      <BackLink href="/customers" label="Back to customers" />
      <PageTitle
        eyebrow={lockedCustomerId ? "Backfill into existing" : "One-shot create + backfill"}
        title={headerName}
        subtitle={
          lockedCustomerId
            ? "Add historical pallet data to this customer. Rates and contact info already saved are kept."
            : "Drop in a customer's billing or inventory sheet — the AI detects who they are, their rates, and every pallet they have on hand."
        }
      />

      <Card t={t}>
        <SectionLabel>1. Upload or paste the sheet</SectionLabel>
        <p style={{ fontSize: 12.5, color: t.muted, margin: "0 0 10px" }}>
          Excel, CSV, or PDF — text is extracted in your browser. Or paste
          cells directly from Excel / Google Sheets below.
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
              accept=".xlsx,.xls,.csv,.txt,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            .xlsx · .csv · .pdf · .png · .jpg — or paste cells below
          </span>
        </div>
        {imagePreview && (
          <div
            style={{
              marginBottom: 10,
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
              alt="Uploaded sheet preview"
              style={{ maxWidth: 360, maxHeight: 240, display: "block" }}
            />
          </div>
        )}
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
          rows={8}
          placeholder="Paste the sheet contents here…"
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
            disabled={(!text.trim() && !imageDataUrl) || parse.isPending}
            onClick={() =>
              parse.mutate({
                text: text.trim() ? text : undefined,
                imageDataUrl: imageDataUrl ?? undefined,
                customerId: lockedCustomerId || undefined,
              })
            }
          >
            {parse.isPending ? "Parsing…" : "Parse with AI"}
          </Btn>
          <span style={{ fontSize: 11, color: t.muted }}>
            ~$0.001 per import. Nothing writes yet.
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
          <SectionLabel>2. Review</SectionLabel>

          {!lockedCustomerId && customer && (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                border: `1.5px solid ${t.border}`,
                borderRadius: 12,
                background: t.surfaceAlt,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: t.ink }}>Customer</strong>
                {parse.data?.existingMatch && (
                  <Tag t={t} tone="primary">
                    Match found in your customer list
                  </Tag>
                )}
              </div>
              {parse.data?.existingMatch && (
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      checked={!!matchExistingId}
                      onChange={() =>
                        setMatchExistingId(parse.data!.existingMatch!.id)
                      }
                    />
                    Link to existing customer{" "}
                    <strong>{parse.data.existingMatch.name}</strong>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      checked={!matchExistingId}
                      onChange={() => setMatchExistingId("")}
                    />
                    Create as a new customer
                  </label>
                </div>
              )}
              {!matchExistingId && (
                <div
                  data-collapse-grid
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <Field label="Name" required>
                    <TextField
                      t={t}
                      value={customer.name}
                      onChange={(e) =>
                        setCustomer({ ...customer, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <TextField
                      t={t}
                      value={customer.email ?? ""}
                      onChange={(e) =>
                        setCustomer({
                          ...customer,
                          email: e.target.value || undefined,
                        })
                      }
                    />
                  </Field>
                  <Field label="Contact name">
                    <TextField
                      t={t}
                      value={customer.contactName ?? ""}
                      onChange={(e) =>
                        setCustomer({
                          ...customer,
                          contactName: e.target.value || undefined,
                        })
                      }
                    />
                  </Field>
                  <Field label="Phone">
                    <TextField
                      t={t}
                      value={customer.phone ?? ""}
                      onChange={(e) =>
                        setCustomer({
                          ...customer,
                          phone: e.target.value || undefined,
                        })
                      }
                    />
                  </Field>
                  <Field label="Address line 1">
                    <TextField
                      t={t}
                      value={customer.billingLine1 ?? ""}
                      onChange={(e) =>
                        setCustomer({
                          ...customer,
                          billingLine1: e.target.value || undefined,
                        })
                      }
                    />
                  </Field>
                  <Field label="City / Region">
                    <TextField
                      t={t}
                      value={`${customer.billingCity ?? ""}${
                        customer.billingRegion
                          ? `, ${customer.billingRegion}`
                          : ""
                      }`}
                      onChange={(e) => {
                        const [city, region] = e.target.value
                          .split(",")
                          .map((s) => s.trim());
                        setCustomer({
                          ...customer,
                          billingCity: city || undefined,
                          billingRegion: region || undefined,
                        });
                      }}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {!lockedCustomerId && !customer && (
            <div
              style={{
                marginBottom: 14,
                padding: 10,
                background: t.coralSoft,
                color: t.coral,
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              The AI couldn&apos;t find a customer name in the sheet. Pick
              one from the dropdown below or cancel and start from
              /customers/new.
            </div>
          )}
          {!lockedCustomerId && !customer && (
            <Field label="Pick existing customer">
              <select
                value={matchExistingId}
                onChange={(e) => setMatchExistingId(e.target.value)}
                style={selectStyle(t)}
              >
                <option value="">— select —</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {detectedRates && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
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
                Apply these rates to the customer
              </label>
            </div>
          )}

          <div
            style={{
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 12, color: t.muted }}>Warehouse:</span>
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
                      j === i ? { ...x, outDate: e.target.value || undefined } : x,
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
                      j === i ? { ...x, expiry: e.target.value || undefined } : x,
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
                apply.isPending ||
                (!lockedCustomerId &&
                  !matchExistingId &&
                  !(customer && customer.name.trim()))
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
                  customerId: lockedCustomerId || matchExistingId || undefined,
                  customerInfo:
                    !lockedCustomerId && !matchExistingId && customer
                      ? {
                          name: customer.name.trim(),
                          contactName: customer.contactName?.trim() || undefined,
                          email: customer.email?.trim() || undefined,
                          phone: customer.phone?.trim() || undefined,
                          billingLine1:
                            customer.billingLine1?.trim() || undefined,
                          billingLine2:
                            customer.billingLine2?.trim() || undefined,
                          billingCity: customer.billingCity?.trim() || undefined,
                          billingRegion:
                            customer.billingRegion?.trim() || undefined,
                          billingPostalCode:
                            customer.billingPostalCode?.trim() || undefined,
                          billingCountry:
                            customer.billingCountry?.trim() || undefined,
                        }
                      : undefined,
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
          letterSpacing: 0.4,
          textTransform: "uppercase",
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

function selectStyle(t: typeof theme): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    background: t.surfaceAlt,
    border: `1.5px solid ${t.border}`,
    fontSize: 13,
    color: t.ink,
    fontFamily: FONTS.sans,
    cursor: "pointer",
  };
}
