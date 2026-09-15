-- Optimizations for slow marketplace filters identified in screenshots (32s for availability, 14s for on_site, etc.)
-- 1. GIN index for working_hours to speed up availability=today filter using @> operator
CREATE INDEX "professional_profiles_working_hours_gin_idx" ON "professional_profiles" USING gin ("working_hours");--> statement-breakpoint
-- 2. Partial indexes for common marketplace filters (fulfilment, pricing, direct booking)
CREATE INDEX "professional_services_fulfilment_marketplace_idx" ON "professional_services" USING btree ("fulfilment_model") WHERE "status" = 'published' AND "moderation_status" = 'clear';--> statement-breakpoint
CREATE INDEX "professional_services_pricing_marketplace_idx" ON "professional_services" USING btree ("pricing_model") WHERE "status" = 'published' AND "moderation_status" = 'clear';--> statement-breakpoint
CREATE INDEX "professional_services_direct_booking_marketplace_idx" ON "professional_services" USING btree ("direct_booking_enabled", "estimated_duration_minutes") WHERE "status" = 'published' AND "moderation_status" = 'clear';--> statement-breakpoint
-- 3. Composite index for verified + topRated filters (verification_status + reputation)
CREATE INDEX "professional_profiles_verification_marketplace_idx" ON "professional_profiles" USING btree ("verification_status");--> statement-breakpoint
-- 4. Index for location filter performance (already have lower(operating_location) and GIN service_areas, add composite for marketplace)
CREATE INDEX "professional_services_location_marketplace_idx" ON "professional_services" USING btree ("id") INCLUDE ("service_areas");--> statement-breakpoint
-- 5. Covering index for image lookup (service_id, position)
CREATE INDEX IF NOT EXISTS "professional_service_images_service_position_idx" ON "professional_service_images" USING btree ("service_id", "position", "id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_assets_service_image_idx" ON "file_assets" USING btree ("id") WHERE "visibility" = 'public' AND "status" = 'ready' AND "purpose" = 'SERVICE_IMAGE';
