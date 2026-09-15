CREATE INDEX "professional_services_marketplace_pagination_idx" ON "professional_services" USING btree ("status","moderation_status","published_at","id");--> statement-breakpoint
CREATE INDEX "professional_services_category_lower_idx" ON "professional_services" USING btree (lower("category"));--> statement-breakpoint
CREATE INDEX "professional_profiles_operating_location_lower_idx" ON "professional_profiles" USING btree (lower("operating_location"));--> statement-breakpoint
CREATE INDEX "professional_reputation_rating_idx" ON "professional_reputation" USING btree ("average_rating_hundredths");
