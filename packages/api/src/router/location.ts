import { z } from "zod";
import { and, eq } from "drizzle-orm";
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
      let row: typeof schema.locations.$inferSelect | undefined;
      try {
        const [r] = await ctx.db
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
        row = r;
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A location with code "${input.code}" already exists in this warehouse. Pick a different code or check the list above.`,
          });
        }
        throw e;
      }

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
              // Map pins are OPTIONAL. With pins, each bay gets a
              // mapX/mapY interpolated along the start→end line so it
              // shows up on the floor-plan view. Without pins, the
              // codes are still generated — the map placement just
              // stays unset and the operator sees them as a list.
              startX: z.number().min(0).max(1).nullable().optional(),
              startY: z.number().min(0).max(1).nullable().optional(),
              endX: z.number().min(0).max(1).nullable().optional(),
              endY: z.number().min(0).max(1).nullable().optional(),
              // Optional intermediate waypoints. When the aisle isn't
              // straight (L-shaped, dog-leg, curving around an
              // obstruction), the operator drops one or more
              // waypoints between start and end and bays distribute
              // evenly along the resulting polyline by arc length.
              waypoints: z
                .array(
                  z.object({
                    x: z.number().min(0).max(1),
                    y: z.number().min(0).max(1),
                  }),
                )
                .max(20)
                .optional(),
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
        const hasPins =
          aisle.startX != null &&
          aisle.startY != null &&
          aisle.endX != null &&
          aisle.endY != null;

        // Build the polyline: start → waypoints → end. Then compute
        // segment lengths so we can place bays by arc-length so they
        // stay evenly spaced even on an L-shaped aisle.
        let polyline: Array<{ x: number; y: number }> = [];
        let cumLen: number[] = [];
        let totalLen = 0;
        if (hasPins) {
          polyline = [
            { x: aisle.startX!, y: aisle.startY! },
            ...(aisle.waypoints ?? []),
            { x: aisle.endX!, y: aisle.endY! },
          ];
          cumLen = [0];
          for (let i = 1; i < polyline.length; i++) {
            const dx = polyline[i]!.x - polyline[i - 1]!.x;
            const dy = polyline[i]!.y - polyline[i - 1]!.y;
            const seg = Math.hypot(dx, dy);
            totalLen += seg;
            cumLen.push(totalLen);
          }
        }
        const pointAtT = (
          tFrac: number,
        ): { x: number; y: number } => {
          // tFrac is 0..1 along the whole polyline by arc length.
          if (polyline.length === 0)
            return { x: 0, y: 0 };
          if (polyline.length === 1 || totalLen === 0)
            return { x: polyline[0]!.x, y: polyline[0]!.y };
          const target = tFrac * totalLen;
          // Find the segment whose cumulative range contains target.
          for (let i = 1; i < polyline.length; i++) {
            if (target <= cumLen[i]!) {
              const segLen = cumLen[i]! - cumLen[i - 1]!;
              const localT = segLen === 0 ? 0 : (target - cumLen[i - 1]!) / segLen;
              const p0 = polyline[i - 1]!;
              const p1 = polyline[i]!;
              return {
                x: p0.x + (p1.x - p0.x) * localT,
                y: p0.y + (p1.y - p0.y) * localT,
              };
            }
          }
          return { x: polyline[polyline.length - 1]!.x, y: polyline[polyline.length - 1]!.y };
        };

        for (let b = 1; b <= aisle.bayCount; b++) {
          let mx: string | undefined;
          let my: string | undefined;
          if (hasPins) {
            const tRaw =
              aisle.bayCount === 1 ? 0 : (b - 1) / (aisle.bayCount - 1);
            const t = aisle.reverseBayNumbers ? 1 - tRaw : tRaw;
            const p = pointAtT(t);
            mx = p.x.toString();
            my = p.y.toString();
          }
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
                mapX: mx,
                mapY: my,
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
   * Detect aisle configuration from an image of the warehouse floor
   * plan via OpenAI Vision (gpt-4o). The client renders page 1 of
   * the uploaded PDF to a canvas, grabs a base64 PNG, and sends it
   * here. We forward the image to OpenAI with a structured-response
   * prompt and parse the returned JSON.
   *
   * Vision beats OCR for floor plans because plans are geometric
   * drawings — the model actually looks at the shapes and reasons
   * about aisle runs and bay counts rather than trying to extract
   * text from a mostly blank page.
   *
   * Returns {letter, bayCount?} per aisle. Caller merges into the
   * layout form so the user reviews before generating.
   */
  detectAislesFromMap: managerProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        imageDataUrl: z
          .string()
          .regex(/^data:image\/(png|jpeg);base64,/, "Expected a PNG/JPEG data URL"),
        userHint: z.string().trim().max(1000).optional(),
        /** Vector geometry extracted from the PDF on the client side
         * via pdfjs. Coordinates are normalized 0-1 with origin at
         * top-left of the page. Stripped to "interesting" shapes
         * before transmission so the prompt stays compact. */
        vectorHints: z
          .object({
            rects: z
              .array(
                z.object({
                  x: z.number(),
                  y: z.number(),
                  w: z.number(),
                  h: z.number(),
                }),
              )
              .max(500),
            lines: z
              .array(
                z.object({
                  x1: z.number(),
                  y1: z.number(),
                  x2: z.number(),
                  y2: z.number(),
                }),
              )
              .max(300),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OPENAI_API_KEY not set on the server.",
        });
      }

      // Make sure the warehouse belongs to the caller before we burn
      // an API call on behalf of something they don't own.
      const [wh] = await ctx.db
        .select({ id: schema.warehouses.id })
        .from(schema.warehouses)
        .where(
          and(
            eq(schema.warehouses.id, input.warehouseId),
            eq(schema.warehouses.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!wh) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Warehouse not found" });
      }

      // Format the vector hints compactly for the prompt. Round
      // coords to 3 decimals so a few hundred shapes don't bloat
      // the message.
      const fmt = (n: number) => Math.round(n * 1000) / 1000;
      const vectorBlock = input.vectorHints
        ? [
            "GEOMETRY EXTRACTED DIRECTLY FROM THE PDF (use these as ground truth — these are the EXACT shapes the drawing contains, not your guess from the image):",
            `${input.vectorHints.rects.length} rectangles (x, y, w, h, all 0-1 fractions of page):`,
            input.vectorHints.rects
              .map((r) => `(${fmt(r.x)},${fmt(r.y)},${fmt(r.w)},${fmt(r.h)})`)
              .join(" "),
            `${input.vectorHints.lines.length} long lines (x1,y1,x2,y2):`,
            input.vectorHints.lines
              .map((l) => `(${fmt(l.x1)},${fmt(l.y1)},${fmt(l.x2)},${fmt(l.y2)})`)
              .join(" "),
            "Long-thin rectangles (one dimension >> the other) and pairs of long parallel lines are likely rack runs. Use the IMAGE to read aisle labels and identify which shapes are racking vs walls vs doors. Use these COORDS for your start/end output — don't make up positions.",
          ].join("\n")
        : "";

      const prompt = [
        "You are analyzing a warehouse floor plan.",
        input.userHint
          ? `The person who uploaded this drawing told you: """${input.userHint.replace(/"/g, "'")}""". Use this as your primary guide.`
          : "",
        vectorBlock,
        "Identify every rack aisle (a continuous run of pallet racking). Real warehouses are often NOT rectangular — expect L-shapes, mezzanines, irregular bays added later, aisles of different lengths, and aisles oriented at different angles. Each aisle is independent: its bay count, length, and orientation can differ from every other aisle. Do NOT assume uniform sizing; do NOT treat the building outline as the only thing that matters.",
        "STRICT RULES:",
        "1. Use the GEOMETRY block above as ground truth for shape and position — your start/end coords MUST correspond to actual rectangles or lines in that list. Do NOT distribute aisles 'evenly' if the geometry shows them clustered, and do NOT invent rectangles that aren't in the list.",
        "2. The image is for reading labels and disambiguating which shapes are racking vs walls/doors/text — not for guessing geometry.",
        "3. Each aisle's start/end pair should follow the LONG axis of that specific rack run, even if other aisles run perpendicular. Don't force every aisle into the same orientation.",
        "4. Return aisles individually. Bay counts can vary widely between aisles (some may have 5 bays, others 30); use the visible geometry to estimate each one separately rather than averaging.",
        "5. If you genuinely can't tell which shapes are racks, return {\"aisles\":[],\"notes\":\"<describe the geometry you saw>\"}.",
        "6. For each aisle return: letter, bayCount (estimated divisions along the run — count tick marks, sub-rectangles, or use length-÷-typical-bay-width if those are absent), startX/Y (center of first bay), endX/Y (center of last bay).",
        "7. Coord system: (0,0)=top-left, (1,1)=bottom-right.",
        "8. In `notes`, name the specific rectangles you picked (by their coords) and why — that lets the user verify you read the actual drawing. Also mention any sections you couldn't classify.",
        'Return minified JSON: {"aisles":[{"letter":"A","bayCount":20,"startX":0.10,"startY":0.30,"endX":0.90,"endY":0.30}],"notes":"..."}.',
        "No prose, no markdown, no code fences — just the JSON.",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: input.imageDataUrl, detail: "high" },
                },
              ],
            },
          ],
          max_tokens: 800,
          temperature: 0,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `OpenAI returned ${res.status}: ${body.slice(0, 500)}`,
        });
      }
      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? "";
      const clampFrac = (v: unknown): number | undefined => {
        if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
        return Math.max(0, Math.min(1, v));
      };
      let aisles: Array<{
        letter: string;
        bayCount?: number;
        startX?: number;
        startY?: number;
        endX?: number;
        endY?: number;
      }> = [];
      let notes = "";
      try {
        const parsed = JSON.parse(content) as {
          aisles?: Array<{
            letter?: unknown;
            bayCount?: unknown;
            startX?: unknown;
            startY?: unknown;
            endX?: unknown;
            endY?: unknown;
          }>;
          notes?: unknown;
        };
        if (typeof parsed.notes === "string") notes = parsed.notes;
        aisles = (parsed.aisles ?? [])
          .map((a) => ({
            letter:
              typeof a.letter === "string"
                ? a.letter.toUpperCase().slice(0, 3)
                : "",
            bayCount:
              typeof a.bayCount === "number" && Number.isFinite(a.bayCount)
                ? Math.max(1, Math.round(a.bayCount))
                : undefined,
            startX: clampFrac(a.startX),
            startY: clampFrac(a.startY),
            endX: clampFrac(a.endX),
            endY: clampFrac(a.endY),
          }))
          .filter((a) => a.letter.length > 0);
      } catch {
        aisles = parseAislesFromText(content);
      }
      return { aisles, notes };
    }),

  /**
   * Per-aisle detection. The user crops a region around ONE aisle on
   * the floor plan and sends just that crop. Vision answers a much
   * narrower question — "how many bays are in THIS rack run" — which
   * is far more reliable than asking it to map the whole non-uniform
   * warehouse in a single call. Returns a single aisle with bay count
   * and start/end coords IN THE CROP'S 0-1 frame; the client maps
   * those back into full-page coordinates using the crop bounds.
   */
  detectSingleAisleInRegion: managerProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        imageDataUrl: z
          .string()
          .regex(/^data:image\/(png|jpeg);base64,/, "Expected a PNG/JPEG data URL"),
        userHint: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OPENAI_API_KEY not set on the server.",
        });
      }
      const [wh] = await ctx.db
        .select({ id: schema.warehouses.id })
        .from(schema.warehouses)
        .where(
          and(
            eq(schema.warehouses.id, input.warehouseId),
            eq(schema.warehouses.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!wh) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Warehouse not found" });
      }

      const prompt = [
        "You are looking at a CROPPED region of a warehouse floor plan that contains exactly ONE rack aisle (a continuous run of pallet racking).",
        input.userHint
          ? `Hint from the user: """${input.userHint.replace(/"/g, "'")}""". Use this as your primary guide.`
          : "",
        "Find the rack run inside this crop and answer:",
        "  - letter: a single uppercase letter or 1-3 char code identifying the aisle. If the image shows a label (e.g. 'A', 'B12', 'AISLE C'), use it. Otherwise return an empty string and the caller will assign one.",
        "  - bayCount: how many bays / sub-rectangles are along the rack run. Count tick marks, sub-divisions, or use length-÷-typical-bay-width.",
        "  - startX, startY: center of the FIRST bay (in this crop's frame, 0-1).",
        "  - endX, endY: center of the LAST bay (in this crop's frame, 0-1).",
        "Coord system in your response: (0,0)=top-left of THIS CROP, (1,1)=bottom-right of THIS CROP. Do not return coords outside [0,1].",
        "If there is no rack run in the image, return {\"letter\":\"\",\"bayCount\":0,\"startX\":0,\"startY\":0,\"endX\":0,\"endY\":0,\"notes\":\"<what you saw>\"}.",
        'Return minified JSON: {"letter":"A","bayCount":12,"startX":0.05,"startY":0.5,"endX":0.95,"endY":0.5,"notes":"..."}.',
        "No prose, no markdown, no code fences — just the JSON.",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: input.imageDataUrl, detail: "high" },
                },
              ],
            },
          ],
          max_tokens: 300,
          temperature: 0,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `OpenAI returned ${res.status}: ${body.slice(0, 500)}`,
        });
      }
      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? "";
      const clamp = (v: unknown): number | undefined => {
        if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
        return Math.max(0, Math.min(1, v));
      };
      try {
        const parsed = JSON.parse(content) as {
          letter?: unknown;
          bayCount?: unknown;
          startX?: unknown;
          startY?: unknown;
          endX?: unknown;
          endY?: unknown;
          notes?: unknown;
        };
        const letter =
          typeof parsed.letter === "string"
            ? parsed.letter.trim().toUpperCase().slice(0, 3)
            : "";
        const bayCount =
          typeof parsed.bayCount === "number" && Number.isFinite(parsed.bayCount)
            ? Math.max(0, Math.round(parsed.bayCount))
            : 0;
        return {
          letter,
          bayCount,
          startX: clamp(parsed.startX),
          startY: clamp(parsed.startY),
          endX: clamp(parsed.endX),
          endY: clamp(parsed.endY),
          notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 500) : "",
        };
      } catch {
        return {
          letter: "",
          bayCount: 0,
          startX: undefined,
          startY: undefined,
          endX: undefined,
          endY: undefined,
          notes: "Couldn't parse AI response.",
        };
      }
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

  /**
   * Wipe mapX/mapY from every rack location in a warehouse.
   * Used by the "Reset layout" button to clear bad auto-placements
   * from a previous generation pass without deleting the locations
   * (they keep their codes; you just have to re-pin).
   */
  clearAllMapPins: managerProcedure
    .input(z.object({ warehouseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const result = await ctx.db
        .update(schema.locations)
        .set({ mapX: null, mapY: null })
        .where(
          and(
            eq(schema.locations.warehouseId, input.warehouseId),
            eq(schema.locations.organizationId, orgId),
          ),
        )
        .returning({ id: schema.locations.id });
      return { cleared: result.length };
    }),

  /**
   * Delete every rack location in a warehouse. Nuclear option —
   * useful when an auto-generated layout was so wrong that the
   * codes themselves are useless (wrong aisle letters, wrong bay
   * counts) and the user wants a clean slate. Pallets currently
   * stored at one of these locations would orphan, so we refuse
   * if any pallet has a current_location_id pointing into the set.
   */
  deleteAllRacks: managerProcedure
    .input(z.object({ warehouseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      // Bail if any pallet is currently sitting at one of these locations.
      const inUse = await ctx.db
        .select({ id: schema.pallets.id })
        .from(schema.pallets)
        .innerJoin(
          schema.locations,
          eq(schema.locations.id, schema.pallets.currentLocationId),
        )
        .where(
          and(
            eq(schema.locations.warehouseId, input.warehouseId),
            eq(schema.locations.organizationId, orgId),
            eq(schema.locations.type, "rack"),
          ),
        )
        .limit(1);
      if (inUse.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Can't delete: at least one pallet is stored at a rack in this warehouse. Move pallets first.",
        });
      }
      const result = await ctx.db
        .delete(schema.locations)
        .where(
          and(
            eq(schema.locations.warehouseId, input.warehouseId),
            eq(schema.locations.organizationId, orgId),
            eq(schema.locations.type, "rack"),
          ),
        )
        .returning({ id: schema.locations.id });
      return { deleted: result.length };
    }),
});
