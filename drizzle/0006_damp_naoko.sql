CREATE TABLE "professional_portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_portfolio_items_asset_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "professional_service_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_service_images_asset_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "professional_service_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_service_snapshots_version_unique" UNIQUE("service_id","version")
);
--> statement-breakpoint
CREATE TABLE "professional_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"fulfilment_model" text,
	"pricing_model" text,
	"price_minor" bigint,
	"currency" text DEFAULT 'KES' NOT NULL,
	"estimated_duration_minutes" integer,
	"service_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warranty_duration_days" integer,
	"warranty_terms" text,
	"direct_booking_enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_services_org_slug_unique" UNIQUE("organisation_id","slug"),
	CONSTRAINT "professional_services_fulfilment_model_check" CHECK ("professional_services"."fulfilment_model" is null or "professional_services"."fulfilment_model" in ('on_site', 'remote', 'hybrid')),
	CONSTRAINT "professional_services_pricing_model_check" CHECK ("professional_services"."pricing_model" is null or "professional_services"."pricing_model" in ('fixed', 'starting_from', 'custom_quote')),
	CONSTRAINT "professional_services_status_check" CHECK ("professional_services"."status" in ('draft', 'published', 'unpublished')),
	CONSTRAINT "professional_services_price_check" CHECK ("professional_services"."price_minor" is null or "professional_services"."price_minor" >= 0),
	CONSTRAINT "professional_services_duration_check" CHECK ("professional_services"."estimated_duration_minutes" is null or "professional_services"."estimated_duration_minutes" > 0),
	CONSTRAINT "professional_services_warranty_duration_check" CHECK ("professional_services"."warranty_duration_days" is null or "professional_services"."warranty_duration_days" >= 0),
	CONSTRAINT "professional_services_version_check" CHECK ("professional_services"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "professional_portfolio_items" ADD CONSTRAINT "professional_portfolio_items_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_portfolio_items" ADD CONSTRAINT "professional_portfolio_items_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_portfolio_items" ADD CONSTRAINT "professional_portfolio_items_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_service_images" ADD CONSTRAINT "professional_service_images_service_id_professional_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."professional_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_service_images" ADD CONSTRAINT "professional_service_images_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_service_snapshots" ADD CONSTRAINT "professional_service_snapshots_service_id_professional_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."professional_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "professional_portfolio_items_org_idx" ON "professional_portfolio_items" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE INDEX "professional_service_images_service_idx" ON "professional_service_images" USING btree ("service_id","position");--> statement-breakpoint
CREATE INDEX "professional_services_org_status_idx" ON "professional_services" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "professional_services_category_status_idx" ON "professional_services" USING btree ("category","status");