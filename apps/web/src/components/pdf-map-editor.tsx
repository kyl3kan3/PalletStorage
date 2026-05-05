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
  drawMode,
  previewPins,
  onPlace,
  onDraw,
  onPickExisting,
}: {
  pdfUrl: string;
  locations: MarkerLocation[];
  activeLocationId: string | null;
  /** If provided, overrides the default (clicks capture whenever an
   * activeLocationId is set). Use when the page has its own active-
   * pin state machine (e.g. layout setup). */
  captureMode?: boolean;
  /** When true, mouse drags on the canvas call `onDraw(x1,y1,x2,y2)`
   * with normalized coords. Replaces the click handler so the user
   * can swipe across a rack to define an aisle in one gesture. */
  drawMode?: boolean;
  previewPins?: PreviewPin[];
  onPlace: (x: number, y: number) => void;
  onDraw?: (x1: number, y1: number, x2: number, y2: number) => void;
  onPickExisting: (id: string) => void;
}) {
  const t = theme;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const capturing = captureMode ?? !!activeLocationId;
  const drawing = !!drawMode && !!onDraw;

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

  function normalizedFrom(e: React.MouseEvent<HTMLDivElement>) {
    if (!wrapRef.current) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (drawing) return; // drag handlers below cover this case
    if (!capturing || !pageSize) return;
    const p = normalizedFrom(e);
    if (!p) return;
    onPlace(p.x, p.y);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!drawing || !pageSize) return;
    const p = normalizedFrom(e);
    if (!p) return;
    e.preventDefault();
    setDrawStart(p);
    setDrawCurrent(p);
  }
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!drawing || !drawStart) return;
    const p = normalizedFrom(e);
    if (!p) return;
    setDrawCurrent(p);
  }
  function handleMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (!drawing || !drawStart || !onDraw) {
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }
    const p = normalizedFrom(e) ?? drawCurrent;
    if (!p) {
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }
    // Ignore tiny accidental drags so a stray click doesn't create
    // a zero-length aisle.
    const dx = p.x - drawStart.x;
    const dy = p.y - drawStart.y;
    if (Math.hypot(dx, dy) >= 0.01) {
      onDraw(drawStart.x, drawStart.y, p.x, p.y);
    }
    setDrawStart(null);
    setDrawCurrent(null);
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setDrawStart(null);
          setDrawCurrent(null);
        }}
        style={{
          position: "relative",
          width: "100%",
          border: `1.5px solid ${t.border}`,
          borderRadius: 12,
          overflow: "hidden",
          background: t.surfaceAlt,
          cursor: drawing ? "crosshair" : capturing ? "crosshair" : "default",
          userSelect: drawing ? "none" : undefined,
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
        {/* Live drag-to-draw overlay — shows the line the user is
            currently swiping across the rack. */}
        {rendered && drawing && drawStart && drawCurrent && (
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <line
              x1={`${drawStart.x * 100}%`}
              y1={`${drawStart.y * 100}%`}
              x2={`${drawCurrent.x * 100}%`}
              y2={`${drawCurrent.y * 100}%`}
              stroke={t.primaryDeep}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle
              cx={`${drawStart.x * 100}%`}
              cy={`${drawStart.y * 100}%`}
              r={5}
              fill={t.primaryDeep}
              stroke={t.ink}
              strokeWidth={1.5}
            />
            <circle
              cx={`${drawCurrent.x * 100}%`}
              cy={`${drawCurrent.y * 100}%`}
              r={5}
              fill={t.coral}
              stroke={t.ink}
              strokeWidth={1.5}
            />
          </svg>
        )}
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
        {drawing
          ? "Click and drag across a rack to define an aisle's start → end in one swipe."
          : capturing
            ? "Click anywhere on the map to drop a pin."
            : "Select a location below to start pinning, or define the rack layout."}
      </div>
    </div>
  );
}
