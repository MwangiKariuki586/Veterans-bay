export interface MarketplaceCategorySummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface ModeratedListingSummary {
  id: string;
  organisationId: string;
  organisationName: string;
  slug: string;
  name: string;
  category: string | null;
  publicationStatus: string;
  moderationStatus: "clear" | "hidden";
  moderationReason: string | null;
  moderatedAt: string | null;
  updatedAt: string;
}

export interface ModeratedListingPage {
  items: ModeratedListingSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
