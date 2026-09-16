import "dotenv/config";
import { createDatabaseClient } from "./src/platform/database/client.ts";
import { PublicCatalogueRepository } from "./src/modules/professional-services/public-repository.ts";
import { PublicCatalogueService } from "./src/modules/professional-services/public-service.ts";
import { BookingsRepository } from "./src/modules/bookings/repository.ts";
import { professionalServices } from "./src/platform/database/schema/professional-services.ts";
import { eq } from "drizzle-orm";

const client = createDatabaseClient(process.env.DATABASE_URL);
try {
  const all = await client.db.select({slug: professionalServices.slug, status: professionalServices.status, mod: professionalServices.moderationStatus, cat: professionalServices.category, desc: professionalServices.description, fulfil: professionalServices.fulfilmentModel, pricing: professionalServices.pricingModel, price: professionalServices.priceMinor}).from(professionalServices).where(eq(professionalServices.status, "published")).limit(20);
  console.log("published count sample:", all.length);
  for (const s of all) {
    const pubRepo = new PublicCatalogueRepository(client.db);
    const svc = new PublicCatalogueService(pubRepo, process.env.CLOUDINARY_CLOUD_NAME, new BookingsRepository(client.db));
    try {
      const data = await svc.getService(s.slug);
      console.log(`✓ ${s.slug} ok`);
    } catch (e) {
      console.log(`✗ ${s.slug} FAIL: ${e.message} code=${e.code} status=${e.status}`);
      console.log(`  cat=${s.cat} desc=${!!s.desc} fulfil=${s.fulfil} pricing=${s.pricing} price=${s.price}`);
    }
  }
} catch(e){ console.error(e) }
finally { await client.close() }
