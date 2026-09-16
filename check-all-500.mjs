import "dotenv/config";
import { createDatabaseClient } from "./src/platform/database/client.ts";
import { PublicCatalogueRepository } from "./src/modules/professional-services/public-repository.ts";
import { PublicCatalogueService } from "./src/modules/professional-services/public-service.ts";
import { BookingsRepository } from "./src/modules/bookings/repository.ts";
import { professionalServices } from "./src/platform/database/schema/professional-services.ts";

const client = createDatabaseClient(process.env.DATABASE_URL);
try {
  const all = await client.db.select({slug: professionalServices.slug}).from(professionalServices).limit(100);
  console.log("total slugs:", all.length);
  for (const {slug} of all) {
    const pubRepo = new PublicCatalogueRepository(client.db);
    const svc = new PublicCatalogueService(pubRepo, process.env.CLOUDINARY_CLOUD_NAME, new BookingsRepository(client.db));
    try {
      const data = await svc.getService(slug);
      // console.log(`✓ ${slug}`);
    } catch (e) {
      if (e.status === 500 || e.code === "INTERNAL_ERROR" || e.message.includes("unexpected")) {
        console.log(`500 ✗ ${slug} -> ${e.message} code=${e.code} status=${e.status}`);
        console.error(e.stack?.slice(0,500));
      } else if (e.status === 404) {
        // console.log(`404 ${slug}`);
      } else {
        console.log(`other ✗ ${slug} -> ${e.message} code=${e.code}`);
      }
    }
  }
  console.log("done");
} catch(e){ console.error(e) }
finally { await client.close() }
