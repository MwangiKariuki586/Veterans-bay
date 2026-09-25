import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { organisations } from "../../platform/database/schema/organisations";
import { professionalProfiles } from "../../platform/database/schema/professional-onboarding";
import {
  professionalServiceImages,
  professionalServices,
} from "../../platform/database/schema/professional-services";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { professionalReputation } from "../../platform/database/schema/reviews";
import type {
  MarketplaceAnalyticsEvent,
  MarketplaceSearchQuery,
} from "./types";

export interface MarketplaceSearchRecord {
  organisationId: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  fulfilmentModel: string;
  pricingModel: string;
  priceMinor: number | null;
  currency: string;
  serviceAreas: string[];
  imagePublicId: string | null;
  estimatedDurationMinutes: number | null;
  directBookingEnabled: boolean;
  providerSlug: string;
  providerName: string;
  providerLocation: string | null;
  providerVerified: boolean;
  providerExperienceStartedYear: number | null;
  providerAverageRatingHundredths: number | null;
  providerReviewCount: number | null;
  providerVerifiedJobs: number | null;
}

export interface MarketplaceStore {
  search(input: MarketplaceSearchQuery): Promise<{
    items: MarketplaceSearchRecord[];
    totalItems: number;
  }>;
  listPopular(input: { location?: string; limit?: number }): Promise<MarketplaceSearchRecord[]>;
  recordAnalytics(event: MarketplaceAnalyticsEvent): Promise<void>;
}

function searchVector() {
  return sql`to_tsvector(
    'simple',
    coalesce(${professionalServices.name}, '') || ' ' ||
    coalesce(${professionalServices.category}, '') || ' ' ||
    coalesce(${professionalServices.description}, '')
  )`;
}

const marketplaceSearchCache = new Map<
  string,
  { expires: number; value: { items: MarketplaceSearchRecord[]; totalItems: number } }
>();
const MARKETPLACE_CACHE_TTL_MS = 15_000;

function marketplaceCacheKey(input: MarketplaceSearchQuery): string {
  return JSON.stringify({
    q: input.q ?? "",
    category: input.category ?? "",
    location: input.location ?? "",
    fulfilmentModel: input.fulfilmentModel ?? "",
    pricingModel: input.pricingModel ?? "",
    availability: input.availability ?? "",
    verified: input.verified ?? "",
    topRated: input.topRated ?? "",
    instantBooking: input.instantBooking ?? "",
    sort: input.sort,
    page: input.page,
    pageSize: input.pageSize,
  });
}

export class MarketplaceRepository implements MarketplaceStore {
  constructor(private readonly db: Database) {}

  async search(input: MarketplaceSearchQuery) {
    const cacheKey = marketplaceCacheKey(input);
    const cached = marketplaceSearchCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }
    const conditions: SQL[] = [
      eq(professionalServices.status, "published"),
      eq(professionalServices.moderationStatus, "clear"),
      eq(organisations.status, "active"),
      isNotNull(professionalServices.category),
      isNotNull(professionalServices.description),
      isNotNull(professionalServices.fulfilmentModel),
      isNotNull(professionalServices.pricingModel),
      sql`(
        ${professionalServices.pricingModel} = 'custom_quote'
        or ${professionalServices.priceMinor} is not null
      )`,
    ];

