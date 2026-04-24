"use client";

import { use, useMemo, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { PdfMapEditor } from "~/components/pdf-map-editor";

/**
 * Warehouse detail page. Three responsibilities:
 *
 *   1. Identify the site (code/name header).
 *   2. Bulk-generate the rack grid. Operator enters the shape once
 *      (aisles, bays, levels, positions) and gets every rack code
 *      created in-place. Re-running with a larger shape fills in only
 *      the missing codes (idempotent via ON CONFLICT DO NOTHING).
 *   3. Attach a PDF floor plan via URL. Phase-2 work will render it
 *      in a click-to-pin viewer; for now the embedded iframe at least
 *      confirms the file is reachable and previewable in the browser.
 */
export default function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = theme;
  const { id } = use(params);
  const utils = trpc.useUtils();
  const warehouse = trpc.warehouse.byId.useQuery({ id });
  const locations = trpc.location.listByWarehouse.useQuery({ warehouseId: id });

  const bulk = trpc.location.bulkGenerate.useMutation({
    onSuccess: () => utils.location.listByWarehouse.invalidate({ warehouseId: id }),
  });
  const setMap = trpc.warehouse.setMapPdfUrl.useMutation({
    onSuccess: () => utils.warehouse.byId.invalidate({ id }),
  });
  const setPin = trpc.location.setMapPosition.useMutation({
    onSuccess: () => utils.location.listByWarehouse.invalidate({ warehouseId: id }),
  });
  const [activePinId, setActivePinId] = useState<string | null>(null);

  const [aisleCount, setAisleCount] = useState(6);
  const [baysPerAisle, setBaysPerAisle] = useState(20);
  const [levelsPerBay, setLevelsPerBay] = useState(4);
  const [positionsPerLevel, setPositionsPerLevel] = useState(2);

  const [mapUrl, setMapUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  // Prime the URL field only when it's an EXTERNAL URL the user
  // pasted — the local /api/... route we set after an upload isn't
  // meaningful for the user to edit, so leave the field blank then.
  useMemo(() => {
    const existing = warehouse.data?.mapPdfUrl;
    if (existing && !existing.startsWith("/api/") && mapUrl === "") {
      setMapUrl(existing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouse.data?.mapPdfUrl]);

  async function handleUploadFile(file: File) {
    setUploadErr(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/warehouses/${id}/upload-map`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Upload failed (${res.status})`);
      }
      await utils.warehouse.byId.invalidate({ id });
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const racks = locations.data?.filter((l) => l.type === "rack") ?? [];
  const byAisle = useMemo(() => {
    const m: Record<string, typeof racks> = {};
    for (const r of racks) {
      const a = r.aisle ?? "—";
      (m[a] ??= []).push(r);
    }
    return m;
  }, [racks]);
  const preview = previewCode(aisleCount, baysPerAisle, levelsPerBay, positionsPerLevel);
  const projected =
    aisleCount * baysPerAisle * levelsPerBay * positionsPerLevel;

  return (
    <div>
      <PageTitle
        eyebrow={warehouse.data?.code ?? "Site"}
        title={warehouse.data?.name ?? "Warehouse"}
        subtitle="Manage the rack grid and the floor map for this site."
      />

      <Card t={t}>
        <Section title="Rack grid">
          <p style={{ fontSize: 13.5, color: t.body, margin: "0 0 14px" }}>
            Enter how many aisles, bays per aisle, levels per bay, and positions
            per level. We&apos;ll create every rack location with a canonical
            code like <code style={{ fontFamily: FONTS.mono }}>A-03-2-04</code>.
            Safe to re-run — only new codes get added.
          </p>

          <div
            data-collapse-grid
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <Field label="Aisles">
              <TextField
                t={t}
                type="number"
                min={1}
                value={aisleCount}
                onChange={(e) => setAisleCount(Number(e.target.value))}
              />
            </Field>
            <Field label="Bays / aisle">
              <TextField
                t={t}
                type="number"
                min={1}
                value={baysPerAisle}
                onChange={(e) => setBaysPerAisle(Number(e.target.value))}
              />
            </Field>
            <Field label="Levels / bay">
              <TextField
                t={t}
                type="number"
                min={1}
                value={levelsPerBay}
                onChange={(e) => setLevelsPerBay(Number(e.target.value))}
              />
            </Field>
            <Field label="Positions / level">
              <TextField
                t={t}
                type="number"
                min={1}
                value={positionsPerLevel}
                onChange={(e) => setPositionsPerLevel(Number(e.target.value))}
              />
            </Field>
          </div>

          <div
            style={{
              background: t.surfaceAlt,
              border: `1.5px dashed ${t.border}`,
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 12.5,
              color: t.body,
              marginBottom: 14,
              fontFamily: FONTS.mono,
            }}
          >
            Will create <strong>{projected.toLocaleString()}</strong> locations;
            first &amp; last codes: <strong>{preview.first}</strong> …{" "}
            <strong>{preview.last}</strong>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Btn
              t={t}
              type="button"
              variant="accent"
              size="md"
              icon={Ic.Plus}
              disabled={bulk.isPending || projected < 1}
              onClick={() =>
                bulk.mutate({
                  warehouseId: id,
                  aisleCount,
                  baysPerAisle,
                  levelsPerBay,
                  positionsPerLevel,
                })
              }
            >
              {bulk.isPending ? "Generating…" : "Generate locations"}
            </Btn>
            {bulk.data && (
              <span style={{ fontSize: 12, color: t.muted }}>
                Created {bulk.data.inserted} new location(s)
                {bulk.data.requested
                  ? ` out of ${bulk.data.requested} requested`
                  : ""}
                .
              </span>
            )}
          </div>
          {bulk.error && (
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
              {bulk.error.message}
            </div>
          )}
        </Section>

        <Section title="Floor map (PDF)">
          <p style={{ fontSize: 13.5, color: t.body, margin: "0 0 14px" }}>
            Upload a PDF of this warehouse&apos;s floor plan (max 4MB) or,
            for larger files, paste a public URL. Once a map is attached,
            use the Map editor below to click where each rack sits.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 14,
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
                cursor: uploading ? "progress" : "pointer",
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <Ic.Upload size={16} />
              {uploading ? "Uploading…" : "Upload PDF"}
              <input
                type="file"
                accept="application/pdf"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadFile(f);
                  // Reset so the same file can be re-selected if needed.
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
            {warehouse.data?.mapPdfFilename && (
              <span style={{ fontSize: 12, color: t.muted }}>
                Current: {warehouse.data.mapPdfFilename}
              </span>
            )}
            {warehouse.data?.mapPdfUrl && (
              <Btn
                t={t}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMap.mutate({ id, url: null });
                  setMapUrl("");
                }}
                disabled={setMap.isPending}
              >
                Clear map
              </Btn>
            )}
          </div>
          {uploadErr && (
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
              {uploadErr}
            </div>
          )}

          <details style={{ marginTop: 6 }}>
            <summary
              style={{
                fontSize: 12,
                color: t.muted,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Or paste an external URL instead
            </summary>
            <div
              data-collapse-grid
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                marginTop: 10,
              }}
            >
              <TextField
                t={t}
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="https://…/floor-plan.pdf"
              />
              <Btn
                t={t}
                type="button"
                variant="secondary"
                size="md"
                icon={Ic.Check}
                disabled={setMap.isPending}
                onClick={() =>
                  setMap.mutate({ id, url: mapUrl.trim() || null })
                }
              >
                {setMap.isPending ? "Saving…" : "Save URL"}
              </Btn>
            </div>
          </details>
          {setMap.error && (
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
              {setMap.error.message}
            </div>
          )}
        </Section>
      </Card>

      {warehouse.data?.mapPdfUrl && racks.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Map editor
          </div>
          <Card t={t}>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 13, color: t.body }}>
                Location to pin:
              </span>
              <select
                value={activePinId ?? ""}
                onChange={(e) => setActivePinId(e.target.value || null)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: t.surfaceAlt,
                  border: `1.5px solid ${t.border}`,
                  fontSize: 13,
                  color: t.ink,
                  fontFamily: FONTS.mono,
                  minWidth: 160,
                }}
              >
                <option value="">— select —</option>
                {racks
                  .slice()
                  .sort((x, y) => (x.code ?? "").localeCompare(y.code ?? ""))
                  .map((r) => {
                    const pinned = r.mapX !== null && r.mapY !== null;
                    return (
                      <option key={r.id} value={r.id}>
                        {r.code} {pinned ? "●" : ""}
                      </option>
                    );
                  })}
              </select>
              {activePinId && (
                <Btn
                  t={t}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPin.mutate({ id: activePinId, mapX: null, mapY: null });
                    setActivePinId(null);
                  }}
                >
                  Clear pin
                </Btn>
              )}
              <Tag t={t} tone="neutral">
                {racks.filter((r) => r.mapX !== null).length}/{racks.length} pinned
              </Tag>
            </div>
            <PdfMapEditor
              pdfUrl={warehouse.data.mapPdfUrl}
              locations={racks}
              activeLocationId={activePinId}
              onPlace={(x, y) => {
                if (!activePinId) return;
                setPin.mutate({ id: activePinId, mapX: x, mapY: y });
              }}
              onPickExisting={(locId) => setActivePinId(locId)}
            />
          </Card>
        </div>
      )}

      {Object.keys(byAisle).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Rack locations ({racks.length} total)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.keys(byAisle)
              .sort()
              .map((a) => {
                const rows = byAisle[a]!;
                return (
                  <Card t={t} key={a} padding={14}>
                    <div
                      style={{
                        fontFamily: FONTS.mono,
                        fontWeight: 700,
                        color: t.ink,
                        marginBottom: 6,
                      }}
                    >
                      Aisle {a}{" "}
                      <span
                        style={{
                          fontWeight: 400,
                          fontSize: 12,
                          color: t.muted,
                        }}
                      >
                        · {rows.length} locations
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                        gap: 4,
                      }}
                    >
                      {rows
                        .slice()
                        .sort((x, y) =>
                          (x.code ?? "").localeCompare(y.code ?? ""),
                        )
                        .map((r) => {
                          const pinned = r.mapX !== null && r.mapY !== null;
                          return (
                            <span
                              key={r.id}
                              style={{
                                fontFamily: FONTS.mono,
                                fontSize: 11.5,
                                color: t.body,
                                padding: "4px 6px",
                                borderRadius: 6,
                                background: pinned ? t.primarySoft : t.surfaceAlt,
                                textAlign: "center",
                                position: "relative",
                              }}
                              title={pinned ? "Pinned on map" : "Not pinned"}
                            >
                              {r.code}
                              {pinned && (
                                <span
                                  style={{
                                    marginLeft: 3,
                                    color: t.primaryDeep,
                                    fontSize: 10,
                                  }}
                                >
                                  ●
                                </span>
                              )}
                            </span>
                          );
                        })}
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

function previewCode(a: number, b: number, l: number, p: number) {
  const first = `A-01-1-01`;
  const lastAisle = aisleLabel(Math.max(0, a - 1));
  const bb = String(Math.max(1, b)).padStart(2, "0");
  const pp = String(Math.max(1, p)).padStart(2, "0");
  const last = `${lastAisle}-${bb}-${Math.max(1, l)}-${pp}`;
  return { first, last };
}

function aisleLabel(index: number): string {
  let n = index;
  let out = "";
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return out;
}
