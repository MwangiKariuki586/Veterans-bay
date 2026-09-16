import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { auditEvents } from "../../platform/database/schema/audit-events";
import { marketplaceCategories } from "../../platform/database/schema/marketplace-moderation";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { professionalServices } from "../../platform/database/schema/professional-services";
import { AppError } from "../../platform/errors/app-error";

export type MarketplaceCategoryRecord =
  typeof marketplaceCategories.$inferSelect;

export interface MarketplaceModerationStore {
  listCategories(status?: "active" | "inactive"): Promise<MarketplaceCategoryRecord[]>;
  createCategory(input: {
    actorAccountId: string;
    name: string;
    slug: string;
    correlationId?: string;
  }): Promise<MarketplaceCategoryRecord>;
  setCategoryStatus(input: {
    actorAccountId: string;
    categoryId: string;
    fromStatus: "active" | "inactive";
    toStatus: "active" | "inactive";
    reason: string;
    correlationId?: string;
  }): Promise<MarketplaceCategoryRecord>;
  listListings(input: {
    status: "all" | "visible" | "hidden";
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{
    items: Array<{
      id: string;
      organisationId: string;
      organisationName: string;
      slug: string;
      name: string;
      category: string | null;
      publicationStatus: string;
      moderationStatus: string;
      moderationReason: string | null;
      moderatedAt: Date | null;
      updatedAt: Date;
    }>;
    totalItems: number;
  }>;
  moderateListing(input: {
    actorAccountId: string;
    serviceId: string;
    fromStatus: "clear" | "hidden";
    toStatus: "clear" | "hidden";
    reason: string;
    eventType: "content.hidden" | "content.restored";
    correlationId?: string;
  }): Promise<void>;
}

export class MarketplaceModerationRepository
  implements MarketplaceModerationStore
{
  constructor(private readonly db: Database) {}

  async listCategories(status?: "active" | "inactive") {
    return this.db
      .select()
      .from(marketplaceCategories)
      .where(status ? eq(marketplaceCategories.status, status) : undefined)
      .orderBy(asc(marketplaceCategories.name), asc(marketplaceCategories.id));
  }

  async createCategory(input: {
    actorAccountId: string;
    name: string;
    slug: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [category] = await tx
        .insert(marketplaceCategories)
        .values({
          name: input.name,
          slug: input.slug,
          createdByAccountId: input.actorAccountId,
        })
        .returning();
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        action: "marketplace.category_created",
        entityType: "marketplace_category",
        entityId: category.id,
        correlationId: input.correlationId,
        metadata: { name: category.name, slug: category.slug },
      });
      return category;
    });
  }

  async setCategoryStatus(input: {
    actorAccountId: string;
    categoryId: string;
    fromStatus: "active" | "inactive";
    toStatus: "active" | "inactive";
    reason: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [category] = await tx
        .update(marketplaceCategories)
        .set({ status: input.toStatus, updatedAt: new Date() })
        .where(
          and(
            eq(marketplaceCategories.id, input.categoryId),
            eq(marketplaceCategories.status, input.fromStatus),
          ),
        )
        .returning();
      if (!category) {
        throw new AppError({
          code: "INVALID_CATEGORY_TRANSITION",
          message: "The category is not in the expected state.",
          status: 409,
        });
      }
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        action: "marketplace.category_status_changed",
        entityType: "marketplace_category",
        entityId: category.id,
        correlationId: input.correlationId,
        metadata: {
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          reason: input.reason,
        },
      });
      return category;
    });
  }

  async listListings(input: {
    status: "all" | "visible" | "hidden";
    q?: string;
    page: number;
    pageSize: number;
  }) {
    const conditions: SQL[] = [eq(professionalServices.status, "published")];
    if (input.status !== "all") {
      conditions.push(
        eq(
          professionalServices.moderationStatus,
          input.status === "hidden" ? "hidden" : "clear",
        ),
      );
    }
    if (input.q) {
      conditions.push(
        or(
          ilike(professionalServices.name, `%${input.q}%`),
          ilike(professionalServices.category, `%${input.q}%`),
          ilike(organisations.name, `%${input.q}%`),
        )!,
      );
    }
    const where = and(...conditions);
    const [items, [total]] = await Promise.all([
      this.db
        .select({
          id: professionalServices.id,
          organisationId: organisations.id,
          organisationName: organisations.name,
          slug: professionalServices.slug,
          name: professionalServices.name,
          category: professionalServices.category,
          publicationStatus: professionalServices.status,
          moderationStatus: professionalServices.moderationStatus,
          moderationReason: professionalServices.moderationReason,
          moderatedAt: professionalServices.moderatedAt,
          updatedAt: professionalServices.updatedAt,
        })
        .from(professionalServices)
        .innerJoin(
          organisations,
          eq(organisations.id, professionalServices.organisationId),
        )
        .where(where)
        .orderBy(desc(professionalServices.updatedAt), asc(professionalServices.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.db
        .select({ value: count() })
        .from(professionalServices)
        .innerJoin(
          organisations,
          eq(organisations.id, professionalServices.organisationId),
        )
        .where(where),
    ]);
    return { items, totalItems: total?.value ?? 0 };
  }

  async moderateListing(input: {
    actorAccountId: string;
    serviceId: string;
    fromStatus: "clear" | "hidden";
    toStatus: "clear" | "hidden";
    reason: string;
    eventType: "content.hidden" | "content.restored";
    correlationId?: string;
  }) {
    await this.db.transaction(async (tx) => {
      const [service] = await tx
        .update(professionalServices)
        .set({
          moderationStatus: input.toStatus,
          moderationReason: input.reason,
          moderatedByAccountId: input.actorAccountId,
          moderatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(professionalServices.id, input.serviceId),
            eq(professionalServices.status, "published"),
            eq(professionalServices.moderationStatus, input.fromStatus),
          ),
        )
        .returning({
          id: professionalServices.id,
          organisationId: professionalServices.organisationId,
        });
      if (!service) {
        throw new AppError({
          code: "INVALID_LISTING_MODERATION_TRANSITION",
          message: "The listing is not in the expected moderation state.",
          status: 409,
        });
      }
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        organisationId: service.organisationId,
        action: input.eventType,
        entityType: "professional_service",
        entityId: service.id,
        correlationId: input.correlationId,
        metadata: {
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          reason: input.reason,
        },
      });
      await tx.insert(outboxEvents).values({
        eventType: input.eventType,
        eventVersion: 1,
        aggregateType: "professional_service",
        aggregateId: service.id,
        organisationId: service.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { serviceId: service.id, reason: input.reason },
      });
    });
  }
}
