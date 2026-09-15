import "server-only";

import { getCachedCategories, searchMarketplaceServer } from "@/lib/marketplace-server";
import type { MarketplaceSearchQuery } from "@/modules/marketplace/types";
import { MarketplaceResultsClient } from "./marketplace-results-client";

export async function ResultsServer({
  input,
  searchKey,
}: {
  input: MarketplaceSearchQuery;
  searchKey: string;
}) {
  const result = await searchMarketplaceServer(input).catch(() => null);
  let initialError: string | null = null;
  if (!result) initialError = "Marketplace results could not be loaded.";

  return (
    <MarketplaceResultsClient
      initialResult={result}
      initialError={initialError}
      initialSearchKey={searchKey}
    />
  );
}

// Lightweight version that only streams results, categories are handled by FiltersServer.
// Kept for future split if we want separate Suspense for results only.
export async function ResultsOnlyServer({
  input,
  searchKey,
}: {
  input: MarketplaceSearchQuery;
  searchKey: string;
}) {
  const result = await searchMarketplaceServer(input).catch(() => null);
  let initialError: string | null = null;
  if (!result) initialError = "Marketplace results could not be loaded.";
  return <MarketplaceResultsClient initialResult={result} initialError={initialError} initialSearchKey={searchKey} />;
}
