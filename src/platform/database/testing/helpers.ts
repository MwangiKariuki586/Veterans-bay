import { sql } from "drizzle-orm";

import {
  createDatabaseClient,
  type Database,
  type DatabaseClient,
  requireDatabaseUrl,
} from "../client";
import { configureNodeDatabaseRuntime } from "../node-runtime";

export interface DatabaseTestContext {
  client: DatabaseClient;
  db: Database;
  databaseUrl: string;
}

export function requireTestDatabaseUrl(): string {
  return requireDatabaseUrl(process.env.DATABASE_URL);
}

export async function withDatabaseClient<T>(
  databaseUrl: string,
  run: (context: DatabaseTestContext) => Promise<T>,
): Promise<T> {
  configureNodeDatabaseRuntime();
  const client = createDatabaseClient(databaseUrl);

  try {
    return await run({
      client,
      db: client.db,
      databaseUrl,
    });
  } finally {
    await client.close();
  }
}

export async function withTestDatabase<T>(
  run: (context: DatabaseTestContext) => Promise<T>,
): Promise<T> {
  return withDatabaseClient(requireTestDatabaseUrl(), run);
}

export async function withRolledBackTransaction<T>(
  db: Database,
  run: (tx: Database) => Promise<T>,
): Promise<T> {
  return db
    .transaction(async (tx) => {
      const result = await run(tx as Database);
      throw new RollbackSignal(result);
    })
    .catch((error: unknown) => {
      if (error instanceof RollbackSignal) {
        return error.result as T;
      }

      throw error;
    });
}

class RollbackSignal<T> extends Error {
  readonly result: T;

  constructor(result: T) {
    super("Intentional transaction rollback for isolated database tests.");
    this.name = "RollbackSignal";
    this.result = result;
  }
}

export async function assertDatabaseConnected(db: Database): Promise<void> {
  await db.execute(sql`select 1`);
}
