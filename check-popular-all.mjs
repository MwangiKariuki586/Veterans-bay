import "dotenv/config";
import { createDatabaseClient } from "./src/platform/database/client.ts";
import { MarketplaceRepository } from "./src/modules/marketplace/repository.ts";
import { PublicCatalogueRepository } from "./src/modules/professional-services/public-repository.ts";
import { PublicCatalogueService } from "./src/modules/professional-services/public-service.ts";
import { BookingsRepository } from "./src/modules/bookings/repository.ts";

const client = createDatabaseClient(process.env.DATABASE_URL);
try {
  const marketRepo = new MarketplaceRepository(client.db);
  // Test with no location and with location
  for (const loc of [undefined, "Nairobi", "Westlands"]) {
    console.log("\n=== Popular for location:", loc ?? "none ===");
    const popular = await marketRepo.listPopular({ location: loc, limit: 3 });
    console.log(popular.map(p => ({slug: p.slug, name: p.name, loc: p.providerLocation, areas: p.serviceAreas.slice(0,2)})));
    for (const p of popular) {
      const pubRepo = new PublicCatalogueRepository(client.db);
      const service = new PublicCatalogueService(pubRepo, process.env.CLOUDINARY_CLOUD_NAME, new BookingsRepository(client.db));
      try {
        const data = await service.getService(p.slug);
        console.log(`  ✓ ${p.slug} -> found: ${data.name} provider ${data.provider.businessName}`);
      } catch (e) {
        console.log(`  ✗ ${p.slug} -> ERROR: ${e.message}`);
        console.error(e.stack);
      }
    }
  }
} catch(e){ console.error(e) }
finally { await client.close() }
