import { z } from "zod";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { schema } from "@wms/db";
import { generateLPN } from "@wms/core";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

export const palletRouter = router({
  byLpn: tenantProcedure.input(z.object({ lpn: z.string() })).query(async ({ ctx, input }) => {
    const orgId = await requireOrgId(ctx);
    const [pallet] = await ctx.db
      .select()
      .from(schema.pallets)
      .where(and(eq(schema.pallets.organizationId, orgId), eq(schema.pallets.lpn, input.lpn)))
      .limit(1);
    if (!pallet) return null;

    const items = await ctx.db
      .select()
      .from(schema.palletItems)
      .where(
        and(
          eq(schema.palletItems.palletId, pallet.id),
          eq(schema.palletItems.organizationId, orgId),
        ),
      );

    return { pallet, items };
  }),

  create: tenantProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        weightKg: z.number().positive().optional(),
        // Owning 3PL customer — copied onto the pallet so the billing
        // report can attribute receive/ship movements without joining
        // back through the inbound/outbound order. Optional because
        // own-stock (non-3PL) pallets exist too.
        customerId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const lpn = generateLPN();
      const [row] = await ctx.db
        .insert(schema.pallets)
        .values({
          organizationId: orgId,
          warehouseId: input.warehouseId,
          lpn,
          status: "in_transit",
          weightKg: input.weightKg?.toString(),
          customerId: input.customerId ?? null,
        })
        .returning();

      await ctx.db.insert(schema.labelCodes).values({
        organizationId: orgId,
        code: lpn,
        kind: "pallet",
        palletId: row!.id,
      });
      return row;
    }),

  /**
   * Operator worklist of pallets needing putaway. The Tasks page shows
   * this as a sibling section to pick lanes — pallets at the dock
   * (status='received') plus any in-transit pallets that already have
   * a location set. Per row includes the current location code so the
   * operator knows which dock door to walk to, plus a suggested rack
   * (first available rack in the same warehouse — placeholder for a
   * smarter velocity/customer-zone strategy later).
   */
  putawayQueue: tenantProcedure
    .input(z.object({ warehouseId: z.string().uuid().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const rows = await ctx.db
        .select({
          palletId: schema.pallets.id,
          lpn: schema.pallets.lpn,
          status: schema.pallets.status,
          warehouseId: schema.pallets.warehouseId,
          warehouseCode: schema.warehouses.code,
          currentLocationId: schema.pallets.currentLocationId,
          locationCode: schema.locations.code,
          customerId: schema.pallets.customerId,
          customerName: schema.customers.name,
          createdAt: schema.pallets.createdAt,
        })
        .from(schema.pallets)
        .leftJoin(
          schema.locations,
          eq(schema.locations.id, schema.pallets.currentLocationId),
        )
        .leftJoin(
          schema.warehouses,
          eq(schema.warehouses.id, schema.pallets.warehouseId),
        )
        .leftJoin(
          schema.customers,
          eq(schema.customers.id, schema.pallets.customerId),
        )
        .where(
          and(
            eq(schema.pallets.organizationId, orgId),
            or(
              eq(schema.pallets.status, "received"),
              eq(schema.pallets.status, "in_transit"),
            ),
            input.warehouseId
              ? eq(schema.pallets.warehouseId, input.warehouseId)
              : undefined,
          ),
        )
        .orderBy(asc(schema.pallets.createdAt));

      if (rows.length === 0) return [];

      // Suggested rack: first available rack in each pallet's warehouse,
      // sorted by code. Cheap "first rack" placeholder — directed
      // putaway with velocity / customer-zone rules is a later layer.
      const warehouseIds = Array.from(new Set(rows.map((r) => r.warehouseId)));
      const racks = await ctx.db
        .select({
          id: schema.locations.id,
          code: schema.locations.code,
          warehouseId: schema.locations.warehouseId,
        })
        .from(schema.locations)
        .where(
          and(
            eq(schema.locations.organizationId, orgId),
            eq(schema.locations.type, "rack"),
            inArray(schema.locations.warehouseId, warehouseIds),
          ),
        )
        .orderBy(asc(schema.locations.code));

      const suggestedByWarehouse = new Map<string, { id: string; code: string }>();
      for (const r of racks) {
        if (!suggestedByWarehouse.has(r.warehouseId)) {
          suggestedByWarehouse.set(r.warehouseId, { id: r.id, code: r.code });
        }
      }

      return rows.map((r) => ({
        ...r,
        suggestedRack: suggestedByWarehouse.get(r.warehouseId) ?? null,
      }));
    }),

  /**
   * Edit a single pallet_item line — qty, lot, expiry. Used by the
   * inventory By-pallet view for in-place corrections (recount, lot
   * fix, mis-keyed expiry). Any actual qty change writes a movement
   * row with reason='adjust' and a note capturing the before→after so
   * the inventory ledger has a paper trail; lot/expiry edits don't
   * touch movements (the pallet still has the same physical units).
   */
  updateItem: tenantProcedure
    .input(
      z.object({
        palletItemId: z.string().uuid(),
        qty: z.number().int().min(0).optional(),
        lot: z.string().trim().max(80).nullable().optional(),
        expiry: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(schema.palletItems)
          .where(
            and(
              eq(schema.palletItems.id, input.palletItemId),
              eq(schema.palletItems.organizationId, orgId),
            ),
          )
          .limit(1);
        if (!item) throw new Error("Pallet item not found");

        // Build the diff so we (a) skip a no-op update and (b) record
        // a useful "before → after" note on the movement row.
        const patch: Partial<typeof schema.palletItems.$inferInsert> = {};
        if (input.qty !== undefined && input.qty !== item.qty) {
          patch.qty = input.qty;
        }
        if (input.lot !== undefined && (input.lot ?? null) !== item.lot) {
          patch.lot = input.lot;
        }
        if (
          input.expiry !== undefined &&
          (input.expiry ? input.expiry.getTime() : null) !==
            (item.expiry ? new Date(item.expiry).getTime() : null)
        ) {
          patch.expiry = input.expiry;
        }
        if (Object.keys(patch).length === 0) {
          return { ok: true, changed: false };
        }

        await tx
          .update(schema.palletItems)
          .set(patch)
          .where(eq(schema.palletItems.id, item.id));

        if (patch.qty !== undefined) {
          const [pallet] = await tx
            .select({
              id: schema.pallets.id,
              currentLocationId: schema.pallets.currentLocationId,
            })
            .from(schema.pallets)
            .where(eq(schema.pallets.id, item.palletId))
            .limit(1);
          await tx.insert(schema.movements).values({
            organizationId: orgId,
            palletId: item.palletId,
            fromLocationId: pallet?.currentLocationId ?? null,
            toLocationId: pallet?.currentLocationId ?? null,
            reason: "adjust",
            notes: `qty ${item.qty} → ${patch.qty} on pallet_item ${item.id.slice(0, 8)}`,
          });
        }

        return { ok: true, changed: true };
      });
    }),

  move: tenantProcedure
    .input(
      z.object({
        palletId: z.string().uuid(),
        toLocationId: z.string().uuid(),
        reason: z.enum(["putaway", "move", "pick", "adjust"]).default("move"),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [pallet] = await tx
          .select()
          .from(schema.pallets)
          .where(and(eq(schema.pallets.id, input.palletId), eq(schema.pallets.organizationId, orgId)))
          .limit(1);
        if (!pallet) throw new Error("Pallet not found");

        await tx.insert(schema.movements).values({
          organizationId: orgId,
          palletId: pallet.id,
          fromLocationId: pallet.currentLocationId,
          toLocationId: input.toLocationId,
          reason: input.reason,
          notes: input.notes,
        });

        await tx
          .update(schema.pallets)
          .set({
            currentLocationId: input.toLocationId,
            status: input.reason === "putaway" ? "stored" : pallet.status,
          })
          .where(eq(schema.pallets.id, pallet.id));

        return { ok: true };
      });
    }),
});
