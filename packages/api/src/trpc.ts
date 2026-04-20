import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Db } from "@wms/db";

export interface CreateContextOptions {
  db: Db;
  /** Clerk user id, null if not authenticated. */
  userId: string | null;
  /** Clerk org id for the active tenant. */
  orgId: string | null;
  role: "admin" | "manager" | "operator" | null;
}

export async function createTRPCContext(opts: CreateContextOptions) {
  return opts;
}
export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Authenticated: requires a signed-in user. */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** Tenant-scoped: requires a user AND an active org. */
export const tenantProcedure = authedProcedure.use(({ ctx, next }) => {
  if (!ctx.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No active organization" });
  return next({ ctx: { ...ctx, orgId: ctx.orgId } });
});

/** Admin-only. */
export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  return next();
});