    if (input.q) {
      conditions.push(
        sql`${searchVector()} @@ websearch_to_tsquery('simple', ${input.q})`,
      );
    }
    if (input.category) {
      conditions.push(
        sql`lower(${professionalServices.category}) = lower(${input.category})`,
      );
    }
    if (input.location) {
      conditions.push(
        sql`(
          ${professionalServices.serviceAreas} @> ${JSON.stringify([input.location])}::jsonb
          or ${professionalProfiles.serviceAreas} @> ${JSON.stringify([input.location])}::jsonb
          or lower(${professionalProfiles.operatingLocation}) = lower(${input.location})
        )`,
      );
    }
    if (input.fulfilmentModel) {
      conditions.push(
        eq(professionalServices.fulfilmentModel, input.fulfilmentModel),
      );
    }
    if (input.pricingModel) {
      conditions.push(eq(professionalServices.pricingModel, input.pricingModel));
    }
    if (input.availability === "today") {
      // Compute Nairobi day in JS to enable GIN index usage via @> instead of per-row to_char
      const nairobiDay = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Nairobi",
        weekday: "long",
      })
        .format(new Date())
        .toLowerCase();
      conditions.push(
        sql`${professionalProfiles.workingHours} @> ${JSON.stringify({ [nairobiDay]: { enabled: true } })}::jsonb`,
      );
    }
    if (input.verified) {
      conditions.push(
        input.verified === "true"
          ? eq(professionalProfiles.verificationStatus, "verified")
          : sql`${professionalProfiles.verificationStatus} <> 'verified'`,
      );
    }
    if (input.topRated === "true") {
      conditions.push(
        sql`${professionalReputation.averageRatingHundredths} >= 470`,
        sql`${professionalReputation.reviewCount} > 0`,
      );
    }
    if (input.instantBooking === "true") {
      conditions.push(
        eq(professionalServices.directBookingEnabled, true),
        isNotNull(professionalServices.estimatedDurationMinutes),
      );
    }

    const where = and(...conditions);
    const relevance = input.q
      ? sql<number>`ts_rank(${searchVector()}, websearch_to_tsquery('simple', ${input.q}))`
      : sql<number>`0`;

    const base = this.db
      .select({
        serviceId: professionalServices.id,
        organisationId: organisations.id,
        slug: professionalServices.slug,
        name: professionalServices.name,
        category: professionalServices.category,
        description: professionalServices.description,
        fulfilmentModel: professionalServices.fulfilmentModel,
        pricingModel: professionalServices.pricingModel,
        priceMinor: professionalServices.priceMinor,
        currency: professionalServices.currency,
        serviceAreas: professionalServices.serviceAreas,
        estimatedDurationMinutes: professionalServices.estimatedDurationMinutes,
        directBookingEnabled: professionalServices.directBookingEnabled,
        providerSlug: organisations.slug,
        providerName: organisations.name,
        providerLocation: professionalProfiles.operatingLocation,
        providerVerified: sql<boolean>`${professionalProfiles.verificationStatus} = 'verified'`,
        providerExperienceStartedYear:
          professionalProfiles.experienceStartedYear,
        providerAverageRatingHundredths:
          professionalReputation.averageRatingHundredths,
        providerReviewCount: professionalReputation.reviewCount,
        providerVerifiedJobs: professionalReputation.verifiedJobs,
      })
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
        professionalReputation,
        eq(professionalReputation.organisationId, organisations.id),
      )
      .where(where);

    const itemsWithoutImages = await base
      .orderBy(
        ...(input.sort === "relevance" && input.q ? [desc(relevance)] : []),
        desc(professionalServices.publishedAt),
        asc(professionalServices.id),
      )
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);

    const [total] = await this.db
      .select({ value: count() })
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
        professionalReputation,
        eq(professionalReputation.organisationId, organisations.id),
      )
      .where(where);

    // Batch fetch images in single query instead of 9 correlated subqueries (cuts 9 index lookups)
    const imageMap = new Map<string, string | null>();
    if (itemsWithoutImages.length > 0) {
      const serviceIds = itemsWithoutImages.map((item) => item.serviceId);
      const images = await this.db
        .select({
          serviceId: professionalServiceImages.serviceId,
          publicId: fileAssets.cloudinaryPublicId,
        })
        .from(professionalServiceImages)
        .innerJoin(fileAssets, eq(fileAssets.id, professionalServiceImages.assetId))
        .where(
          and(
            inArray(professionalServiceImages.serviceId, serviceIds),
            eq(fileAssets.visibility, "public"),
            eq(fileAssets.status, "ready"),
            eq(fileAssets.purpose, "SERVICE_IMAGE"),
          ),
        )
        .orderBy(asc(professionalServiceImages.position), asc(professionalServiceImages.id));
      for (const row of images) {
        if (!imageMap.has(row.serviceId)) {
          imageMap.set(row.serviceId, row.publicId);
        }
      }
    }

    const items = itemsWithoutImages.map(({ serviceId, ...rest }) => ({
      ...rest,
      imagePublicId: imageMap.get(serviceId) ?? null,
    }));

    const result = {
      items: items as unknown as MarketplaceSearchRecord[],
      totalItems: total?.value ?? 0,
    };
    // Cache successful results for 15s to reduce Neon fetch pressure
    // when preview shares the dev DB and receives burst traffic.
    if (marketplaceSearchCache.size > 100) {
      const firstKey = marketplaceSearchCache.keys().next().value as string | undefined;
      if (firstKey) marketplaceSearchCache.delete(firstKey);
    }
    marketplaceSearchCache.set(cacheKey, {
      expires: Date.now() + MARKETPLACE_CACHE_TTL_MS,
      value: result,
    });
    return result;
  }

  async listPopular(input: { location?: string; limit?: number } = {}): Promise<MarketplaceSearchRecord[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 3, 9));
    const conditions: SQL[] = [
      eq(professionalServices.status, "published"),
      eq(professionalServices.moderationStatus, "clear"),
      eq(organisations.status, "active"),
      isNotNull(professionalServices.category),
      isNotNull(professionalServices.description),
      isNotNull(professionalServices.fulfilmentModel),
      isNotNull(professionalServices.pricingModel),
      sql`(
        ${professionalServices.pricingModel} = 'custom_quote'
        or ${professionalServices.priceMinor} is not null
      )`,
    ];

    if (input.location) {
      conditions.push(
        sql`(
          ${professionalServices.serviceAreas} @> ${JSON.stringify([input.location])}::jsonb
          or ${professionalProfiles.serviceAreas} @> ${JSON.stringify([input.location])}::jsonb
          or lower(${professionalProfiles.operatingLocation}) = lower(${input.location})
        )`,
      );
    }

    const where = and(...conditions);

    const itemsWithoutImages = await this.db
      .select({
        serviceId: professionalServices.id,
        organisationId: organisations.id,
        slug: professionalServices.slug,
        name: professionalServices.name,
        category: professionalServices.category,
        description: professionalServices.description,
        fulfilmentModel: professionalServices.fulfilmentModel,
        pricingModel: professionalServices.pricingModel,
        priceMinor: professionalServices.priceMinor,
        currency: professionalServices.currency,
        serviceAreas: professionalServices.serviceAreas,
        estimatedDurationMinutes: professionalServices.estimatedDurationMinutes,
        directBookingEnabled: professionalServices.directBookingEnabled,
        providerSlug: organisations.slug,
        providerName: organisations.name,
        providerLocation: professionalProfiles.operatingLocation,
        providerVerified: sql<boolean>`${professionalProfiles.verificationStatus} = 'verified'`,
        providerExperienceStartedYear: professionalProfiles.experienceStartedYear,
        providerAverageRatingHundredths: professionalReputation.averageRatingHundredths,
        providerReviewCount: professionalReputation.reviewCount,
        providerVerifiedJobs: professionalReputation.verifiedJobs,
      })
      .from(professionalServices)
      .innerJoin(organisations, eq(organisations.id, professionalServices.organisationId))
      .innerJoin(professionalProfiles, eq(professionalProfiles.organisationId, organisations.id))
      .leftJoin(professionalReputation, eq(professionalReputation.organisationId, organisations.id))
      .where(where)
      .orderBy(
        desc(sql`coalesce(${professionalReputation.averageRatingHundredths}, 0)`),
        desc(sql`coalesce(${professionalReputation.reviewCount}, 0)`),
        desc(professionalServices.publishedAt),
        asc(professionalServices.id),
      )
      .limit(limit);

    if (itemsWithoutImages.length === 0) return [];

    const serviceIds = itemsWithoutImages.map((item) => item.serviceId);
    const images = await this.db
      .select({
        serviceId: professionalServiceImages.serviceId,
        publicId: fileAssets.cloudinaryPublicId,
      })
      .from(professionalServiceImages)
      .innerJoin(fileAssets, eq(fileAssets.id, professionalServiceImages.assetId))
      .where(
        and(
          inArray(professionalServiceImages.serviceId, serviceIds),
          eq(fileAssets.visibility, "public"),
          eq(fileAssets.status, "ready"),
          eq(fileAssets.purpose, "SERVICE_IMAGE"),
        ),
      )
      .orderBy(asc(professionalServiceImages.position), asc(professionalServiceImages.id));

    const imageMap = new Map<string, string | null>();
    for (const row of images) {
      if (!imageMap.has(row.serviceId)) imageMap.set(row.serviceId, row.publicId);
    }

    return itemsWithoutImages.map(({ serviceId, ...rest }) => ({
      ...rest,
      imagePublicId: imageMap.get(serviceId) ?? null,
    })) as unknown as MarketplaceSearchRecord[];
  }

  async recordAnalytics(event: MarketplaceAnalyticsEvent): Promise<void> {
    if (event.eventType === "marketplace.search_performed") {
      await this.db.insert(outboxEvents).values({
        eventType: event.eventType,
        eventVersion: 1,
        aggregateType: "marketplace",
        aggregateId: "public",
        payload: {
          activeFilters: event.activeFilters,
          page: event.page,
          resultCount: event.resultCount,
          sort: event.sort,
        },
      });
      return;
    }

    if (event.eventType === "professional.profile_viewed") {
      const [provider] = await this.db
        .select({ id: organisations.id, slug: organisations.slug })
        .from(organisations)
        .innerJoin(
          professionalProfiles,
          eq(professionalProfiles.organisationId, organisations.id),
        )
        .where(
          and(
            eq(organisations.slug, event.targetSlug),
            eq(organisations.status, "active"),
            sql`exists (
              select 1 from ${professionalServices}
              where ${professionalServices.organisationId} = ${organisations.id}
                and ${professionalServices.status} = 'published'
                and ${professionalServices.moderationStatus} = 'clear'
                and ${professionalServices.category} is not null
                and ${professionalServices.description} is not null
                and ${professionalServices.fulfilmentModel} is not null
                and ${professionalServices.pricingModel} is not null
                and (
                  ${professionalServices.pricingModel} = 'custom_quote'
                  or ${professionalServices.priceMinor} is not null
                )
            )`,
          ),
        )
        .limit(1);
      if (!provider) return;
      await this.db.insert(outboxEvents).values({
        eventType: event.eventType,
        eventVersion: 1,
        aggregateType: "organisation",
        aggregateId: provider.id,
        organisationId: provider.id,
        payload: { providerSlug: provider.slug },
      });
      return;
    }

    const [service] = await this.db
      .select({
        id: professionalServices.id,
        slug: professionalServices.slug,
        organisationId: organisations.id,
      })
      .from(professionalServices)
      .innerJoin(
        organisations,
        eq(organisations.id, professionalServices.organisationId),
      )
      .where(
        and(
          eq(professionalServices.slug, event.targetSlug),
          eq(professionalServices.status, "published"),
          eq(professionalServices.moderationStatus, "clear"),
          eq(organisations.status, "active"),
          isNotNull(professionalServices.category),
          isNotNull(professionalServices.description),
          isNotNull(professionalServices.fulfilmentModel),
          isNotNull(professionalServices.pricingModel),
          sql`(
            ${professionalServices.pricingModel} = 'custom_quote'
            or ${professionalServices.priceMinor} is not null
          )`,
        ),
      )
      .limit(1);
    if (!service) return;
    await this.db.insert(outboxEvents).values({
      eventType: event.eventType,
      eventVersion: 1,
      aggregateType: "professional_service",
      aggregateId: service.id,
      organisationId: service.organisationId,
      payload: { serviceSlug: service.slug },
    });
  }
}
