import "server-only";

import { getCachedCategories } from "@/lib/marketplace-server";
import { MarketplaceFiltersClient } from "./marketplace-filters-client";

export async function FiltersServer() {
  const categories = await getCachedCategories().catch(() => []);
  const names = categories.map((c) => c.name);
  return <MarketplaceFiltersClient initialCategories={names} />;
}

export async function FiltersDesktopServer() {
  const categories = await getCachedCategories().catch(() => []);
  const names = categories.map((c) => c.name);
  return <MarketplaceFiltersClient initialCategories={names} variant="desktop" />;
}

export async function FiltersMobileServer() {
  const categories = await getCachedCategories().catch(() => []);
  const names = categories.map((c) => c.name);
  return <MarketplaceFiltersClient initialCategories={names} variant="mobile" />;
}
