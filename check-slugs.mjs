import "dotenv/config";
import { createDatabaseClient } from "./src/platform/database/client.ts";
import { professionalServices } from "./src/platform/database/schema/professional-services.ts";
import { sql } from "drizzle-orm";

const client = createDatabaseClient(process.env.DATABASE_URL);
try {
  const rows = await client.db.execute(sql`select slug, count(*) as cnt from professional_services group by slug having count(*) > 1 limit 5`);
  console.log("duplicate slugs:", rows.rows);
  const all = await client.db.select({slug: professionalServices.slug, status: professionalServices.status, moderation: professionalServices.moderationStatus}).from(professionalServices).limit(10);
  console.log("sample:", all.slice(0,3));
} catch(e){ console.error(e) }
finally { await client.close() }
