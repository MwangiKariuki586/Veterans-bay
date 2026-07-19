import { Pool } from "@neondatabase/serverless";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

export type DatabaseSchema = typeof schema;
export type Database = NeonDatabase<DatabaseSchema>;

export interface DatabaseClient {
  db: Database;
  close: () => Promise<void>;
}

export function createDatabaseClient(connectionString: string): DatabaseClient {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool, schema });

  return {
    db,
    close: async () => {
      await pool.end();
    },
  };
}

export function requireDatabaseUrl(
  value: string | undefined,
  label = "DATABASE_URL",
): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${label} is required for database access.`);
  }

  return value;
}
