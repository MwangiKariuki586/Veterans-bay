import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { fileAssets } from "./file-assets";
import { organisations } from "./organisations";

export interface WorkingDay {
  enabled: boolean;
  opensAt: string;
  closesAt: string;
}

export type WorkingHours = Record<string, WorkingDay>;

export const professionalProfiles = pgTable(
  "professional_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    businessType: text("business_type"),
    primaryCategory: text("primary_category"),
    description: text("description"),
    phone: text("phone"),
    email: text("email"),
    operatingLocation: text("operating_location"),
    experienceStartedYear: integer("experience_started_year"),
    serviceAreas: jsonb("service_areas").$type<string[]>().notNull().default([]),
    workingHours: jsonb("working_hours").$type<WorkingHours>().notNull().default({}),
    logoAssetId: uuid("logo_asset_id").references(() => fileAssets.id, {
      onDelete: "set null",
    }),
    verificationType: text("verification_type"),
    verificationReference: text("verification_reference"),
    verificationStatus: text("verification_status")
      .notNull()
      .default("not_started"),
    termsAccepted: boolean("terms_accepted").notNull().default(false),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("professional_profiles_organisation_unique").on(table.organisationId),
    check(
      "professional_profiles_business_type_check",
      sql`${table.businessType} is null or ${table.businessType} in ('independent', 'business')`,
    ),
    check(
      "professional_profiles_verification_status_check",
      sql`${table.verificationStatus} in ('not_started', 'pending', 'verified', 'rejected')`,
    ),
    check(
      "professional_profiles_experience_started_year_check",
      sql`${table.experienceStartedYear} is null or ${table.experienceStartedYear} between 1900 and 2100`,
    ),
    index("professional_profiles_verification_status_idx").on(
      table.verificationStatus,
    ),
    index("professional_profiles_service_areas_idx").using(
      "gin",
      table.serviceAreas,
    ),
    index("professional_profiles_operating_location_idx").on(
      table.operatingLocation,
    ),
  ],
);

export const professionalVerificationDocuments = pgTable(
  "professional_verification_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    documentType: text("document_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("professional_verification_documents_asset_unique").on(table.assetId),
    index("professional_verification_documents_profile_idx").on(
      table.professionalProfileId,
    ),
  ],
);

export const professionalOnboardingHistory = pgTable(
  "professional_onboarding_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("professional_onboarding_history_org_idx").on(
      table.organisationId,
      table.createdAt,
    ),
  ],
);
