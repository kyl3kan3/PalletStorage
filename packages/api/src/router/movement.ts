import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

export const movementRouter = router({
  recent: tenantProcedure
    .input(z.object({ palletId: z.string().uuid().optional(), limit: z.number().int().max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select()
        .from(schema.movements)
        .where(
          and(
            eq(schema.movements.organizationId, orgId),
            input.palletId ? eq(schema.movements.palletId, input.palletId) : undefined,
          ),
        )
        .orderBy(desc(schema.movements.createdAt))
        .limit(input.limit);
    }),
});
