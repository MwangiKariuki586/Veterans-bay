CREATE TABLE "marketplace_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "marketplace_categories_status_check" CHECK ("marketplace_categories"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
ALTER TABLE "professional_services" ADD COLUMN "moderation_status" text DEFAULT 'clear' NOT NULL;--> statement-breakpoint
ALTER TABLE "professional_services" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "professional_services" ADD COLUMN "moderated_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "professional_services" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketplace_categories" ADD CONSTRAINT "marketplace_categories_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketplace_categories_status_name_idx" ON "marketplace_categories" USING btree ("status","name");--> statement-breakpoint
INSERT INTO "marketplace_categories" ("name", "slug") VALUES
  ('Plumbing', 'plumbing'),
  ('Electrical', 'electrical'),
  ('Cleaning', 'cleaning'),
  ('Painting', 'painting'),
  ('Appliance Repair', 'appliance-repair')
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_moderated_by_account_id_account_profiles_id_fk" FOREIGN KEY ("moderated_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "professional_services_moderation_status_idx" ON "professional_services" USING btree ("moderation_status","status");--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_moderation_status_check" CHECK ("professional_services"."moderation_status" in ('clear', 'hidden'));
