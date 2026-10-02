import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
import { createDatabasePoolConfig } from "./config";

export type Db = Pick<
  NodePgDatabase<typeof schema>,
  "select" | "insert" | "update" | "delete" | "query" | "transaction"
>;

let db: Db | null = null;

/**
 * Production DB handle (node-postgres — plain TCP driver; Neon Postgres via
 * its pooled endpoint since 2026-08-10, see the superseded note in
 * docs/adr/hosting-hybrid.md). Tests inject a PGlite-backed drizzle instance
 * through the same Db type, so data-access code never knows which driver it
 * runs on.
 *
 * Pool stays small (max 3) because each Vercel function instance gets its
 * own pool and Neon's pooler multiplexes them — see the ADR for the pooling
 * revisit trigger. TLS turns on for every host except localhost (Neon
 * requires it; local dev Postgres typically doesn't have a cert to offer).
 */
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set.");
    }

    const pool = new Pool(createDatabasePoolConfig(url));

    db = drizzle(pool, { schema });
  }

  return db;
}

export { schema };
