ALTER TABLE "account_profiles" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "account_profiles" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "account_profiles" ADD COLUMN "avatar_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "account_profiles" ADD CONSTRAINT "account_profiles_avatar_asset_id_file_assets_id_fk" FOREIGN KEY ("avatar_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE set null ON UPDATE no action;