import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy-initialise. Next.js collects page data at build time by importing
// route modules — if we opened a pool eagerly, every build without
// DATABASE_URL would fail. We defer until first query instead.
const globalForPg = globalThis as unknown as {
  __pg?: ReturnType<typeof postgres>;
  __db?: ReturnType<typeof drizzle<typeof schema>>;
};

function getClient() {
  if (globalForPg.__pg) return globalForPg.__pg;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 10, prepare: false });
  if (process.env.NODE_ENV !== "production") globalForPg.__pg = client;
  else globalForPg.__pg = client;
  return client;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop) {
    if (!globalForPg.__db) {
      globalForPg.__db = drizzle(getClient(), { schema });
    }
    const target = globalForPg.__db as unknown as Record<string | symbol, unknown>;
    const v = target[prop];
    return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(target) : v;
  },
}) as ReturnType<typeof drizzle<typeof schema>>;

export type Db = ReturnType<typeof drizzle<typeof schema>>;
export { schema };
