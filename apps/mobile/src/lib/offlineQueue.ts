import * as SQLite from "expo-sqlite";

/**
 * Offline mutation queue. Floor staff in steel-shelving aisles regularly
 * lose wifi — rather than failing the scan, we persist the intended
 * mutation to a local SQLite table and replay it when connectivity returns.
 *
 * Usage:
 *   const queue = await openQueue();
 *   try { await mutate(); } catch { await queue.enqueue("pallet.move", input); }
 *   // On app focus / network-up:
 *   await queue.drain(async (action) => trpc.resolve(action.op, action.input));
 */

export interface QueuedAction {
  id: number;
  op: string;
  input: unknown;
  createdAt: string;
}

export interface OfflineQueue {
  enqueue: (op: string, input: unknown) => Promise<void>;
  list: () => Promise<QueuedAction[]>;
  drain: (apply: (a: QueuedAction) => Promise<void>) => Promise<{ applied: number; failed: number }>;
  size: () => Promise<number>;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("wms-queue.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS pending_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          op TEXT NOT NULL,
          input TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function openQueue(): Promise<OfflineQueue> {
  const db = await getDb();

  async function list(): Promise<QueuedAction[]> {
    const rows = await db.getAllAsync<{
      id: number;
      op: string;
      input: string;
      created_at: string;
    }>("SELECT id, op, input, created_at FROM pending_actions ORDER BY id ASC");
    return rows.map((r) => ({
      id: r.id,
      op: r.op,
      input: JSON.parse(r.input),
      createdAt: r.created_at,
    }));
  }

  return {
    async enqueue(op, input) {
      await db.runAsync(
        "INSERT INTO pending_actions (op, input) VALUES (?, ?)",
        op,
        JSON.stringify(input),
      );
    },

    list,

    async size() {
      const row = await db.getFirstAsync<{ n: number }>(
        "SELECT count(*) as n FROM pending_actions",
      );
      return row?.n ?? 0;
    },

    /**
     * Apply each queued action in FIFO order. On the first failure we stop —
     * later actions often depend on earlier ones and replaying out of order
     * corrupts the ledger. Caller retries later.
     */
    async drain(apply) {
      const actions = await list();
      let applied = 0;
      let failed = 0;
      for (const a of actions) {
        try {
          await apply(a);
          await db.runAsync("DELETE FROM pending_actions WHERE id = ?", a.id);
          applied++;
        } catch {
          failed++;
          break;
        }
      }
      return { applied, failed };
    },
  };
}
