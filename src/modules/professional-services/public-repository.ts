import { and, asc, desc, eq } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { organisations } from "../../platform/database/schema/organisations";
import { professionalProfiles } from "../../platform/database/schema/professional-onboarding";
import {
  professionalPortfolioItems,
  professionalServiceImages,
  professionalServices,
} from "../../platform/database/schema/professional-services";
import {
  professionalReputation,
  reviewResponses,
  reviews,
} from "../../platform/database/schema/reviews";

export interface PublicProfessionalRecord {
  organisationId: string;
  slug: string;
  businessName: string;
  description: string | null;
  primaryCategory: string | null;
  operatingLocation: string | null;
  serviceAreas: string[];
  workingHours: Record<string, { enabled: boolean; opensAt: string; closesAt: string }>;
  verificationStatus: string;
  logoPublicId: string | null;
}

export type PublicServiceRecord = typeof professionalServices.$inferSelect;

export interface PublicAssetRecord {
  id: string;
  publicId: string;
}

export interface PublicPortfolioRecord extends PublicAssetRecord {
  title: string;
  description: string | null;
}

export interface PublicCatalogueStore {
  findProfessionalBySlug(slug: string): Promise<PublicProfessionalRecord | null>;
  findServiceBySlug(slug: string): Promise<{
    service: PublicServiceRecord;
    professional: PublicProfessionalRecord;
  } | null>;
  listServices(organisationId: string): Promise<PublicServiceRecord[]>;
  listPortfolio(organisationId: string): Promise<PublicPortfolioRecord[]>;
  listServiceImages(serviceId: string): Promise<PublicAssetRecord[]>;
  getReputation?(
    organisationId: string,
  ): Promise<typeof professionalReputation.$inferSelect | null>;
  listReviews?(organisationId: string): Promise<Array<{
    id: string;
    clientName: string;
    overallRating: number;
    feedback: string;
    submittedAt: Date;
    responseBody: string | null;
    responseCreatedAt: Date | null;
  }>>;
}

const professionalSelection = {
  organisationId: organisations.id,
  slug: organisations.slug,
  businessName: organisations.name,
  description: professionalProfiles.description,
  primaryCategory: professionalProfiles.primaryCategory,
  operatingLocation: professionalProfiles.operatingLocation,
  serviceAreas: professionalProfiles.serviceAreas,
  workingHours: professionalProfiles.workingHours,
  verificationStatus: professionalProfiles.verificationStatus,
  logoPublicId: fileAssets.cloudinaryPublicId,
};

export class PublicCatalogueRepository implements PublicCatalogueStore {
  constructor(private readonly db: Database) {}

  async findProfessionalBySlug(slug: string): Promise<PublicProfessionalRecord | null> {
    const [record] = await this.db
      .select(professionalSelection)
      .from(organisations)
      .innerJoin(
        professionalProfiles,
        eq(professionalProfiles.organisationId, organisations.id),
      )
      .leftJoin(
        fileAssets,
        and(
          eq(fileAssets.id, professionalProfiles.logoAssetId),
          eq(fileAssets.visibility, "public"),
          eq(fileAssets.status, "ready"),
          eq(fileAssets.purpose, "PROFESSIONAL_LOGO"),
        ),
      )
      .where(and(eq(organisations.slug, slug), eq(organisations.status, "active")))
      .limit(1);
    return record ?? null;
  }

  async findServiceBySlug(slug: string): Promise<{
    service: PublicServiceRecord;
    professional: PublicProfessionalRecord;
  } | null> {
    const [record] = await this.db
      .select({ service: professionalServices, professional: professionalSelection })
      .from(professionalServices)
      .innerJoin(
        organisations,
        eq(organisations.id, professionalServices.organisationId),
      )
      .innerJoin(
        professionalProfiles,
        eq(professionalProfiles.organisationId, organisations.id),
      )
      .leftJoin(
        fileAssets,
        and(
          eq(fileAssets.id, professionalProfiles.logoAssetId),
          eq(fileAssets.visibility, "public"),
          eq(fileAssets.status, "ready"),
          eq(fileAssets.purpose, "PROFESSIONAL_LOGO"),
        ),
      )
      .where(
        and(
          eq(professionalServices.slug, slug),
          eq(professionalServices.status, "published"),
          eq(professionalServices.moderationStatus, "clear"),
          eq(organisations.status, "active"),
        ),
      )
      .limit(1);
    return record ?? null;
  }

  async listServices(organisationId: string): Promise<PublicServiceRecord[]> {
    return this.db
      .select()
      .from(professionalServices)
      .where(
        and(
          eq(professionalServices.organisationId, organisationId),
          eq(professionalServices.status, "published"),
          eq(professionalServices.moderationStatus, "clear"),
        ),
      )
      .orderBy(asc(professionalServices.name), asc(professionalServices.id));
  }

  async listPortfolio(organisationId: string): Promise<PublicPortfolioRecord[]> {
    return this.db
      .select({
        id: professionalPortfolioItems.id,
        title: professionalPortfolioItems.title,
        description: professionalPortfolioItems.description,
        publicId: fileAssets.cloudinaryPublicId,
      })
      .from(professionalPortfolioItems)
      .innerJoin(fileAssets, eq(fileAssets.id, professionalPortfolioItems.assetId))
      .where(
        and(
          eq(professionalPortfolioItems.organisationId, organisationId),
          eq(fileAssets.visibility, "public"),
          eq(fileAssets.status, "ready"),
          eq(fileAssets.purpose, "PORTFOLIO_IMAGE"),
        ),
      )
      .orderBy(asc(professionalPortfolioItems.createdAt), asc(professionalPortfolioItems.id));
  }

  async listServiceImages(serviceId: string): Promise<PublicAssetRecord[]> {
    return this.db
      .select({ id: professionalServiceImages.id, publicId: fileAssets.cloudinaryPublicId })
      .from(professionalServiceImages)
      .innerJoin(fileAssets, eq(fileAssets.id, professionalServiceImages.assetId))
      .where(
        and(
          eq(professionalServiceImages.serviceId, serviceId),
          eq(fileAssets.visibility, "public"),
          eq(fileAssets.status, "ready"),
          eq(fileAssets.purpose, "SERVICE_IMAGE"),
        ),
      )
      .orderBy(asc(professionalServiceImages.position), asc(professionalServiceImages.id));
  }

  async getReputation(organisationId: string) {
    const [record] = await this.db
      .select()
      .from(professionalReputation)
      .where(eq(professionalReputation.organisationId, organisationId))
      .limit(1);
    return record ?? null;
  }

  async listReviews(organisationId: string) {
    return this.db
      .select({
        id: reviews.id,
        clientName: accountProfiles.displayName,
        overallRating: reviews.overallRating,
        feedback: reviews.feedback,
        submittedAt: reviews.submittedAt,
        responseBody: reviewResponses.body,
        responseCreatedAt: reviewResponses.createdAt,
      })
      .from(reviews)
      .innerJoin(accountProfiles, eq(accountProfiles.id, reviews.clientAccountId))
      .leftJoin(reviewResponses, eq(reviewResponses.reviewId, reviews.id))
      .where(
        and(
          eq(reviews.organisationId, organisationId),
          eq(reviews.status, "PUBLISHED"),
        ),
      )
      .orderBy(desc(reviews.submittedAt), desc(reviews.id))
      .limit(20);
  }
}
