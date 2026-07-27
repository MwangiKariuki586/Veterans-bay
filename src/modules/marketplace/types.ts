import type { FulfilmentModel, PricingModel } from "../professional-services/types";

export interface MarketplaceSearchQuery {
  q?: string;
  category?: string;
  location?: string;
  fulfilmentModel?: FulfilmentModel;
  pricingModel?: PricingModel;
  availability?: "today";
  verified?: "true" | "false";
  sort: "relevance" | "newest";
  page: number;
  pageSize: number;
}

export interface MarketplaceListing {
  slug: string;
  name: string;
  category: string;
  description: string;
  fulfilmentModel: FulfilmentModel;
  pricingModel: PricingModel;
  priceMinor: number | null;
  currency: string;
  serviceAreas: string[];
  imageUrl: string | null;
  provider: {
    slug: string;
    businessName: string;
    operatingLocation: string | null;
    verified: boolean;
  };
}

export interface MarketplaceSearchResult {
  items: MarketplaceListing[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type MarketplaceAnalyticsEvent =
  | {
      eventType: "marketplace.search_performed";
      activeFilters: Array<
        | "q"
        | "category"
        | "location"
        | "fulfilmentModel"
        | "pricingModel"
        | "availability"
        | "verified"
      >;
      page: number;
      resultCount: number;
      sort: "relevance" | "newest";
    }
  | {
      eventType: "professional.profile_viewed" | "service.viewed";
      targetSlug: string;
    };
