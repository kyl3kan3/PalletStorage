"use client";

import { use, useMemo, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";

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

  const [aisleCount, setAisleCount] = useState(6);
  const [baysPerAisle, setBaysPerAisle] = useState(20);
  const [levelsPerBay, setLevelsPerBay] = useState(4);
  const [positionsPerLevel, setPositionsPerLevel] = useState(2);

  const [mapUrl, setMapUrl] = useState("");
  // Prime the field once the warehouse loads so the user sees the
  // existing URL (if any) and can edit it in place.
  useMemo(() => {
    if (warehouse.data?.mapPdfUrl && mapUrl === "") setMapUrl(warehouse.data.mapPdfUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouse.data?.mapPdfUrl]);

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
            Paste a URL to a PDF of this warehouse&apos;s floor plan. Any
            publicly-reachable URL works (Google Drive share, Dropbox, your
            own hosting). Phase 2 of this feature will let you click a spot
            on the PDF to pin a location there.
          </p>
          <div
            data-collapse-grid
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}
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
              variant="accent"
              size="md"
              icon={Ic.Check}
              disabled={setMap.isPending}
              onClick={() =>
                setMap.mutate({ id, url: mapUrl.trim() || null })
              }
            >
              {setMap.isPending ? "Saving…" : "Save map URL"}
            </Btn>
          </div>
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
          {warehouse.data?.mapPdfUrl && (
            <div style={{ marginTop: 14 }}>
              <iframe
                src={warehouse.data.mapPdfUrl}
                title="Warehouse floor map"
                style={{
                  width: "100%",
                  height: 500,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 12,
                  background: t.surfaceAlt,
                }}
              />
              <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>
                Preview — if nothing renders, the URL isn&apos;t publicly
                reachable or the host blocks embedding.
              </div>
            </div>
          )}
        </Section>
      </Card>

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
                        .map((r) => (
                          <span
                            key={r.id}
                            style={{
                              fontFamily: FONTS.mono,
                              fontSize: 11.5,
                              color: t.body,
                              padding: "4px 6px",
                              borderRadius: 6,
                              background: t.surfaceAlt,
                              textAlign: "center",
                            }}
                          >
                            {r.code}
                          </span>
                        ))}
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
