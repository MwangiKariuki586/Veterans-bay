import "dotenv/config";
import { createDatabaseClient } from "./src/platform/database/client.ts";
import { MarketplaceRepository } from "./src/modules/marketplace/repository.ts";
import { PublicCatalogueRepository } from "./src/modules/professional-services/public-repository.ts";

const client = createDatabaseClient(process.env.DATABASE_URL);
try {
  const marketRepo = new MarketplaceRepository(client.db);
  const popular = await marketRepo.listPopular({ limit: 3 });
  console.log("popular count:", popular.length);
  console.log(popular.map(p => ({slug: p.slug, name: p.name, rating: p.providerAverageRatingHundredths, reviews: p.providerReviewCount})));
  
  if (popular.length > 0) {
    const slug = popular[0].slug;
    console.log("testing public catalogue for slug:", slug);
    const pubRepo = new PublicCatalogueRepository(client.db);
    const found = await pubRepo.findServiceBySlug(slug);
    console.log("found:", found ? `yes: ${found.service.slug} status ${found.service.status}` : "null");
    if (!found) {
      console.log("NOT FOUND - would show Listing unavailable");
      // try to see why
      const { professionalServices } = await import("./src/platform/database/schema/professional-services.ts");
      const { eq } = await import("drizzle-orm");
      const rows = await client.db.select().from(professionalServices).where(eq(professionalServices.slug, slug)).limit(5);
      console.log("raw rows:", rows.map(r => ({slug: r.slug, status: r.status, moderation: r.moderationStatus})));
    }
  }
} catch(e){ console.error(e.stack || e) }
finally { await client.close() }
