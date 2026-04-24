"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { theme, FONTS } from "~/lib/theme";

/**
 * Interactive PDF map with pin placement. Accepts a list of locations
 * that may have mapX/mapY set (0-1 normalized coordinates) and
 * renders each as a dot over the PDF. When `activeLocationId` is set,
 * clicks on the canvas call `onPlace(x, y)` with normalized coords
 * so the parent can persist the pin to the server.
 *
 * Why pdfjs-dist instead of an iframe: iframes don't expose a click
 * coordinate relative to the PDF content — the browser's own PDF
 * viewer consumes all events. Rendering to a <canvas> ourselves lets
 * us overlay an absolutely-positioned layer that captures clicks
 * with known coordinates.
 *
 * pdfjs is loaded lazily via dynamic import so it only ships to the
 * client when this component actually renders (the warehouse detail
 * page). Worker URL is pointed at the matching version on unpkg so
 * we don't have to configure a webpack worker loader.
 */

interface MarkerLocation {
  id: string;
  code: string;
  mapX: string | null;
  mapY: string | null;
}

export function PdfMapEditor({
  pdfUrl,
  locations,
  activeLocationId,
  onPlace,
  onPickExisting,
}: {
  pdfUrl: string;
  locations: MarkerLocation[];
  activeLocationId: string | null;
  onPlace: (x: number, y: number) => void;
  onPickExisting: (id: string) => void;
}) {
  const t = theme;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setRendered(false);
    (async () => {
      try {
        // Lazy-load pdfjs. `legacy/build/pdf.mjs` is the Node-free
        // ESM entry that works in Next's client bundle.
        const pdfjs = await import("pdfjs-dist");
        // Point pdfjs at its matching worker on unpkg. The version
        // read from pdfjs.version guarantees we don't drift.
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        if (cancelled) return;

        // Render at the canvas's current pixel width, preserving the
        // PDF's aspect ratio.
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
    if (!activeLocationId || !pageSize || !wrapRef.current) return;
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
          host blocks cross-origin requests, pdfjs can&apos;t fetch it — host
          the map somewhere public-CORS-friendly (S3 public bucket, GitHub raw,
          Dropbox direct link).
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
          cursor: activeLocationId ? "crosshair" : "default",
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
            return (
              <button
                key={loc.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickExisting(loc.id);
                }}
                title={`Click to re-pin ${loc.code}`}
                style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: activeLocationId === loc.id ? 20 : 14,
                  height: activeLocationId === loc.id ? 20 : 14,
                  borderRadius: 999,
                  background:
                    activeLocationId === loc.id ? t.coral : t.primary,
                  border: `2px solid ${t.ink}`,
                  padding: 0,
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  ...(pinLabelStyles(loc.code, t) as CSSProperties),
                }}
                aria-label={`Map pin for ${loc.code}`}
              />
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
        {activeLocationId ? (
          <>
            Click anywhere on the map to pin the selected location. Click an
            existing pin to pick it for re-placement.
          </>
        ) : (
          <>Select a location below and click the map to pin it.</>
        )}
      </div>
    </div>
  );
}

function pinLabelStyles(_code: string, _t: typeof theme) {
  // Placeholder — future enhancement can render the code as a label
  // next to the pin. Kept as a no-op now so the component stays
  // lightweight.
  return {};
}
