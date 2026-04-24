"use client";

import { useEffect, useRef, useState } from "react";
import { theme, FONTS } from "~/lib/theme";

/**
 * Interactive PDF map with pin placement. Accepts a list of locations
 * that may have mapX/mapY set (0-1 normalized coordinates) and
 * renders each as a dot over the PDF. When `captureMode` is true,
 * clicks on the canvas call `onPlace(x, y)` with normalized coords
 * so the parent can persist the pin (or feed an in-progress layout
 * form) to the server.
 *
 * The default `captureMode` derives from `activeLocationId` for
 * backwards compat — single-location pinning keeps working the way
 * it always did. New callers that drive layout setup (per-aisle
 * start/end points) set captureMode explicitly.
 *
 * Labels: each saved pin renders an aisle/bay badge next to the
 * dot ("A03"), and a native tooltip shows the full rack code on
 * hover. Preview pins (for in-progress layout) render with a
 * dashed ring so they're visibly different from saved state.
 *
 * Why pdfjs-dist instead of an iframe: iframes don't expose a click
 * coordinate relative to the PDF content — the browser's own PDF
 * viewer consumes all events. Rendering to a <canvas> ourselves
 * lets us overlay an absolutely-positioned layer that captures
 * clicks with known coordinates.
 *
 * pdfjs is loaded lazily via dynamic import so it only ships to the
 * client when this component actually renders.
 */

interface MarkerLocation {
  id: string;
  code: string;
  aisle: string | null;
  bay: number | null;
  mapX: string | null;
  mapY: string | null;
}

export interface PreviewPin {
  x: number;
  y: number;
  label: string;
  /** Optional tone override. Default "preview" (yellow dashed). */
  tone?: "preview" | "start" | "end";
}

export function PdfMapEditor({
  pdfUrl,
  locations,
  activeLocationId,
  captureMode,
  previewPins,
  onPlace,
  onPickExisting,
}: {
  pdfUrl: string;
  locations: MarkerLocation[];
  activeLocationId: string | null;
  /** If provided, overrides the default (clicks capture whenever an
   * activeLocationId is set). Use when the page has its own active-
   * pin state machine (e.g. layout setup). */
  captureMode?: boolean;
  previewPins?: PreviewPin[];
  onPlace: (x: number, y: number) => void;
  onPickExisting: (id: string) => void;
}) {
  const t = theme;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);

  const capturing = captureMode ?? !!activeLocationId;

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setRendered(false);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const wrapWidth = wrapRef.current?.clientWidth ?? 720;
        const vp1 = page.getViewport({ scale: 1 });
        const scale = wrapWidth / vp1.width;
        const vp = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        if (cancelled) return;
        setPageSize({ w: vp.width, h: vp.height });
        setRendered(true);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Failed to load PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!capturing || !pageSize || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onPlace(x, y);
  }

  const pinnedLocations = locations.filter(
    (l) => l.mapX !== null && l.mapY !== null,
  );

  return (
    <div>
      {err && (
        <div
          style={{
            background: t.coralSoft,
            color: t.coral,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 10,
          }}
        >
          Couldn&apos;t render the PDF: {err}. If the URL requires auth or the
          host blocks cross-origin requests, pdfjs can&apos;t fetch it.
        </div>
      )}

      <div
        ref={wrapRef}
        onClick={handleClick}
        style={{
          position: "relative",
          width: "100%",
          border: `1.5px solid ${t.border}`,
          borderRadius: 12,
          overflow: "hidden",
          background: t.surfaceAlt,
          cursor: capturing ? "crosshair" : "default",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%" }} />
        {!rendered && !err && (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: t.muted,
              fontSize: 13,
            }}
          >
            Loading map…
          </div>
        )}
        {/* Existing pins */}
        {rendered &&
          pinnedLocations.map((loc) => {
            const x = Number(loc.mapX);
            const y = Number(loc.mapY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            const isActive = activeLocationId === loc.id;
            const shortLabel =
              loc.aisle && loc.bay !== null
                ? `${loc.aisle}${String(loc.bay).padStart(2, "0")}`
                : loc.code;
            return (
              <div
                key={loc.id}
                title={loc.code}
                style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  pointerEvents: "none",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickExisting(loc.id);
                  }}
                  title={`${loc.code} — click to re-pin`}
                  style={{
                    width: isActive ? 18 : 12,
                    height: isActive ? 18 : 12,
                    borderRadius: 999,
                    background: isActive ? t.coral : t.primary,
                    border: `2px solid ${t.ink}`,
                    padding: 0,
                    cursor: "pointer",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                    pointerEvents: "auto",
                  }}
                  aria-label={`Map pin for ${loc.code}`}
                />
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    color: t.ink,
                    background: "rgba(255,255,255,0.88)",
                    padding: "1px 4px",
                    borderRadius: 4,
                    border: `1px solid rgba(0,0,0,0.1)`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {shortLabel}
                </span>
              </div>
            );
          })}
        {/* Preview pins (layout in progress) */}
        {rendered &&
          (previewPins ?? []).map((pin, i) => {
            const tone = pin.tone ?? "preview";
            const color =
              tone === "start" ? t.primaryDeep : tone === "end" ? t.coral : t.primary;
            return (
              <div
                key={`preview-${i}`}
                title={pin.label}
                style={{
                  position: "absolute",
                  left: `${pin.x * 100}%`,
                  top: `${pin.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.8)",
                    border: `2px dashed ${color}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    color: t.ink,
                    background: "rgba(255,255,255,0.9)",
                    padding: "1px 4px",
                    borderRadius: 4,
                    border: `1px dashed ${color}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {pin.label}
                </span>
              </div>
            );
          })}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 12,
          color: t.muted,
          fontFamily: FONTS.sans,
        }}
      >
        {capturing
          ? "Click anywhere on the map to drop a pin."
          : "Select a location below to start pinning, or define the rack layout."}
      </div>
    </div>
  );
}
