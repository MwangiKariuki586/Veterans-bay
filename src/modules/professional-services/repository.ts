import { and, asc, count, eq, max, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { AppError } from "../../platform/errors/app-error";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { professionalProfiles } from "../../platform/database/schema/professional-onboarding";
import {
  professionalPortfolioItems,
  professionalServiceImages,
  professionalServiceSnapshots,
  professionalServices,
} from "../../platform/database/schema/professional-services";
import type { ProfessionalServiceSnapshot } from "./types";

export type ProfessionalServiceRecord = typeof professionalServices.$inferSelect;
export type ManagedProfileRecord = {
  organisationId: string;
  professionalProfileId: string;
  slug: string;
  businessName: string;
  organisationStatus: string;
  description: string | null;
  primaryCategory: string | null;
  operatingLocation: string | null;
  serviceAreas: string[];
  workingHours: Record<string, { enabled: boolean; opensAt: string; closesAt: string }>;
  verificationStatus: string;
  logoAssetId: string | null;
  logoPublicId: string | null;
  updatedAt: Date;
};
export type ManagedPortfolioRecord = {
  id: string;
  assetId: string;
  title: string;
  description: string | null;
  publicId: string;
};
export type ManagedServiceImageRecord = {
  id: string;
  assetId: string;
  publicId: string;
  position: number;
};

export interface ProfessionalServicesStore {
  getOrganisationStatus(organisationId: string): Promise<string | null>;
  list(organisationId: string): Promise<ProfessionalServiceRecord[]>;
  get(organisationId: string, serviceId: string): Promise<ProfessionalServiceRecord | null>;
  createDraft(input: {
    organisationId: string;
    actorAccountId: string;
    slug: string;
    values: Omit<
      typeof professionalServices.$inferInsert,
      "id" | "organisationId" | "slug" | "status" | "version"
    >;
    correlationId?: string;
  }): Promise<ProfessionalServiceRecord>;
  update(input: ServiceMutationInput): Promise<ProfessionalServiceRecord | null>;
  publish(input: ServiceTransitionInput): Promise<ProfessionalServiceRecord | null>;
  unpublish(input: ServiceTransitionInput): Promise<ProfessionalServiceRecord | null>;
  getManagedProfile(organisationId: string): Promise<ManagedProfileRecord | null>;
  updateManagedProfile(input: {
    organisationId: string;
    values: {
      businessName: string;
      description: string;
      primaryCategory: string;
      operatingLocation: string;
      serviceAreas: string[];
    };
  }): Promise<ManagedProfileRecord | null>;
  attachLogo(input: AssetMutationInput): Promise<void>;
  listPortfolio(organisationId: string): Promise<ManagedPortfolioRecord[]>;
  addPortfolioItem(input: AssetMutationInput & {
    title: string;
    description: string | null;
    correlationId?: string;
  }): Promise<ManagedPortfolioRecord>;
  removePortfolioItem(organisationId: string, itemId: string): Promise<ManagedPortfolioRecord | null>;
  listServiceImages(organisationId: string, serviceId: string): Promise<ManagedServiceImageRecord[]>;
  addServiceImage(input: AssetMutationInput & { serviceId: string }): Promise<ManagedServiceImageRecord>;
  removeServiceImage(
    organisationId: string,
    serviceId: string,
    imageId: string,
  ): Promise<ManagedServiceImageRecord | null>;
}

interface AssetMutationInput {
  organisationId: string;
  actorAccountId: string;
  assetId: string;
}

type ServiceUpdateValues = Partial<
  Omit<
    typeof professionalServices.$inferInsert,
    "id" | "organisationId" | "slug" | "status" | "version" | "publishedAt" | "createdAt" | "updatedAt"
  >
>;

interface ServiceMutationInput {
  organisationId: string;
  serviceId: string;
  actorAccountId: string;
  expectedVersion: number;
  values: ServiceUpdateValues;
  correlationId?: string;
}

interface ServiceTransitionInput {
  organisationId: string;
  serviceId: string;
  actorAccountId: string;
  expectedVersion: number;
  correlationId?: string;
}

export class ProfessionalServicesRepository implements ProfessionalServicesStore {
  constructor(private readonly db: Database) {}

  async getOrganisationStatus(organisationId: string): Promise<string | null> {
    const [organisation] = await this.db
      .select({ status: organisations.status })
      .from(organisations)
      .where(eq(organisations.id, organisationId))
      .limit(1);
    return organisation?.status ?? null;
  }

  async list(organisationId: string): Promise<ProfessionalServiceRecord[]> {
    return this.db
      .select()
      .from(professionalServices)
      .where(eq(professionalServices.organisationId, organisationId))
      .orderBy(asc(professionalServices.createdAt), asc(professionalServices.id));
  }

  async get(
    organisationId: string,
    serviceId: string,
  ): Promise<ProfessionalServiceRecord | null> {
    const [service] = await this.db
      .select()
      .from(professionalServices)
      .where(
        and(
          eq(professionalServices.organisationId, organisationId),
          eq(professionalServices.id, serviceId),
        ),
      )
      .limit(1);
    return service ?? null;
  }

  async createDraft(input: {
    organisationId: string;
    actorAccountId: string;
    slug: string;
    values: Omit<
      typeof professionalServices.$inferInsert,
      "id" | "organisationId" | "slug" | "status" | "version"
    >;
    correlationId?: string;
  }): Promise<ProfessionalServiceRecord> {
    return this.db.transaction(async (tx) => {
      const [service] = await tx
        .insert(professionalServices)
        .values({
          organisationId: input.organisationId,
          slug: input.slug,
          status: "draft",
          ...input.values,
        })
        .returning();
      await tx.insert(outboxEvents).values({
        eventType: "service.created",
        eventVersion: 1,
        aggregateType: "professional_service",
        aggregateId: service.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { serviceId: service.id, status: "draft" },
      });
      return service;
    });
  }

  async update(input: ServiceMutationInput): Promise<ProfessionalServiceRecord | null> {
    return this.db.transaction(async (tx) => {
      const [service] = await tx
        .update(professionalServices)
        .set({
          ...input.values,
          version: sql`${professionalServices.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(professionalServices.organisationId, input.organisationId),
            eq(professionalServices.id, input.serviceId),
            eq(professionalServices.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!service) return null;
      await tx.insert(outboxEvents).values({
        eventType: "service.updated",
        eventVersion: 1,
        aggregateType: "professional_service",
        aggregateId: service.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          serviceId: service.id,
          version: service.version,
          changedFields: Object.keys(input.values).sort(),
        },
      });
      return service;
    });
  }

  async publish(input: ServiceTransitionInput): Promise<ProfessionalServiceRecord | null> {
    return this.db.transaction(async (tx) => {
      const publishedAt = new Date();
      const [service] = await tx
        .update(professionalServices)
        .set({
          status: "published",
          publishedAt,
          version: sql`${professionalServices.version} + 1`,
          updatedAt: publishedAt,
        })
        .where(
          and(
            eq(professionalServices.organisationId, input.organisationId),
            eq(professionalServices.id, input.serviceId),
            eq(professionalServices.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!service) return null;
      const imageAssets = await tx
        .select({ assetId: professionalServiceImages.assetId })
        .from(professionalServiceImages)
        .where(eq(professionalServiceImages.serviceId, service.id))
        .orderBy(asc(professionalServiceImages.position));
      const snapshot: ProfessionalServiceSnapshot = {
        serviceId: service.id,
        slug: service.slug,
        name: service.name,
        category: service.category!,
        description: service.description!,
        fulfilmentModel: service.fulfilmentModel as ProfessionalServiceSnapshot["fulfilmentModel"],
        pricingModel: service.pricingModel as ProfessionalServiceSnapshot["pricingModel"],
        priceMinor: service.pricingModel === "custom_quote" ? null : service.priceMinor,
        currency: service.currency,
        estimatedDurationMinutes: service.estimatedDurationMinutes,
        serviceAreas: service.serviceAreas,
        requirements: service.requirements,
        warrantyDurationDays: service.warrantyDurationDays,
        warrantyTerms: service.warrantyTerms,
        directBookingEnabled: service.directBookingEnabled,
        imageAssetIds: imageAssets.map((image) => image.assetId),
        version: service.version,
        publishedAt: publishedAt.toISOString(),
      };
      await tx.insert(professionalServiceSnapshots).values({
        serviceId: service.id,
        version: service.version,
        snapshot,
      });
      await tx.insert(outboxEvents).values({
        eventType: "service.published",
        eventVersion: 1,
        aggregateType: "professional_service",
        aggregateId: service.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { serviceId: service.id, version: service.version },
      });
      return service;
    });
  }

  async unpublish(input: ServiceTransitionInput): Promise<ProfessionalServiceRecord | null> {
    return this.db.transaction(async (tx) => {
      const [service] = await tx
        .update(professionalServices)
        .set({
          status: "unpublished",
          version: sql`${professionalServices.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(professionalServices.organisationId, input.organisationId),
            eq(professionalServices.id, input.serviceId),
            eq(professionalServices.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!service) return null;
      await tx.insert(outboxEvents).values({
        eventType: "service.unpublished",
        eventVersion: 1,
        aggregateType: "professional_service",
        aggregateId: service.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { serviceId: service.id, version: service.version },
      });
      return service;
    });
  }

  async getManagedProfile(
    organisationId: string,
  ): Promise<ManagedProfileRecord | null> {
    const [record] = await this.db
      .select({
        organisationId: organisations.id,
        professionalProfileId: professionalProfiles.id,
        slug: organisations.slug,
        businessName: organisations.name,
        organisationStatus: organisations.status,
        description: professionalProfiles.description,
        primaryCategory: professionalProfiles.primaryCategory,
        operatingLocation: professionalProfiles.operatingLocation,
        serviceAreas: professionalProfiles.serviceAreas,
        workingHours: professionalProfiles.workingHours,
        verificationStatus: professionalProfiles.verificationStatus,
        logoAssetId: professionalProfiles.logoAssetId,
        updatedAt: professionalProfiles.updatedAt,
      })
      .from(professionalProfiles)
      .innerJoin(
        organisations,
        eq(professionalProfiles.organisationId, organisations.id),
      )
      .where(eq(organisations.id, organisationId))
      .limit(1);
    if (!record) return null;

    const logo = record.logoAssetId
      ? await this.db
          .select({ publicId: fileAssets.cloudinaryPublicId })
          .from(fileAssets)
          .where(
            and(
              eq(fileAssets.id, record.logoAssetId),
              eq(fileAssets.status, "ready"),
              eq(fileAssets.visibility, "public"),
              eq(fileAssets.purpose, "PROFESSIONAL_LOGO"),
            ),
          )
          .limit(1)
      : [];
    return { ...record, logoPublicId: logo[0]?.publicId ?? null };
  }

  async updateManagedProfile(input: {
    organisationId: string;
    values: {
      businessName: string;
      description: string;
      primaryCategory: string;
      operatingLocation: string;
      serviceAreas: string[];
    };
  }): Promise<ManagedProfileRecord | null> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(organisations)
        .set({ name: input.values.businessName, updatedAt: new Date() })
        .where(eq(organisations.id, input.organisationId));
      await tx
        .update(professionalProfiles)
        .set({
          description: input.values.description,
          primaryCategory: input.values.primaryCategory,
          operatingLocation: input.values.operatingLocation,
          serviceAreas: input.values.serviceAreas,
          updatedAt: new Date(),
        })
        .where(eq(professionalProfiles.organisationId, input.organisationId));
    });
    return this.getManagedProfile(input.organisationId);
  }

  async attachLogo(input: AssetMutationInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [profile] = await tx
        .select({
          id: professionalProfiles.id,
          logoAssetId: professionalProfiles.logoAssetId,
        })
        .from(professionalProfiles)
        .where(eq(professionalProfiles.organisationId, input.organisationId))
        .limit(1);
      const [asset] = await tx
        .select({ id: fileAssets.id })
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, input.assetId),
            eq(fileAssets.ownerAccountId, input.actorAccountId),
            eq(fileAssets.organisationId, input.organisationId),
            eq(fileAssets.purpose, "PROFESSIONAL_LOGO"),
            eq(fileAssets.visibility, "public"),
            eq(fileAssets.status, "ready"),
          ),
        )
        .limit(1);
      if (!profile || !asset) throw invalidAsset("professional logo");
      await tx
        .update(professionalProfiles)
        .set({ logoAssetId: asset.id, updatedAt: new Date() })
        .where(eq(professionalProfiles.id, profile.id));
      await tx
        .update(fileAssets)
        .set({
          linkedEntityType: "professional_profile",
          linkedEntityId: profile.id,
          updatedAt: new Date(),
        })
        .where(eq(fileAssets.id, asset.id));
      if (profile.logoAssetId && profile.logoAssetId !== asset.id) {
        await tx
          .update(fileAssets)
          .set({
            linkedEntityType: null,
            linkedEntityId: null,
            updatedAt: new Date(),
          })
          .where(eq(fileAssets.id, profile.logoAssetId));
      }
    });
  }

  async listPortfolio(organisationId: string): Promise<ManagedPortfolioRecord[]> {
    return this.db
      .select({
        id: professionalPortfolioItems.id,
        assetId: professionalPortfolioItems.assetId,
        title: professionalPortfolioItems.title,
        description: professionalPortfolioItems.description,
        publicId: fileAssets.cloudinaryPublicId,
      })
      .from(professionalPortfolioItems)
      .innerJoin(fileAssets, eq(fileAssets.id, professionalPortfolioItems.assetId))
      .where(
        and(
          eq(professionalPortfolioItems.organisationId, organisationId),
          eq(fileAssets.status, "ready"),
          eq(fileAssets.visibility, "public"),
          eq(fileAssets.purpose, "PORTFOLIO_IMAGE"),
        ),
      )
      .orderBy(asc(professionalPortfolioItems.createdAt));
  }

  async addPortfolioItem(
    input: AssetMutationInput & {
      title: string;
      description: string | null;
      correlationId?: string;
    },
  ): Promise<ManagedPortfolioRecord> {
    return this.db.transaction(async (tx) => {
      const [portfolioCount] = await tx
        .select({ value: count() })
        .from(professionalPortfolioItems)
        .where(
          eq(professionalPortfolioItems.organisationId, input.organisationId),
        );
      if ((portfolioCount?.value ?? 0) >= 12) {
        throw catalogueImageLimit("portfolio", 12);
      }
      const [asset] = await tx
        .select({ id: fileAssets.id, publicId: fileAssets.cloudinaryPublicId })
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, input.assetId),
            eq(fileAssets.ownerAccountId, input.actorAccountId),
            eq(fileAssets.organisationId, input.organisationId),
            eq(fileAssets.purpose, "PORTFOLIO_IMAGE"),
            eq(fileAssets.visibility, "public"),
            eq(fileAssets.status, "ready"),
            sql`${fileAssets.linkedEntityType} is null`,
          ),
        )
        .limit(1);
      if (!asset) throw invalidAsset("portfolio");
      const [item] = await tx
        .insert(professionalPortfolioItems)
        .values({
          organisationId: input.organisationId,
          assetId: input.assetId,
          title: input.title,
          description: input.description,
          createdByAccountId: input.actorAccountId,
        })
        .returning();
      await tx
        .update(fileAssets)
        .set({
          linkedEntityType: "professional_portfolio_item",
          linkedEntityId: item.id,
          updatedAt: new Date(),
        })
        .where(eq(fileAssets.id, asset.id));
      await tx.insert(outboxEvents).values({
        eventType: "portfolio.item_added",
        eventVersion: 1,
        aggregateType: "professional_portfolio_item",
        aggregateId: item.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { portfolioItemId: item.id },
      });
      return { ...item, publicId: asset.publicId };
    });
  }

  async removePortfolioItem(
    organisationId: string,
    itemId: string,
  ): Promise<ManagedPortfolioRecord | null> {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .select({
          id: professionalPortfolioItems.id,
          assetId: professionalPortfolioItems.assetId,
          title: professionalPortfolioItems.title,
          description: professionalPortfolioItems.description,
          publicId: fileAssets.cloudinaryPublicId,
        })
        .from(professionalPortfolioItems)
        .innerJoin(fileAssets, eq(fileAssets.id, professionalPortfolioItems.assetId))
        .where(
          and(
            eq(professionalPortfolioItems.id, itemId),
            eq(professionalPortfolioItems.organisationId, organisationId),
          ),
        )
        .limit(1);
      if (!record) return null;
      await tx
        .delete(professionalPortfolioItems)
        .where(eq(professionalPortfolioItems.id, itemId));
      await tx
        .update(fileAssets)
        .set({ linkedEntityType: null, linkedEntityId: null, updatedAt: new Date() })
        .where(eq(fileAssets.id, record.assetId));
      return record;
    });
  }

  async listServiceImages(
    organisationId: string,
    serviceId: string,
  ): Promise<ManagedServiceImageRecord[]> {
    return this.db
      .select({
        id: professionalServiceImages.id,
        assetId: professionalServiceImages.assetId,
        publicId: fileAssets.cloudinaryPublicId,
        position: professionalServiceImages.position,
      })
      .from(professionalServiceImages)
      .innerJoin(
        professionalServices,
        eq(professionalServices.id, professionalServiceImages.serviceId),
      )
      .innerJoin(fileAssets, eq(fileAssets.id, professionalServiceImages.assetId))
      .where(
        and(
          eq(professionalServices.organisationId, organisationId),
          eq(professionalServices.id, serviceId),
          eq(fileAssets.status, "ready"),
          eq(fileAssets.visibility, "public"),
          eq(fileAssets.purpose, "SERVICE_IMAGE"),
        ),
      )
      .orderBy(asc(professionalServiceImages.position));
  }

  async addServiceImage(
    input: AssetMutationInput & { serviceId: string },
  ): Promise<ManagedServiceImageRecord> {
    return this.db.transaction(async (tx) => {
      const [service] = await tx
        .select({ id: professionalServices.id, status: professionalServices.status })
        .from(professionalServices)
        .where(
          and(
            eq(professionalServices.id, input.serviceId),
            eq(professionalServices.organisationId, input.organisationId),
          ),
        )
        .limit(1);
      if (!service) throw notFound("service");
      if (service.status === "published") throw publishedImageConflict();
      const [asset] = await tx
        .select({ id: fileAssets.id, publicId: fileAssets.cloudinaryPublicId })
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, input.assetId),
            eq(fileAssets.ownerAccountId, input.actorAccountId),
            eq(fileAssets.organisationId, input.organisationId),
            eq(fileAssets.purpose, "SERVICE_IMAGE"),
            eq(fileAssets.visibility, "public"),
            eq(fileAssets.status, "ready"),
            sql`${fileAssets.linkedEntityType} is null`,
          ),
        )
        .limit(1);
      if (!asset) throw invalidAsset("service image");
      const [imageState] = await tx
        .select({
          count: count(),
          position: max(professionalServiceImages.position),
        })
        .from(professionalServiceImages)
        .where(eq(professionalServiceImages.serviceId, input.serviceId));
      if ((imageState?.count ?? 0) >= 6) {
        throw catalogueImageLimit("service", 6);
      }
      const [image] = await tx
        .insert(professionalServiceImages)
        .values({
          serviceId: input.serviceId,
          assetId: input.assetId,
          position: (imageState?.position ?? -1) + 1,
        })
        .returning();
      await tx
        .update(fileAssets)
        .set({
          linkedEntityType: "professional_service",
          linkedEntityId: input.serviceId,
          updatedAt: new Date(),
        })
        .where(eq(fileAssets.id, asset.id));
      return { ...image, publicId: asset.publicId };
    });
  }

  async removeServiceImage(
    organisationId: string,
    serviceId: string,
    imageId: string,
  ): Promise<ManagedServiceImageRecord | null> {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .select({
          id: professionalServiceImages.id,
          assetId: professionalServiceImages.assetId,
          publicId: fileAssets.cloudinaryPublicId,
          position: professionalServiceImages.position,
          status: professionalServices.status,
        })
        .from(professionalServiceImages)
        .innerJoin(
          professionalServices,
          eq(professionalServices.id, professionalServiceImages.serviceId),
        )
        .innerJoin(fileAssets, eq(fileAssets.id, professionalServiceImages.assetId))
        .where(
          and(
            eq(professionalServiceImages.id, imageId),
            eq(professionalServices.id, serviceId),
            eq(professionalServices.organisationId, organisationId),
          ),
        )
        .limit(1);
      if (!record) return null;
      if (record.status === "published") throw publishedImageConflict();
      await tx
        .delete(professionalServiceImages)
        .where(eq(professionalServiceImages.id, imageId));
      await tx
        .update(fileAssets)
        .set({ linkedEntityType: null, linkedEntityId: null, updatedAt: new Date() })
        .where(eq(fileAssets.id, record.assetId));
      return record;
    });
  }
}

function invalidAsset(kind: string) {
  return new AppError({
    code: "INVALID_CATALOGUE_ASSET",
    message: `The uploaded asset is not eligible as a ${kind}.`,
    status: 422,
  });
}

function notFound(kind: string) {
  return new AppError({
    code: "NOT_FOUND",
    message: `The requested ${kind} was not found.`,
    status: 404,
  });
}

function publishedImageConflict() {
  return new AppError({
    code: "SERVICE_PUBLISHED",
    message: "Unpublish this service before changing its images.",
    status: 409,
  });
}

function catalogueImageLimit(kind: string, limit: number) {
  return new AppError({
    code: "CATALOGUE_IMAGE_LIMIT",
    message: `This ${kind} has reached its limit of ${limit} images.`,
    status: 409,
  });
}
