import { z } from "zod";
import { and, eq } from "drizzle-orm";
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
