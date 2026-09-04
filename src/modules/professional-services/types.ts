export type ServiceStatus = "draft" | "published" | "unpublished";
export type FulfilmentModel = "on_site" | "remote" | "hybrid";
export type PricingModel = "fixed" | "starting_from" | "custom_quote";

export interface ProfessionalServiceSummary {
  id: string;
  organisationId: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  fulfilmentModel: FulfilmentModel | null;
  pricingModel: PricingModel | null;
  priceMinor: number | null;
  currency: string;
  estimatedDurationMinutes: number | null;
  serviceAreas: string[];
  requirements: string[];
  warrantyDurationDays: number | null;
  warrantyTerms: string | null;
  directBookingEnabled: boolean;
  status: ServiceStatus;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedImageAsset {
  id: string;
  assetId: string;
  imageUrl: string | null;
}

export interface ManagedPortfolioItem extends ManagedImageAsset {
  title: string;
  description: string | null;
}

export interface ManagedProfessionalProfile {
  organisationId: string;
  professionalProfileId: string;
  slug: string;
  businessName: string;
  organisationStatus: string;
  description: string | null;
  primaryCategory: string | null;
  operatingLocation: string | null;
  experienceStartedYear: number | null;
  serviceAreas: string[];
  availabilitySummary: string | null;
  verificationStatus: string;
  logoAssetId: string | null;
  logoUrl: string | null;
  phone?: string | null;
  email?: string | null;
  portfolio: ManagedPortfolioItem[];
  updatedAt: string;
}

export interface ProfessionalServiceSnapshot extends Record<string, unknown> {
  serviceId: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  fulfilmentModel: FulfilmentModel;
  pricingModel: PricingModel;
  priceMinor: number | null;
  currency: string;
  estimatedDurationMinutes: number | null;
  serviceAreas: string[];
  requirements: string[];
  warrantyDurationDays: number | null;
  warrantyTerms: string | null;
  directBookingEnabled: boolean;
  imageAssetIds: string[];
  version: number;
  publishedAt: string;
}

export interface PublicPortfolioItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
}

export interface PublicServiceCard {
  slug: string;
  name: string;
  category: string;
  description: string;
  fulfilmentModel: FulfilmentModel;
  pricingModel: PricingModel;
  priceMinor: number | null;
  currency: string;
  estimatedDurationMinutes: number | null;
  serviceAreas: string[];
  directBookingEnabled: boolean;
  imageUrl: string | null;
}

export interface PublicProfessionalProfile {
  slug: string;
  businessName: string;
  description: string | null;
  primaryCategory: string | null;
  categories: string[];
  operatingLocation: string | null;
  serviceAreas: string[];
  availabilitySummary: string | null;
  nextAvailableSlot: { startsAt: string; timezone: string } | null;
  verified: boolean;
  logoUrl: string | null;
  rating: number | null;
  reviewCount: number;
  completedJobs: number;
  responseIndicator: string | null;
  experienceYears?: number | null;
  organisationCreatedAt?: string | null;
  reviews?: Array<{
    id: string;
    clientName: string;
    overallRating: number;
    feedback: string;
    submittedAt: string;
    response: { body: string; createdAt: string } | null;
  }>;
  portfolio: PublicPortfolioItem[];
  services: PublicServiceCard[];
}

export interface PublicServiceDetail extends PublicServiceCard {
  requirements: string[];
  warrantyDurationDays: number | null;
  warrantyTerms: string | null;
  images: string[];
  provider: Omit<
    PublicProfessionalProfile,
    "categories" | "portfolio" | "services"
  >;
  reviews?: Array<{
    id: string;
    clientName: string;
    overallRating: number;
    feedback: string;
    submittedAt: string;
    response: { body: string; createdAt: string } | null;
  }>;
}
