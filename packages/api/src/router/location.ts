import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { generateLocationCode } from "@wms/core";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Standard WMS rack code: letter aisle, 2-digit bay, 1-digit level,
 * 2-digit position. Example: A-03-2-04. Chosen so labels are readable
 * under cold-storage lights and easy to call over radio ("A, oh-three,
 * two, oh-four").
 */
function formatRackCode(aisle: string, bay: number, level: number, position: number) {
  const bb = String(bay).padStart(2, "0");
  const pp = String(position).padStart(2, "0");
  return `${aisle}-${bb}-${level}-${pp}`;
}

/**
 * Very fragile best-effort parser for what Firecrawl extracts from a
 * floor-plan PDF. We look for two common signals:
 *
 *   1. "Aisle A", "Aisle B", ... headings → aisle letters only
 *   2. Code-like tokens "A1", "A01", "B-12", "C03" → aisle letter +
 *      max bay number seen
 *
 * Returns {letter, bayCount?} per detected aisle. The caller shows
 * these as suggestions; user still reviews/edits before generating.
 */
function parseAislesFromText(text: string): Array<{ letter: string; bayCount?: number }> {
  const aisleMaxBay = new Map<string, number>();

  // Pattern 1: "Aisle A" / "AISLE B"
  const aisleMentionRx = /\baisle\s+([A-Z]{1,3})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = aisleMentionRx.exec(text)) !== null) {
    const letter = m[1]!.toUpperCase();
    if (!aisleMaxBay.has(letter)) aisleMaxBay.set(letter, 0);
  }

  // Pattern 2: code-like tokens. Matches A1, A01, A-03, AA12, etc.
  // Anchored by a word boundary + 1-3 letters + optional separator +
  // 1-3 digits. Ignores obvious non-codes (years like "2026", letter-
  // only sequences).
  const codeRx = /\b([A-Z]{1,3})[-\s]?(\d{1,3})\b/g;
  while ((m = codeRx.exec(text)) !== null) {
    const letter = m[1]!.toUpperCase();
    const bay = Number(m[2]);
    // Skip obvious false positives — 4+ digit numbers ruled out by
    // the regex, but also skip if bay > 500 (unlikely to be a bay).
    if (!Number.isFinite(bay) || bay < 1 || bay > 500) continue;
    // Skip letters that look like units/qualifiers — FT, M, KG, etc.
    if (["FT", "IN", "CM", "MM", "KG", "LB", "M"].includes(letter)) continue;
    const prev = aisleMaxBay.get(letter) ?? 0;
    if (bay > prev) aisleMaxBay.set(letter, bay);
  }

  return Array.from(aisleMaxBay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, max]) => ({
      letter,
      bayCount: max > 0 ? max : undefined,
    }));
}

/** A, B, C, ..., Z, AA, AB, ... for >26 aisles. */
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

