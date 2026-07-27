import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { fileAssets } from "./file-assets";
import { organisations } from "./organisations";

export const professionalServices = pgTable(
  "professional_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    fulfilmentModel: text("fulfilment_model"),
    pricingModel: text("pricing_model"),
    priceMinor: bigint("price_minor", { mode: "number" }),
    currency: text("currency").notNull().default("KES"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    serviceAreas: jsonb("service_areas").$type<string[]>().notNull().default([]),
    requirements: jsonb("requirements").$type<string[]>().notNull().default([]),
    warrantyDurationDays: integer("warranty_duration_days"),
    warrantyTerms: text("warranty_terms"),
    directBookingEnabled: boolean("direct_booking_enabled").notNull().default(false),
    status: text("status").notNull().default("draft"),
    moderationStatus: text("moderation_status").notNull().default("clear"),
    moderationReason: text("moderation_reason"),
    moderatedByAccountId: uuid("moderated_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "set null" },
    ),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("professional_services_org_slug_unique").on(
      table.organisationId,
      table.slug,
    ),
    check(
      "professional_services_fulfilment_model_check",
      sql`${table.fulfilmentModel} is null or ${table.fulfilmentModel} in ('on_site', 'remote', 'hybrid')`,
    ),
    check(
      "professional_services_pricing_model_check",
      sql`${table.pricingModel} is null or ${table.pricingModel} in ('fixed', 'starting_from', 'custom_quote')`,
    ),
    check(
      "professional_services_status_check",
      sql`${table.status} in ('draft', 'published', 'unpublished')`,
    ),
    check(
      "professional_services_moderation_status_check",
      sql`${table.moderationStatus} in ('clear', 'hidden')`,
    ),
    check(
      "professional_services_price_check",
      sql`${table.priceMinor} is null or ${table.priceMinor} >= 0`,
    ),
    check(
      "professional_services_duration_check",
      sql`${table.estimatedDurationMinutes} is null or ${table.estimatedDurationMinutes} > 0`,
    ),
    check(
      "professional_services_warranty_duration_check",
      sql`${table.warrantyDurationDays} is null or ${table.warrantyDurationDays} >= 0`,
    ),
    check("professional_services_version_check", sql`${table.version} > 0`),
    index("professional_services_org_status_idx").on(
      table.organisationId,
      table.status,
    ),
    index("professional_services_moderation_status_idx").on(
      table.moderationStatus,
      table.status,
    ),
    index("professional_services_category_status_idx").on(
      table.category,
      table.status,
    ),
    index("professional_services_marketplace_search_idx").using(
      "gin",
      sql`to_tsvector(
        'simple',
        coalesce(${table.name}, '') || ' ' ||
        coalesce(${table.category}, '') || ' ' ||
        coalesce(${table.description}, '')
      )`,
    ),
    index("professional_services_service_areas_idx").using(
      "gin",
      table.serviceAreas,
    ),
    index("professional_services_fulfilment_status_idx").on(
      table.fulfilmentModel,
      table.status,
    ),
    index("professional_services_pricing_status_idx").on(
      table.pricingModel,
      table.status,
    ),
  ],
);

export const professionalServiceImages = pgTable(
  "professional_service_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => professionalServices.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("professional_service_images_asset_unique").on(table.assetId),
    index("professional_service_images_service_idx").on(
      table.serviceId,
      table.position,
    ),
  ],
);

export const professionalServiceSnapshots = pgTable(
  "professional_service_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => professionalServices.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("professional_service_snapshots_version_unique").on(
      table.serviceId,
      table.version,
    ),
  ],
);

export const professionalPortfolioItems = pgTable(
  "professional_portfolio_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("professional_portfolio_items_asset_unique").on(table.assetId),
    index("professional_portfolio_items_org_idx").on(
      table.organisationId,
      table.createdAt,
    ),
  ],
);
