import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@wms/db/schema";
import { appRouter } from "../root";
import { createTRPCContext } from "../trpc";
import { ensureProvisioned } from "../provisioning";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export interface Harness {
  container: StartedPostgreSqlContainer;
  db: ReturnType<typeof drizzle<typeof schema>>;
  pg: ReturnType<typeof postgres>;
  /** Caller for the given Clerk org id — resolves to a tRPC server caller. */
  caller: (clerkOrgId?: string, clerkUserId?: string) => Promise<ReturnType<typeof appRouter.createCaller>>;
  stop: () => Promise<void>;
}

/**
 * Boot a throwaway Postgres, apply migrations, and return a function that
 * yields a tRPC caller pinned to a (user, org). Shared across test files via
 * vitest's beforeAll hook — containers take 20-30s to pull the first time.
 */
export async function createHarness(): Promise<Harness> {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();
  const pg = postgres(url, { max: 1 });
  const db = drizzle(pg, { schema });

  // Resolve migrations folder relative to packages/db regardless of where
  // vitest is invoked from.
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(here, "../../../db/migrations");
  await migrate(db, { migrationsFolder });

  // RLS is tested separately — disable it in integration tests so we can
  // exercise application-layer tenant scoping without threading a session
  // variable through every query.
  await pg`
    DO $$
    DECLARE t text;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
      END LOOP;
    END $$;
  `;

  async function caller(
    clerkOrgId = "org_test",
    clerkUserId = "user_test",
  ) {
    await ensureProvisioned(db, {
      userId: clerkUserId,
      email: `${clerkUserId}@test.local`,
      name: "Test User",
      orgId: clerkOrgId,
      orgName: "Test Org",
      role: "admin",
    });
    const ctx = await createTRPCContext({
      db,
      userId: clerkUserId,
      orgId: clerkOrgId,
      role: "admin",
    });
    return appRouter.createCaller(ctx);
  }

  async function stop() {
    await pg.end();
    await container.stop();
  }

  return { container, db, pg, caller, stop };
}
