CREATE TABLE "professional_onboarding_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"actor_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"business_type" text,
	"primary_category" text,
	"description" text,
	"phone" text,
	"email" text,
	"operating_location" text,
	"service_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"working_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo_asset_id" uuid,
	"verification_type" text,
	"verification_reference" text,
	"verification_status" text DEFAULT 'not_started' NOT NULL,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_profiles_organisation_unique" UNIQUE("organisation_id"),
	CONSTRAINT "professional_profiles_business_type_check" CHECK ("professional_profiles"."business_type" is null or "professional_profiles"."business_type" in ('independent', 'business')),
	CONSTRAINT "professional_profiles_verification_status_check" CHECK ("professional_profiles"."verification_status" in ('not_started', 'pending', 'verified', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "professional_verification_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_profile_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_verification_documents_asset_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
ALTER TABLE "organisations" DROP CONSTRAINT "organisations_status_check";--> statement-breakpoint
ALTER TABLE "professional_onboarding_history" ADD CONSTRAINT "professional_onboarding_history_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_onboarding_history" ADD CONSTRAINT "professional_onboarding_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_logo_asset_id_file_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_verification_documents" ADD CONSTRAINT "professional_verification_documents_professional_profile_id_professional_profiles_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."professional_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_verification_documents" ADD CONSTRAINT "professional_verification_documents_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "professional_onboarding_history_org_idx" ON "professional_onboarding_history" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE INDEX "professional_profiles_verification_status_idx" ON "professional_profiles" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "professional_verification_documents_profile_idx" ON "professional_verification_documents" USING btree ("professional_profile_id");--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_status_check" CHECK ("organisations"."status" in ('draft', 'pending_review', 'active', 'requires_changes', 'suspended', 'deactivated'));