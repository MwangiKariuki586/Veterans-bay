import "server-only";

import { unstable_cache } from "next/cache";

import { createDatabaseClient } from "@/platform/database/client";
import { BookingsRepository } from "@/modules/bookings/repository";
import { MarketplaceRepository } from "@/modules/marketplace/repository";
import { MarketplaceService } from "@/modules/marketplace/service";
import type {
  MarketplaceSearchQuery,
  MarketplaceSearchResult,
} from "@/modules/marketplace/types";
import { MarketplaceModerationRepository } from "@/modules/marketplace-moderation/repository";
import type { MarketplaceCategorySummary } from "@/modules/marketplace-moderation/types";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for marketplace server fetch.");
  return url;
}

async function fetchMarketplaceDirect(
  input: MarketplaceSearchQuery,
): Promise<MarketplaceSearchResult> {
  const client = createDatabaseClient(getDatabaseUrl());
  try {
    const service = new MarketplaceService(
      new MarketplaceRepository(client.db),
      process.env.CLOUDINARY_CLOUD_NAME,
      new BookingsRepository(client.db),
    );
    return await service.search(input);
  } finally {
    await client.close();
  }
}

function stableKey(input: MarketplaceSearchQuery): string {
  return JSON.stringify([
    input.q ?? "",
    input.category ?? "",
    input.location ?? "",
    input.fulfilmentModel ?? "",
    input.pricingModel ?? "",
    input.availability ?? "",
    input.verified ?? "",
    input.topRated ?? "",
    input.instantBooking ?? "",
    input.sort ?? "relevance",
    input.page ?? 1,
    input.pageSize ?? 9,
  ]);
}

export async function searchMarketplaceServer(
  input: MarketplaceSearchQuery,
): Promise<MarketplaceSearchResult> {
  const key = stableKey(input);
  const cached = unstable_cache(
    () => fetchMarketplaceDirect(input),
    ["marketplace-search-v2", key],
    { revalidate: 30, tags: ["marketplace"] },
  );
  return cached();
}

async function fetchCategoriesDirect(): Promise<MarketplaceCategorySummary[]> {
  const client = createDatabaseClient(getDatabaseUrl());
  try {
    const repo = new MarketplaceModerationRepository(client.db);
    const records = await repo.listCategories("active");
    return records.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status as "active" | "inactive",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } finally {
    await client.close();
  }
}

export const getCachedCategories = unstable_cache(
  fetchCategoriesDirect,
  ["marketplace-categories-v2"],
  { revalidate: 300, tags: ["marketplace-categories"] },
);

export const getCachedCategoryNames = unstable_cache(
  async (): Promise<string[]> => {
    const cats = await getCachedCategories();
    return cats.map((c) => c.name);
  },
  ["marketplace-category-names-v2"],
  { revalidate: 300, tags: ["marketplace-categories"] },
);