export const locationRouter = router({
  listByWarehouse: tenantProcedure
    .input(z.object({ warehouseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select()
        .from(schema.locations)
        .where(
          and(
            eq(schema.locations.organizationId, orgId),
            eq(schema.locations.warehouseId, input.warehouseId),
          ),
        );
    }),

  create: tenantProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        parentId: z.string().uuid().nullable().optional(),
        code: z.string().min(1),
        path: z.string().min(1),
        type: z.enum(["floor", "rack", "staging", "dock"]).default("rack"),
        maxWeightKg: z.number().positive().optional(),
        velocityClass: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .insert(schema.locations)
        .values({
          organizationId: orgId,
          warehouseId: input.warehouseId,
          parentId: input.parentId ?? null,
          code: input.code,
          path: input.path,
          type: input.type,
          maxWeightKg: input.maxWeightKg?.toString(),
          velocityClass: input.velocityClass,
        })
        .returning();

      // Issue a scannable label code for this location.
      await ctx.db.insert(schema.labelCodes).values({
        organizationId: orgId,
        code: generateLocationCode(),
        kind: "location",
        locationId: row!.id,
      });
      return row;
    }),

  /**
   * Bulk-generate the full rack grid for a warehouse. Given a shape
   * (N aisles × baysPerAisle × levelsPerBay × positionsPerLevel), this
   * inserts every combination as a rack location with a canonical code
   * (e.g. A-01-1-01). Idempotent: ON CONFLICT DO NOTHING on (warehouse,
   * path), so re-running only creates missing rows — safe to expand a
   * grid later.
   */
  bulkGenerate: managerProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        aisleCount: z.number().int().min(1).max(200),
        baysPerAisle: z.number().int().min(1).max(200),
        levelsPerBay: z.number().int().min(1).max(20),
        positionsPerLevel: z.number().int().min(1).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const rows: (typeof schema.locations.$inferInsert)[] = [];
      for (let ai = 0; ai < input.aisleCount; ai++) {
        const aisle = aisleLabel(ai);
        for (let bay = 1; bay <= input.baysPerAisle; bay++) {
          for (let level = 1; level <= input.levelsPerBay; level++) {
            for (let position = 1; position <= input.positionsPerLevel; position++) {
              const code = formatRackCode(aisle, bay, level, position);
              rows.push({
                organizationId: orgId,
                warehouseId: input.warehouseId,
                code,
                path: code,
                type: "rack",
                aisle,
                bay,
                level,
                position,
              });
            }
          }
        }
      }
      if (rows.length === 0) return { inserted: 0 };
      // Chunk large batches so we don't blow the statement size limit.
      let inserted = 0;
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const result = await ctx.db
          .insert(schema.locations)
          .values(slice)
          .onConflictDoNothing({
            target: [schema.locations.warehouseId, schema.locations.path],
          })
          .returning({ id: schema.locations.id });
        inserted += result.length;
      }
      return { inserted, requested: rows.length };
    }),

  /**
   * Bulk-generate + auto-place. For each aisle the caller specifies
   * a shape (bayCount, levelsPerBay, positionsPerLevel) and two map
   * points (startX/Y, endX/Y). Bays are distributed evenly along the
   * line between those points; levels and positions at the same bay
   * share the same map coord (they stack vertically in real life).
   *
   * Reuses the canonical code format and the ON CONFLICT DO NOTHING
   * semantics from bulkGenerate, plus writes mapX/mapY on every
   * newly-created location so the map viewer lights up immediately.
   *
   * Existing pinned locations with the same (warehouse, path) key
   * are NOT overwritten — operator can re-place them individually.
   */
  bulkGenerateWithLayout: managerProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        aisles: z
          .array(
            z.object({
              letter: z.string().trim().min(1).max(3),
              bayCount: z.number().int().min(1).max(200),
              levelsPerBay: z.number().int().min(1).max(20),
              positionsPerLevel: z.number().int().min(1).max(20),
              startX: z.number().min(0).max(1),
              startY: z.number().min(0).max(1),
              endX: z.number().min(0).max(1),
              endY: z.number().min(0).max(1),
              reverseBayNumbers: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const rows: (typeof schema.locations.$inferInsert)[] = [];
      for (const aisle of input.aisles) {
        for (let b = 1; b <= aisle.bayCount; b++) {
          // Fraction along the aisle line, 0 at the first bay and 1
          // at the last. Single-bay aisles pin at the start point.
          const tRaw = aisle.bayCount === 1 ? 0 : (b - 1) / (aisle.bayCount - 1);
          const t = aisle.reverseBayNumbers ? 1 - tRaw : tRaw;
          const mx = aisle.startX + (aisle.endX - aisle.startX) * t;
          const my = aisle.startY + (aisle.endY - aisle.startY) * t;
          for (let level = 1; level <= aisle.levelsPerBay; level++) {
            for (let pos = 1; pos <= aisle.positionsPerLevel; pos++) {
              const bb = String(b).padStart(2, "0");
              const pp = String(pos).padStart(2, "0");
              const code = `${aisle.letter}-${bb}-${level}-${pp}`;
              rows.push({
                organizationId: orgId,
                warehouseId: input.warehouseId,
                code,
                path: code,
                type: "rack",
                aisle: aisle.letter,
                bay: b,
                level,
                position: pos,
                mapX: mx.toString(),
                mapY: my.toString(),
              });
            }
          }
        }
      }
      if (rows.length === 0) return { inserted: 0 };
      let inserted = 0;
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const result = await ctx.db
          .insert(schema.locations)
          .values(slice)
          .onConflictDoNothing({
            target: [schema.locations.warehouseId, schema.locations.path],
          })
          .returning({ id: schema.locations.id });
        inserted += result.length;
      }
      return { inserted, requested: rows.length };
    }),

  /**
   * Detect aisle configuration from an uploaded floor-map PDF via
   * Firecrawl's document parser. Generates a short-lived signed URL
   * to the PDF (so Firecrawl's backend can fetch it without our
   * Clerk auth), sends it through /v1/scrape with the `pdf` parser,
   * and groups the extracted text to find aisle letters + likely
   * bay counts.
   *
   * Floor plans vary widely and text OCR of geometric diagrams is
   * best-effort, so this returns a list of {letter, bayCount}
   * suggestions the user confirms/edits in the layout UI rather
   * than creating anything directly.
   */
  detectAislesFromMap: managerProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        publicBaseUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "FIRECRAWL_API_KEY not set on the server.",
        });
      }
      const signingKey = process.env.CLERK_SECRET_KEY;
      if (!signingKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Server signing key not configured.",
        });
      }

      // Require an uploaded PDF so we have something for Firecrawl
      // to fetch. External URLs (pasted by the user) already work —
      // we pass them straight through below.
      const [wh] = await ctx.db
        .select({
          mapPdfUrl: schema.warehouses.mapPdfUrl,
        })
        .from(schema.warehouses)
        .where(
          and(
            eq(schema.warehouses.id, input.warehouseId),
            eq(schema.warehouses.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!wh?.mapPdfUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No map PDF attached to this warehouse.",
        });
      }

      // Build the URL we'll hand to Firecrawl. For user-pasted
      // external URLs we use them directly. For our own uploaded
      // files (served from /api/warehouses/.../map) we generate a
      // 10-minute HMAC-signed URL that bypasses Clerk auth.
      let targetUrl: string;
      if (wh.mapPdfUrl.startsWith("/api/")) {
        const exp = Date.now() + 10 * 60 * 1000;
        const sig = createHmac("sha256", signingKey)
          .update(`${input.warehouseId}.${exp}`)
          .digest("hex");
        const base = input.publicBaseUrl.replace(/\/$/, "");
        targetUrl = `${base}/api/warehouses/${input.warehouseId}/map-signed?exp=${exp}&sig=${sig}`;
      } else {
        targetUrl = wh.mapPdfUrl;
      }

      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ["markdown"],
          parsers: ["pdf"],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Firecrawl returned ${res.status}: ${body.slice(0, 500)}`,
        });
      }
      const payload = (await res.json()) as {
        data?: { markdown?: string; content?: string };
      };
      const text =
        payload.data?.markdown ?? payload.data?.content ?? "";
      const aisles = parseAislesFromText(text);
      return {
        rawTextLength: text.length,
        aisles,
      };
    }),

  /**
   * Save pin coordinates for a location on the warehouse map PDF.
   * Phase 2 feature — users drag/drop a marker on the viewer.
   */
  setMapPosition: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        mapX: z.number().nullable(),
        mapY: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      await ctx.db
        .update(schema.locations)
        .set({
          mapX: input.mapX === null ? null : input.mapX.toString(),
          mapY: input.mapY === null ? null : input.mapY.toString(),
        })
        .where(
          and(
            eq(schema.locations.id, input.id),
            eq(schema.locations.organizationId, orgId),
          ),
        );
      return { ok: true };
    }),
});
