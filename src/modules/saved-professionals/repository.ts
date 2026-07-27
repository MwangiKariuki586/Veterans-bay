import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { professionalProfiles } from "../../platform/database/schema/professional-onboarding";
import { professionalServices } from "../../platform/database/schema/professional-services";
import { savedProfessionals } from "../../platform/database/schema/saved-professionals";

export interface SavedProfessionalRecord {
  slug: string;
  businessName: string;
  primaryCategory: string | null;
  description: string | null;
  operatingLocation: string | null;
  verified: boolean;
  logoPublicId: string | null;
  serviceCount: number;
  savedAt: Date;
}

export interface SavedProfessionalsStore {
  list(accountProfileId: string): Promise<SavedProfessionalRecord[]>;
  save(input: {
    accountProfileId: string;
    providerSlug: string;
    correlationId?: string;
  }): Promise<{ created: boolean } | null>;
  remove(accountProfileId: string, providerSlug: string): Promise<void>;
}

const publicServiceExists = sql<boolean>`exists (
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
    )`;

export class SavedProfessionalsRepository implements SavedProfessionalsStore {
  constructor(private readonly db: Database) {}

  async list(accountProfileId: string): Promise<SavedProfessionalRecord[]> {
    const logoPublicId = sql<string | null>`(
      select ${fileAssets.cloudinaryPublicId}
      from ${fileAssets}
      where ${fileAssets.id} = ${professionalProfiles.logoAssetId}
        and ${fileAssets.visibility} = 'public'
        and ${fileAssets.status} = 'ready'
      limit 1
    )`;
    const serviceCount = sql<number>`(
      select count(*)::int
      from ${professionalServices}
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
    )`;

    return this.db
      .select({
        slug: organisations.slug,
        businessName: organisations.name,
        primaryCategory: professionalProfiles.primaryCategory,
        description: professionalProfiles.description,
        operatingLocation: professionalProfiles.operatingLocation,
        verified: sql<boolean>`${professionalProfiles.verificationStatus} = 'verified'`,
        logoPublicId,
        serviceCount,
        savedAt: savedProfessionals.createdAt,
      })
      .from(savedProfessionals)
      .innerJoin(
        organisations,
        eq(organisations.id, savedProfessionals.organisationId),
      )
      .innerJoin(
        professionalProfiles,
        eq(professionalProfiles.organisationId, organisations.id),
      )
      .where(
        and(
          eq(savedProfessionals.accountProfileId, accountProfileId),
          eq(organisations.status, "active"),
          publicServiceExists,
        ),
      )
      .orderBy(desc(savedProfessionals.createdAt), desc(savedProfessionals.id))
      .limit(100);
  }

  async save(input: {
    accountProfileId: string;
    providerSlug: string;
    correlationId?: string;
  }): Promise<{ created: boolean } | null> {
    return this.db.transaction(async (tx) => {
      const [provider] = await tx
        .select({ id: organisations.id, slug: organisations.slug })
        .from(organisations)
        .innerJoin(
          professionalProfiles,
          eq(professionalProfiles.organisationId, organisations.id),
        )
        .where(
          and(
            eq(organisations.slug, input.providerSlug),
            eq(organisations.status, "active"),
            publicServiceExists,
          ),
        )
        .limit(1);

      if (!provider) return null;

      const inserted = await tx
        .insert(savedProfessionals)
        .values({
          accountProfileId: input.accountProfileId,
          organisationId: provider.id,
        })
        .onConflictDoNothing()
        .returning({ id: savedProfessionals.id });

      if (inserted.length > 0) {
        await tx.insert(outboxEvents).values({
          eventType: "professional.saved",
          eventVersion: 1,
          aggregateType: "organisation",
          aggregateId: provider.id,
          organisationId: provider.id,
          actorAccountId: input.accountProfileId,
          correlationId: input.correlationId,
          payload: { providerSlug: provider.slug },
        });
      }

      return { created: inserted.length > 0 };
    });
  }

  async remove(accountProfileId: string, providerSlug: string): Promise<void> {
    await this.db
      .delete(savedProfessionals)
      .where(
        and(
          eq(savedProfessionals.accountProfileId, accountProfileId),
          sql`${savedProfessionals.organisationId} in (
            select ${organisations.id}
            from ${organisations}
            where ${organisations.slug} = ${providerSlug}
          )`,
        ),
      );
  }
}
