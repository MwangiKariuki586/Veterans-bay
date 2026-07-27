import type { MarketplaceStore } from "./repository";
import type {
  MarketplaceAnalyticsEvent,
  MarketplaceListing,
  MarketplaceSearchQuery,
  MarketplaceSearchResult,
} from "./types";

function publicImageUrl(
  cloudName: string | undefined,
  publicId: string | null,
): string | null {
  if (!cloudName || !publicId) return null;
  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${encodedPublicId}`;
}

export class MarketplaceService {
  constructor(
    private readonly store: MarketplaceStore,
    private readonly cloudName?: string,
  ) {}

  async search(input: MarketplaceSearchQuery): Promise<MarketplaceSearchResult> {
    const result = await this.store.search(input);
    const items: MarketplaceListing[] = result.items.map((item) => ({
      slug: item.slug,
      name: item.name,
      category: item.category,
      description: item.description,
      fulfilmentModel:
        item.fulfilmentModel as MarketplaceListing["fulfilmentModel"],
      pricingModel: item.pricingModel as MarketplaceListing["pricingModel"],
      priceMinor:
        item.pricingModel === "custom_quote" ? null : item.priceMinor,
      currency: item.currency,
      serviceAreas: item.serviceAreas,
      imageUrl: publicImageUrl(this.cloudName, item.imagePublicId),
      provider: {
        slug: item.providerSlug,
        businessName: item.providerName,
        operatingLocation: item.providerLocation,
        verified: item.providerVerified,
      },
    }));

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      totalItems: result.totalItems,
      totalPages: Math.max(1, Math.ceil(result.totalItems / input.pageSize)),
    };
  }

  async recordAnalytics(event: MarketplaceAnalyticsEvent): Promise<void> {
    await this.store.recordAnalytics(event);
  }
}
