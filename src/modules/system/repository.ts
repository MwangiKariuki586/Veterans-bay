import { sql } from "drizzle-orm";

import { createDatabaseClient } from "../../platform/database/client";
import type { DependencyStatus } from "./types";

export interface SystemRepository {
  checkDependencies(): Promise<DependencyStatus>;
}

export class RuntimeSystemRepository implements SystemRepository {
  constructor(private readonly databaseUrl: string) {}

  async checkDependencies(): Promise<DependencyStatus> {
    const client = createDatabaseClient(this.databaseUrl);

    try {
      await client.db.execute(sql`select 1`);
      return { available: true };
    } catch {
      return { available: false };
    } finally {
      await client.close();
    }
  }
}
