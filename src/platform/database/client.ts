import { neonConfig, Pool } from "@neondatabase/serverless";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

// Cloudflare Workers cannot reliably maintain persistent WebSockets to Neon.
// Use HTTP fetch for pooled queries. In Vitest we keep the dedicated
// WebSocket path (ws package) for isolated transactional tests, otherwise
// prefer fetch for both Workers and Node dev to avoid the "hung" detection
// seen in miniflare when the WS handshake never completes.
function shouldUseFetchTransport(): boolean {
  if (typeof process !== "undefined" && (process.env.VITEST === "true" || process.env.NODE_ENV === "test")) {
    return false;
  }
  return true;
}

if (shouldUseFetchTransport()) {
  neonConfig.poolQueryViaFetch = true;
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
}

export type DatabaseSchema = typeof schema;
export type Database = NeonDatabase<DatabaseSchema>;

export interface DatabaseClient {
  db: Database;
  close: () => Promise<void>;
}

const pooledClients = new Map<string, Pool>();

function isTestEnvironment(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

export function createDatabaseClient(connectionString: string): DatabaseClient {
  // In test/ Vitest we must isolate connections so transactions roll back cleanly.
  if (isTestEnvironment()) {
    const pool = new Pool({ connectionString });
    const db = drizzle({ client: pool, schema });
    return {
      db,
      close: async () => {
        await pool.end();
      },
    };
  }

  let pool = pooledClients.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString });
    pooledClients.set(connectionString, pool);
  }
  const db = drizzle({ client: pool, schema });

  return {
    db,
    // In Workers the Pool is reused across requests in the same isolate.
    // Closing per request would force TLS re-handshake (~200-800ms) and
    // cause the thundering-herd seen in HAR (1250ms for categories).
    close: async () => {},
  };
}

export async function destroyPooledClients(): Promise<void> {
  const pools = Array.from(pooledClients.values());
  pooledClients.clear();
  await Promise.all(pools.map((pool) => pool.end()));
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
