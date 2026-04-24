import { initTRPC, TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import type { Db } from "@wms/db";
import { rateLimit } from "./rateLimit";

export interface CreateContextOptions {
  db: Db;
  /** Clerk user id, null if not authenticated. */
  userId: string | null;
  /** Clerk org id for the active tenant. */
  orgId: string | null;
  role: "admin" | "manager" | "operator" | null;
  /** Request correlation id (propagated to logs). */
  traceId?: string;
  /**
   * Optional hook so mutations can push certain fields back to Clerk
   * (e.g. keep the organization switcher label in sync when the user
   * renames their org from /settings/company). Injected by the Next.js
   * route handler which owns the Clerk SDK dependency.
   */
  updateClerkOrgName?: (clerkOrgId: string, name: string) => Promise<void>;
}

export async function createTRPCContext(opts: CreateContextOptions) {
  return { ...opts, traceId: opts.traceId ?? randomUUID() };
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
  // Per-user rate limit as a blast-radius guard. Stricter limits belong
  // on specific mutations (e.g. QuickBooks export) via their own guards.
  rateLimit(`user:${ctx.userId}`, { max: 600, windowMs: 60_000 });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** Tenant-scoped: requires a user AND an active org. */
export const tenantProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const orgId = ctx.orgId;
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No active organization" });
  // Enforce DB tenant context in-band for every tenant procedure so RLS
  // remains active even if a downstream query forgets an explicit
  // organizationId predicate.
  return ctx.db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    return next({
      ctx: { ...ctx, db: tx as unknown as Db, orgId },
    });
  });
});

/** Manager or admin — gate for sign-off actions (close, approve). */
export const managerProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.role !== "admin" && ctx.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager or admin role required" });
  }
  return next();
});

/** Admin-only. */
export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  return next();
});
